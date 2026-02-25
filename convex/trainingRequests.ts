import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { hasPermission } from "./lib/permissions";
import type { UserRole } from "../lib/types/enums";

/** List training requests (filtered by role) */
export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    let results;

    if (user.role === "employee") {
      // Employees see only their own requests
      results = await ctx.db
        .query("trainingRequests")
        .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else if (user.role === "department_lead") {
      // Department leads see requests from their department
      const deptUsers = await ctx.db
        .query("users")
        .withIndex("by_department", (q) => q.eq("departmentId", user.departmentId))
        .collect();
      const deptUserIds = new Set(deptUsers.map((u) => u._id));

      const all = await ctx.db
        .query("trainingRequests")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      results = all.filter((r) => deptUserIds.has(r.requesterId));
    } else {
      // QMB/Admin see all
      results = await ctx.db
        .query("trainingRequests")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }

    if (args.status) {
      results = results.filter((r) => r.status === args.status);
    }
    return results;
  },
});

/** Get a training request by ID */
export const getById = query({
  args: { id: v.id("trainingRequests") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db.get(args.id);
  },
});

/** Create a training request (any authenticated user) */
export const create = mutation({
  args: {
    topic: v.string(),
    justification: v.string(),
    urgency: v.string(),
    externalLink: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingRequests:create");
    const now = Date.now();

    const id = await ctx.db.insert("trainingRequests", {
      requesterId: user._id,
      topic: args.topic,
      justification: args.justification,
      urgency: args.urgency as any,
      externalLink: args.externalLink,
      estimatedCost: args.estimatedCost,
      status: "REQUESTED",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    // Create review task for department lead or QMB
    let reviewerId: typeof user._id | undefined;
    if (user.departmentId) {
      const deptLead = await ctx.db
        .query("users")
        .withIndex("by_department", (q) => q.eq("departmentId", user.departmentId))
        .filter((q) =>
          q.and(
            q.eq(q.field("role"), "department_lead"),
            q.eq(q.field("isArchived"), false)
          )
        )
        .first();
      if (deptLead) reviewerId = deptLead._id;
    }

    // Fall back to first QMB if no department lead
    if (!reviewerId) {
      const qmb = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "qmb"))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .first();
      if (qmb) reviewerId = qmb._id;
    }

    if (reviewerId) {
      await ctx.db.insert("tasks", {
        type: "TRAINING_REQUEST_REVIEW" as any,
        title: `Schulungsantrag prüfen: ${args.topic}`,
        description: `${user.firstName} ${user.lastName} hat einen Schulungsantrag eingereicht.`,
        assigneeId: reviewerId,
        status: "OPEN" as any,
        priority: args.urgency === "HIGH" ? ("HIGH" as any) : ("MEDIUM" as any),
        resourceType: "trainingRequests",
        resourceId: id as string,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainingRequests",
      entityId: id,
      metadata: { topic: args.topic, urgency: args.urgency },
    });

    return id;
  },
});

/** Update a training request (creator when REQUESTED, or reviewer) */
export const update = mutation({
  args: {
    id: v.id("trainingRequests"),
    topic: v.optional(v.string()),
    justification: v.optional(v.string()),
    urgency: v.optional(v.string()),
    externalLink: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await getAuthenticatedUser(ctx);
    const request = await ctx.db.get(id);
    if (!request) throw new Error("Schulungsantrag nicht gefunden");

    // Permission logic:
    // - Creator can edit when status === "REQUESTED"
    // - Reviewer (trainingRequests:review) can edit unless COMPLETED/REJECTED
    const isCreator = request.requesterId === user._id;
    const isReviewer = hasPermission(user.role as UserRole, "trainingRequests:review");

    if (isCreator && request.status === "REQUESTED") {
      // OK — creator can edit their own request while it's still requested
    } else if (isReviewer && request.status !== "COMPLETED" && request.status !== "REJECTED") {
      // OK — reviewer can edit unless completed/rejected
    } else {
      throw new Error("Keine Berechtigung zum Bearbeiten dieses Antrags");
    }

    const now = Date.now();
    const patch: Record<string, any> = { updatedAt: now, updatedBy: user._id };
    if (updates.topic !== undefined) patch.topic = updates.topic;
    if (updates.justification !== undefined) patch.justification = updates.justification;
    if (updates.urgency !== undefined) patch.urgency = updates.urgency;
    if (updates.externalLink !== undefined) patch.externalLink = updates.externalLink;
    if (updates.estimatedCost !== undefined) patch.estimatedCost = updates.estimatedCost;

    await ctx.db.patch(id, patch as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "trainingRequests",
      entityId: id,
      changes: updates,
    });
  },
});

/** Approve a training request */
export const approve = mutation({
  args: { id: v.id("trainingRequests") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingRequests:review");
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Schulungsantrag nicht gefunden");

    validateTransition("trainingRequestStatus", request.status, "APPROVED");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "APPROVED" as any,
      reviewedById: user._id,
      reviewedAt: now,
      updatedAt: now,
      updatedBy: user._id,
    });

    // Mark review task as DONE
    const reviewTask = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", "trainingRequests").eq("resourceId", args.id as string)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "TRAINING_REQUEST_REVIEW"),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .first();

    if (reviewTask) {
      await ctx.db.patch(reviewTask._id, {
        status: "DONE" as any,
        updatedAt: now,
        updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingRequests",
      entityId: args.id,
      previousStatus: request.status,
      newStatus: "APPROVED",
    });
  },
});

/** Reject a training request */
export const reject = mutation({
  args: {
    id: v.id("trainingRequests"),
    rejectionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingRequests:review");
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Schulungsantrag nicht gefunden");

    validateTransition("trainingRequestStatus", request.status, "REJECTED");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "REJECTED" as any,
      reviewedById: user._id,
      reviewedAt: now,
      rejectionReason: args.rejectionReason,
      updatedAt: now,
      updatedBy: user._id,
    });

    // Mark review task as DONE
    const reviewTask = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", "trainingRequests").eq("resourceId", args.id as string)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "TRAINING_REQUEST_REVIEW"),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .first();

    if (reviewTask) {
      await ctx.db.patch(reviewTask._id, {
        status: "DONE" as any,
        updatedAt: now,
        updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingRequests",
      entityId: args.id,
      previousStatus: request.status,
      newStatus: "REJECTED",
      metadata: { rejectionReason: args.rejectionReason },
    });
  },
});

/** Link approved request to a training */
export const linkToTraining = mutation({
  args: {
    id: v.id("trainingRequests"),
    trainingId: v.id("trainings"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingRequests:review");
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Schulungsantrag nicht gefunden");

    validateTransition("trainingRequestStatus", request.status, "PLANNED");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "PLANNED" as any,
      linkedTrainingId: args.trainingId,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingRequests",
      entityId: args.id,
      previousStatus: request.status,
      newStatus: "PLANNED",
      metadata: { linkedTrainingId: args.trainingId },
    });
  },
});
