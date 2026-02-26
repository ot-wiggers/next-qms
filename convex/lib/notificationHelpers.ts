import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: string;
    title: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
  }
) {
  // Check if user has muted this notification type
  const prefs = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();

  if (prefs?.mutedEventTypes?.includes(args.type)) return;

  const notificationId = await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    message: args.message,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    isRead: false,
    createdAt: Date.now(),
  });

  return notificationId;
}

export async function createNotificationsForUsers(
  ctx: MutationCtx,
  userIds: Id<"users">[],
  notification: Omit<Parameters<typeof createNotification>[1], "userId">
) {
  for (const userId of userIds) {
    await createNotification(ctx, { ...notification, userId });
  }
}
