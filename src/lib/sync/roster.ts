/**
 * Roster sync — reconciles the CRM with the school's Excel roster
 * (`Student Log Data` sheet of the Fees Collection Report on OneDrive).
 *
 * Rules:
 * - The Excel is the source of truth for the roster (names, classes, phones,
 *   student type). The CRM is the source of truth for everything it generates
 *   (call logs, opt-ins, priority flags, action items) — never touched here.
 * - Students are matched by name+class (then name); families by parent mobile.
 * - Students missing from the roster are marked inactive, never deleted.
 * - New students are slotted into the call plan under their class teacher's
 *   lightest weekday.
 * - Safety guards: abort when the sheet looks wrong (<600 rows) or the diff
 *   is implausible (>40 deactivations).
 */
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

// Column letters per the handover spec (§3a): C, D, E, AD, AE, AF
const COL = { name: 2, klass: 3, section: 4, mobile: 29, alt: 30, type: 31 };
const SHEET = "Student Log Data";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIN_ROWS = 600;
const MAX_DEACTIVATIONS = 40;

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const stdName = (s: string) => s.replace(/^Class\s+/i, "").trim();
const phoneKey = (s: string) => {
  const d = String(s ?? "").replace(/[^\d]/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};

interface RosterRow {
  name: string;
  klass: string;
  section: string;
  mobile: string;
  alt: string;
  type: string;
}

export interface SyncResult {
  ok: boolean;
  rosterRows: number;
  studentsAdded: number;
  studentsUpdated: number;
  studentsDeactivated: number;
  familiesAdded: number;
  phonesUpdated: number;
  skippedNoMobile: number;
  error?: string;
}

function parseRoster(buffer: Buffer): RosterRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === SHEET.toLowerCase()) ??
    wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const out: RosterRow[] = [];
  for (const r of rows) {
    const name = String(r[COL.name] ?? "").trim();
    const klass = String(r[COL.klass] ?? "").trim();
    if (!name || !klass) continue;
    if (/student\s*name/i.test(name)) continue; // header row
    out.push({
      name: titleCase(name),
      klass: stdName(klass),
      section: (String(r[COL.section] ?? "").trim() || "—").toUpperCase(),
      mobile: phoneKey(String(r[COL.mobile] ?? "")),
      alt: String(r[COL.alt] ?? "").trim(),
      type: String(r[COL.type] ?? "").trim() || "OLD",
    });
  }
  return out;
}

export async function syncRoster(
  supabase: SupabaseClient,
  buffer: Buffer,
  triggeredBy: string
): Promise<SyncResult> {
  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ triggered_by: triggeredBy, source: process.env.ROSTER_LOCAL_PATH ? "local" : "graph" })
    .select("id")
    .single();
  const runId = run?.id;

  const fail = async (error: string, rosterRows = 0): Promise<SyncResult> => {
    if (runId) {
      await supabase
        .from("sync_runs")
        .update({ status: "failed", error, roster_rows: rosterRows, finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    return {
      ok: false, error, rosterRows,
      studentsAdded: 0, studentsUpdated: 0, studentsDeactivated: 0,
      familiesAdded: 0, phonesUpdated: 0, skippedNoMobile: 0,
    };
  };

  let roster: RosterRow[];
  try {
    roster = parseRoster(buffer);
  } catch (e) {
    return fail(`Could not parse roster: ${e instanceof Error ? e.message : e}`);
  }
  if (roster.length < MIN_ROWS) {
    return fail(
      `Roster has only ${roster.length} rows (expected 600+) — sheet layout may have changed; sync aborted.`,
      roster.length
    );
  }

  const [{ data: classes }, { data: students }, { data: families }, { data: plan }] =
    await Promise.all([
      supabase.from("classes").select("id, name, section, class_teacher_id"),
      supabase.from("students").select("id, name, family_id, class_id, status, student_type"),
      supabase.from("families").select("id, family_name, primary_phone"),
      supabase.from("call_plan").select("staff_id, weekday"),
    ]);

  const classByKey = new Map(
    (classes ?? []).map((c) => [`${c.name}|${c.section}`, c])
  );
  const famByPhone = new Map(
    (families ?? []).map((f) => [phoneKey(f.primary_phone ?? ""), f])
  );
  const studentByNameClass = new Map<string, (typeof students extends (infer T)[] | null ? T : never)>();
  const studentsByName = new Map<string, typeof studentByNameClass extends Map<string, infer T> ? T[] : never>();
  for (const s of students ?? []) {
    studentByNameClass.set(`${s.name.toLowerCase()}|${s.class_id ?? ""}`, s);
    const arr = studentsByName.get(s.name.toLowerCase()) ?? [];
    arr.push(s);
    studentsByName.set(s.name.toLowerCase(), arr);
  }
  const planLoad = new Map<string, number>();
  for (const p of plan ?? []) {
    if (!p.staff_id) continue;
    const k = `${p.staff_id}|${p.weekday}`;
    planLoad.set(k, (planLoad.get(k) ?? 0) + 1);
  }

  let added = 0, updated = 0, familiesAdded = 0, phonesUpdated = 0, skippedNoMobile = 0;
  const details: Record<string, string[]> = { added: [], updated: [], deactivated: [], phone_changes: [] };
  const note = (k: string, v: string) => { if (details[k].length < 50) details[k].push(v); };
  const seenStudentIds = new Set<string>();

  for (const row of roster) {
    const classKey = `${row.klass}|${row.section}`;
    let klass = classByKey.get(classKey);
    if (!klass) {
      const { data: created } = await supabase
        .from("classes")
        .insert({ name: row.klass, section: row.section })
        .select("id, name, section, class_teacher_id")
        .single();
      if (!created) continue;
      klass = created;
      classByKey.set(classKey, klass);
    }

    let student =
      studentByNameClass.get(`${row.name.toLowerCase()}|${klass.id}`) ??
      (studentsByName.get(row.name.toLowerCase())?.length === 1
        ? studentsByName.get(row.name.toLowerCase())![0]
        : undefined);

    if (student) {
      seenStudentIds.add(student.id);
      const changes: Record<string, unknown> = {};
      if (student.class_id !== klass.id) changes.class_id = klass.id;
      if (student.student_type !== row.type) changes.student_type = row.type;
      if (student.status !== "active") changes.status = "active";
      if (Object.keys(changes).length > 0) {
        await supabase.from("students").update(changes).eq("id", student.id);
        updated += 1;
        note("updated", `${row.name} (${Object.keys(changes).join(", ")})`);
      }
      // Phone drift: roster phone differs from the family's phone on file
      if (row.mobile) {
        const fam = (families ?? []).find((f) => f.id === student!.family_id);
        if (fam && phoneKey(fam.primary_phone ?? "") !== row.mobile) {
          await supabase
            .from("families")
            .update({ primary_phone: row.mobile })
            .eq("id", fam.id);
          phonesUpdated += 1;
          note("phone_changes", `${fam.family_name} (${row.name})`);
        }
      }
      continue;
    }

    // New student
    if (!row.mobile) {
      skippedNoMobile += 1;
      note("added", `${row.name} — SKIPPED (no mobile)`);
      continue;
    }
    let fam = famByPhone.get(row.mobile);
    if (!fam) {
      const surname = titleCase(row.name.split(/\s+/).at(-1) ?? "Family");
      const { data: createdFam } = await supabase
        .from("families")
        .insert({
          family_name: `${surname} Family`,
          primary_phone: row.mobile,
          notes: row.alt ? `Alt: ${row.alt}` : null,
        })
        .select("id, family_name, primary_phone")
        .single();
      if (!createdFam) continue;
      fam = createdFam;
      famByPhone.set(row.mobile, fam);
      families?.push(fam);
      familiesAdded += 1;
    }
    const { data: createdStudent } = await supabase
      .from("students")
      .insert({
        name: row.name,
        family_id: fam.id,
        class_id: klass.id,
        student_type: row.type,
        priority_flag: row.type === "RTE" || row.type === "New Reg",
        priority_reason:
          row.type === "RTE" ? "RTE student" : row.type === "New Reg" ? "New admission" : null,
      })
      .select("id")
      .single();
    if (!createdStudent) continue;
    added += 1;
    note("added", `${row.name} (${row.klass}-${row.section})`);

    // Call-plan slot: class teacher's lightest weekday
    const teacherId = klass.class_teacher_id;
    let weekday = WEEKDAYS[0];
    if (teacherId) {
      weekday = WEEKDAYS.reduce((best, d) =>
        (planLoad.get(`${teacherId}|${d}`) ?? 0) < (planLoad.get(`${teacherId}|${best}`) ?? 0) ? d : best
      );
      planLoad.set(`${teacherId}|${weekday}`, (planLoad.get(`${teacherId}|${weekday}`) ?? 0) + 1);
    }
    await supabase.from("call_plan").insert({
      weekday,
      student_id: createdStudent.id,
      family_id: fam.id,
      staff_id: teacherId ?? null,
      caller_label: teacherId ? "Class teacher (new admission)" : "TBD (new admission)",
    });
  }

  // Deactivate active students no longer in the roster
  const toDeactivate = (students ?? []).filter(
    (s) => s.status === "active" && !seenStudentIds.has(s.id)
  );
  if (toDeactivate.length > MAX_DEACTIVATIONS) {
    return fail(
      `${toDeactivate.length} students would be deactivated (cap ${MAX_DEACTIVATIONS}) — implausible diff; sync aborted.`,
      roster.length
    );
  }
  for (const s of toDeactivate) {
    await supabase.from("students").update({ status: "inactive" }).eq("id", s.id);
    await supabase.from("call_plan").delete().eq("student_id", s.id);
    note("deactivated", s.name);
  }

  if (runId) {
    await supabase
      .from("sync_runs")
      .update({
        status: "success",
        roster_rows: roster.length,
        students_added: added,
        students_updated: updated,
        students_deactivated: toDeactivate.length,
        families_added: familiesAdded,
        phones_updated: phonesUpdated,
        skipped_no_mobile: skippedNoMobile,
        details,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  return {
    ok: true,
    rosterRows: roster.length,
    studentsAdded: added,
    studentsUpdated: updated,
    studentsDeactivated: toDeactivate.length,
    familiesAdded,
    phonesUpdated,
    skippedNoMobile,
  };
}
