"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";
import type { StaffRole } from "@/lib/types";

interface ShellProps {
  staff: { name: string; email: string; role: StaffRole };
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "coordinator"], icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { href: "/today", label: "Parent Connect", roles: null, icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" },
  { href: "/history", label: "History", roles: null, icon: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" },
  { href: "/feedback", label: "Feedback", roles: null, icon: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" },
  { href: "/families", label: "Families", roles: null, icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
];

export function Shell({ staff, children }: ShellProps) {
  const pathname = usePathname();
  const [sideOpen, setSideOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV.filter((n) => !n.roles || n.roles.includes(staff.role));

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-50" style={{ background: "var(--teal-700)", borderBottom: "2px solid var(--brass-500)", boxShadow: "var(--shadow-sm)" }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-2.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-crest.png" alt="The World School crest" className="h-[42px] w-[42px] rounded-full p-0.5" style={{ background: "var(--white)" }} />
            <div className="leading-tight">
              <span className="block text-base font-bold text-white">Parent Connect CRM</span>
              <span className="block text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.18em", color: "var(--brass-400)" }}>
                The World School (ICSE) · Parent Connect
              </span>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} className="flex cursor-pointer items-center gap-2.5 p-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--white)", color: "var(--teal-700)" }}>
                {staff.name.replace(/^(Mr\.|Ms\.|Mrs\.|CA|CS)\s*/i, "").slice(0, 1)}
              </span>
              <span className="hidden text-[13px] font-semibold sm:block" style={{ color: "var(--teal-200)" }}>{staff.name}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-[60] mt-2.5 min-w-[264px] rounded-xl p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--rule)", boxShadow: "var(--shadow-md)" }}>
                <p className="text-[15px] font-bold" style={{ color: "var(--brand-ink)" }}>{staff.name}</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--fg-subtle)" }}>{staff.email}</p>
                <span className="dc-chip dc-chip-teal mt-2.5 uppercase" style={{ letterSpacing: "0.1em", fontSize: 11 }}>{staff.role}</span>
                <hr className="my-3.5" style={{ border: 0, borderTop: "1px solid var(--rule)" }} />
                <p className="mb-3 flex items-center gap-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
                  <svg width="12" height="12" viewBox="0 0 21 21" aria-hidden>
                    <rect width="10" height="10" fill="#F25022" /><rect x="11" width="10" height="10" fill="#7FBA00" /><rect y="11" width="10" height="10" fill="#00A4EF" /><rect x="11" y="11" width="10" height="10" fill="#FFB900" />
                  </svg>
                  Signed in {staff.email.endsWith("worldschool.demo") ? "with password" : "with Microsoft SSO"}
                </p>
                <form action={signOut}>
                  <button className="w-full rounded-lg px-3.5 py-2 text-[13px] font-semibold" style={{ color: "var(--clay-600)", border: "1px solid var(--rule)", background: "transparent" }}>
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex items-stretch">
        <aside
          className="sticky flex flex-col gap-1 overflow-hidden px-3 py-4"
          style={{
            flex: "none",
            width: sideOpen ? 216 : 66,
            background: "var(--teal-800)",
            transition: "width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            top: 65,
            height: "calc(100vh - 65px)",
          }}
        >
          <button
            onClick={() => setSideOpen((v) => !v)}
            title={sideOpen ? "Collapse menu" : "Expand menu"}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
            style={{ color: "var(--teal-300)", background: "none", border: "none" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sideOpen ? "none" : "rotate(180deg)", transition: "transform 240ms", flex: "none" }}>
              <path d="m11 17-5-5 5-5 M18 17l-5-5 5-5" />
            </svg>
            {sideOpen && (
              <span className="whitespace-nowrap text-[11px] font-bold uppercase" style={{ letterSpacing: "0.12em" }}>Menu</span>
            )}
          </button>
          {items.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  color: active ? "var(--white)" : "var(--teal-300)",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  boxShadow: active ? "inset 3px 0 0 var(--brass-500)" : "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                  <path d={n.icon} />
                </svg>
                {sideOpen && <span className="whitespace-nowrap text-sm font-semibold">{n.label}</span>}
              </Link>
            );
          })}
        </aside>

        <div className="min-w-0 flex-1">
          <main className="mx-auto max-w-[1200px] px-6 pb-6 pt-10">{children}</main>
          <footer className="mx-auto max-w-[1200px] px-6 pb-8 pt-6">
            <hr className="dc-ornament mb-4" />
            <p className="text-center text-xs" style={{ color: "var(--fg-subtle)" }}>
              Kolte Foundation Educational Institution&apos;s The World School (ICSE), Bhusawal · Affiliation No: MA234
            </p>
            <p className="mt-1.5 text-center text-xs" style={{ color: "var(--fg-subtle)" }}>
              CRM by{" "}
              <a href="https://kolte.biz" target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: "var(--teal-700)" }}>
                Kolte Enterprises Private Limited
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
