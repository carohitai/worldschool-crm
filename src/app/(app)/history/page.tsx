import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff";
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

export default async function HistoryPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  const supabase = await createClient();

  const { data } = await supabase
    .from("call_logs")
    .select(
      "id, started_at, disposition, sentiment, staff(name), family:families(family_name, students(class:classes(name, section)))"
    )
    .order("started_at", { ascending: false })
    .limit(500);
  const logs = (data ?? []) as unknown as HistLog[];

  // Group: standard -> division -> calls
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
    <div className="relative flex flex-col gap-8">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise">
        <div className="dc-overline" style={{ fontSize: 12 }}>Earlier calling</div>
        <h1 className="dc-h1 mt-1.5">History</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
          History of calling · Standard &gt; Division wise
        </p>
      </div>

      <section className="flex flex-col gap-3">
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
                {[...divs.entries()].sort().map(([div, calls]) => (
                  <div key={div} className="mt-3">
                    <p className="dc-overline mb-1" style={{ letterSpacing: "0.12em" }}>{div}</p>
                    {calls.map((c) => (
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
      </section>
    </div>
  );
}
