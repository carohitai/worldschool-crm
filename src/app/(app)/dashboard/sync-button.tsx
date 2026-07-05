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
        className="rounded-md border border-[#1A2B5E] px-4 py-2 text-sm font-semibold text-[#1A2B5E] hover:bg-[#1A2B5E] hover:text-white disabled:opacity-50"
      >
        {isPending ? "Syncing roster…" : "⟳ Sync roster from OneDrive"}
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </div>
  );
}
