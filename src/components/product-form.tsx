"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { upsertProduct } from "@/actions/products";

type Category = { id: string; name: string; active: boolean };
type InventoryItem = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description: string | null;
  price: unknown;
  categoryId: string;
  sku: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isTemporary: boolean;
  availableFrom: Date | null;
  availableTo: Date | null;
  trackInventory: boolean;
  inventoryItemId: string | null;
};

function priceStr(p: unknown): string {
  if (typeof p === "number") return String(p);
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && "toString" in p) return String(p);
  return "";
}

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function ProductForm({
  categories,
  inventoryItems,
  product,
  redirectTo = "/admin/menu",
}: {
  categories: Category[];
  inventoryItems: InventoryItem[];
  product: Product | null;
  redirectTo?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [uploading, setUploading] = useState(false);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/product", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("imageUrl", imageUrl);
    startTransition(async () => {
      try {
        await upsertProduct(fd);
        setError("");
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card-surface grid gap-3 p-5 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 font-semibold text-[var(--ink)]">
        {product ? "Edit menu item" : "Add menu item"}
      </h2>
      {product && <input type="hidden" name="id" value={product.id} />}
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Name</span>
        <input
          name="name"
          required
          defaultValue={product?.name || ""}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Category</span>
        <select
          name="categoryId"
          required
          defaultValue={product?.categoryId || categories[0]?.id}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Price (Rs)</span>
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={product ? priceStr(product.price) : ""}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">SKU / code</span>
        <input
          name="sku"
          defaultValue={product?.sku || ""}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">Description</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={product?.description || ""}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        />
      </label>

      <div className="md:col-span-2 space-y-2">
        <span className="block text-sm text-[var(--muted)]">Food photo</span>
        <div className="flex flex-wrap items-start gap-4">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-24 w-24 rounded-xl object-cover border border-[var(--line)]"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] text-xs text-[var(--muted)]">
              No photo
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="btn-primary touch-btn w-full px-4 py-2 text-sm sm:w-auto"
            >
              {uploading ? "Uploading…" : "Upload image"}
            </button>
            <input
              name="imageUrl"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Or paste image URL"
              className="block w-full min-w-0 max-w-full rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Available from</span>
        <input
          name="availableFrom"
          type="datetime-local"
          defaultValue={toLocalInput(product?.availableFrom || null)}
          className="w-full min-w-0 max-w-full rounded-lg border border-[var(--line)] px-3 py-2.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Available to</span>
        <input
          name="availableTo"
          type="datetime-local"
          defaultValue={toLocalInput(product?.availableTo || null)}
          className="w-full min-w-0 max-w-full rounded-lg border border-[var(--line)] px-3 py-2.5"
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="mb-1 block text-[var(--muted)]">Link inventory item</span>
        <select
          name="inventoryItemId"
          defaultValue={product?.inventoryItemId || ""}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
        >
          <option value="">None</option>
          {inventoryItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={product?.isActive ?? true}
          />
          Available on POS
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isTemporary"
            defaultChecked={product?.isTemporary ?? false}
          />
          Temporary item
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="trackInventory"
            defaultChecked={product?.trackInventory ?? false}
          />
          Track stock on sale
        </label>
      </div>
      {error && <p className="md:col-span-2 text-sm text-red-700">{error}</p>}
      <div className="md:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary px-5 py-2.5">
          {pending ? "Saving…" : product ? "Update item" : "Add to menu"}
        </button>
      </div>
    </form>
  );
}
