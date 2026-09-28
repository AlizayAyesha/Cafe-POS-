"use client";

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

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-text)] md:w-60">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          What The Food
        </p>
        <p className="mt-1 text-sm text-emerald-50">{name}</p>
        <p className="text-xs text-[var(--sidebar-muted)]">{role}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {visible.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== "/admin" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
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
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
