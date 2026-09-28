"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReceiving } from "@/actions/ospos";

export function ReceivingForm({
  items,
  suppliers,
}: {
  items: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [lines, setLines] = useState([
    { inventoryItemId: "", quantity: "1", unitCost: "0" },
  ]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createReceiving({
          supplierId: String(fd.get("supplierId") || "") || null,
          reference: String(fd.get("reference") || "") || null,
          notes: String(fd.get("notes") || "") || null,
          items: lines
            .filter((l) => l.inventoryItemId && Number(l.quantity) > 0)
            .map((l) => ({
              inventoryItemId: l.inventoryItemId,
              quantity: Number(l.quantity),
              unitCost: Number(l.unitCost) || 0,
            })),
        });
        setError("");
        setLines([{ inventoryItemId: "", quantity: "1", unitCost: "0" }]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <h2 className="font-semibold">New receiving</h2>
      <div className="grid gap-2 md:grid-cols-3">
        <select
          name="supplierId"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="">No supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          name="reference"
          placeholder="PO / reference #"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          name="notes"
          placeholder="Notes"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid gap-2 md:grid-cols-3">
          <select
            required
            value={l.inventoryItemId}
            onChange={(e) =>
              setLines((prev) =>
                prev.map((x, idx) =>
                  idx === i ? { ...x, inventoryItemId: e.target.value } : x
                )
              )
            }
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="">Inventory item</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={l.quantity}
            onChange={(e) =>
              setLines((prev) =>
                prev.map((x, idx) =>
                  idx === i ? { ...x, quantity: e.target.value } : x
                )
              )
            }
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={l.unitCost}
            onChange={(e) =>
              setLines((prev) =>
                prev.map((x, idx) =>
                  idx === i ? { ...x, unitCost: e.target.value } : x
                )
              )
            }
            placeholder="Unit cost"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          className="text-sm text-amber-800"
          onClick={() =>
            setLines((p) => [
              ...p,
              { inventoryItemId: "", quantity: "1", unitCost: "0" },
            ])
          }
        >
          + Line
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Receive stock"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
