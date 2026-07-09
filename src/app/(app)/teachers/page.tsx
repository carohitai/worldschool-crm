import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff";
import { AvailabilitySelect } from "./availability-select";
import { SyncLinkusButton } from "./sync-linkus-button";

const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  linkus_extension: string | null;
  auth_user_id: string | null;
  available_for_calling: boolean;
  calling_remarks: string | null;
}

export default async function TeachersPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  if (staff.role !== "admin" && staff.role !== "coordinator") redirect("/today");

  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select(
      "id, name, email, role, linkus_extension, auth_user_id, available_for_calling, calling_remarks"
    )
    .order("role")
    .order("name");
  const rows = (data ?? []) as unknown as StaffRow[];
  const teachers = rows.filter((r) => r.role === "teacher");
  const others = rows.filter((r) => r.role !== "teacher");
  const availableCount = teachers.filter((t) => t.available_for_calling).length;

  const Row = (s: StaffRow) => (
    <div
      key={s.id}
      className="grid items-center gap-3 px-6 py-3 text-sm"
      style={{ gridTemplateColumns: "1.5fr 2fr 0.7fr 0.9fr 1fr 1.6fr", borderBottom: "1px solid var(--paper-2)" }}
    >
      <span>
        <span className="block font-bold" style={{ color: "var(--brand-ink)" }}>{s.name}</span>
        <span className="text-xs capitalize" style={{ color: "var(--fg-subtle)" }}>{s.role.replace("_", " ")}</span>
      </span>
      <span style={{ color: "var(--fg-muted)" }}>
        {s.email}
        <span className={`dc-chip ml-2 ${s.auth_user_id ? "dc-chip-teal" : "dc-chip-paper"}`}>
          {s.auth_user_id ? "SSO linked" : s.email.endsWith("@tws.local") ? "no account" : "not signed in yet"}
        </span>
      </span>
      <span style={{ color: "var(--fg-muted)" }}>{s.linkus_extension ?? "—"}</span>
      <AvailabilitySelect staffId={s.id} value={s.available_for_calling} />
      <span />
      <span className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>{s.calling_remarks ?? ""}</span>
    </div>
  );

  return (
    <div className="relative flex flex-col gap-8">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="dc-overline" style={{ fontSize: 12 }}>Staff directory</div>
          <h1 className="dc-h1 mt-1.5">Teachers</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
            {`Calling rights as decided by the Principal · ${availableCount} of ${teachers.length} teachers available for calling`}
          </p>
        </div>
        <SyncLinkusButton />
      </div>

      <section>
        <div className="dc-card overflow-x-auto">
          <div style={{ minWidth: 900 }}>
            <div className="dc-thead grid gap-3 px-6 py-3" style={{ gridTemplateColumns: "1.5fr 2fr 0.7fr 0.9fr 1fr 1.6fr", background: "var(--bg-sunken)", borderBottom: "1px solid var(--rule)" }}>
              <span>Teacher</span>
              <span>Microsoft account</span>
              <span>Ext.</span>
              <span>Available for calling</span>
              <span />
              <span>Principal&apos;s remarks</span>
            </div>
            {teachers.map(Row)}
          </div>
        </div>
      </section>

      <section>
        <p className="dc-overline">Leadership &amp; office</p>
        <div className="dc-card mt-3 overflow-x-auto">
          <div style={{ minWidth: 900 }}>{others.map(Row)}</div>
        </div>
      </section>
    </div>
  );
}
