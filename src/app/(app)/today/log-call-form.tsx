"use client";

import { useState, useTransition } from "react";
import { logCall } from "../actions";
import { CALL_TOPICS } from "@/lib/types";

const DISPOSITIONS = [
  { value: "reached", label: "Answered" },
  { value: "not_reached", label: "Not answered" },
  { value: "callback", label: "Callback later" },
] as const;

const SENTIMENTS = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
] as const;

export function LogCallForm({
  targetId,
  familyId,
}: {
  targetId: string;
  familyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState("reached");
  const [sentiment, setSentiment] = useState("neutral");
  const [topics, setTopics] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [duration, setDuration] = useState("");
  const [actionItem, setActionItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("target_id", targetId);
        fd.set("family_id", familyId);
        fd.set("disposition", disposition);
        fd.set("sentiment", sentiment);
        topics.forEach((t) => fd.append("topics", t));
        fd.set("summary", summary);
        fd.set("duration_min", duration);
        fd.set("action_item", actionItem);
        await logCall(fd);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log call");
      }
    });
  }

  const pill = (selected: boolean) => ({
    background: selected ? "var(--teal-700)" : "var(--white)",
    color: selected ? "var(--paper)" : "var(--fg-muted)",
    borderColor: selected ? "var(--teal-700)" : "var(--rule)",
  });

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="dc-btn-primary inline-flex items-center gap-2">
        Log call
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 w-full basis-full" style={{ borderTop: "1px solid var(--rule)", paddingTop: 20 }}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="dc-thead mb-2" style={{ letterSpacing: "0.12em" }}>Disposition</p>
              <div className="flex flex-wrap gap-2">
                {DISPOSITIONS.map((d) => (
                  <button key={d.value} type="button" onClick={() => setDisposition(d.value)} className="dc-pill-option" style={pill(disposition === d.value)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="dc-thead mb-2" style={{ letterSpacing: "0.12em" }}>Parent sentiment</p>
              <div className="flex flex-wrap gap-2">
                {SENTIMENTS.map((s) => (
                  <button key={s.value} type="button" onClick={() => setSentiment(s.value)} className="dc-pill-option" style={pill(sentiment === s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="dc-thead mb-2" style={{ letterSpacing: "0.12em" }}>Topics discussed</p>
              <div className="flex flex-wrap gap-2">
                {CALL_TOPICS.map((t) => {
                  const sel = topics.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => setTopics((prev) => sel ? prev.filter((x) => x !== t) : [...prev, t])} className="dc-pill-option" style={pill(sel)}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="dc-thead mb-2" style={{ letterSpacing: "0.12em" }}>Summary — parent&apos;s comment</p>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What did the parent say?"
                className="w-full rounded-lg px-3 py-2.5 text-sm leading-normal"
                style={{ border: "1px solid var(--rule)", background: "var(--paper)", color: "var(--fg)", resize: "vertical" }}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="text-sm">
                <span className="dc-thead mb-2 block" style={{ letterSpacing: "0.12em" }}>Duration (min)</span>
                <input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} className="w-24 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--rule)", background: "var(--paper)" }} />
              </label>
              <label className="flex-1 text-sm" style={{ minWidth: 220 }}>
                <span className="dc-thead mb-2 block" style={{ letterSpacing: "0.12em" }}>Action item (optional)</span>
                <input type="text" value={actionItem} onChange={(e) => setActionItem(e.target.value)} placeholder="e.g. Share revision worksheets by Friday" className="w-full rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--rule)", background: "var(--paper)" }} />
              </label>
            </div>
            {error && <p className="text-sm" style={{ color: "var(--clay-600)" }}>{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="dc-btn-ghost">Cancel</button>
              <button type="button" onClick={save} disabled={isPending} className="dc-btn-accent disabled:opacity-50">
                {isPending ? "Saving…" : "Save call log"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
