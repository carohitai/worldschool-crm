import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DISPOSITION_LABELS, type CallStatus, type CallSentiment } from "@/lib/types";

interface FamilyDetail {
  id: string;
  family_name: string;
  primary_phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  notes: string | null;
  parents: { id: string; name: string; relation: string | null; phone: string | null }[];
  students: {
    id: string;
    name: string;
    admission_no: string | null;
    priority_flag: boolean;
    priority_reason: string | null;
    class: { name: string; section: string } | null;
  }[];
}

interface LogRow {
  id: string;
  started_at: string;
  disposition: CallStatus;
  topics: string[];
  sentiment: CallSentiment | null;
  summary: string | null;
  duration_seconds: number | null;
  staff: { name: string } | null;
}

interface ActionRow {
  id: string;
  description: string;
  status: string;
  due_date: string | null;
  owner: { name: string } | null;
}

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [familyRes, logsRes, actionsRes] = await Promise.all([
    supabase
      .from("families")
      .select(
        "id, family_name, primary_phone, whatsapp_number, address, notes, parents(id, name, relation, phone), students(id, name, admission_no, priority_flag, priority_reason, class:classes(name, section))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("call_logs")
      .select(
        "id, started_at, disposition, topics, sentiment, summary, duration_seconds, staff(name)"
      )
      .eq("family_id", id)
      .order("started_at", { ascending: false }),
    supabase
      .from("action_items")
      .select("id, description, status, due_date, owner:staff(name)")
      .eq("family_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const family = familyRes.data as unknown as FamilyDetail | null;
  if (!family) notFound();
  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const actions = (actionsRes.data ?? []) as unknown as ActionRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {family.family_name}
        </h1>
        <p className="text-sm text-slate-500">
          {family.primary_phone && `📞 ${family.primary_phone}`}
          {family.whatsapp_number && ` · WhatsApp ${family.whatsapp_number}`}
        </p>
        {family.address && (
          <p className="mt-1 text-sm text-slate-500">{family.address}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Students</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {family.students.map((s) => (
              <li key={s.id}>
                {s.name}
                {s.class && ` · Class ${s.class.name}-${s.class.section}`}
                {s.admission_no && ` · ${s.admission_no}`}
                {s.priority_flag && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Priority{s.priority_reason ? `: ${s.priority_reason}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Parents</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {family.parents.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.relation && ` (${p.relation})`}
                {p.phone && ` · ${p.phone}`}
              </li>
            ))}
            {family.parents.length === 0 && (
              <li className="text-slate-400">No parents recorded.</li>
            )}
          </ul>
        </section>
      </div>

      {actions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Action items</h2>
          <ul className="mt-2 space-y-2">
            {actions.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm"
              >
                <span className="text-slate-700">{a.description}</span>
                <span className="text-xs text-slate-500">
                  {a.owner?.name} ·{" "}
                  <span
                    className={
                      a.status === "open" ? "text-amber-600" : "text-green-600"
                    }
                  >
                    {a.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900">
          Communication timeline
        </h2>
        <ul className="mt-3 space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-800">
                  {l.staff?.name ?? "Staff"}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {new Date(l.started_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {DISPOSITION_LABELS[l.disposition]}
                </span>
                {l.sentiment && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {l.sentiment}
                  </span>
                )}
                {l.duration_seconds != null && (
                  <span className="text-xs text-slate-500">
                    {Math.round(l.duration_seconds / 60)} min
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
              No calls logged with this family yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
