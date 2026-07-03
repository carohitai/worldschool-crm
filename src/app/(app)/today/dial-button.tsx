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
        className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
      >
        {isPending ? "Dialling…" : "☎ Call via Linkus"}
      </button>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </span>
  );
}
