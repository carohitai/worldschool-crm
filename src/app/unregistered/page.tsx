import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff";
import { signOut } from "../(app)/actions";

/**
 * Shown when someone signs in (e.g. via Microsoft 365) but their email
 * doesn't match any staff record — instead of a redirect loop.
 */
export default async function UnregisteredPage() {
  const staff = await getCurrentStaff();
  if (staff) redirect("/today");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tws-logo.png"
          alt="The World School"
          className="mx-auto h-16 w-16"
        />
        <h1 className="mt-4 text-lg font-bold text-[#1A2B5E]">
          Account not registered
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You signed in as <span className="font-semibold">{user.email}</span>,
          but this email is not registered as staff in the CRM yet.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Please ask the school office to add your email to the staff list,
          then sign in again.
        </p>
        <form action={signOut} className="mt-6">
          <button className="rounded-md bg-[#1A2B5E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24397a]">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
