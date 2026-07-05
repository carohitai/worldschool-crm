import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, todayIST } from "@/lib/staff";
import type { CallStatus } from "@/lib/types";
import { LogCallForm } from "./log-call-form";
import { GenerateButton } from "./generate-button";
import { DialButton } from "./dial-button";

const LINKUS_ENABLED = process.env.NEXT_PUBLIC_LINKUS === "1";
const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";

interface TargetRow {
  id: string;
  status: CallStatus;
  family: { id: string; family_name: string; primary_phone: string | null } | null;
  student: { name: string; class: { name: string; section: string } | null } | null;
}
interface LogRow {
  family_id: string;
  disposition: CallStatus;
  started_at: string;
}
interface MsgRow {
  family_id: string;
  status: string;
}

const DISP_CHIP: Record<string, { label: string; cls: string }> = {
  reached: { label: "Answered", cls: "dc-chip-olive" },
  not_reached: { label: "Not answered", cls: "dc-chip-clay" },
  callback: { label: "Callback", cls: "dc-chip-brass" },
};

export default async function TodayPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  const supabase = await createClient();
  const today = todayIST();
  const dayStart = `${today}T00:00:00+05:30`;

  const [targetsRes, logsRes, msgsRes] = await Promise.all([
    supabase
      .from("call_targets")
      .select(
        "id, status, family:families(id, family_name, primary_phone), student:students(name, class:classes(name, section))"
      )
      .eq("staff_id", staff.id)
      .eq("target_date", today)
      .order("created_at"),
    supabase
      .from("call_logs")
      .select("family_id, disposition, started_at")
      .eq("staff_id", staff.id)
      .gte("started_at", dayStart),
    supabase.from("messages").select("family_id, status").eq("staff_id", staff.id).gte("created_at", dayStart),
  ]);

  const targets = (targetsRes.data ?? []) as unknown as TargetRow[];
  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const msgs = (msgsRes.data ?? []) as unknown as MsgRow[];
  const logByFam = new Map(logs.map((l) => [l.family_id, l]));
  const msgByFam = new Map(msgs.map((m) => [m.family_id, m.status]));

  const pending = targets.filter((t) => t.status === "pending");
  const completed = targets.filter((t) => t.status !== "pending");

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const clsLabel = (t: TargetRow) =>
    t.student
      ? `${t.student.name}${t.student.class ? ` · ${/^\d+$/.test(t.student.class.name) ? "Class " : ""}${t.student.class.name}-${t.student.class.section}` : ""}`
      : "";

  return (
    <div className="relative flex flex-col gap-10">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="dc-overline" style={{ fontSize: 12 }}>Today&apos;s calling</div>
          <h1 className="dc-h1 mt-1.5">Parent Connect</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
            {`${dateLabel} · report the day's calling here`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="dc-chip dc-chip-clay" style={{ fontSize: 13, padding: "6px 14px" }}>{pending.length} pending</span>
          <span className="dc-chip dc-chip-olive" style={{ fontSize: 13, padding: "6px 14px" }}>{completed.length} done</span>
          <GenerateButton />
        </div>
      </div>

      <section>
        <h2 className="dc-h2">Pending Calls</h2>
        <div className="mt-4 flex flex-col gap-3">
          {pending.map((t) => (
            <div key={t.id} className="dc-card overflow-hidden" style={{ boxShadow: "var(--shadow-xs)" }}>
              <div className="flex flex-wrap items-center gap-5 px-6 py-4">
                <span className="min-w-[200px] flex-1">
                  <span className="block text-[15px] font-bold" style={{ color: "var(--brand-ink)" }}>{t.family?.family_name ?? "—"}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--fg-subtle)" }}>{clsLabel(t)}</span>
                </span>
                {t.family?.primary_phone && (
                  <a href={`tel:${t.family.primary_phone}`} className="text-sm font-semibold" style={{ color: "var(--teal-700)" }}>
                    📞 {t.family.primary_phone}
                  </a>
                )}
                {LINKUS_ENABLED && t.family && <DialButton familyId={t.family.id} />}
                <span className="dc-chip dc-chip-paper">Pending</span>
                {t.family && <LogCallForm targetId={t.id} familyId={t.family.id} />}
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="rounded-xl p-10 text-center text-sm font-semibold" style={{ border: "1px dashed var(--rule-strong)", background: "var(--bg-elevated)", color: "var(--olive-700)" }}>
              {targets.length === 0
                ? "No call targets for today yet — use “Generate today’s call list” above."
                : "All of today’s calls are logged. Well done."}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="dc-h2">Completed Today</h2>
        <div className="dc-card mt-4 px-6 py-1">
          <div className="dc-thead grid gap-4 py-3" style={{ gridTemplateColumns: "0.9fr 1.8fr auto 1.2fr", borderBottom: "1px solid var(--rule)" }}>
            <span>Standard</span>
            <span>Family</span>
            <span>Status</span>
            <span className="text-right">Time · WhatsApp</span>
          </div>
          {completed.map((t) => {
            const log = t.family ? logByFam.get(t.family.id) : undefined;
            const wa = t.family ? msgByFam.get(t.family.id) : undefined;
            const chip = DISP_CHIP[t.status] ?? { label: t.status, cls: "dc-chip-paper" };
            return (
              <div key={t.id} className="grid items-center gap-4 py-3" style={{ gridTemplateColumns: "0.9fr 1.8fr auto 1.2fr", borderBottom: "1px solid var(--paper-2)" }}>
                <span className="text-sm font-bold" style={{ color: "var(--brand-ink)" }}>
                  {t.student?.class ? `${t.student.class.name}-${t.student.class.section}` : "—"}
                </span>
                <span className="text-sm font-semibold">{t.family?.family_name}</span>
                <span className={`dc-chip ${chip.cls}`}>{chip.label}</span>
                <span className="flex justify-end gap-3.5 text-[13px]" style={{ color: "var(--fg-subtle)" }}>
                  <span>
                    {log
                      ? new Date(log.started_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })
                      : "—"}
                  </span>
                  {wa && (
                    <span className="font-semibold" style={{ color: wa === "sent" ? "var(--olive-700)" : "var(--clay-600)" }}>
                      WA {wa === "sent" ? "sent" : "failed"}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {completed.length === 0 && (
            <p className="py-6 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>Nothing logged yet today.</p>
          )}
        </div>
      </section>
    </div>
  );
}
