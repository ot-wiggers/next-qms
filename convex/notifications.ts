import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";

/** List unread notifications for the current user */
export const listUnread = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "notifications:read");
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .order("desc")
      .collect();
  },
});

/** List all notifications for the current user (most recent first) */
export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "notifications:read");
    const q = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");

    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.take(50);
  },
});

/** Get count of unread notifications for the current user */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "notifications:read");
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();
    return unread.length;
  },
});

/** Mark a single notification as read */
export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "notifications:read");
    const notification = await ctx.db.get(args.id);
    if (!notification) throw new Error("Benachrichtigung nicht gefunden");
    if (notification.userId !== user._id) {
      throw new Error("Keine Berechtigung");
    }
    await ctx.db.patch(args.id, { isRead: true, readAt: Date.now() });
  },
});

/** Mark all unread notifications as read for the current user */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "notifications:read");
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    const now = Date.now();
    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true, readAt: now });
    }
  },
});

/** Get notification preferences for the current user */
export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "notifications:read");
    return await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

/** Upsert notification preferences */
export const updatePreferences = mutation({
  args: {
    emailEnabled: v.boolean(),
    digestFrequency: v.string(),
    mutedEventTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "notifications:manage");
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        emailEnabled: args.emailEnabled,
        digestFrequency: args.digestFrequency,
        mutedEventTypes: args.mutedEventTypes,
      });
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        emailEnabled: args.emailEnabled,
        digestFrequency: args.digestFrequency,
        mutedEventTypes: args.mutedEventTypes,
      });
    }
  },
});
