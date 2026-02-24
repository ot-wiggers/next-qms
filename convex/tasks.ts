import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { hasPermission } from "./lib/permissions";

/** List tasks for current user */
export const myTasks = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("tasks")
      .withIndex("by_assignee_status", (q) =>
        q.eq("assigneeId", user._id)
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** List all tasks (qmb/admin) */
export const listAll = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "tasks:all");
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** List team tasks (department_lead) */
export const teamTasks = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "tasks:team");
    // Get all users in same department
    const teamUsers = await ctx.db
      .query("users")
      .withIndex("by_department", (q) =>
        q.eq("departmentId", user.departmentId)
      )
      .collect();
    const teamUserIds = new Set(teamUsers.map((u) => u._id));

    const allTasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return allTasks.filter((t) => teamUserIds.has(t.assigneeId));
  },
});

/** Create a task */
export const create = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.id("users"),
    dueDate: v.optional(v.number()),
    priority: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("tasks", {
      ...args,
      type: args.type as any,
      priority: args.priority as any,
      status: "OPEN",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "tasks",
      entityId: id,
      metadata: { type: args.type, title: args.title, assigneeId: args.assigneeId },
    });

    return id;
  },
});

/** Update task details (own tasks → anyone; team → dept lead; all → QMB/admin) */
export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await getAuthenticatedUser(ctx);
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Aufgabe nicht gefunden");

    if (task.status === "DONE" || task.status === "CANCELLED") {
      throw new Error("Abgeschlossene Aufgaben können nicht bearbeitet werden");
    }

    // Permission check: own tasks → anyone; team → dept lead; all → QMB/admin
    const isOwn = task.assigneeId === user._id;
    const canAll = hasPermission(user.role as any, "tasks:all");
    const canTeam = hasPermission(user.role as any, "tasks:team");

    if (!isOwn && !canAll && !canTeam) {
      throw new Error("Keine Berechtigung zum Bearbeiten dieser Aufgabe");
    }

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    } as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "tasks",
      entityId: id,
      changes: updates,
    });
  },
});

/** Update task status */
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Aufgabe nicht gefunden");

    validateTransition("taskStatus", task.status, args.status);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "tasks",
      entityId: args.id,
      previousStatus: task.status,
      newStatus: args.status,
    });
  },
});

/** Internal: Mark overdue tasks (called by cron) */
export const checkOverdue = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const openTasks = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .collect();

    for (const task of openTasks) {
      if (task.dueDate && task.dueDate < now && !task.isOverdue) {
        await ctx.db.patch(task._id, {
          isOverdue: true,
          updatedAt: now,
        });
      }
    }
  },
});
