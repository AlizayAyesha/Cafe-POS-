import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top right, #bbf7d0aa, transparent 55%), radial-gradient(ellipse at bottom left, #dcfce7, transparent 50%), linear-gradient(165deg, #f4faf6, #e8f5ee)",
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--line)] bg-white/95 p-8 shadow-sm backdrop-blur">
        <p
          className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]"
          style={{ fontFamily: "var(--font-accent), serif" }}
        >
          Café POS
        </p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight text-[var(--ink)]"
          style={{ fontFamily: "var(--font-accent), serif" }}
        >
          What The Food
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Staff sign-in for counter & kitchen
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-xs text-[var(--muted)]">
          Admin: admin@whatthefood.local · password123
        </p>
      </div>
    </main>
  );
}
