"use client";

import { useState, useTransition } from "react";
import { logCall } from "../actions";
import { CALL_TOPICS } from "@/lib/types";

export function LogCallForm({
  targetId,
  familyId,
}: {
  targetId: string;
  familyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Log call
      </button>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await logCall(formData);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log call");
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="mt-3 w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="family_id" value={familyId} />

      <div>
        <span className="block text-xs font-semibold uppercase text-slate-500">
          Outcome
        </span>
        <div className="mt-1 flex gap-3 text-sm">
          {(
            [
              ["reached", "Reached"],
              ["not_reached", "Not reached"],
              ["callback", "Callback later"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="disposition"
                value={value}
                required
                defaultChecked={value === "reached"}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold uppercase text-slate-500">
          Topics discussed
        </span>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {CALL_TOPICS.map((topic) => (
            <label key={topic} className="flex items-center gap-1.5">
              <input type="checkbox" name="topics" value={topic} />
              {topic}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase text-slate-500">
            Parent sentiment
          </span>
          <select
            name="sentiment"
            className="mt-1 rounded-md border border-slate-300 px-2 py-1"
            defaultValue="neutral"
          >
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase text-slate-500">
            Duration (min)
          </span>
          <input
            type="number"
            name="duration_min"
            min={0}
            step={1}
            className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="block text-xs font-semibold uppercase text-slate-500">
          Summary
        </span>
        <textarea
          name="summary"
          rows={2}
          placeholder="What was discussed?"
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="block text-sm">
        <span className="block text-xs font-semibold uppercase text-slate-500">
          Action item (optional)
        </span>
        <input
          type="text"
          name="action_item"
          placeholder="e.g. Share revision worksheets by Friday"
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save call"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
