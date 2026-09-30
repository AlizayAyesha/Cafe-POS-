import { listAuditLogs } from "@/actions/ospos";

export default async function AuditPage() {
  const logs = await listAuditLogs(150);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Activity log</h1>
        <p className="text-sm text-[var(--muted)]">
          Who changed prices, voided sales, opened the drawer, or adjusted stock — for when money
          or inventory doesn&apos;t match
        </p>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {logs.map((l) => (
          <div key={l.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-stone-500">{l.createdAt.toLocaleString()}</p>
            <p className="mt-1 font-semibold break-words">{l.action}</p>
            <p className="text-sm text-stone-600">{l.user?.name || "System"}</p>
            <p className="mt-1 break-all text-xs text-stone-500">
              {[l.entityType, l.entityId, l.details].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            No audit events yet
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-stone-50">
                <td className="whitespace-nowrap px-4 py-3">
                  {l.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3">{l.user?.name || "System"}</td>
                <td className="px-4 py-3 font-medium">{l.action}</td>
                <td className="max-w-md break-all px-4 py-3 text-stone-600">
                  {[l.entityType, l.entityId, l.details].filter(Boolean).join(" · ")}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                  No audit events yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
