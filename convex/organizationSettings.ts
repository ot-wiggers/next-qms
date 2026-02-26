import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    organizationId: v.id("organizations"),
    logoFileId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:settings");
    const now = Date.now();

    const existing = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        logoFileId: args.logoFileId,
        logoFileName: args.logoFileName,
        primaryColor: args.primaryColor,
        secondaryColor: args.secondaryColor,
        updatedAt: now,
        updatedBy: user._id,
      } as any);
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "UPDATE",
        entityType: "organizationSettings",
        entityId: existing._id,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("organizationSettings", {
      organizationId: args.organizationId,
      logoFileId: args.logoFileId,
      logoFileName: args.logoFileName,
      primaryColor: args.primaryColor,
      secondaryColor: args.secondaryColor,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "organizationSettings",
      entityId: id,
    });
    return id;
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requirePermission(ctx, "admin:settings");
    return await ctx.storage.generateUploadUrl();
  },
});
