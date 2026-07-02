import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const isLeadership = staff.role === "admin" || staff.role === "coordinator";

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#1A2B5E] shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/tws-logo.png"
                alt="The World School"
                width={40}
                height={40}
                className="rounded-full bg-white p-0.5"
              />
              <div className="leading-tight">
                <span className="block font-bold text-white">
                  The World School
                </span>
                <span className="block text-[11px] font-medium tracking-wide text-[#C5A028]">
                  Ethics | Education | Excellence
                </span>
              </div>
            </div>
            <nav className="flex gap-4 text-sm font-medium text-slate-200">
              <Link href="/today" className="hover:text-[#C5A028]">
                Today&apos;s Calls
              </Link>
              <Link href="/families" className="hover:text-[#C5A028]">
                Families
              </Link>
              {isLeadership && (
                <Link href="/dashboard" className="hover:text-[#C5A028]">
                  Dashboard
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">
              {staff.name} · {staff.role}
            </span>
            <form action={signOut}>
              <button className="rounded-md border border-slate-400 px-3 py-1 text-slate-200 hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
