"use client";

export function CsvExportButton({
  filename,
  rows,
  label,
}: {
  filename: string;
  rows: string[][];
  label: string;
}) {
  function download() {
    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
    >
      {label}
    </button>
  );
}
