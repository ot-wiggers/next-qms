import { QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/**
 * Standard-Zuständigen für System-Aufgaben finden:
 * erster aktiver, nicht archivierter QMB — Fallback erster aktiver,
 * nicht archivierter Admin — sonst null.
 */
export async function findQmbAssignee(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const qmb = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "qmb"))
    .filter((q) =>
      q.and(
        q.eq(q.field("isArchived"), false),
        q.eq(q.field("status"), "active")
      )
    )
    .first();
  if (qmb) return qmb;

  const admin = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .filter((q) =>
      q.and(
        q.eq(q.field("isArchived"), false),
        q.eq(q.field("status"), "active")
      )
    )
    .first();
  return admin ?? null;
}
