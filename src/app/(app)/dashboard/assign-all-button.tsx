"use client";

import { useState, useTransition } from "react";
import { assignAllTodayTargets } from "../actions";

export function AssignAllButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await assignAllTodayTargets();
              setMessage(result.message);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Failed");
            }
          })
        }
        disabled={isPending}
        className="rounded-md bg-[#1A2B5E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24397a] disabled:opacity-50"
      >
        {isPending ? "Assigning…" : "Assign today's plan to all teachers"}
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </div>
  );
}
