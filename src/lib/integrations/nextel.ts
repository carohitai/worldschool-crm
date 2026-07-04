/**
 * Nextel WhatsApp Business API — outbound template messages.
 *
 * Env vars (server-only):
 *   NEXTEL_API_URL      full send_template endpoint incl. the account token path,
 *                       e.g. https://api.nextel.io/API_V2/Whatsapp/send_template/XXXX
 *   NEXTEL_API_KEY      Bearer API key from the Nextel dashboard
 *   NEXTEL_TEMPLATE_ID  approved template id (default: parent_connect)
 *
 * Request shape (per Nextel docs):
 *   POST { type: "buttonTemplate", templateId, templateLanguage: "en",
 *          sender_phone: "91XXXXXXXXXX", templateArgs: [arg1, arg2] }
 *
 * Template "parent_connect" args: [0] = student name, [1] = teacher name.
 */

const URL = process.env.NEXTEL_API_URL;
const KEY = process.env.NEXTEL_API_KEY;
const TEMPLATE_ID = process.env.NEXTEL_TEMPLATE_ID ?? "parent_connect";

export function nextelConfigured(): boolean {
  return Boolean(URL && KEY);
}

export async function sendMissedCallMessage(
  toPhone: string,
  studentName: string,
  teacherName: string
): Promise<{ ok: boolean; messageId?: string; error?: string; template: string }> {
  if (!nextelConfigured()) {
    return { ok: false, error: "Nextel is not configured yet.", template: TEMPLATE_ID };
  }
  // 91XXXXXXXXXX format: digits only, ensure the 91 country prefix
  const digits = toPhone.replace(/[^\d]/g, "");
  const phone = digits.startsWith("91") && digits.length > 10 ? digits : `91${digits.slice(-10)}`;
  try {
    const res = await fetch(URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        type: "buttonTemplate",
        templateId: TEMPLATE_ID,
        templateLanguage: "en",
        sender_phone: phone,
        templateArgs: [studentName, teacherName],
      }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    // Nextel returns HTTP 200 even on failure, with the real outcome in
    // `status` (numeric, e.g. {"status":500,"statusText":"Mobile not correct!"}).
    const failed =
      !res.ok ||
      (typeof data.status === "number" && data.status >= 400) ||
      (typeof data.status === "string" &&
        !["success", "sent", "queued", "ok", "200"].includes(
          data.status.toLowerCase()
        ));
    if (failed) {
      return {
        ok: false,
        error:
          (data.statusText as string) ??
          (data.message as string) ??
          (data.error as string) ??
          `HTTP ${res.status}`,
        template: TEMPLATE_ID,
      };
    }
    return {
      ok: true,
      messageId:
        (data.messageId as string) ??
        (data.message_id as string) ??
        (data.id as string) ??
        undefined,
      template: TEMPLATE_ID,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Send failed",
      template: TEMPLATE_ID,
    };
  }
}
