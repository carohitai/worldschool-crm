import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff";
import { DialButton } from "../today/dial-button";
import { ConsentToggle } from "./consent-toggle";

const LINKUS_ENABLED = process.env.NEXT_PUBLIC_LINKUS === "1";
const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";

interface FamilyRow {
  id: string;
  family_name: string;
  primary_phone: string | null;
  whatsapp_opt_in: boolean;
  recording_consent: boolean;
  students: { name: string; class: { name: string; section: string } | null }[];
}

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("families")
    .select(
      "id, family_name, primary_phone, whatsapp_opt_in, recording_consent, students(name, class:classes(name, section))"
    )
    .order("family_name")
    .limit(100);
  if (q) {
    query = query.or(`family_name.ilike.%${q}%,primary_phone.ilike.%${q}%`);
  }
  const { data } = await query;
  const families = (data ?? []) as unknown as FamilyRow[];
  const canEditConsent = ["admin", "coordinator", "front_office"].includes(staff.role);

  return (
    <div className="relative flex flex-col gap-8">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="dc-overline" style={{ fontSize: 12 }}>Family directory</div>
          <h1 className="dc-h1 mt-1.5">Parents</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
            Every family, their wards and contact numbers
          </p>
        </div>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or phone…"
            className="w-64 rounded-lg px-3 py-2 text-sm"
            style={{ border: "1px solid var(--rule)", background: "var(--bg-elevated)", color: "var(--fg)" }}
          />
          <button className="dc-btn-primary">Search</button>
        </form>
      </div>

      <div className="dc-card overflow-x-auto">
        <div style={{ minWidth: 760 }}>
          <div className="dc-thead grid gap-3 px-6 py-3" style={{ gridTemplateColumns: "1.3fr 1.7fr 1.5fr 0.9fr 0.9fr", background: "var(--bg-sunken)", borderBottom: "1px solid var(--rule)" }}>
            <span>Family</span>
            <span>Students</span>
            <span>Phone · Call</span>
            <span>WhatsApp opt-in</span>
            <span>Recording consent</span>
          </div>
          {families.map((f) => (
            <div key={f.id} className="grid items-center gap-3 px-6 py-3 text-sm" style={{ gridTemplateColumns: "1.3fr 1.7fr 1.5fr 0.9fr 0.9fr", borderBottom: "1px solid var(--paper-2)" }}>
              <Link href={`/families/${f.id}`} className="font-semibold" style={{ color: "var(--teal-700)" }}>
                {f.family_name}
              </Link>
              <span style={{ color: "var(--fg-muted)" }}>
                {f.students
                  .map((s) => `${s.name}${s.class ? ` (${s.class.name}-${s.class.section})` : ""}`)
                  .join(", ")}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {f.primary_phone ? (
                  <>
                    <a href={`tel:${f.primary_phone}`} className="font-semibold" style={{ color: "var(--teal-700)" }}>
                      📞 {f.primary_phone}
                    </a>
                    {LINKUS_ENABLED && <DialButton familyId={f.id} />}
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span>
                <ConsentToggle
                  familyId={f.id}
                  field="whatsapp_opt_in"
                  value={f.whatsapp_opt_in}
                  labels={{ on: "opted in", off: "no opt-in" }}
                  canEdit={canEditConsent}
                />
              </span>
              <span>
                <ConsentToggle
                  familyId={f.id}
                  field="recording_consent"
                  value={f.recording_consent}
                  labels={{ on: "consented", off: "no consent" }}
                  canEdit={canEditConsent}
                />
              </span>
            </div>
          ))}
          {families.length === 0 && (
            <p className="px-6 py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
              No families found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
