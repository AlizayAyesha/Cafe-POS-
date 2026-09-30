"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { upsertStaff } from "@/actions/admin";
import type { Role } from "@prisma/client";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export function StaffForm({ staff }: { staff: Staff | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await upsertStaff(fd);
        router.push("/admin/staff");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2"
    >
      <h2 className="font-semibold md:col-span-2">
        {staff ? "Edit staff" : "Add staff"}
      </h2>
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <input
        name="name"
        required
        placeholder="Full name"
        defaultValue={staff?.name || ""}
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        defaultValue={staff?.email || ""}
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      />
      <select
        name="role"
        defaultValue={staff?.role || "CASHIER"}
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      >
        <option value="CASHIER">Cashier</option>
        <option value="SUPERVISOR">Supervisor</option>
        <option value="ADMIN">Admin</option>
      </select>
      <input
        name="password"
        type="password"
        placeholder={staff ? "New password (optional)" : "Password"}
        required={!staff}
        minLength={6}
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      />
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={staff?.active ?? true}
        />
        Active
      </label>
      {error && <p className="text-sm text-red-700 md:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="touch-btn w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 md:col-span-2 sm:w-fit"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
