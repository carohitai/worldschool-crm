import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, todayIST, weekdayIST } from "@/lib/staff";
import type { CallStatus } from "@/lib/types";
import { AssignAllButton } from "./assign-all-button";
import { SyncButton } from "./sync-button";

const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";

interface TargetRow {
  id: string;
  status: CallStatus;
  staff_id: string;
  staff: { name: string } | null;
  family: { id: string; family_name: string } | null;
  student: { name: string; class: { name: string; section: string } | null } | null;
}
interface LogRow {
  staff_id: string;
  family_id: string;
  disposition: CallStatus;
  sentiment: string | null;
  started_at: string;
  duration_seconds: number | null;
}
interface MsgRow {
  family_id: string;
  status: string;
}
interface SyncRun {
  started_at: string;
  triggered_by: string;
  status: string;
  roster_rows: number | null;
  students_added: number;
  students_updated: number;
  students_deactivated: number;
  phones_updated: number;
  error: string | null;
}

const DISP_CHIP: Record<string, { label: string; cls: string }> = {
  reached: { label: "Answered", cls: "dc-chip-olive" },
  not_reached: { label: "Not answered", cls: "dc-chip-clay" },
  callback: { label: "Callback", cls: "dc-chip-brass" },
  pending: { label: "Pending", cls: "dc-chip-paper" },
};

function timeIST(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Donut({
  segments,
  centerTop,
  centerBottom,
}: {
  segments: { value: number; color: string }[];
  centerTop: string;
  centerBottom: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 25; // start at 12 o'clock
  return (
    <div className="relative h-[176px] w-[176px] flex-none">
      <svg viewBox="0 0 120 120" width="176" height="176" role="img">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--paper-2)" strokeWidth="14" />
        {segments.map((s, i) => {
          const len = (s.value / total) * 100;
          const el = s.value > 0 && (
            <circle
              key={i}
              cx="60" cy="60" r="50" fill="none"
              stroke={s.color} strokeWidth="14" pathLength={100}
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={offset}
            />
          );
          offset -= len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: 30, color: "var(--brand-ink)", lineHeight: 1 }}>{centerTop}</span>
        <span className="mt-1 text-[11px] font-semibold uppercase" style={{ letterSpacing: "0.12em", color: "var(--fg-subtle)" }}>{centerBottom}</span>
      </div>
    </div>
  );
}

function Legend({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  return (
    <div className="flex min-w-[160px] flex-1 flex-col gap-2.5">
      {rows.map((l) => (
        <div key={l.label} className="flex items-center gap-2.5 rounded px-1.5 py-1">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: l.color }} />
          <span className="flex-1 text-sm" style={{ color: "var(--fg-muted)" }}>{l.label}</span>
          <span className="text-sm font-bold" style={{ color: "var(--brand-ink)" }}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  if (staff.role !== "admin" && staff.role !== "coordinator") redirect("/today");

  const supabase = await createClient();
  const today = todayIST();
  const weekday = weekdayIST();
  const dayStart = `${today}T00:00:00+05:30`;

  const [
    targetsRes, logsRes, msgsRes, familiesRes, contactedRes, actionsRes,
    planRes, tbdRes, studentsRes, classesRes, staffRes, syncRes,
  ] = await Promise.all([
    supabase
      .from("call_targets")
      .select("id, status, staff_id, staff(name), family:families(id, family_name), student:students(name, class:classes(name, section))")
      .eq("target_date", today),
    supabase
      .from("call_logs")
      .select("staff_id, family_id, disposition, sentiment, started_at, duration_seconds")
      .gte("started_at", dayStart),
    supabase.from("messages").select("family_id, status").gte("created_at", dayStart),
    supabase.from("families").select("id", { count: "exact", head: true }),
    supabase.from("call_logs").select("family_id"),
    supabase.from("action_items").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("call_plan").select("id", { count: "exact", head: true }).eq("weekday", weekday).not("staff_id", "is", null),
    supabase.from("call_plan").select("student_id").is("staff_id", null),
    supabase.from("students").select("id, class:classes(name)").eq("status", "active"),
    supabase.from("classes").select("name, class_teacher_id, section"),
    supabase.from("staff").select("id", { count: "exact", head: true }),
    supabase
      .from("sync_runs")
      .select("started_at, triggered_by, status, roster_rows, students_added, students_updated, students_deactivated, phones_updated, error")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const targets = (targetsRes.data ?? []) as unknown as TargetRow[];
  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const msgs = (msgsRes.data ?? []) as unknown as MsgRow[];
  const students = (studentsRes.data ?? []) as unknown as { id: string; class: { name: string } | null }[];
  const classes = classesRes.data ?? [];
  const lastSync = syncRes.data as SyncRun | null;

  const plannedToday = planRes.count ?? 0;
  const done = targets.filter((t) => t.status !== "pending").length;
  const contactedFamilies = new Set((contactedRes.data ?? []).map((l) => l.family_id)).size;
  const totalFamilies = familiesRes.count ?? 0;
  const openActions = actionsRes.count ?? 0;
  const negToday = logs.filter((l) => l.sentiment === "negative").length;
  const tbdStudents = new Set((tbdRes.data ?? []).map((r) => r.student_id)).size;

  const byStatus = (s: CallStatus) => targets.filter((t) => t.status === s).length;
  const callSegs = [
    { label: "Answered", value: byStatus("reached"), color: "var(--teal-600)" },
    { label: "Callback", value: byStatus("callback"), color: "var(--brass-500)" },
    { label: "Not answered", value: byStatus("not_reached"), color: "var(--clay-600)" },
    { label: "Pending", value: byStatus("pending"), color: "var(--paper-3)" },
  ];
  const waSent = msgs.filter((m) => m.status === "sent").length;
  const waNot = msgs.filter((m) => m.status !== "sent").length;

  // Standard-wise aggregation
  const stdOrder = ["NUR", "Jr.Kg", "Sr.Kg", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  const stdStudents = new Map<string, number>();
  for (const s of students) {
    const k = s.class?.name ?? "—";
    stdStudents.set(k, (stdStudents.get(k) ?? 0) + 1);
  }
  const famStd = new Map<string, string>();
  for (const t of targets) {
    if (t.family && t.student?.class) famStd.set(t.family.id, t.student.class.name);
  }
  const msgStatusByFam = new Map<string, string>();
  for (const m of msgs) msgStatusByFam.set(m.family_id, m.status);

  const stdRows = [...new Set([...stdStudents.keys()])]
    .sort((a, b) => stdOrder.indexOf(a) - stdOrder.indexOf(b))
    .map((std) => {
      const stdTargets = targets.filter((t) => t.student?.class?.name === std);
      const doneT = stdTargets.filter((t) => t.status !== "pending");
      const stdMsgs = msgs.filter((m) => famStd.get(m.family_id) === std);
      return {
        std,
        students: stdStudents.get(std) ?? 0,
        done: doneT.length,
        answered: stdTargets.filter((t) => t.status === "reached").length,
        notAnswered: stdTargets.filter((t) => t.status === "not_reached" || t.status === "callback").length,
        sent: stdMsgs.filter((m) => m.status === "sent").length,
        notSent: stdMsgs.filter((m) => m.status !== "sent").length,
      };
    });
  const stdTotals = stdRows.reduce(
    (a, r) => ({
      students: a.students + r.students, done: a.done + r.done,
      answered: a.answered + r.answered, notAnswered: a.notAnswered + r.notAnswered,
      sent: a.sent + r.sent, notSent: a.notSent + r.notSent,
    }),
    { students: 0, done: 0, answered: 0, notAnswered: 0, sent: 0, notSent: 0 }
  );

  // Per-teacher accordion data
  const logByKey = new Map<string, LogRow>();
  for (const l of logs) logByKey.set(`${l.staff_id}|${l.family_id}`, l);
  const teacherClass = new Map<string, string>();
  for (const c of classes) {
    if (c.class_teacher_id && !teacherClass.has(c.class_teacher_id)) {
      teacherClass.set(c.class_teacher_id, `Class Teacher · ${c.name}-${c.section}`);
    }
  }
  const teacherMap = new Map<string, { name: string; targets: TargetRow[] }>();
  for (const t of targets) {
    const e = teacherMap.get(t.staff_id) ?? { name: t.staff?.name ?? "Unknown", targets: [] };
    e.targets.push(t);
    teacherMap.set(t.staff_id, e);
  }
  const teachers = [...teacherMap.entries()]
    .map(([id, e]) => {
      const doneN = e.targets.filter((t) => t.status !== "pending").length;
      const waSentN = e.targets.filter(
        (t) => t.family && msgStatusByFam.get(t.family.id) === "sent"
      ).length;
      const waNotN = e.targets.filter(
        (t) => t.family && msgStatusByFam.get(t.family.id) && msgStatusByFam.get(t.family.id) !== "sent"
      ).length;
      return { id, name: e.name, cls: teacherClass.get(id) ?? "Subject Teacher", targets: e.targets, doneN, waSentN, waNotN };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="relative flex flex-col gap-12">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="dc-overline" style={{ fontSize: 12 }}>Parent Connect · Academic Year 2026-27</div>
          <h1 className="dc-h1 mt-1.5">Dashboard</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
            {`A summary of completed calls · ${dateLabel} · ${plannedToday} calls in today's plan`}
          </p>
        </div>
        <AssignAllButton />
      </div>

      {tbdStudents > 0 && (
        <p className="rounded-xl px-4 py-2 text-sm" style={{ border: "1px solid var(--brass-400)", background: "#FBF3DC", color: "var(--brass-700)", marginTop: -24 }}>
          {tbdStudents} pre-primary students have no assigned caller yet — set the NUR / Jr.Kg / Sr.Kg class teachers to include them in the plan.
        </p>
      )}

      <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: tbdStudents > 0 ? -24 : 0 }}>
        <div className="dc-card px-6 py-5">
          <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Calls done today</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="dc-stat">{done}</span>
            <span className="text-[15px]" style={{ color: "var(--fg-subtle)" }}>/ {targets.length}</span>
          </p>
          <p className="mt-1.5 text-[13px] font-semibold" style={{ color: "var(--clay-600)" }}>
            {targets.length - done} not done yet
          </p>
        </div>
        <div className="dc-card px-6 py-5">
          <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Parents contacted</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="dc-stat">{contactedFamilies}</span>
            <span className="text-[15px]" style={{ color: "var(--fg-subtle)" }}>/ {totalFamilies}</span>
          </p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--fg-subtle)" }}>all time, across the school</p>
        </div>
        <div className="dc-card px-6 py-5">
          <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Open action items</p>
          <p className="mt-2"><span className="dc-stat">{openActions}</span></p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--fg-subtle)" }}>follow-ups owned by teachers</p>
        </div>
        <div className="dc-card px-6 py-5" style={{ borderTop: "3px solid var(--clay-600)" }}>
          <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Negative calls today</p>
          <p className="mt-2"><span className="dc-stat" style={{ color: "var(--clay-600)" }}>{negToday}</span></p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--fg-subtle)" }}>needs leadership follow-up</p>
        </div>
      </section>

      <section className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <div className="dc-card p-6">
          <p className="dc-overline">Today&apos;s targets</p>
          <h3 className="mt-1" style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 20, color: "var(--brand-ink)" }}>Calling Status</h3>
          <div className="mt-5 flex flex-wrap items-center gap-8">
            <Donut
              segments={callSegs.map((s) => ({ value: s.value, color: s.color }))}
              centerTop={targets.length ? `${Math.round((done / targets.length) * 100)}%` : "0%"}
              centerBottom="done"
            />
            <Legend rows={callSegs} />
          </div>
        </div>
        <div className="dc-card p-6">
          <p className="dc-overline">Parent messaging</p>
          <h3 className="mt-1" style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 20, color: "var(--brand-ink)" }}>WhatsApp Follow-ups</h3>
          <div className="mt-5 flex flex-wrap items-center gap-8">
            <Donut
              segments={[
                { value: waSent, color: "var(--olive-600)" },
                { value: waNot, color: "var(--clay-600)" },
              ]}
              centerTop={String(waSent)}
              centerBottom="sent"
            />
            <div className="flex min-w-[160px] flex-1 flex-col gap-2.5">
              <Legend rows={[
                { label: "Sent", value: waSent, color: "var(--olive-600)" },
                { label: "Not sent", value: waNot, color: "var(--clay-600)" },
              ]} />
              <p className="mt-1.5 text-[13px] leading-normal" style={{ color: "var(--fg-subtle)" }}>
                Sent automatically when a parent is not reached, to opted-in families only.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="dc-overline">Standard-wise</p>
        <h2 className="dc-h2 mt-1">Calls &amp; Messages by Standard</h2>
        <div className="dc-card mt-4 overflow-x-auto">
          <div style={{ minWidth: 720 }}>
            <div className="dc-thead grid gap-2 px-6 py-3" style={{ gridTemplateColumns: "1.4fr repeat(6, 1fr)", background: "var(--bg-sunken)", borderBottom: "1px solid var(--rule)" }}>
              <span>Standard</span>
              <span className="text-right">Students</span>
              <span className="text-right">Calls done</span>
              <span className="text-right">Answered</span>
              <span className="text-right">Not answered</span>
              <span className="text-right">Msgs sent</span>
              <span className="text-right">Msgs not sent</span>
            </div>
            {stdRows.map((r) => (
              <div key={r.std} className="grid items-center gap-2 px-6 py-3 text-sm" style={{ gridTemplateColumns: "1.4fr repeat(6, 1fr)", borderBottom: "1px solid var(--paper-2)" }}>
                <span className="font-bold" style={{ color: "var(--brand-ink)" }}>{/^\d+$/.test(r.std) ? `Class ${r.std}` : r.std}</span>
                <span className="text-right" style={{ color: "var(--fg-muted)" }}>{r.students}</span>
                <span className="text-right font-semibold">{r.done}</span>
                <span className="text-right font-semibold" style={{ color: "var(--olive-700)" }}>{r.answered}</span>
                <span className="text-right font-semibold" style={{ color: "var(--clay-600)" }}>{r.notAnswered}</span>
                <span className="text-right font-semibold" style={{ color: "var(--olive-700)" }}>{r.sent}</span>
                <span className="text-right font-semibold" style={{ color: r.notSent > 0 ? "var(--clay-600)" : "var(--fg-subtle)" }}>{r.notSent}</span>
              </div>
            ))}
            <div className="grid gap-2 px-6 py-3 text-sm font-bold" style={{ gridTemplateColumns: "1.4fr repeat(6, 1fr)", borderTop: "2px solid var(--brass-500)", color: "var(--brand-ink)" }}>
              <span>Total</span>
              <span className="text-right">{stdTotals.students}</span>
              <span className="text-right">{stdTotals.done}</span>
              <span className="text-right">{stdTotals.answered}</span>
              <span className="text-right">{stdTotals.notAnswered}</span>
              <span className="text-right">{stdTotals.sent}</span>
              <span className="text-right">{stdTotals.notSent}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="dc-overline">By teacher</p>
        <h2 className="dc-h2 mt-1">Target Completion &amp; Messaging</h2>
        <div className="mt-4 flex flex-col gap-3">
          {teachers.length === 0 && (
            <div className="dc-card p-10 text-center text-sm" style={{ color: "var(--fg-subtle)", borderStyle: "dashed" }}>
              No call targets assigned today.
            </div>
          )}
          {teachers.map((t) => (
            <details key={t.id} className="dc-acc dc-card overflow-hidden" style={{ boxShadow: "var(--shadow-xs)" }}>
              <summary className="flex flex-wrap items-center gap-5 px-6 py-4">
                <span className="block min-w-[190px]">
                  <span className="block text-[15px] font-bold" style={{ color: "var(--brand-ink)" }}>{t.name}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--fg-subtle)" }}>{t.cls}</span>
                </span>
                <span className="block min-w-[100px] flex-1">
                  <span className="block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                    <span className="block h-full rounded-full" style={{ background: "var(--brass-500)", width: `${t.targets.length ? (t.doneN / t.targets.length) * 100 : 0}%` }} />
                  </span>
                </span>
                <span className="block min-w-[108px] text-right">
                  <span className="block text-sm font-bold" style={{ color: "var(--brand-ink)" }}>{t.doneN} / {t.targets.length} done</span>
                  <span className="mt-0.5 block text-xs font-semibold" style={{ color: t.doneN === t.targets.length ? "var(--olive-700)" : "var(--clay-600)" }}>
                    {t.doneN === t.targets.length ? "complete" : `${t.targets.length - t.doneN} pending`}
                  </span>
                </span>
                <span className="flex min-w-[120px] justify-end gap-2">
                  {t.waSentN > 0 && <span className="dc-chip dc-chip-olive">{t.waSentN} sent</span>}
                  {t.waNotN > 0 && <span className="dc-chip dc-chip-clay">{t.waNotN} not sent</span>}
                </span>
                <span className="dc-chev flex" style={{ color: "var(--earth-600)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </summary>
              <div className="px-6 pb-4 pt-2" style={{ borderTop: "1px solid var(--rule)" }}>
                {t.targets.map((tg) => {
                  const log = tg.family ? logByKey.get(`${t.id}|${tg.family.id}`) : undefined;
                  const wa = tg.family ? msgStatusByFam.get(tg.family.id) : undefined;
                  const chip = DISP_CHIP[tg.status] ?? DISP_CHIP.pending;
                  return (
                    <div key={tg.id} className="grid items-center gap-4 py-2.5" style={{ gridTemplateColumns: "1.3fr auto 1fr", borderBottom: "1px solid var(--paper-2)" }}>
                      <span className="text-sm font-semibold">{tg.family?.family_name ?? "—"}</span>
                      <span className={`dc-chip ${chip.cls}`}>{chip.label}</span>
                      <span className="flex justify-end gap-3.5 text-[13px]" style={{ color: "var(--fg-subtle)" }}>
                        <span>{log ? timeIST(log.started_at) : "—"}</span>
                        {log?.duration_seconds != null && <span>{Math.round(log.duration_seconds / 60)} min</span>}
                        {wa && (
                          <span className="font-semibold" style={{ color: wa === "sent" ? "var(--olive-700)" : "var(--clay-600)" }}>
                            WA {wa === "sent" ? "sent" : "failed"}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <p className="dc-overline">Administration</p>
        <h2 className="dc-h2 mt-1">School Data &amp; Roster Sync</h2>
        <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div className="dc-card px-6 py-5">
            <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Total students</p>
            <p className="dc-stat mt-2">{students.length.toLocaleString("en-IN")}</p>
          </div>
          <div className="dc-card px-6 py-5">
            <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Classes</p>
            <p className="dc-stat mt-2">{new Set(classes.map((c) => c.name)).size}</p>
          </div>
          <div className="dc-card px-6 py-5">
            <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Divisions</p>
            <p className="dc-stat mt-2">{classes.length}</p>
          </div>
          <div className="dc-card px-6 py-5">
            <p className="dc-thead" style={{ letterSpacing: "0.12em" }}>Staff</p>
            <p className="dc-stat mt-2">{staffRes.count ?? 0}</p>
          </div>
        </div>
        <div className="dc-card mt-3 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {lastSync ? (
              <>
                <span className={`dc-chip mr-2 ${lastSync.status === "success" ? "dc-chip-olive" : lastSync.status === "failed" ? "dc-chip-clay" : "dc-chip-brass"}`}>
                  {lastSync.status}
                </span>
                Last roster sync:{" "}
                {new Date(lastSync.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}{" "}
                · by {lastSync.triggered_by}
                {lastSync.status === "success" && (
                  <> · {lastSync.roster_rows} rows — {lastSync.students_added} added, {lastSync.students_updated} updated, {lastSync.students_deactivated} left, {lastSync.phones_updated} phone changes</>
                )}
                {lastSync.error && <span style={{ color: "var(--clay-600)" }}> · {lastSync.error}</span>}
              </>
            ) : (
              "Roster has never been synced — nightly sync runs at 2:00 AM IST."
            )}
          </div>
          <SyncButton />
        </div>
      </section>
    </div>
  );
}
