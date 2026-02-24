import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

interface AuditLogEntry {
  userId?: Id<"users">;
  action: "CREATE" | "UPDATE" | "STATUS_CHANGE" | "ARCHIVE" | "FILE_UPLOAD" | "PERMISSION_CHANGE" | "LOGIN" | "LOGOUT";
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event. Call this from every mutation that modifies data.
 */
export async function logAuditEvent(
  ctx: MutationCtx,
  entry: AuditLogEntry
): Promise<void> {
  await ctx.db.insert("auditLog", {
    ...entry,
    timestamp: Date.now(),
  });
}
