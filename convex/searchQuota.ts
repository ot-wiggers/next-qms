import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";

/** Get today's search quota for an organization */
export const getQuota = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "declarations:list");

    const today = new Date().toISOString().split("T")[0];
    const record = await ctx.db
      .query("searchQuota")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", today)
      )
      .first();

    if (!record) {
      return { used: 0, max: 20, remaining: 20 };
    }

    return {
      used: record.count,
      max: record.maxPerDay,
      remaining: Math.max(0, record.maxPerDay - record.count),
    };
  },
});

/** Increment daily search count */
export const incrementQuota = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "declarations:list");

    const today = new Date().toISOString().split("T")[0];
    const record = await ctx.db
      .query("searchQuota")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", today)
      )
      .first();

    if (record) {
      if (record.count >= record.maxPerDay) {
        throw new Error("Tageslimit für Suchen erreicht");
      }
      await ctx.db.patch(record._id, {
        count: record.count + 1,
      });
    } else {
      await ctx.db.insert("searchQuota", {
        organizationId: args.organizationId,
        date: today,
        count: 1,
        maxPerDay: 20,
      });
    }
  },
});
