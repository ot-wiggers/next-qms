import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================================
// Email Templates (German)
// ============================================================

function buildNotificationEmailHtml(
  notification: { title: string; message: string; type: string; resourceType?: string; resourceId?: string },
  user: { firstName: string },
  appUrl: string,
): string {
  const resourceLink =
    notification.resourceType && notification.resourceId
      ? `${appUrl}/${resourceTypeToPath(notification.resourceType)}/${notification.resourceId}`
      : appUrl;

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;padding:16px 24px;">
      <h1 style="color:#fff;margin:0;font-size:16px;font-weight:600;">QMS</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#3f3f46;margin:0 0 8px;">Hallo ${user.firstName},</p>
      <h2 style="color:#18181b;margin:16px 0 8px;font-size:18px;">${notification.title}</h2>
      <p style="color:#52525b;margin:0 0 24px;line-height:1.5;">${notification.message}</p>
      <a href="${resourceLink}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        Im QMS ansehen
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e4e4e7;">
      <p style="color:#a1a1aa;margin:0;font-size:12px;">
        Sie erhalten diese E-Mail, weil Sie im QMS registriert sind.
        <a href="${appUrl}/settings/notifications" style="color:#a1a1aa;">Einstellungen ändern</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildDigestEmailHtml(
  notifications: Array<{ title: string; message: string; type: string }>,
  user: { firstName: string },
  appUrl: string,
  period: string,
): string {
  const rows = notifications
    .map(
      (n) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;"><strong style="color:#18181b;">${n.title}</strong><br><span style="color:#71717a;font-size:13px;">${n.message}</span></td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;padding:16px 24px;">
      <h1 style="color:#fff;margin:0;font-size:16px;font-weight:600;">QMS</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#3f3f46;margin:0 0 8px;">Hallo ${user.firstName},</p>
      <p style="color:#52525b;margin:0 0 16px;">Hier ist Ihre ${period} Zusammenfassung mit ${notifications.length} Benachrichtigung${notifications.length === 1 ? "" : "en"}:</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="margin-top:24px;">
        <a href="${appUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
          Im QMS ansehen
        </a>
      </div>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e4e4e7;">
      <p style="color:#a1a1aa;margin:0;font-size:12px;">
        <a href="${appUrl}/settings/notifications" style="color:#a1a1aa;">Benachrichtigungseinstellungen ändern</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function resourceTypeToPath(resourceType: string): string {
  switch (resourceType) {
    case "documentRecords":
      return "documents";
    case "trainings":
      return "trainings";
    case "trainingRequests":
      return "training-requests";
    case "tasks":
      return "tasks";
    default:
      return "";
  }
}

// ============================================================
// Send single notification email
// ============================================================

export const sendNotificationEmail = internalAction({
  args: {
    notificationId: v.id("notifications"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.runQuery(internal.email.getNotification, {
      id: args.notificationId,
    });
    const user = await ctx.runQuery(internal.email.getUser, { id: args.userId });
    if (!notification || !user) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return; // silently skip if no key configured

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qms.example.com";

    const html = buildNotificationEmailHtml(notification, user, appUrl);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "QMS <noreply@qms.example.com>",
        to: [user.email],
        subject: notification.title,
        html,
      }),
    });
  },
});

// ============================================================
// Digest emails
// ============================================================

export const sendDailyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.email.getUsersWithDigest, {
      frequency: "daily",
    });

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const user of users) {
      const notifications = await ctx.runQuery(
        internal.email.getUnreadNotificationsSince,
        { userId: user._id, since: oneDayAgo }
      );
      if (notifications.length === 0) continue;

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qms.example.com";
      const html = buildDigestEmailHtml(notifications, user, appUrl, "tägliche");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "QMS <noreply@qms.example.com>",
          to: [user.email],
          subject: `QMS — ${notifications.length} neue Benachrichtigung${notifications.length === 1 ? "" : "en"}`,
          html,
        }),
      });
    }
  },
});

export const sendWeeklyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.email.getUsersWithDigest, {
      frequency: "weekly",
    });

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const user of users) {
      const notifications = await ctx.runQuery(
        internal.email.getUnreadNotificationsSince,
        { userId: user._id, since: oneWeekAgo }
      );
      if (notifications.length === 0) continue;

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qms.example.com";
      const html = buildDigestEmailHtml(notifications, user, appUrl, "wöchentliche");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "QMS <noreply@qms.example.com>",
          to: [user.email],
          subject: `QMS Wochenzusammenfassung — ${notifications.length} Benachrichtigung${notifications.length === 1 ? "" : "en"}`,
          html,
        }),
      });
    }
  },
});

// ============================================================
// Internal helper queries (used by actions above)
// ============================================================

import { internalQuery } from "./_generated/server";

export const getNotification = internalQuery({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUser = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUsersWithDigest = internalQuery({
  args: { frequency: v.string() },
  handler: async (ctx, args) => {
    const allPrefs = await ctx.db.query("notificationPreferences").collect();
    const matchingPrefs = allPrefs.filter(
      (p) => p.emailEnabled && p.digestFrequency === args.frequency
    );
    const users = [];
    for (const pref of matchingPrefs) {
      const user = await ctx.db.get(pref.userId);
      if (user && user.status === "active") {
        users.push(user);
      }
    }
    return users;
  },
});

export const getUnreadNotificationsSince = internalQuery({
  args: { userId: v.id("users"), since: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return all.filter((n) => !n.isRead && n.createdAt >= args.since);
  },
});
