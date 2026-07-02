/**
 * One-time import of the TWS Teacher-Load handoff CSVs into the CRM database.
 * Runs locally; signs in as the admin account so RLS policies apply.
 *
 * Usage: node scripts/import-handoff.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const HANDOFF_DIR =
  process.env.HANDOFF_DIR ??
  path.join(
    process.env.HOME,
    "Documents/Claude/Projects/The World School MIS/Teacher Teaching Load Dashboard/handoff"
  );

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const titleCase = (s) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const emailSlug = (name) =>
  name
    .replace(/^(Ms\.|Mr\.|Mrs\.)\s*/i, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "") + "@tws.local";

const stdName = (standard) => standard.replace(/^Class\s+/i, "");

async function insertBatched(table, rows, select) {
  const out = [];
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { data, error } = await supabase.from(table).insert(chunk).select(select);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
  }
  return out;
}

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@worldschool.demo",
    password: "Demo@1234",
  });
  if (authErr) throw new Error(`auth: ${authErr.message}`);

  const teachers = parseCSV(readFileSync(path.join(HANDOFF_DIR, "teachers_master.csv"), "utf8"));
  const sectionMap = parseCSV(readFileSync(path.join(HANDOFF_DIR, "section_class_teacher_map.csv"), "utf8"));
  const callPlan = parseCSV(readFileSync(path.join(HANDOFF_DIR, "call_plan_full.csv"), "utf8"));

  // 1) Staff — Director gets his real email + admin role
  const staffRows = teachers.map((t) => {
    const isDirector = /rohit k/i.test(t.teacher);
    return {
      name: t.teacher.trim(),
      email: isDirector ? "carohitkolte@gmail.com" : emailSlug(t.teacher),
      role: isDirector ? "admin" : "teacher",
    };
  });
  const staff = await insertBatched("staff", staffRows, "id, name");
  const staffByName = new Map(staff.map((s) => [s.name.toLowerCase(), s.id]));
  const findStaff = (name) => staffByName.get(name.trim().toLowerCase()) ?? null;

  // 2) Classes from the section map (TBD / blank class teachers stay null)
  const classRows = sectionMap.map((r) => ({
    name: stdName(r.standard),
    section: r.section_house || "—",
    class_teacher_id: r["class_teacher(s)"].includes("TBD")
      ? null
      : findStaff(r["class_teacher(s)"]),
  }));
  const classes = await insertBatched("classes", classRows, "id, name, section");
  const classKey = (std, house) => `${stdName(std)}|${house || "—"}`;
  const classByKey = new Map(classes.map((c) => [`${c.name}|${c.section}`, c.id]));

  // Any (standard, section) present in the plan but missing from the map
  const missing = new Map();
  for (const r of callPlan) {
    const k = classKey(r.standard, r.section_house);
    if (!classByKey.has(k) && !missing.has(k)) {
      missing.set(k, { name: stdName(r.standard), section: r.section_house || "—", class_teacher_id: null });
    }
  }
  if (missing.size) {
    const extra = await insertBatched("classes", [...missing.values()], "id, name, section");
    extra.forEach((c) => classByKey.set(`${c.name}|${c.section}`, c.id));
  }

  // 3) Families — siblings share the parent mobile, so dedupe on it
  const famByPhone = new Map();
  for (const r of callPlan) {
    const phone = r.parent_mobile.trim();
    if (!famByPhone.has(phone)) {
      const surname = titleCase(r.student.trim().split(/\s+/).at(-1));
      famByPhone.set(phone, {
        family_name: `${surname} Family`,
        primary_phone: phone,
        notes: r.alt_phone ? `Alt: ${r.alt_phone.trim()}` : null,
      });
    }
  }
  const families = await insertBatched("families", [...famByPhone.values()], "id, primary_phone");
  const famIdByPhone = new Map(families.map((f) => [f.primary_phone, f.id]));

  // 4) Students (order-preserving insert so we can map ids back)
  const studentRows = callPlan.map((r) => ({
    name: titleCase(r.student),
    family_id: famIdByPhone.get(r.parent_mobile.trim()),
    class_id: classByKey.get(classKey(r.standard, r.section_house)),
    student_type: r.student_type || "OLD",
    priority_flag: r.student_type === "RTE" || r.student_type === "New Reg",
    priority_reason:
      r.student_type === "RTE" ? "RTE student" : r.student_type === "New Reg" ? "New admission" : null,
  }));
  const students = await insertBatched("students", studentRows, "id");
  if (students.length !== callPlan.length)
    throw new Error(`student count mismatch: ${students.length} vs ${callPlan.length}`);

  // 5) Call plan rows (TBD pre-primary callers keep staff_id null)
  const planRows = callPlan.map((r, i) => ({
    weekday: r.day,
    student_id: students[i].id,
    family_id: studentRows[i].family_id,
    staff_id: findStaff(r.caller),
    caller_label: r.caller.trim(),
  }));
  await insertBatched("call_plan", planRows, "id");

  const unassigned = planRows.filter((p) => !p.staff_id).length;
  console.log(
    JSON.stringify(
      {
        staff: staff.length,
        classes: classByKey.size,
        families: families.length,
        students: students.length,
        call_plan: planRows.length,
        plan_rows_without_caller: unassigned,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
