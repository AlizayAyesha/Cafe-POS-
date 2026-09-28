"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";

function isNextRedirect(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@whatthefood.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const result = await loginAction(email, password, params.get("callbackUrl"));
        if (result && !result.ok) {
          setError(result.error);
        }
        // Success redirects via Auth.js / Next.js — no client navigation needed
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        setError("Invalid email or password");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Email</label>
        <input
          type="text"
          name="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Password</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
        />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="touch-btn btn-primary w-full px-4 py-3">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
