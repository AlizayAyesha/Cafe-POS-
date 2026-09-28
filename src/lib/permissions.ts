/** Compatibility shim — prefer importing from @/core/permissions */
export {
  type AppRole,
  normalizeRole,
  hasMinRole,
  isAdmin,
  canAccessPos,
  canAccessAdmin,
  canVoidSales,
  canCloseRegister,
  canManageCatalog,
  canManageStaff,
  canViewAudit,
  navAccess,
  visibleNavLinks,
} from "@/core/permissions";

import { hasMinRole, canManageCatalog, canManageStaff } from "@/core/permissions";

export function canManageProducts(role: string | null | undefined) {
  return canManageCatalog(role);
}
export function canManageInventory(role: string | null | undefined) {
  return hasMinRole(role, "SUPERVISOR");
}
export function canManageSettings(role: string | null | undefined) {
  return canManageStaff(role);
}
export function canViewReports(role: string | null | undefined) {
  return hasMinRole(role, "SUPERVISOR");
}
export function canManageSchedule(role: string | null | undefined) {
  return hasMinRole(role, "SUPERVISOR");
}
export function canViewAllOrders(role: string | null | undefined) {
  return hasMinRole(role, "SUPERVISOR");
}
