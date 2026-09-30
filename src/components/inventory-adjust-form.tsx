"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStock } from "@/actions/inventory";

export function InventoryAdjustForm({
  items,
}: {
  items: { id: string; name: string; quantity: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = String(fd.get("type")) as "ADD" | "REDUCE" | "ADJUST";
    startTransition(async () => {
      try {
        await adjustStock({
          itemId: String(fd.get("itemId")),
          type,
          quantity: Number(fd.get("quantity") || 0) || 1,
          reason: String(fd.get("reason") || "") || undefined,
          newQuantity:
            type === "ADJUST" ? Number(fd.get("newQuantity")) : undefined,
        });
        setError("");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
    >
      <h2 className="font-semibold sm:col-span-2 lg:col-span-4">Stock adjustment</h2>
      <select
        name="itemId"
        required
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      >
        <option value="">Select item</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.quantity})
          </option>
        ))}
      </select>
      <select
        name="type"
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      >
        <option value="ADD">Add stock</option>
        <option value="REDUCE">Reduce stock</option>
        <option value="ADJUST">Set quantity</option>
      </select>
      <input
        name="quantity"
        type="number"
        step="0.001"
        min="0"
        defaultValue={1}
        placeholder="Qty change"
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      />
      <input
        name="newQuantity"
        type="number"
        step="0.001"
        placeholder="New qty (adjust)"
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
      />
      <input
        name="reason"
        placeholder="Reason / note"
        className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm sm:col-span-2 lg:col-span-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="touch-btn w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Apply"}
      </button>
      {error && <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">{error}</p>}
    </form>
  );
}
