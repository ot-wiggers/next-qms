import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission, getAuthenticatedUser } from "./lib/withAuth";

/** List audit log entries for a specific entity */
export const listByEntity = query({
  args: { entityType: v.string(), entityId: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("desc")
      .collect();
  },
});

/** List recent audit log entries (admin/qmb) */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "admin:settings");
    const results = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
    return results;
  },
});
