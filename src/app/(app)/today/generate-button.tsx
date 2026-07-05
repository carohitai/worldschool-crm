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
        className="dc-btn-accent disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate today's call list"}
      </button>
      {message && <span className="text-sm" style={{ color: "var(--fg-subtle)" }}>{message}</span>}
    </div>
  );
}
