/**
 * Yeastar P-Series (Linkus) OpenAPI — click-to-call.
 *
 * Env vars (server-only):
 *   YEASTAR_API_URL       e.g. https://<pbx-domain>/openapi/v1.0
 *   YEASTAR_CLIENT_ID     OpenAPI client ID (PBX → Integrations → OpenAPI)
 *   YEASTAR_CLIENT_SECRET OpenAPI client secret
 *
 * Flow: get_token → POST /call/dial { caller: <staff extension>, callee: <parent number> }.
 * The teacher's Linkus/desk phone rings first; on answer the PBX dials the parent.
 */

const BASE = process.env.YEASTAR_API_URL;
const CLIENT_ID = process.env.YEASTAR_CLIENT_ID;
const CLIENT_SECRET = process.env.YEASTAR_CLIENT_SECRET;

export function linkusConfigured(): boolean {
  return Boolean(BASE && CLIENT_ID && CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const res = await fetch(`${BASE}/get_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: CLIENT_ID, password: CLIENT_SECRET }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`Linkus token failed: ${data.errmsg ?? res.status}`);
  }
  cachedToken = {
    token: data.access_token,
    // access_token_expire_time is in seconds; refresh 60s early
    expiresAt: Date.now() + (Number(data.access_token_expire_time ?? 1800) - 60) * 1000,
  };
  return cachedToken.token;
}

export interface CdrRecord {
  id: string;
  startTime: string; // "YYYY-MM-DD HH:MM:SS" (PBX local time, IST)
  from: string;
  to: string;
  durationSec: number; // total duration
  talkSec: number; // talking time (0 = never connected)
  disposition: string; // ANSWERED / NO ANSWER / BUSY / FAILED …
  type: string; // Outbound / Inbound / Internal
}

/**
 * Query the PBX call records (CDR) — every call made through Linkus/desk
 * phones, whether or not it was logged in the CRM. Fields differ slightly
 * across firmware versions, so values are read defensively.
 */
export async function searchCdr(maxRecords = 200): Promise<{
  ok: boolean;
  records: CdrRecord[];
  error?: string;
}> {
  if (!linkusConfigured()) {
    return { ok: false, records: [], error: "Linkus is not configured yet." };
  }
  try {
    const token = await getToken();
    const pageSize = 100;
    // The PBX ignores sort params and always returns oldest-first, so read
    // the total and walk the LAST pages backwards to get the newest calls.
    const probeRes = await fetch(
      `${BASE}/cdr/search?access_token=${token}&page=1&page_size=1`,
      { cache: "no-store" }
    );
    const probe = await probeRes.json();
    if (probe.errcode !== 0) {
      return { ok: false, records: [], error: probe.errmsg ?? `CDR error ${probe.errcode}` };
    }
    const total = Number(probe.total_number ?? 0);
    const records: CdrRecord[] = [];
    let page = Math.max(1, Math.ceil(total / pageSize));
    while (records.length < maxRecords && page >= 1) {
      const res = await fetch(
        `${BASE}/cdr/search?access_token=${token}&page=${page}&page_size=${pageSize}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.errcode !== 0) {
        return { ok: false, records, error: data.errmsg ?? `CDR error ${data.errcode}` };
      }
      const rows: Record<string, unknown>[] = data.data ?? data.cdr_list ?? [];
      for (const r of rows) {
        records.push({
          id: String(r.id ?? r.uid ?? `${r.time}-${r.call_from}-${r.call_to}`),
          startTime: String(r.time ?? r.start_time ?? ""),
          from: String(r.call_from ?? r.src ?? ""),
          to: String(r.call_to ?? r.dst ?? ""),
          durationSec: Number(r.duration ?? 0),
          talkSec: Number(r.talk_duration ?? r.billduration ?? 0),
          disposition: String(r.disposition ?? r.status ?? ""),
          type: String(r.communication_type ?? r.call_type ?? ""),
        });
      }
      page -= 1;
    }
    return { ok: true, records: records.slice(0, maxRecords * 2) };
  } catch (e) {
    return { ok: false, records: [], error: e instanceof Error ? e.message : "CDR fetch failed" };
  }
}

export interface LinkusExtension {
  number: string; // the extension number, e.g. "2031"
  name: string; // caller-ID / full name on the PBX
  email: string; // extension email (used to match staff)
  mobile: string; // mobile number registered on the extension
}

/**
 * List the extensions (users) configured on the PBX. Field names differ
 * across P-Series firmware, so every value is read defensively. Paginates
 * until the PBX reports no more rows.
 */
export async function listExtensions(): Promise<{
  ok: boolean;
  extensions: LinkusExtension[];
  error?: string;
}> {
  if (!linkusConfigured()) {
    return { ok: false, extensions: [], error: "Linkus is not configured yet." };
  }
  try {
    const token = await getToken();
    const pageSize = 100;
    const extensions: LinkusExtension[] = [];
    let page = 1;
    // Cap pages defensively so a firmware that ignores paging can't loop forever.
    while (page <= 50) {
      const res = await fetch(
        `${BASE}/extension/list?access_token=${token}&page=${page}&page_size=${pageSize}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.errcode !== 0) {
        return {
          ok: false,
          extensions,
          error: data.errmsg ?? `Extension list error ${data.errcode}`,
        };
      }
      const rows: Record<string, unknown>[] =
        data.data ?? data.ext_list ?? data.extension_list ?? [];
      for (const r of rows) {
        const first = String(r.first_name ?? "").trim();
        const last = String(r.last_name ?? "").trim();
        const name =
          String(r.caller_id_name ?? r.name ?? "").trim() ||
          `${first} ${last}`.trim();
        extensions.push({
          number: String(r.number ?? r.ext_number ?? r.extension ?? "").trim(),
          name,
          email: String(r.email ?? r.email_address ?? "").trim().toLowerCase(),
          mobile: String(r.mobile_number ?? r.mobile ?? "").trim(),
        });
      }
      const total = Number(data.total_number ?? data.total ?? rows.length);
      if (rows.length < pageSize || extensions.length >= total) break;
      page += 1;
    }
    return { ok: true, extensions: extensions.filter((e) => e.number) };
  } catch (e) {
    return {
      ok: false,
      extensions: [],
      error: e instanceof Error ? e.message : "Extension list fetch failed",
    };
  }
}

export async function dial(
  extension: string,
  number: string
): Promise<{ ok: boolean; error?: string }> {
  if (!linkusConfigured()) return { ok: false, error: "Linkus is not configured yet." };
  try {
    const token = await getToken();
    const res = await fetch(`${BASE}/call/dial?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caller: extension, callee: number.replace(/[^\d+]/g, "") }),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.errcode !== 0) return { ok: false, error: data.errmsg ?? "Dial failed" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Dial failed" };
  }
}
