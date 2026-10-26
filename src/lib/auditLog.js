import { prisma } from "@/lib/prisma";

export async function createAuditLog({
  userId,
  action,
  entity,
  entityId,
  details,
}) {
  try {
    if (!action || !entity) {
      return;
    }

    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId === undefined || entityId === null ? null : Number(entityId),
        details: details ? String(details).slice(0, 1000) : null,
        userId: userId === undefined || userId === null ? null : Number(userId),
      },
    });
  } catch (error) {
    console.error("AUDIT LOG ERROR:", error?.message || error);
  }
}
