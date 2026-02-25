import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requirePermission, getAuthenticatedUser } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

/** Get current authenticated user profile (returns null if not logged in) */
export const me = query({
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) return null;

    // createOrUpdateUser returns our users table _id,
    // so getAuthUserId gives us that _id directly.
    const user = await ctx.db.get(authUserId as any);
    return user ?? null;
  },
});

/**
 * Complete user profile after registration.
 * The auth callback already created the user row with defaults —
 * this patches in the real name.
 */
export const createProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Nicht authentifiziert");

    const user = await ctx.db.get(authUserId as any);
    if (!user) throw new Error("Benutzer nicht gefunden");

    // Patch in the profile details
    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      updatedAt: Date.now(),
    } as any);

    return user._id;
  },
});

/** Update own profile (any authenticated user — name + email only) */
export const updateSelf = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const updates: Record<string, any> = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.email !== undefined) updates.email = args.email;

    if (Object.keys(updates).length === 0) return;

    const now = Date.now();
    await ctx.db.patch(user._id, {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    } as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "users",
      entityId: user._id,
      changes: updates,
      metadata: { selfEdit: true },
    });
  },
});

/** List all active users (requires users:list) */
export const list = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "users:list");
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Get user by ID */
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db.get(args.id);
  },
});

/** Create a new user (admin only) */
export const create = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.string(),
    organizationId: v.id("organizations"),
    locationId: v.optional(v.id("organizations")),
    departmentId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requirePermission(ctx, "users:create");
    const now = Date.now();

    const id = await ctx.db.insert("users", {
      ...args,
      role: args.role as any,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
    });

    await logAuditEvent(ctx, {
      userId: currentUser._id,
      action: "CREATE",
      entityType: "users",
      entityId: id,
      metadata: { email: args.email, role: args.role },
    });

    return id;
  },
});

/** Update a user (admin only) */
export const update = mutation({
  args: {
    id: v.id("users"),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    locationId: v.optional(v.id("organizations")),
    departmentId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const currentUser = await requirePermission(ctx, "users:update");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Benutzer nicht gefunden");

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
      updatedBy: currentUser._id,
    } as any);

    await logAuditEvent(ctx, {
      userId: currentUser._id,
      action: "UPDATE",
      entityType: "users",
      entityId: id,
      changes: updates,
    });
  },
});

/** Archive a user (soft delete — admin only) */
export const archive = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await requirePermission(ctx, "users:archive");
    await archiveRecord(ctx, "users", args.id, currentUser._id);
  },
});
