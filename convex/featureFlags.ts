import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

/** Get a feature flag by key */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/** List all feature flags */
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("featureFlags").collect();
  },
});

/** Update a feature flag (admin only) */
export const update = mutation({
  args: {
    key: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:featureFlags");
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();

    if (flag) {
      await ctx.db.patch(flag._id, {
        enabled: args.enabled,
        updatedAt: now,
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("featureFlags", {
        key: args.key,
        enabled: args.enabled,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "featureFlags",
      entityId: args.key,
      changes: { enabled: args.enabled },
    });
  },
});
