"use client";

import { useState, useTransition } from "react";
import { syncLinkusExtensions } from "../actions";

interface SyncResult {
  ok: boolean;
  message: string;
  changes?: string[];
  conflicts?: string[];
  unmatchedExt?: string[];
}

export function SyncLinkusButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              setResult(await syncLinkusExtensions());
            } catch (e) {
              setResult({
                ok: false,
                message: e instanceof Error ? e.message : "Sync failed",
              });
            }
          })
        }
        disabled={isPending}
        className="dc-btn-ghost disabled:opacity-50"
      >
        {isPending ? "Checking Linkus…" : "⟳ Sync extensions from Linkus"}
      </button>

      {result && (
        <div className="max-w-md text-right text-[13px]" style={{ color: "var(--fg-subtle)" }}>
          <p style={{ color: result.ok ? "var(--fg-subtle)" : "var(--clay-600)" }}>
            {result.message}
          </p>
          {result.changes && result.changes.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer">Updated ({result.changes.length})</summary>
              <ul className="mt-1 list-none">
                {result.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
          {result.conflicts && result.conflicts.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer" style={{ color: "var(--clay-600)" }}>
                Conflicts ({result.conflicts.length})
              </summary>
              <ul className="mt-1 list-none">
                {result.conflicts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
          {result.unmatchedExt && result.unmatchedExt.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer">
                PBX extensions with no matching staff email ({result.unmatchedExt.length})
              </summary>
              <ul className="mt-1 list-none">
                {result.unmatchedExt.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
