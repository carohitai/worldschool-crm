"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, todayIST, weekdayIST } from "@/lib/staff";
import { dial, linkusConfigured } from "@/lib/integrations/linkus";
import {
  nextelConfigured,
  sendMissedCallMessage,
} from "@/lib/integrations/nextel";
import type { CallStatus } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const DAILY_TARGET_COUNT = 5;

/**
 * Builds today's call list for the logged-in teacher from the official
 * Parent-Connect call plan (weekday-based, deterministic). Falls back to the
 * least-recently-contacted heuristic only if the teacher has no plan rows.
 */
export async function generateTodayTargets() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("No staff record for this login.");
  const supabase = await createClient();
  const today = todayIST();
  const weekday = weekdayIST();

  const { data: planRows } = await supabase
    .from("call_plan")
    .select("family_id, student_id")
    .eq("staff_id", staff.id)
    .eq("weekday", weekday);

  if (planRows && planRows.length > 0) {
    const { data: existing } = await supabase
      .from("call_targets")
      .select("family_id")
      .eq("staff_id", staff.id)
      .eq("target_date", today);
    const already = new Set((existing ?? []).map((t) => t.family_id));

    const seen = new Set<string>();
    const rows = planRows
      .filter((p) => {
        if (already.has(p.family_id) || seen.has(p.family_id)) return false;
        seen.add(p.family_id);
        return true;
      })
      .map((p) => ({
        staff_id: staff.id,
        target_date: today,
        family_id: p.family_id,
        student_id: p.student_id,
      }));

    if (rows.length === 0) {
      return { created: 0, message: "Today's planned list is already loaded." };
    }
    const { error } = await supabase.from("call_targets").insert(rows);
    if (error) throw new Error(error.message);
    revalidatePath("/today");
    return {
      created: rows.length,
      message: `Loaded ${rows.length} families from the ${weekday} call plan.`,
    };
  }

  const { data: myClasses } = await supabase
    .from("classes")
    .select("id")
    .eq("class_teacher_id", staff.id);
  const classIds = (myClasses ?? []).map((c) => c.id);

  let studentQuery = supabase
    .from("students")
    .select("id, family_id, priority_flag")
    .eq("status", "active");
  if (classIds.length > 0) {
    studentQuery = studentQuery.in("class_id", classIds);
  }
  const { data: students } = await studentQuery;
  if (!students || students.length === 0) {
    return { created: 0, message: "No students found for your classes." };
  }

  const familyIds = [...new Set(students.map((s) => s.family_id))];

  const { data: existing } = await supabase
    .from("call_targets")
    .select("family_id")
    .eq("staff_id", staff.id)
    .eq("target_date", today);
  const alreadyTargeted = new Set((existing ?? []).map((t) => t.family_id));

  const { data: logs } = await supabase
    .from("call_logs")
    .select("family_id, started_at")
    .in("family_id", familyIds)
    .order("started_at", { ascending: false });
  const lastContact = new Map<string, string>();
  for (const log of logs ?? []) {
    if (!lastContact.has(log.family_id)) {
      lastContact.set(log.family_id, log.started_at);
    }
  }

  const priorityFamilies = new Set(
    students.filter((s) => s.priority_flag).map((s) => s.family_id)
  );
  const familyToStudent = new Map<string, string>();
  for (const s of students) {
    if (!familyToStudent.has(s.family_id)) familyToStudent.set(s.family_id, s.id);
  }

  const candidates = familyIds
    .filter((f) => !alreadyTargeted.has(f))
    .sort((a, b) => {
      const pa = priorityFamilies.has(a) ? 0 : 1;
      const pb = priorityFamilies.has(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const la = lastContact.get(a) ?? "";
      const lb = lastContact.get(b) ?? "";
      return la.localeCompare(lb);
    })
    .slice(0, Math.max(0, DAILY_TARGET_COUNT - alreadyTargeted.size));

  if (candidates.length === 0) {
    return { created: 0, message: "Today's list is already complete." };
  }

  const rows = candidates.map((familyId) => ({
    staff_id: staff.id,
    target_date: today,
    family_id: familyId,
    student_id: familyToStudent.get(familyId) ?? null,
  }));
  const { error } = await supabase.from("call_targets").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath("/today");
  return { created: rows.length, message: `Added ${rows.length} families to today's list.` };
}

/**
 * Coordinator/admin: load today's planned calls for ALL teachers at once,
 * so the dashboard tracks completion without each teacher generating a list.
 */
export async function assignAllTodayTargets() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("No staff record for this login.");
  if (staff.role !== "admin" && staff.role !== "coordinator") {
    throw new Error("Only coordinators or admins can assign all targets.");
  }
  const supabase = await createClient();
  const today = todayIST();
  const weekday = weekdayIST();

  const { data: planRows } = await supabase
    .from("call_plan")
    .select("family_id, student_id, staff_id")
    .eq("weekday", weekday)
    .not("staff_id", "is", null);
  if (!planRows || planRows.length === 0) {
    return { created: 0, message: `No planned calls for ${weekday}.` };
  }

  const { data: existing } = await supabase
    .from("call_targets")
    .select("staff_id, family_id")
    .eq("target_date", today);
  const already = new Set(
    (existing ?? []).map((t) => `${t.staff_id}|${t.family_id}`)
  );

  const seen = new Set<string>();
  const rows = planRows
    .filter((p) => {
      const key = `${p.staff_id}|${p.family_id}`;
      if (already.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({
      staff_id: p.staff_id,
      target_date: today,
      family_id: p.family_id,
      student_id: p.student_id,
    }));

  if (rows.length === 0) {
    return { created: 0, message: "Today's plan is already assigned to all teachers." };
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from("call_targets")
      .insert(rows.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/today");
  return {
    created: rows.length,
    message: `Assigned ${rows.length} calls across the team for ${weekday}.`,
  };
}

/**
 * Click-to-call via the school's Yeastar PBX: rings the teacher's Linkus
 * extension first, then connects the parent. Requires YEASTAR_* env vars.
 */
export async function dialViaLinkus(familyId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("No staff record for this login.");
  if (!linkusConfigured()) {
    return { ok: false, message: "Linkus is not connected yet." };
  }
  if (!staff.linkus_extension) {
    return {
      ok: false,
      message: "No Linkus extension is set on your staff record — ask the office to add it.",
    };
  }
  const supabase = await createClient();
  const { data: family } = await supabase
    .from("families")
    .select("primary_phone")
    .eq("id", familyId)
    .maybeSingle();
  if (!family?.primary_phone) {
    return { ok: false, message: "This family has no phone number." };
  }
  const result = await dial(staff.linkus_extension, family.primary_phone);
  return result.ok
    ? { ok: true, message: "Ringing your Linkus — answer to connect the parent." }
    : { ok: false, message: result.error ?? "Dial failed." };
}

/**
 * Manual roster sync from the dashboard (admin/coordinator only) — pulls the
 * students' Excel from OneDrive via Graph and reconciles the CRM.
 */
export async function syncRosterNow() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("No staff record for this login.");
  if (staff.role !== "admin" && staff.role !== "coordinator") {
    throw new Error("Only coordinators or admins can sync the roster.");
  }
  const { downloadRoster } = await import("@/lib/integrations/graph");
  const { syncRoster } = await import("@/lib/sync/roster");
  const supabase = await createClient();

  const buffer = await downloadRoster();
  const result = await syncRoster(supabase, buffer, staff.name);

  revalidatePath("/dashboard");
  revalidatePath("/families");
  revalidatePath("/today");

  if (!result.ok) return { ok: false, message: result.error ?? "Sync failed." };
  return {
    ok: true,
    message:
      `Synced ${result.rosterRows} roster rows — ` +
      `${result.studentsAdded} added, ${result.studentsUpdated} updated, ` +
      `${result.studentsDeactivated} marked left, ${result.phonesUpdated} phone changes` +
      (result.skippedNoMobile ? `, ${result.skippedNoMobile} skipped (no mobile)` : "") +
      ".",
  };
}

export async function logCall(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("No staff record for this login.");
  const supabase = await createClient();

  const targetId = String(formData.get("target_id") ?? "");
  const familyId = String(formData.get("family_id") ?? "");
  const disposition = String(formData.get("disposition")) as CallStatus;
  const topics = formData.getAll("topics").map(String);
  const sentiment = String(formData.get("sentiment") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();
  const durationMin = Number(formData.get("duration_min") ?? 0);
  const actionItem = String(formData.get("action_item") ?? "").trim();

  const { data: log, error } = await supabase
    .from("call_logs")
    .insert({
      call_target_id: targetId || null,
      family_id: familyId,
      staff_id: staff.id,
      disposition,
      topics,
      sentiment: sentiment || null,
      summary: summary || null,
      duration_seconds: durationMin > 0 ? Math.round(durationMin * 60) : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (targetId) {
    await supabase
      .from("call_targets")
      .update({ status: disposition })
      .eq("id", targetId);
  }

  if (actionItem) {
    await supabase.from("action_items").insert({
      call_log_id: log.id,
      family_id: familyId,
      description: actionItem,
      owner_staff_id: staff.id,
    });
  }

  // Parent not reached → WhatsApp "we tried to contact you" via Nextel
  // (official template, opted-in families only). Failures are recorded,
  // never block the call log.
  if (disposition !== "reached" && nextelConfigured()) {
    const { data: family } = await supabase
      .from("families")
      .select(
        "whatsapp_number, primary_phone, whatsapp_opt_in, students(name)"
      )
      .eq("id", familyId)
      .maybeSingle();
    const toPhone = family?.whatsapp_number || family?.primary_phone;
    if (family?.whatsapp_opt_in && toPhone) {
      const studentName =
        (family.students as { name: string }[] | null)?.[0]?.name ?? "your ward";
      const result = await sendMissedCallMessage(toPhone, studentName, staff.name);
      await supabase.from("messages").insert({
        family_id: familyId,
        call_log_id: log.id,
        staff_id: staff.id,
        channel: "whatsapp",
        to_phone: toPhone,
        template: result.template,
        status: result.ok ? "sent" : "failed",
        provider_message_id: result.messageId ?? null,
        error: result.error ?? null,
      });
    }
  }

  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath(`/families/${familyId}`);
}
