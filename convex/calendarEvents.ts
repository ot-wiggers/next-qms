import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

// ============================================================
// Calendar Events — CRUD for user-created events
// ============================================================

/**
 * List calendar events visible to the current user.
 * Returns: own events (public + private) + other users' public events.
 * Optional date range filtering via startDate/endDate args.
 */
export const list = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    let events = await ctx.db
      .query("calendarEvents")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Filter: own events (all) + others' public events
    events = events.filter(
      (e) => e.createdByUserId === user._id || !e.isPrivate
    );

    // Optional date range filtering
    if (args.startDate !== undefined) {
      events = events.filter((e) => {
        const eventEnd = e.endDate ?? e.startDate;
        return eventEnd >= args.startDate!;
      });
    }
    if (args.endDate !== undefined) {
      events = events.filter((e) => e.startDate <= args.endDate!);
    }

    return events;
  },
});

/** Create a calendar event */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    color: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("calendarEvents", {
      ...args,
      createdByUserId: user._id,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
      isArchived: false,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "calendarEvents",
      entityId: id,
      metadata: { title: args.title },
    });

    return id;
  },
});

/** Update a calendar event (only creator can edit) */
export const update = mutation({
  args: {
    id: v.id("calendarEvents"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    location: v.optional(v.string()),
    color: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await getAuthenticatedUser(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Termin nicht gefunden");

    if (existing.createdByUserId !== user._id) {
      throw new Error("Nur der Ersteller kann diesen Termin bearbeiten");
    }

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "calendarEvents",
      entityId: id,
      changes: updates,
    });
  },
});

/** Archive (soft-delete) a calendar event (only creator can archive) */
export const archive = mutation({
  args: {
    id: v.id("calendarEvents"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Termin nicht gefunden");

    if (existing.createdByUserId !== user._id) {
      throw new Error("Nur der Ersteller kann diesen Termin löschen");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      archivedBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "ARCHIVE",
      entityType: "calendarEvents",
      entityId: args.id,
    });
  },
});
