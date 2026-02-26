import { query } from "./_generated/server";
import { getAuthenticatedUser } from "./lib/withAuth";
import { hasPermission } from "./lib/permissions";
import type { UserRole } from "../lib/types/enums";

/** Count documents currently in review */
export const openReviews = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const docs = await ctx.db
      .query("documentRecords")
      .withIndex("by_status", (q) => q.eq("status", "IN_REVIEW"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return { count: docs.length };
  },
});

/** Document status distribution for pie chart */
export const documentStatusDistribution = query({
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    const docs = await ctx.db
      .query("documentRecords")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const counts: Record<string, number> = {};
    for (const doc of docs) {
      counts[doc.status] = (counts[doc.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
    }));
  },
});

/** Overdue tasks count */
export const overdueTasks = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const canSeeAll = hasPermission(user.role as UserRole, "tasks:all");
    const canSeeTeam = hasPermission(user.role as UserRole, "tasks:team");

    let tasks = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isOverdue"), true),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .collect();

    if (!canSeeAll && !canSeeTeam) {
      tasks = tasks.filter((t) => t.assigneeId === user._id);
    } else if (!canSeeAll && canSeeTeam) {
      const teamUsers = await ctx.db
        .query("users")
        .withIndex("by_department", (q) => q.eq("departmentId", user.departmentId))
        .collect();
      const teamIds = new Set(teamUsers.map((u) => u._id));
      tasks = tasks.filter((t) => teamIds.has(t.assigneeId));
    }

    return { count: tasks.length };
  },
});

/** Documents with upcoming review dates (next 90 days) */
export const upcomingReviews = query({
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    const now = Date.now();
    const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;

    const docs = await ctx.db
      .query("documentRecords")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("status"), "APPROVED")
        )
      )
      .collect();

    const upcoming = docs
      .filter((d) => d.nextReviewDate && d.nextReviewDate <= ninetyDays)
      .sort((a, b) => (a.nextReviewDate ?? 0) - (b.nextReviewDate ?? 0))
      .slice(0, 10);

    return upcoming.map((d) => ({
      _id: d._id,
      documentCode: d.documentCode,
      title: d.title,
      nextReviewDate: d.nextReviewDate,
      daysUntil: Math.floor(
        ((d.nextReviewDate ?? 0) - now) / (24 * 60 * 60 * 1000)
      ),
    }));
  },
});

/** Training quota — % of required trainings completed */
export const trainingQuota = query({
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);

    const requiredTrainings = await ctx.db
      .query("trainings")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isRequired"), true)
        )
      )
      .collect();

    const activeUsers = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("isArchived"), false)
        )
      )
      .collect();

    if (requiredTrainings.length === 0 || activeUsers.length === 0) {
      return { percentage: 100, completed: 0, total: 0 };
    }

    // Count completed sessions per user
    const total = requiredTrainings.length * activeUsers.length;
    let completed = 0;

    for (const training of requiredTrainings) {
      const sessions = await ctx.db
        .query("trainingSessions")
        .withIndex("by_training", (q) => q.eq("trainingId", training._id))
        .filter((q) => q.eq(q.field("status"), "HELD"))
        .collect();

      const sessionIds = new Set(sessions.map((s) => s._id));

      for (const u of activeUsers) {
        const participation = await ctx.db
          .query("trainingParticipants")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .filter((q) => q.eq(q.field("status"), "ATTENDED"))
          .collect();

        if (participation.some((p) => sessionIds.has(p.sessionId))) {
          completed++;
        }
      }
    }

    return {
      percentage: Math.round((completed / total) * 100),
      completed,
      total,
    };
  },
});

/** Read confirmation rates for approved documents */
export const readConfirmationRates = query({
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);

    const approvedDocs = await ctx.db
      .query("documentRecords")
      .withIndex("by_status", (q) => q.eq("status", "APPROVED"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const activeUserCount = (
      await ctx.db
        .query("users")
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("isArchived"), false)
          )
        )
        .collect()
    ).length;

    if (activeUserCount === 0) return { averageRate: 100, documents: [] };

    const docRates = await Promise.all(
      approvedDocs.slice(0, 20).map(async (doc) => {
        const confirmations = await ctx.db
          .query("readConfirmations")
          .withIndex("by_document", (q) => q.eq("documentRecordId", doc._id))
          .collect();
        const confirmed = new Set(confirmations.map((c) => c.userId)).size;
        return {
          _id: doc._id,
          documentCode: doc.documentCode,
          title: doc.title,
          confirmed,
          total: activeUserCount,
          rate: Math.round((confirmed / activeUserCount) * 100),
        };
      })
    );

    const averageRate =
      docRates.length > 0
        ? Math.round(docRates.reduce((s, d) => s + d.rate, 0) / docRates.length)
        : 100;

    return { averageRate, documents: docRates };
  },
});
