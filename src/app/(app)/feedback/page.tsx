import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff";

const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";

interface CommentLog {
  id: string;
  started_at: string;
  sentiment: string | null;
  summary: string | null;
  topics: string[];
  staff: { name: string } | null;
  family: {
    family_name: string;
    students: { class: { name: string; section: string } | null }[];
  } | null;
}

const SENT_CHIP: Record<string, string> = {
  positive: "dc-chip-olive",
  neutral: "dc-chip-paper",
  negative: "dc-chip-clay",
};
const FILTERS = ["all", "positive", "neutral", "negative"] as const;

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ sentiment?: string }>;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/unregistered");
  const { sentiment } = await searchParams;
  const filter = FILTERS.includes(sentiment as (typeof FILTERS)[number]) ? sentiment! : "all";

  const supabase = await createClient();
  let query = supabase
    .from("call_logs")
    .select(
      "id, started_at, sentiment, summary, topics, staff(name), family:families(family_name, students(class:classes(name, section)))"
    )
    .not("summary", "is", null)
    .order("started_at", { ascending: false })
    .limit(300);
  if (filter !== "all") query = query.eq("sentiment", filter);
  const { data } = await query;
  const comments = (data ?? []) as unknown as CommentLog[];

  return (
    <div className="relative flex flex-col gap-8">
      <svg viewBox="0 0 200 200" width="360" height="360" aria-hidden className="pointer-events-none absolute" style={{ top: -140, right: -100, opacity: 0.1, animation: "swirlSpin 100s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="dc-overline" style={{ fontSize: 12 }}>Parent voice</div>
          <h1 className="dc-h1 mt-1.5">Feedback</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--fg-subtle)" }}>
            Parents&apos; comments dashboard
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === "all" ? "/feedback" : `/feedback?sentiment=${f}`}
              className="dc-pill-option capitalize"
              data-selected={filter === f}
              style={
                filter === f
                  ? { background: "var(--teal-700)", color: "var(--paper)", borderColor: "var(--teal-700)" }
                  : undefined
              }
            >
              {f}
            </Link>
          ))}
        </div>
      </div>

      <section>
        <div className="dc-card overflow-x-auto">
          <div style={{ minWidth: 960 }}>
            <div className="dc-thead grid gap-3 px-6 py-3" style={{ gridTemplateColumns: "0.9fr 1.5fr 1.5fr 1.1fr 0.9fr 3fr", background: "var(--bg-sunken)", borderBottom: "1px solid var(--rule)" }}>
              <span>Std / Div</span>
              <span>Family</span>
              <span>Teacher</span>
              <span>Date &amp; time</span>
              <span>Sentiment</span>
              <span>Parent&apos;s comment</span>
            </div>
            {comments.map((c) => {
              const cls = c.family?.students?.[0]?.class;
              return (
                <div key={c.id} className="grid items-start gap-3 px-6 py-3.5 text-sm" style={{ gridTemplateColumns: "0.9fr 1.5fr 1.5fr 1.1fr 0.9fr 3fr", borderBottom: "1px solid var(--paper-2)" }}>
                  <span className="font-bold" style={{ color: "var(--brand-ink)" }}>
                    {cls ? `${cls.name}-${cls.section}` : "—"}
                  </span>
                  <span className="font-semibold" style={{ color: "var(--teal-700)" }}>{c.family?.family_name ?? "—"}</span>
                  <span style={{ color: "var(--fg-muted)" }}>{c.staff?.name}</span>
                  <span className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>
                    {new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <span>
                    <span className={`dc-chip capitalize ${SENT_CHIP[c.sentiment ?? "neutral"] ?? "dc-chip-paper"}`}>{c.sentiment ?? "—"}</span>
                  </span>
                  <span className="block">
                    <span className="block leading-normal" style={{ color: "var(--fg-muted)" }}>{c.summary}</span>
                    {c.topics.length > 0 && (
                      <span className="mt-1 block text-xs font-semibold" style={{ color: "var(--teal-800)" }}>
                        {c.topics.join(" · ")}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {comments.length === 0 && (
          <div className="dc-card mt-3 p-10 text-center text-sm" style={{ color: "var(--fg-subtle)", borderStyle: "dashed" }}>
            No comments match this filter.
          </div>
        )}
      </section>
    </div>
  );
}
