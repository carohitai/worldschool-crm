import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";

/**
 * Returns the staff record for the logged-in user. On first login the
 * auth account is linked to the staff row that matches the user's email.
 */
export async function getCurrentStaff(): Promise<Staff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (staff) return staff as Staff;

  if (user.email) {
    const { data: linked } = await supabase
      .from("staff")
      .update({ auth_user_id: user.id })
      .eq("email", user.email)
      .is("auth_user_id", null)
      .select()
      .maybeSingle();
    if (linked) return linked as Staff;
  }
  return null;
}

/** Today's date in the school's timezone (IST). */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

/** Weekday abbreviation (Mon…Sun) in IST, matching call_plan.weekday. */
export function weekdayIST(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(new Date());
}
