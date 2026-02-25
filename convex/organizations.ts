import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

/** List all organizations (by type) */
export const list = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "users:list"); // org management tied to admin
    let q = ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("isArchived"), false));

    const all = await q.collect();
    if (args.type) {
      return all.filter((org) => org.type === args.type);
    }
    return all;
  },
});

/** Get organization by ID */
export const getById = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Get children of an organization */
export const getChildren = query({
  args: { parentId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Create organization/location/department (admin only) */
export const create = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    parentId: v.optional(v.id("organizations")),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:settings");
    const now = Date.now();

    const id = await ctx.db.insert("organizations", {
      ...args,
      type: args.type as any,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "organizations",
      entityId: id,
      metadata: { name: args.name, type: args.type },
    });

    return id;
  },
});

/** Update organization (admin only) */
export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    parentId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { id, parentId, ...updates }) => {
    const user = await requirePermission(ctx, "admin:settings");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Organisation nicht gefunden");

    const now = Date.now();
    const patch: Record<string, any> = {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    };

    // Only set parentId if explicitly provided (avoid overwriting with undefined)
    if (parentId !== undefined) {
      patch.parentId = parentId;
    }

    await ctx.db.patch(id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "organizations",
      entityId: id,
      changes: { ...updates, ...(parentId !== undefined ? { parentId } : {}) },
    });
  },
});

/** Archive organization (admin only) */
export const archive = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:settings");
    await archiveRecord(ctx, "organizations", args.id, user._id);
  },
});
