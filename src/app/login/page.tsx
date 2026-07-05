"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MicrosoftButton } from "./microsoft-button";

const SSO_ENABLED = process.env.NEXT_PUBLIC_MICROSOFT_SSO === "1";

const SPIRAL =
  "M100 100 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a15 15 0 0 1 30 0 a20 20 0 0 1 -40 0 a25 25 0 0 1 50 0 a30 30 0 0 1 -60 0 a35 35 0 0 1 70 0 a40 40 0 0 1 -80 0";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(!SSO_ENABLED);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/today");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6" style={{ background: "var(--bg)" }}>
      <svg viewBox="0 0 200 200" width="520" height="520" aria-hidden className="pointer-events-none absolute" style={{ top: -160, left: -160, opacity: 0.13, animation: "swirlSpin 120s linear infinite" }}>
        <path d={SPIRAL} fill="none" stroke="var(--brass-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 200 200" width="560" height="560" aria-hidden className="pointer-events-none absolute" style={{ bottom: -200, right: -180, opacity: 0.09, animation: "swirlSpin 150s linear infinite reverse" }}>
        <path d={SPIRAL} fill="none" stroke="var(--teal-500)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="dc-rise relative w-full max-w-[400px] rounded-xl px-10 py-12 text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--rule)", boxShadow: "var(--shadow-md)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-crest.png" alt="The World School crest" className="mx-auto h-[76px] w-[76px]" />
        <h1 className="mt-4 text-[35px] leading-none" style={{ fontFamily: "var(--font-serif)", fontWeight: 800, color: "var(--brand-ink)" }}>
          Parent Connect CRM
        </h1>
        <p className="mt-2.5 text-[11px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--brand-accent-ink)" }}>
          Convey, Discuss, Execute
        </p>
        <hr className="dc-ornament my-5" />
        <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
          Parent Connect CRM for Kolte Foundation Educational Institution&apos;s
          The World School (ICSE), Bhusawal.
        </p>

        {SSO_ENABLED && (
          <>
            <MicrosoftButton />
            <p className="mt-4 text-xs leading-normal" style={{ color: "var(--fg-subtle)" }}>
              Your name, email, role and profile photo are taken from your
              Microsoft account.
            </p>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="mt-3 text-xs font-semibold"
              style={{ color: "var(--teal-700)" }}
            >
              {showPassword ? "Hide password sign-in" : "Sign in with password instead"}
            </button>
          </>
        )}

        {showPassword && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-left">
            <div>
              <label className="block text-xs font-bold uppercase" style={{ letterSpacing: "0.12em", color: "var(--fg-subtle)" }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--rule)", background: "var(--paper)", color: "var(--fg)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase" style={{ letterSpacing: "0.12em", color: "var(--fg-subtle)" }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid var(--rule)", background: "var(--paper)", color: "var(--fg)" }}
              />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--clay-600)" }}>{error}</p>}
            <button type="submit" disabled={loading} className="dc-btn-primary w-full disabled:opacity-50">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        <p className="mt-4 text-xs" style={{ color: "var(--fg-subtle)" }}>
          CRM by{" "}
          <a href="https://kolte.biz" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: "var(--teal-700)" }}>
            Kolte Enterprises Private Limited
          </a>
        </p>
      </div>
    </main>
  );
}
