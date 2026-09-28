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
        <h1 className="text-2xl font-bold tracking-tight">Staff & pay</h1>
        <p className="text-sm text-[var(--muted)]">
          Logins and roles. See each cashier&apos;s cash vs card on Cash drawer during a shift.
          Record salary notes in staff notes for now — full payroll module can come later.
        </p>
      </div>

      <StaffForm staff={editing} />

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
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
