export type AppRole = "CASHIER" | "SUPERVISOR" | "ADMIN";

const rank: Record<AppRole, number> = {
  CASHIER: 1,
  SUPERVISOR: 2,
  ADMIN: 3,
};

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  const key = String(role).toUpperCase();
  if (key === "CASHIER" || key === "SUPERVISOR" || key === "ADMIN") return key;
  return null;
}

export function hasMinRole(
  userRole: string | null | undefined,
  required: AppRole
): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  return rank[normalized] >= rank[required];
}

export function isAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === "ADMIN";
}

export function canAccessPos(role: string | null | undefined): boolean {
  return hasMinRole(role, "CASHIER");
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  return hasMinRole(role, "SUPERVISOR");
}

export function canVoidSales(role: string | null | undefined): boolean {
  return hasMinRole(role, "SUPERVISOR");
}

export function canCloseRegister(role: string | null | undefined): boolean {
  return hasMinRole(role, "SUPERVISOR");
}

export function canManageCatalog(role: string | null | undefined): boolean {
  return hasMinRole(role, "ADMIN");
}

export function canManageStaff(role: string | null | undefined): boolean {
  return hasMinRole(role, "ADMIN");
}

export function canViewAudit(role: string | null | undefined): boolean {
  return hasMinRole(role, "ADMIN");
}

/** Primary nav — lean for café operations */
export const navAccess: { href: string; label: string; minRole: AppRole }[] = [
  { href: "/admin", label: "Dashboard", minRole: "SUPERVISOR" },
  { href: "/pos", label: "POS", minRole: "CASHIER" },
  { href: "/admin/orders", label: "Orders", minRole: "SUPERVISOR" },
  { href: "/admin/menu", label: "Menu", minRole: "ADMIN" },
  { href: "/admin/analytics", label: "Analytics", minRole: "SUPERVISOR" },
  { href: "/admin/register", label: "Cash drawer", minRole: "SUPERVISOR" },
  { href: "/admin/inventory", label: "Stock", minRole: "SUPERVISOR" },
  { href: "/admin/customers", label: "Customers", minRole: "SUPERVISOR" },
  { href: "/admin/gift-cards", label: "Gift cards", minRole: "SUPERVISOR" },
  { href: "/admin/staff", label: "Staff & pay", minRole: "ADMIN" },
  { href: "/admin/audit", label: "Activity log", minRole: "ADMIN" },
  { href: "/admin/settings", label: "Café settings", minRole: "ADMIN" },
];

export function visibleNavLinks(role: string | null | undefined) {
  if (isAdmin(role)) return navAccess;
  return navAccess.filter((l) => hasMinRole(role, l.minRole));
}
