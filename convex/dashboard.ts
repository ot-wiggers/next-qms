import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { hasPermission } from "./lib/permissions";
import type { UserRole } from "../lib/types/enums";

// ============================================================
// Dashboard-Scope: who sees whose data
//   all  → dashboard:view_all (QMB, Auditor) → org-weit (kein Filter)
//   team → tasks:team (Abteilungsleitung)    → eigene Abteilung
//   own  → sonst (Mitarbeiter)               → nur eigene
// ============================================================
type DashboardScope = "own" | "team" | "all";

function resolveScope(role: UserRole): DashboardScope {
  if (hasPermission(role, "dashboard:view_all")) return "all";
  if (hasPermission(role, "tasks:team")) return "team";
  return "own";
}

/** Nutzer-Ids im Scope; null = org-weit (kein Filter). */
async function scopedUserIds(
  ctx: QueryCtx,
  user: { _id: Id<"users">; departmentId?: Id<"organizations"> },
  scope: DashboardScope,
): Promise<Set<Id<"users">> | null> {
  if (scope === "all") return null;
  const deptId = user.departmentId;
  if (scope === "own" || !deptId) return new Set([user._id]);
  const team = await ctx.db
    .query("users")
    .withIndex("by_department", (q) => q.eq("departmentId", deptId))
    .filter((q) => q.eq(q.field("isArchived"), false))
    .collect();
  const ids = new Set(team.map((u) => u._id));
  ids.add(user._id);
  return ids;
}

/** Dokumente in Prüfung im Scope (own = von mir verantwortete) */
export const openReviews = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));

    const docs = await ctx.db
      .query("documentRecords")
      .withIndex("by_status", (q) => q.eq("status", "IN_REVIEW"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const scoped = userIds === null ? docs : docs.filter((d) => userIds.has(d.responsibleUserId));
    return { count: scoped.length };
  },
});

/** Document status distribution for pie chart */
export const documentStatusDistribution = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "dashboard:view_all");
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

/** Überfällige Aufgaben im Scope (own/team/all) */
export const overdueTasks = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));

    const tasks = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isOverdue"), true),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED"),
        ),
      )
      .collect();

    const scoped = userIds === null ? tasks : tasks.filter((t) => t.assigneeId && userIds.has(t.assigneeId));
    return { count: scoped.length };
  },
});

/** Anstehende Überprüfungen (90 Tage) im Scope (own = von mir verantwortete) */
export const upcomingReviews = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));
    const now = Date.now();
    const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;

    const docs = await ctx.db
      .query("documentRecords")
      .filter((q) =>
        q.and(q.eq(q.field("isArchived"), false), q.eq(q.field("status"), "APPROVED")),
      )
      .collect();

    const upcoming = docs
      .filter(
        (d) =>
          (userIds === null || userIds.has(d.responsibleUserId)) &&
          d.nextReviewDate !== undefined &&
          d.nextReviewDate <= ninetyDays,
      )
      .sort((a, b) => (a.nextReviewDate ?? 0) - (b.nextReviewDate ?? 0))
      .slice(0, 10);

    return upcoming.map((d) => ({
      _id: d._id,
      documentCode: d.documentCode,
      title: d.title,
      nextReviewDate: d.nextReviewDate,
      daysUntil: Math.floor(((d.nextReviewDate ?? 0) - now) / (24 * 60 * 60 * 1000)),
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
