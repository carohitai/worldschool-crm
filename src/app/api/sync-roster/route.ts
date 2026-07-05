import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { downloadRoster } from "@/lib/integrations/graph";
import { syncRoster } from "@/lib/sync/roster";

export const maxDuration = 60;

/**
 * Nightly roster sync (Vercel cron) — also callable manually with the secret:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/sync-roster
 */
async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.CRM_SYNC_EMAIL!,
    password: process.env.CRM_SYNC_PASSWORD!,
  });
  if (authErr) {
    return NextResponse.json(
      { ok: false, error: `sync auth failed: ${authErr.message}` },
      { status: 500 }
    );
  }
  try {
    const buffer = await downloadRoster();
    const result = await syncRoster(supabase, buffer, "cron");
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 }
    );
  } finally {
    await supabase.auth.signOut();
  }
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return run();
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return run();
}
