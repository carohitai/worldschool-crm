import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff";
import { searchCdr, linkusConfigured, type CdrRecord } from "@/lib/integrations/linkus";
import type { CallStatus } from "@/lib/types";

const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";
const STD_ORDER = ["NUR", "Jr.Kg", "Sr.Kg", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "—"];

interface HistLog {
  id: string;
  started_at: string;
  disposition: CallStatus;
  sentiment: string | null;
  staff: { name: string } | null;
  family: {
    family_name: string;
    students: { class: { name: string; section: string } | null }[];
  } | null;
}

const SENT_CHIP: Record<string, string> = {
  positive: "dc-chip-olive",
  neutral: "dc-chip-paper",
  negative: "dc-chip-clay",
};

/** PBX renders parties as "Display Name<number>" — split them. */
const partyNum = (s: string) => {
  const m = /<([^>]*)>/.exec(s ?? "");
  return (m ? m[1] : (s ?? "")).replace(/[^\d]/g, "");
};
const partyName = (s: string) => {
  const i = (s ?? "").indexOf("<");
  return i > 0 ? s.slice(0, i).trim() : "";
};
const last10 = (s: string) => {
  const d = partyNum(s);
  return d.length >= 10 ? d.slice(-10) : d;
};

/** CDR time comes as "DD/MM/YYYY HH:MM:SS AM/PM" (PBX local, IST). */
function parseStart(s: string): Date | null {
  const dm = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(s ?? "");
  if (dm) {
    let h = Number(dm[4]);
    const mer = dm[7]?.toUpperCase();
    if (mer === "PM" && h < 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    return new Date(
      `${dm[3]}-${dm[2]}-${dm[1]}T${String(h).padStart(2, "0")}:${dm[5]}:${dm[6] ?? "00"}+05:30`
    );
  }
  const iso = new Date((s ?? "").replace(" ", "T") + "+05:30");
  return isNaN(iso.getTime()) ? null : iso;
}

function fmtDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

const fmtTime = (d: Date | null) =>
  d
    ? d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })
    : "—";
const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })
    : "—";

export default async function HistoryPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  const supabase = await createClient();

  const [logsRes, familiesRes, staffRes, cdr] = await Promise.all([
    supabase
      .from("call_logs")
      .select(
        "id, started_at, disposition, sentiment, staff(name), family:families(family_name, students(class:classes(name, section)))"
      )
      .order("started_at", { ascending: false })
      .limit(500),
    supabase
      .from("families")
      .select("family_name, primary_phone, students(name, status, class:classes(name, section))"),
    supabase.from("staff").select("name, linkus_extension").not("linkus_extension", "is", null),
    linkusConfigured() ? searchCdr(200) : Promise.resolve({ ok: false, records: [], error: "Linkus is not configured yet." }),
  ]);

  const logs = (logsRes.data ?? []) as unknown as HistLog[];
  interface FamInfo {
    name: string;
    students: string;
    standard: string;
  }
  const famByPhone = new Map<string, FamInfo>(
    (
      (familiesRes.data ?? []) as unknown as {
        family_name: string;
        primary_phone: string | null;
        students: { name: string; status: string; class: { name: string; section: string } | null }[];
      }[]
    )
      .filter((f) => f.primary_phone)
      .map((f) => {
        const kids = (f.students ?? []).filter((s) => s.status === "active");
        const standards = [
          ...new Set(
            kids.map((s) => (s.class ? `${s.class.name}-${s.class.section}` : "—"))
          ),
        ];
        return [
          last10(f.primary_phone!),
          {
            name: f.family_name,
            students: kids.map((s) => s.name).join(", "),
            standard: standards.join(", "),
          },
        ];
      })
  );
  const staffByExt = new Map(
    (staffRes.data ?? []).map((s) => [s.linkus_extension as string, s.name])
  );

  // School-relevant external calls only: the internal side must be a CRM
  // staff extension, or the external side a known family. This keeps the
  // CA-firm's calls (same shared PBX) and internal traffic out.
  const calls = (cdr.records as CdrRecord[])
    .map((r) => {
      const isOutbound = !/inbound/i.test(r.type);
      const external = isOutbound ? r.to : r.from;
      const internal = isOutbound ? r.from : r.to;
      const start = parseStart(r.startTime);
      return {
        ...r,
        isOutbound,
        start,
        externalNum: partyNum(external),
        externalName: partyName(external),
        internalExt: partyNum(internal),
        internalName: partyName(internal),
        callerName: staffByExt.get(partyNum(internal)) ?? null,
        familyName: famByPhone.get(last10(external))?.name ?? null,
        studentNames: famByPhone.get(last10(external))?.students ?? "",
        standard: famByPhone.get(last10(external))?.standard ?? "",
      };
    })
    .filter((r) => !/internal/i.test(r.type) && (r.callerName || r.familyName))
    .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));

  // Grouped teacher-logged reports (unchanged)
  const groups = new Map<string, Map<string, HistLog[]>>();
  for (const l of logs) {
    const cls = l.family?.students?.[0]?.class;
    const std = cls?.name ?? "—";
    const div = cls ? `${cls.name}-${cls.section}` : "—";
    if (!groups.has(std)) groups.set(std, new Map());
    const divs = groups.get(std)!;
    if (!divs.has(div)) divs.set(div, []);
    divs.get(div)!.push(l);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => STD_ORDER.indexOf(a[0]) - STD_ORDER.indexOf(b[0])
  );

  return (
    <div className="relative flex flex-col gap-10">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise">
        <div className="dc-overline" style={{ fontSize: 12 }}>Earlier calling</div>
        <h1 className="dc-h1 mt-1.5">History</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
          Every call made through the school phone system, and teacher-logged reports
        </p>
      </div>

      <section>
        <p className="dc-overline">Phone system (Linkus)</p>
        <h2 className="dc-h2 mt-1">All Calls</h2>
        {!cdr.ok && (
          <p className="dc-card mt-4 p-6 text-sm" style={{ color: "var(--clay-600)" }}>
            Could not load call records from the PBX: {cdr.error}
          </p>
        )}
        {cdr.ok && (
          <div className="dc-card mt-4 overflow-x-auto">
            <div style={{ minWidth: 1150 }}>
              <div className="dc-thead grid gap-3 px-6 py-3" style={{ gridTemplateColumns: "1fr 1.5fr 1.5fr 0.8fr 1.1fr 1.2fr 0.7fr 0.7fr 0.8fr 0.9fr", background: "var(--bg-sunken)", borderBottom: "1px solid var(--rule)" }}>
                <span>Date</span>
                <span>Parent / Contact</span>
                <span>Student</span>
                <span>Standard</span>
                <span>Number</span>
                <span>Called by (Ext.)</span>
                <span>Start</span>
                <span>End</span>
                <span>Duration</span>
                <span>Status</span>
              </div>
              {calls.map((r) => {
                const answered = /answer/i.test(r.disposition) && !/no\s*answer/i.test(r.disposition);
                const end =
                  r.start && r.durationSec
                    ? fmtTime(new Date(r.start.getTime() + r.durationSec * 1000))
                    : "—";
                return (
                  <div key={r.id} className="grid items-center gap-3 px-6 py-3 text-sm" style={{ gridTemplateColumns: "1fr 1.5fr 1.5fr 0.8fr 1.1fr 1.2fr 0.7fr 0.7fr 0.8fr 0.9fr", borderBottom: "1px solid var(--paper-2)" }}>
                    <span style={{ color: "var(--fg-muted)" }}>{fmtDate(r.start)}</span>
                    <span className="font-semibold" style={{ color: r.familyName ? "var(--brand-ink)" : "var(--fg-subtle)" }}>
                      {r.familyName ?? (r.externalName || "Unknown")}
                      {!r.isOutbound && <span className="dc-chip dc-chip-teal ml-2">in</span>}
                    </span>
                    <span style={{ color: "var(--fg-muted)" }}>{r.studentNames || "—"}</span>
                    <span className="font-semibold" style={{ color: "var(--brand-ink)" }}>{r.standard || "—"}</span>
                    <span style={{ color: "var(--fg-muted)" }}>{r.externalNum || "—"}</span>
                    <span style={{ color: "var(--fg-muted)" }}>
                      {r.callerName ?? r.internalName ?? "—"}
                      {r.internalExt && (
                        <span className="dc-chip dc-chip-teal ml-1.5" style={{ fontSize: 11 }}>
                          {r.internalExt}
                        </span>
                      )}
                    </span>
                    <span style={{ color: "var(--fg-subtle)" }}>{fmtTime(r.start)}</span>
                    <span style={{ color: "var(--fg-subtle)" }}>{end}</span>
                    <span style={{ color: "var(--fg-subtle)" }}>{fmtDuration(r.talkSec || r.durationSec)}</span>
                    <span className={`dc-chip ${answered ? "dc-chip-olive" : "dc-chip-clay"}`}>
                      {answered ? "Answered" : r.disposition || "—"}
                    </span>
                  </div>
                );
              })}
              {calls.length === 0 && (
                <p className="px-6 py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                  No calls recorded on the phone system yet.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <p className="dc-overline">Teacher reports</p>
        <h2 className="dc-h2 mt-1">Logged Calls · Standard &gt; Division</h2>
        <div className="mt-4 flex flex-col gap-3">
          {ordered.length === 0 && (
            <div className="dc-card p-10 text-center text-sm" style={{ color: "var(--fg-subtle)", borderStyle: "dashed" }}>
              No calls logged yet.
            </div>
          )}
          {ordered.map(([std, divs]) => {
            const count = [...divs.values()].reduce((a, c) => a + c.length, 0);
            return (
              <details key={std} className="dc-acc dc-card overflow-hidden" style={{ boxShadow: "var(--shadow-xs)" }}>
                <summary className="flex items-center gap-4 px-6 py-4">
                  <span className="flex-1" style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 18, color: "var(--brand-ink)" }}>
                    {/^\d+$/.test(std) ? `Class ${std}` : std}
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--fg-subtle)" }}>
                    {count} call{count === 1 ? "" : "s"}
                  </span>
                  <span className="dc-chev flex" style={{ color: "var(--earth-600)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </summary>
                <div className="px-6 pb-4 pt-1" style={{ borderTop: "1px solid var(--rule)" }}>
                  {[...divs.entries()].sort().map(([div, divCalls]) => (
                    <div key={div} className="mt-3">
                      <p className="dc-overline mb-1" style={{ letterSpacing: "0.12em" }}>{div}</p>
                      {divCalls.map((c) => (
                        <div key={c.id} className="grid items-center gap-4 py-2.5" style={{ gridTemplateColumns: "1.5fr 1.5fr 1.1fr auto", borderBottom: "1px solid var(--paper-2)" }}>
                          <span className="text-sm font-semibold">{c.family?.family_name ?? "—"}</span>
                          <span className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>{c.staff?.name}</span>
                          <span className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>
                            {new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                          </span>
                          <span className={`dc-chip justify-self-end ${SENT_CHIP[c.sentiment ?? "neutral"] ?? "dc-chip-paper"}`}>
                            {c.sentiment ?? c.disposition.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
