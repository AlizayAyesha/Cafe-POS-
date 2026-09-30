import { listStaff } from "@/actions/admin";
import { StaffForm } from "@/components/staff-form";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const sp = await searchParams;
  const staff = await listStaff();
  const editing = staff.find((s) => s.id === sp.edit) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Staff & pay</h1>
        <p className="text-sm text-[var(--muted)]">
          Logins and roles. See each cashier&apos;s cash vs card on Cash drawer during a shift.
          Record salary notes in staff notes for now — full payroll module can come later.
        </p>
      </div>

      <StaffForm staff={editing} />

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {staff.map((s) => (
          <div
            key={s.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold">{s.name}</p>
              <p className="break-all text-sm text-stone-600">{s.email}</p>
              <p className="mt-1 text-xs text-stone-500">
                {s.role} · {s.active ? "Active" : "Disabled"}
              </p>
            </div>
            <a
              href={`/admin/staff?edit=${s.id}`}
              className="touch-btn shrink-0 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent)]"
            >
              Edit
            </a>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-stone-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3">{s.role}</td>
                <td className="px-4 py-3">{s.active ? "Active" : "Disabled"}</td>
                <td className="px-4 py-3">
                  <a href={`/admin/staff?edit=${s.id}`} className="text-[var(--accent)]">
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
