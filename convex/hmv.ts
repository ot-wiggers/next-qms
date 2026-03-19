import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

// ============================================================
// HMV Cache (Hilfsmittelverzeichnis)
// ============================================================

/** Upsert HMV cache entries from REHADAT API data */
export const upsertCacheEntries = mutation({
  args: {
    entries: v.array(
      v.object({
        rehadatId: v.string(),
        hmvNummer: v.string(),
        displayName: v.string(),
        level: v.number(),
        parentRehadatId: v.optional(v.string()),
        herstellerName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");
    const now = Date.now();

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("hmvCache")
        .withIndex("by_rehadatId", (q) => q.eq("rehadatId", entry.rehadatId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          hmvNummer: entry.hmvNummer,
          displayName: entry.displayName,
          level: entry.level,
          parentRehadatId: entry.parentRehadatId,
          herstellerName: entry.herstellerName,
          lastSynced: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("hmvCache", {
          rehadatId: entry.rehadatId,
          hmvNummer: entry.hmvNummer,
          displayName: entry.displayName,
          level: entry.level,
          parentRehadatId: entry.parentRehadatId,
          herstellerName: entry.herstellerName,
          lastSynced: now,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

/** Get cached HMV entries by parent for tree browsing */
export const getCachedChildren = query({
  args: {
    parentRehadatId: v.optional(v.string()),
    level: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    if (args.parentRehadatId) {
      return await ctx.db
        .query("hmvCache")
        .withIndex("by_parent", (q) =>
          q.eq("parentRehadatId", args.parentRehadatId as string)
        )
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }

    // Top-level: get level 1 entries
    return await ctx.db
      .query("hmvCache")
      .withIndex("by_level", (q) => q.eq("level", 1))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Search HMV cache by number or name */
export const searchCache = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    const term = args.searchTerm.toLowerCase();

    const allEntries = await ctx.db
      .query("hmvCache")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const results: typeof allEntries = [];
    for (const entry of allEntries) {
      // Bidirectional matching: entry contains term OR term contains entry number
      if (
        entry.hmvNummer.toLowerCase().includes(term) ||
        term.includes(entry.hmvNummer.toLowerCase()) ||
        entry.displayName.toLowerCase().includes(term)
      ) {
        results.push(entry);
        if (results.length >= 50) break;
      }
    }

    // Sort: most specific (longest hmvNummer) first
    results.sort((a, b) => b.hmvNummer.length - a.hmvNummer.length);

    return results;
  },
});

// ============================================================
// HMV Marked Items (Versorgungsspektrum)
// ============================================================

/** Mark HMV item as Versorgungsspektrum */
export const markItem = mutation({
  args: {
    hmvNummer: v.string(),
    hmvLevel: v.union(
      v.literal("produktgruppe"),
      v.literal("anwendungsort"),
      v.literal("untergruppe"),
      v.literal("produktart")
    ),
    displayName: v.string(),
    rehadatId: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "hmv:mark");
    const now = Date.now();

    // Duplicate check scoped by organizationId for multi-tenancy
    const existing = await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("hmvNummer"), args.hmvNummer))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("hmvMarkedItems", {
      hmvNummer: args.hmvNummer,
      hmvLevel: args.hmvLevel,
      displayName: args.displayName,
      rehadatId: args.rehadatId,
      organizationId: args.organizationId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "hmvMarkedItems",
      entityId: id,
      metadata: {
        hmvNummer: args.hmvNummer,
        displayName: args.displayName,
        hmvLevel: args.hmvLevel,
      },
    });

    return id;
  },
});

/** Remove HMV marking */
export const unmarkItem = mutation({
  args: {
    hmvNummer: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "hmv:mark");

    // Scoped to organization for multi-tenancy
    const item = await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("hmvNummer"), args.hmvNummer))
      .first();

    if (!item) {
      throw new Error("HMV-Markierung nicht gefunden");
    }

    await ctx.db.delete(item._id);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "hmvMarkedItems",
      entityId: item._id,
      metadata: {
        hmvNummer: args.hmvNummer,
        displayName: item.displayName,
      },
    });
  },
});

/** List all marked items for an organization */
export const listMarkedItems = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    return await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
  },
});

/** Check if specific HMV number is marked */
export const isMarked = query({
  args: {
    hmvNummer: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    // Scoped to organization for multi-tenancy
    const item = await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("hmvNummer"), args.hmvNummer))
      .first();

    return item !== null;
  },
});
