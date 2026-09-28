"use server";

import { prisma } from "@/lib/prisma";

export async function writeAudit(
  userId: string | null | undefined,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        details: details || null,
      },
    });
  } catch {
    // never block primary flow on audit failure
  }
}
