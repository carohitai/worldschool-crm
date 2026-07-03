/**
 * Nextel WhatsApp Business API — outbound template messages.
 *
 * Env vars (server-only):
 *   NEXTEL_API_URL        message-send endpoint from the Nextel dashboard
 *   NEXTEL_API_KEY        API key / bearer token
 *   NEXTEL_TEMPLATE_NAME  approved template, default 'parent_connect_missed_call'
 *
 * The default payload follows the standard WhatsApp Cloud-API template shape
 * most BSPs (including Nextel) accept. If Nextel's exact schema differs, only
 * buildPayload() needs adjusting once we have their API docs/credentials.
 *
 * Template expectation (2 body variables):
 *   {{1}} = student name, {{2}} = teacher name
 *   e.g. "Dear parent, {{2}} from The World School tried calling you today
 *         regarding your ward {{1}} under our Parent Connect programme.
 *         We will try again soon — you may also call the school office."
 */

const URL = process.env.NEXTEL_API_URL;
const KEY = process.env.NEXTEL_API_KEY;
const TEMPLATE = process.env.NEXTEL_TEMPLATE_NAME ?? "parent_connect_missed_call";

export function nextelConfigured(): boolean {
  return Boolean(URL && KEY);
}

function buildPayload(to: string, studentName: string, teacherName: string) {
  return {
    to,
    type: "template",
    template: {
      name: TEMPLATE,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: studentName },
            { type: "text", text: teacherName },
          ],
        },
      ],
    },
  };
}

export async function sendMissedCallMessage(
  toPhone: string,
  studentName: string,
  teacherName: string
): Promise<{ ok: boolean; messageId?: string; error?: string; template: string }> {
  if (!nextelConfigured()) {
    return { ok: false, error: "Nextel is not configured yet.", template: TEMPLATE };
  }
  const to = toPhone.replace(/[^\d]/g, "").replace(/^(?!91)/, "91"); // E.164 India, no +
  try {
    const res = await fetch(URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(buildPayload(to, studentName, teacherName)),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message ?? data?.message ?? `HTTP ${res.status}`,
        template: TEMPLATE,
      };
    }
    return {
      ok: true,
      messageId: data?.messages?.[0]?.id ?? data?.id ?? undefined,
      template: TEMPLATE,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Send failed",
      template: TEMPLATE,
    };
  }
}
