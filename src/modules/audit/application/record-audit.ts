import { prisma } from "@/core/database";
import type { AuditAction } from "@/modules/audit/domain/actions";

/** Append-only audit writer. Application code must not update/delete these rows. */
export async function recordAudit(input: {
  userId?: string | null;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        details: input.details || null,
      },
    });
  } catch {
    // Never fail the primary business transaction solely due to audit write issues
  }
}
