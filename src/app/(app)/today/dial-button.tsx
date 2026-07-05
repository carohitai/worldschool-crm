"use client";

import { useState, useTransition } from "react";
import { dialViaLinkus } from "../actions";

export function DialButton({ familyId }: { familyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await dialViaLinkus(familyId);
              setMessage(result.message);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Dial failed");
            }
          })
        }
        disabled={isPending}
        className="dc-btn-primary disabled:opacity-50"
        style={{ background: "var(--olive-600)" }}
      >
        {isPending ? "Dialling…" : "☎ Call via Linkus"}
      </button>
      {message && <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{message}</span>}
    </span>
  );
}
