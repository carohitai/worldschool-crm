"use client";

import { useState, useTransition } from "react";
import { updateFamilyConsent } from "../actions";

export function ConsentToggle({
  familyId,
  field,
  value,
  labels,
  canEdit,
}: {
  familyId: string;
  field: "whatsapp_opt_in" | "recording_consent";
  value: boolean;
  labels: { on: string; off: string };
  canEdit: boolean;
}) {
  const [current, setCurrent] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <span className={`dc-chip ${current ? "dc-chip-olive" : "dc-chip-paper"}`}>
        {current ? labels.on : labels.off}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const next = !current;
          const prev = current;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            try {
              await updateFamilyConsent(familyId, field, next);
            } catch (e) {
              setCurrent(prev);
              setError(e instanceof Error ? e.message : "Failed");
            }
          });
        }}
        title="Click to change (per signed declaration)"
        className={`dc-chip ${current ? "dc-chip-olive" : "dc-chip-paper"}`}
        style={{ cursor: "pointer", border: "1px dashed transparent", opacity: isPending ? 0.6 : 1 }}
      >
        {current ? labels.on : labels.off}
      </button>
      {error && <span className="text-xs" style={{ color: "var(--clay-600)" }}>{error}</span>}
    </span>
  );
}
