"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { visibleNavLinks } from "@/lib/permissions";

export function AdminNav({
  role,
  name,
  signOutAction,
}: {
  role: Role;
  name: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const visible = visibleNavLinks(role);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          What The Food
        </p>
        <p className="mt-1 text-sm text-emerald-50">{name}</p>
        <p className="text-xs text-[var(--sidebar-muted)]">{role}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-3">
        {visible.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== "/admin" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-3 text-sm font-medium transition md:py-2.5 ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-emerald-100/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOutAction} className="border-t border-white/10 p-3">
        <button
          type="submit"
          className="touch-btn w-full rounded-lg px-3 py-2.5 text-left text-sm text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--sidebar)] px-3 py-3 text-white md:hidden">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="touch-btn flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"
        >
          <span className="sr-only">Menu</span>
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">What The Food</p>
          <p className="truncate text-xs text-emerald-100/70">{name}</p>
        </div>
        <Link
          href="/pos"
          className="touch-btn shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium"
        >
          POS
        </Link>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer (mobile) / sidebar (desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col bg-[var(--sidebar)] text-[var(--sidebar-text)] transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 md:shrink-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
