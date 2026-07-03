import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, todayIST } from "@/lib/staff";
import { DISPOSITION_LABELS, type CallStatus } from "@/lib/types";
import { LogCallForm } from "./log-call-form";
import { GenerateButton } from "./generate-button";

interface TargetRow {
  id: string;
  status: CallStatus;
  family: {
    id: string;
    family_name: string;
    primary_phone: string | null;
  } | null;
  student: {
    name: string;
    class: { name: string; section: string } | null;
  } | null;
}

const STATUS_STYLES: Record<CallStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  reached: "bg-green-100 text-green-800",
  not_reached: "bg-red-100 text-red-700",
  callback: "bg-blue-100 text-blue-800",
};

export default async function TodayPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  const supabase = await createClient();
  const today = todayIST();

  const { data } = await supabase
    .from("call_targets")
    .select(
      "id, status, family:families(id, family_name, primary_phone), student:students(name, class:classes(name, section))"
    )
    .eq("staff_id", staff.id)
    .eq("target_date", today)
    .order("created_at");
  const targets = (data ?? []) as unknown as TargetRow[];

  const done = targets.filter((t) => t.status !== "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Today&apos;s Calls
          </h1>
          <p className="text-sm text-slate-500">
            {today} · {done} of {targets.length} completed
          </p>
        </div>
        <GenerateButton />
      </div>

      {targets.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No call targets for today yet. Click &ldquo;Generate today&apos;s
          call list&rdquo; to build your list.
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {targets.map((t) => (
          <li
            key={t.id}
            className="rounded-xl bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {t.family?.family_name ?? "Unknown family"}
                </p>
                <p className="text-sm text-slate-500">
                  {t.student
                    ? `${t.student.name}${
                        t.student.class
                          ? ` · Class ${t.student.class.name}-${t.student.class.section}`
                          : ""
                      }`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {t.family?.primary_phone && (
                  <a
                    href={`tel:${t.family.primary_phone}`}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    📞 {t.family.primary_phone}
                  </a>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[t.status]}`}
                >
                  {DISPOSITION_LABELS[t.status]}
                </span>
                {t.status === "pending" && t.family && (
                  <LogCallForm targetId={t.id} familyId={t.family.id} />
                )}
              </div>
            </div>
            {t.status === "pending" && !t.family && null}
          </li>
        ))}
      </ul>
    </div>
  );
}
