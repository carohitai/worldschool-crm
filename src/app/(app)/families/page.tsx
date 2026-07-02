import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface FamilyRow {
  id: string;
  family_name: string;
  primary_phone: string | null;
  whatsapp_number: string | null;
  students: { name: string; class: { name: string; section: string } | null }[];
}

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("families")
    .select(
      "id, family_name, primary_phone, whatsapp_number, students(name, class:classes(name, section))"
    )
    .order("family_name")
    .limit(100);
  if (q) {
    query = query.or(`family_name.ilike.%${q}%,primary_phone.ilike.%${q}%`);
  }
  const { data } = await query;
  const families = (data ?? []) as unknown as FamilyRow[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Families</h1>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or phone…"
            className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Family</th>
              <th className="px-4 py-2">Students</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {families.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/families/${f.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {f.family_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {f.students
                    .map(
                      (s) =>
                        `${s.name}${s.class ? ` (${s.class.name}-${s.class.section})` : ""}`
                    )
                    .join(", ")}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {f.primary_phone ?? "—"}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {f.whatsapp_number ?? "—"}
                </td>
              </tr>
            ))}
            {families.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No families found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
