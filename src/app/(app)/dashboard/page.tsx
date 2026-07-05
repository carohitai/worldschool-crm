import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, todayIST, weekdayIST } from "@/lib/staff";
import type { CallSentiment } from "@/lib/types";
import { AssignAllButton } from "./assign-all-button";
import { SyncButton } from "./sync-button";

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

interface TargetAgg {
  staff_id: string;
  status: string;
  staff: { name: string } | null;
}

interface RecentLog {
  id: string;
  started_at: string;
  disposition: string;
  topics: string[];
  sentiment: CallSentiment | null;
  summary: string | null;
  staff: { name: string } | null;
  family: { id: string; family_name: string } | null;
}

const SENTIMENT_BADGE: Record<CallSentiment, string> = {
  positive: "bg-green-100 text-green-800",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-red-100 text-red-700",
};

export default async function DashboardPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  if (staff.role !== "admin" && staff.role !== "coordinator") {
    redirect("/today");
  }
  const supabase = await createClient();
  const today = todayIST();
  const weekday = weekdayIST();

  const [
    targetsRes,
    logsRes,
    familiesRes,
    contactedRes,
    actionsRes,
    planRes,
    tbdRes,
    studentsRes,
    classesRes,
    staffRes,
    syncRes,
  ] = await Promise.all([
      supabase
        .from("call_targets")
        .select("staff_id, status, staff(name)")
        .eq("target_date", today),
      supabase
        .from("call_logs")
        .select(
          "id, started_at, disposition, topics, sentiment, summary, staff(name), family:families(id, family_name)"
        )
        .order("started_at", { ascending: false })
        .limit(15),
      supabase.from("families").select("id", { count: "exact", head: true }),
      supabase.from("call_logs").select("family_id"),
      supabase
        .from("action_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("call_plan")
        .select("id", { count: "exact", head: true })
        .eq("weekday", weekday)
        .not("staff_id", "is", null),
      supabase
        .from("call_plan")
        .select("student_id")
        .is("staff_id", null),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase.from("classes").select("name"),
      supabase.from("staff").select("id", { count: "exact", head: true }),
      supabase
        .from("sync_runs")
        .select(
          "started_at, triggered_by, status, roster_rows, students_added, students_updated, students_deactivated, phones_updated, error"
        )
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const targets = (targetsRes.data ?? []) as unknown as TargetAgg[];
  const logs = (logsRes.data ?? []) as unknown as RecentLog[];
  const totalFamilies = familiesRes.count ?? 0;
  const contactedFamilies = new Set(
    (contactedRes.data ?? []).map((l) => l.family_id)
  ).size;
  const openActions = actionsRes.count ?? 0;
  const plannedToday = planRes.count ?? 0;
  const tbdStudents = new Set(
    (tbdRes.data ?? []).map((r) => r.student_id)
  ).size;
  const totalStudents = studentsRes.count ?? 0;
  const totalDivisions = (classesRes.data ?? []).length;
  const totalStandards = new Set(
    (classesRes.data ?? []).map((c) => c.name)
  ).size;
  const totalStaff = staffRes.count ?? 0;
  const lastSync = syncRes.data as SyncRun | null;

  const byStaff = new Map<string, { name: string; total: number; done: number }>();
  for (const t of targets) {
    const entry = byStaff.get(t.staff_id) ?? {
      name: t.staff?.name ?? "Unknown",
      total: 0,
      done: 0,
    };
    entry.total += 1;
    if (t.status !== "pending") entry.done += 1;
    byStaff.set(t.staff_id, entry);
  }

  const negativeToday = logs.filter(
    (l) => l.sentiment === "negative" && l.started_at.startsWith(today)
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Parent Connect Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            {`${today} (${weekday}) · ${plannedToday} calls in today's plan`}
          </p>
        </div>
        <AssignAllButton />
      </div>

      {tbdStudents > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {tbdStudents} pre-primary students have no assigned caller yet — set
          the NUR / Jr.Kg / Sr.Kg class teachers to include them in the plan.
        </p>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          School data in the system
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total students" value={totalStudents.toLocaleString("en-IN")} />
          <StatCard label="Classes" value={String(totalStandards)} />
          <StatCard label="Divisions" value={String(totalDivisions)} />
          <StatCard label="Staff" value={String(totalStaff)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-600">
            {lastSync ? (
              <>
                <span
                  className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    lastSync.status === "success"
                      ? "bg-green-100 text-green-800"
                      : lastSync.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {lastSync.status}
                </span>
                Last roster sync:{" "}
                {new Date(lastSync.started_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · by {lastSync.triggered_by}
                {lastSync.status === "success" && (
                  <>
                    {" "}
                    · {lastSync.roster_rows} rows — {lastSync.students_added} added,{" "}
                    {lastSync.students_updated} updated, {lastSync.students_deactivated}{" "}
                    left, {lastSync.phones_updated} phone changes
                  </>
                )}
                {lastSync.error && (
                  <span className="text-red-600"> · {lastSync.error}</span>
                )}
              </>
            ) : (
              "Roster has never been synced — nightly sync runs at 2:00 AM IST."
            )}
          </div>
          <SyncButton />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Today's targets"
          value={`${targets.filter((t) => t.status !== "pending").length} / ${targets.length}`}
        />
        <StatCard
          label="Families contacted (all time)"
          value={`${contactedFamilies} / ${totalFamilies}`}
        />
        <StatCard label="Open action items" value={String(openActions)} />
        <StatCard
          label="Negative calls today"
          value={String(negativeToday)}
          alert={negativeToday > 0}
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          Target completion by teacher
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Teacher</th>
                <th className="px-4 py-2">Completed</th>
                <th className="px-4 py-2">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...byStaff.values()].map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {s.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {s.done} / {s.total}
                  </td>
                  <td className="px-4 py-2">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${s.total ? (s.done / s.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {byStaff.size === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    No call targets assigned today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Recent calls</h2>
        <ul className="mt-3 space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/families/${l.family?.id}`}
                  className="font-semibold text-indigo-700 hover:underline"
                >
                  {l.family?.family_name ?? "Unknown"}
                </Link>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{l.staff?.name}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {new Date(l.started_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {l.sentiment && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SENTIMENT_BADGE[l.sentiment]}`}
                  >
                    {l.sentiment}
                  </span>
                )}
                {l.topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {l.summary && (
                <p className="mt-1 text-sm text-slate-600">{l.summary}</p>
              )}
            </li>
          ))}
          {logs.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
              No calls logged yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl bg-white p-4 shadow-sm ${alert ? "ring-2 ring-red-300" : ""}`}
    >
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}
