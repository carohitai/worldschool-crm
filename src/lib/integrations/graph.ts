/**
 * Microsoft Graph — downloads the student roster Excel from the school's
 * SharePoint library using the same Entra app as SSO (client credentials).
 *
 * Env vars (server-only):
 *   GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET
 * Required app permission: Files.Read.All (Application) with admin consent.
 *
 * Dev fallback: if ROSTER_LOCAL_PATH is set, the file is read from disk
 * (the OneDrive folder synced on the office Mac) instead of Graph.
 */
import { readFileSync } from "node:fs";

const TENANT = process.env.GRAPH_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;

const SITE_SEARCH = "The World School";
const DRIVE_PATH =
  "SCHOOL ADMIN DATA/26-27/02_Fees_&_Collections/Fees Collection Report 2026-27.xlsx";

async function graphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    }
  );
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Graph token failed: ${data.error_description ?? res.status}`);
  }
  return data.access_token;
}

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Graph ${res.status}: ${data?.error?.code ?? ""} ${data?.error?.message ?? url}`
    );
  }
  return data;
}

export async function downloadRoster(): Promise<Buffer> {
  if (process.env.ROSTER_LOCAL_PATH) {
    return readFileSync(process.env.ROSTER_LOCAL_PATH);
  }
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Graph is not configured (GRAPH_* env vars missing).");
  }
  const token = await graphToken();

  const sites = await graphGet(
    token,
    `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(SITE_SEARCH)}`
  );
  const site = (sites.value ?? []).find(
    (s: { displayName?: string }) =>
      s.displayName?.toLowerCase().includes("world school")
  );
  if (!site) throw new Error(`SharePoint site not found for "${SITE_SEARCH}".`);

  const drives = await graphGet(
    token,
    `https://graph.microsoft.com/v1.0/sites/${site.id}/drives`
  );
  const drive =
    (drives.value ?? []).find(
      (d: { name?: string }) => d.name === "Documents"
    ) ?? (drives.value ?? [])[0];
  if (!drive) throw new Error("Document library not found on the site.");

  const encodedPath = DRIVE_PATH.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${drive.id}/root:/${encodedPath}:/content`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Roster download failed (${res.status}) at ${DRIVE_PATH}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
