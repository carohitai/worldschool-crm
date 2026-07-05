"use client";

import { useState, useTransition } from "react";
import { syncRosterNow } from "../actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            try {
              const result = await syncRosterNow();
              setMessage(result.message);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Sync failed");
            }
          })
        }
        disabled={isPending}
        className="dc-btn-ghost disabled:opacity-50"
      >
        {isPending ? "Syncing roster…" : "⟳ Sync roster from OneDrive"}
      </button>
      {message && <span className="text-sm" style={{ color: "var(--fg-subtle)" }}>{message}</span>}
    </div>
  );
}
