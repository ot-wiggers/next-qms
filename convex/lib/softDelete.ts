import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { logAuditEvent } from "./auditLog";

/**
 * Soft-delete (archive) a record. Sets isArchived=true and logs the event.
 * NEVER hard-delete — ISO 13485 requires full traceability.
 */
export async function archiveRecord<T extends string>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  userId: Id<"users">
): Promise<void> {
  const now = Date.now();

  await ctx.db.patch(id as any, {
    isArchived: true,
    archivedAt: now,
    archivedBy: userId,
    updatedAt: now,
    updatedBy: userId,
  } as any);

  await logAuditEvent(ctx, {
    userId,
    action: "ARCHIVE",
    entityType: table,
    entityId: id as string,
  });
}
