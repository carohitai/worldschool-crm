"use client";

import { useState, useTransition } from "react";
import { generateTodayTargets } from "../actions";

export function GenerateButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await generateTodayTargets();
              setMessage(result.message);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Failed");
            }
          })
        }
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate today's call list"}
      </button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </div>
  );
}
