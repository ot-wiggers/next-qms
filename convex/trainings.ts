import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";

// ============================================================
// Trainings
// ============================================================

/** List all trainings */
export const list = query({
  args: { status: v.optional(v.string()), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    let results = await ctx.db
      .query("trainings")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    if (args.status) results = results.filter((t) => t.status === args.status);
    if (args.category) results = results.filter((t) => t.category === args.category);
    return results;
  },
});

/** Get training by ID */
export const getById = query({
  args: { id: v.id("trainings") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db.get(args.id);
  },
});

/** Create a training */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isRequired: v.boolean(),
    effectivenessCheckAfterDays: v.number(),
    targetOrganizationIds: v.optional(v.array(v.id("organizations"))),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:create");
    const now = Date.now();

    const id = await ctx.db.insert("trainings", {
      ...args,
      status: "ACTIVE",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainings",
      entityId: id,
      metadata: { title: args.title },
    });

    return id;
  },
});

/** Update a training */
export const update = mutation({
  args: {
    id: v.id("trainings"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
    effectivenessCheckAfterDays: v.optional(v.number()),
    targetOrganizationIds: v.optional(v.array(v.id("organizations"))),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Schulung nicht gefunden");

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "trainings",
      entityId: id,
      changes: updates,
    });
  },
});

/** Archive a training */
export const archive = mutation({
  args: { id: v.id("trainings") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    await archiveRecord(ctx, "trainings", args.id, user._id);
  },
});

// ============================================================
// Training Sessions
// ============================================================

/** List upcoming planned sessions (for calendar integration) */
export const listUpcomingSessions = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "trainings:list");
    const now = Date.now();

    const sessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_scheduledDate")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "PLANNED"),
          q.gte(q.field("scheduledDate"), now),
          q.eq(q.field("isArchived"), false)
        )
      )
      .collect();

    // Join with training to get title
    const results = await Promise.all(
      sessions.map(async (session) => {
        const training = await ctx.db.get(session.trainingId);
        return {
          ...session,
          trainingTitle: training?.title ?? "Unbekannte Schulung",
        };
      })
    );

    return results;
  },
});

/** List sessions for a training */
export const listSessions = query({
  args: { trainingId: v.id("trainings") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db
      .query("trainingSessions")
      .withIndex("by_training", (q) => q.eq("trainingId", args.trainingId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Get session by ID */
export const getSession = query({
  args: { id: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db.get(args.id);
  },
});

/** Create a session */
export const createSession = mutation({
  args: {
    trainingId: v.id("trainings"),
    scheduledDate: v.number(),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    trainerId: v.optional(v.id("users")),
    trainerName: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const now = Date.now();

    const id = await ctx.db.insert("trainingSessions", {
      ...args,
      status: "PLANNED",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainingSessions",
      entityId: id,
      metadata: { trainingId: args.trainingId, scheduledDate: args.scheduledDate },
    });

    return id;
  },
});

/** Update session details (only when PLANNED — ISO 13485 compliance) */
export const updateSession = mutation({
  args: {
    id: v.id("trainingSessions"),
    scheduledDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    trainerId: v.optional(v.id("users")),
    trainerName: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Schulungstermin nicht gefunden");
    if (session.status !== "PLANNED") {
      throw new Error("Nur geplante Termine können bearbeitet werden");
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
      entityType: "trainingSessions",
      entityId: id,
      changes: updates,
    });
  },
});

/** Update session status (PLANNED → HELD → CLOSED, or PLANNED → CANCELLED) */
export const updateSessionStatus = mutation({
  args: {
    id: v.id("trainingSessions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Schulungstermin nicht gefunden");

    validateTransition("sessionStatus", session.status, args.status);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingSessions",
      entityId: args.id,
      previousStatus: session.status,
      newStatus: args.status,
    });

    // Business rule: When session marked HELD → move INVITED participants to FEEDBACK_PENDING + create tasks
    if (args.status === "HELD") {
      const participants = await ctx.db
        .query("trainingParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.id))
        .filter((q) => q.eq(q.field("status"), "INVITED"))
        .collect();

      // Mark remaining INVITED as NO_SHOW (they didn't mark attendance before HELD)
      // Participants who were marked ATTENDED stay as-is
      for (const p of participants) {
        await ctx.db.patch(p._id, {
          status: "NO_SHOW" as any,
          updatedAt: now,
          updatedBy: user._id,
        });
      }

      // Move ATTENDED participants to FEEDBACK_PENDING
      const attendedParticipants = await ctx.db
        .query("trainingParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.id))
        .filter((q) => q.eq(q.field("status"), "ATTENDED"))
        .collect();

      for (const p of attendedParticipants) {
        await ctx.db.patch(p._id, {
          status: "FEEDBACK_PENDING" as any,
          updatedAt: now,
          updatedBy: user._id,
        });

        // Create feedback task
        await ctx.db.insert("tasks", {
          type: "TRAINING_FEEDBACK" as any,
          title: "Schulungsfeedback abgeben",
          description: `Bitte geben Sie Ihr Feedback zur Schulung ab.`,
          assigneeId: p.userId,
          status: "OPEN" as any,
          priority: "MEDIUM" as any,
          resourceType: "trainingSessions",
          resourceId: args.id as string,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          createdBy: user._id,
          updatedBy: user._id,
        });
      }
    }
  },
});

// ============================================================
// Training Participants
// ============================================================

/** List participants for a session */
export const listParticipants = query({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db
      .query("trainingParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

/** Add participant to a session */
export const addParticipant = mutation({
  args: {
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");

    // Check not already added
    const existing = await ctx.db
      .query("trainingParticipants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", args.userId)
      )
      .first();
    if (existing) throw new Error("Teilnehmer bereits hinzugefügt");

    // Check max participants
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Schulungstermin nicht gefunden");
    if (session.maxParticipants) {
      const count = await ctx.db
        .query("trainingParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
      if (count.length >= session.maxParticipants) {
        throw new Error("Maximale Teilnehmerzahl erreicht");
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert("trainingParticipants", {
      sessionId: args.sessionId,
      userId: args.userId,
      status: "INVITED",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainingParticipants",
      entityId: id,
      metadata: { sessionId: args.sessionId, participantUserId: args.userId },
    });

    return id;
  },
});

/** Mark attendance for a participant */
export const markAttendance = mutation({
  args: {
    participantId: v.id("trainingParticipants"),
    attended: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Teilnehmer nicht gefunden");

    const targetStatus = args.attended ? "ATTENDED" : "NO_SHOW";
    validateTransition("participantStatus", participant.status, targetStatus);

    const now = Date.now();
    await ctx.db.patch(args.participantId, {
      status: targetStatus as any,
      attendedAt: args.attended ? now : undefined,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingParticipants",
      entityId: args.participantId,
      previousStatus: participant.status,
      newStatus: targetStatus,
    });
  },
});

/** Remove participant from session (only if INVITED) */
export const removeParticipant = mutation({
  args: { participantId: v.id("trainingParticipants") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Teilnehmer nicht gefunden");
    if (participant.status !== "INVITED") {
      throw new Error("Teilnehmer kann nur im Status 'Eingeladen' entfernt werden");
    }

    await archiveRecord(ctx, "trainingParticipants", args.participantId, user._id);
  },
});
