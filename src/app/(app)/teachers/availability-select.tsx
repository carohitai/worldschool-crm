"use client";

import { useState, useTransition } from "react";
import { updateCallingAvailability } from "../actions";

export function AvailabilitySelect({
  staffId,
  value,
}: {
  staffId: string;
  value: boolean;
}) {
  const [current, setCurrent] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={current ? "yes" : "no"}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value === "yes";
          const prev = current;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            try {
              await updateCallingAvailability(staffId, next);
            } catch (err) {
              setCurrent(prev);
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="rounded-lg px-3 py-1.5 text-[13px] font-bold"
        style={{
          border: `1px solid ${current ? "var(--olive-500)" : "var(--clay-500)"}`,
          background: current ? "#E8EDDD" : "#F6E2DD",
          color: current ? "var(--olive-700)" : "var(--clay-700)",
          cursor: "pointer",
        }}
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      {error && <span className="text-xs" style={{ color: "var(--clay-600)" }}>{error}</span>}
    </span>
  );
}
