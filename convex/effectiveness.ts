import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";

// ============================================================
// Training Feedback Submission
// ============================================================

/** Generate a file upload URL for certificate/participant list uploads */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requirePermission(ctx, "trainings:feedback:submit");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Submit training feedback (Schulungsbewertungsbogen 6.2.0) */
export const submitFeedback = mutation({
  args: {
    participantId: v.id("trainingParticipants"),
    sessionId: v.id("trainingSessions"),
    shortReport: v.string(),
    organizationRatings: v.object({
      venueAccessibility: v.number(),
      conferenceRooms: v.number(),
      catering: v.number(),
      staffSupport: v.number(),
    }),
    eventRatings: v.object({
      overallEvent: v.number(),
      knowledgeUsefulness: v.number(),
      structurePresentation: v.number(),
      seminarContent: v.number(),
      questionOpportunity: v.number(),
      seminarMaterials: v.number(),
      speakerExpertise: v.number(),
      presentationQuality: v.number(),
    }),
    badRatingReason: v.optional(v.string()),
    certificateFileId: v.optional(v.id("_storage")),
    certificateFileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:feedback:submit");

    // Verify participant exists and is in correct status
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Teilnehmer nicht gefunden");
    if (participant.userId !== user._id) {
      throw new Error("Feedback kann nur für eigene Teilnahme abgegeben werden");
    }

    validateTransition("participantStatus", participant.status, "FEEDBACK_DONE");

    // Validate shortReport minimum length
    if (args.shortReport.trim().length < 30) {
      throw new Error("Der Kurzbericht muss mindestens 30 Zeichen lang sein");
    }

    // Validate all ratings are 1-6
    const allRatings = [
      ...Object.values(args.organizationRatings),
      ...Object.values(args.eventRatings),
    ];
    for (const rating of allRatings) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 6) {
        throw new Error("Bewertungen müssen zwischen 1 und 6 liegen");
      }
    }

    // If any rating is 5 or 6, badRatingReason is required
    const hasBadRating = allRatings.some((r) => r >= 5);
    if (hasBadRating && (!args.badRatingReason || args.badRatingReason.trim().length === 0)) {
      throw new Error(
        "Bei einer Bewertung von 5 oder 6 muss eine Begründung angegeben werden"
      );
    }

    const now = Date.now();

    // Insert feedback record
    const feedbackId = await ctx.db.insert("trainingFeedback", {
      participantId: args.participantId,
      sessionId: args.sessionId,
      userId: user._id,
      shortReport: args.shortReport,
      organizationRatings: args.organizationRatings,
      eventRatings: args.eventRatings,
      badRatingReason: args.badRatingReason,
      certificateFileId: args.certificateFileId,
      certificateFileName: args.certificateFileName,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    // Transition participant to FEEDBACK_DONE
    await ctx.db.patch(args.participantId, {
      status: "FEEDBACK_DONE" as any,
      updatedAt: now,
      updatedBy: user._id,
    });

    // Mark associated TRAINING_FEEDBACK task as DONE
    const feedbackTask = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", "trainingSessions").eq("resourceId", args.sessionId as string)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("assigneeId"), user._id),
          q.eq(q.field("type"), "TRAINING_FEEDBACK"),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .first();

    if (feedbackTask) {
      await ctx.db.patch(feedbackTask._id, {
        status: "DONE" as any,
        updatedAt: now,
        updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainingFeedback",
      entityId: feedbackId,
      metadata: { participantId: args.participantId, sessionId: args.sessionId },
    });

    return feedbackId;
  },
});

/** Get feedback for a session */
export const listFeedback = query({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db
      .query("trainingFeedback")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

/** Get feedback by participant */
export const getFeedbackByParticipant = query({
  args: { participantId: v.id("trainingParticipants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db
      .query("trainingFeedback")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();
  },
});

// ============================================================
// Effectiveness Checks
// ============================================================

/** Submit effectiveness check (reviewer) */
export const submitEffectivenessCheck = mutation({
  args: {
    participantId: v.id("trainingParticipants"),
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    goalAchieved: v.boolean(),
    applicationVisible: v.boolean(),
    errorRateReduced: v.boolean(),
    decision: v.string(),
    justification: v.string(),
  },
  handler: async (ctx, args) => {
    const reviewer = await requirePermission(ctx, "trainings:effectiveness:review");

    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Teilnehmer nicht gefunden");

    validateTransition("participantStatus", participant.status, args.decision);

    const now = Date.now();

    // Insert effectiveness check record
    const checkId = await ctx.db.insert("effectivenessChecks", {
      participantId: args.participantId,
      sessionId: args.sessionId,
      userId: args.userId,
      reviewerId: reviewer._id,
      dueDate: now, // already due since being submitted
      completedAt: now,
      goalAchieved: args.goalAchieved,
      applicationVisible: args.applicationVisible,
      errorRateReduced: args.errorRateReduced,
      decision: args.decision as any,
      justification: args.justification,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: reviewer._id,
      updatedBy: reviewer._id,
    });

    // Transition participant status
    await ctx.db.patch(args.participantId, {
      status: args.decision as any,
      updatedAt: now,
      updatedBy: reviewer._id,
    });

    // Mark associated TRAINING_EFFECTIVENESS task as DONE
    const effectivenessTask = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", "trainingParticipants").eq("resourceId", args.participantId as string)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("assigneeId"), reviewer._id),
          q.eq(q.field("type"), "TRAINING_EFFECTIVENESS"),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .first();

    if (effectivenessTask) {
      await ctx.db.patch(effectivenessTask._id, {
        status: "DONE" as any,
        updatedAt: now,
        updatedBy: reviewer._id,
      });
    }

    // If INEFFECTIVE → transition to REQUIRES_ACTION + create follow-up task
    if (args.decision === "INEFFECTIVE") {
      await ctx.db.patch(args.participantId, {
        status: "REQUIRES_ACTION" as any,
        updatedAt: now,
        updatedBy: reviewer._id,
      });

      // Create follow-up task for QMB/department lead
      await ctx.db.insert("tasks", {
        type: "FOLLOW_UP" as any,
        title: "Nachschulung erforderlich — Wirksamkeitsprüfung nicht bestanden",
        description: `Die Wirksamkeitsprüfung für einen Teilnehmer war nicht erfolgreich. Bitte Maßnahmen einleiten.`,
        assigneeId: reviewer._id,
        status: "OPEN" as any,
        priority: "HIGH" as any,
        resourceType: "trainingParticipants",
        resourceId: args.participantId as string,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: reviewer._id,
        updatedBy: reviewer._id,
      });

      // TODO: CAPA trigger placeholder — when CAPA module is implemented,
      // create a CAPA action linked to this ineffective training result
    }

    await logAuditEvent(ctx, {
      userId: reviewer._id,
      action: "CREATE",
      entityType: "effectivenessChecks",
      entityId: checkId,
      metadata: {
        participantId: args.participantId,
        decision: args.decision,
      },
    });

    return checkId;
  },
});

/** Get effectiveness check for a participant */
export const getByParticipant = query({
  args: { participantId: v.id("trainingParticipants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db
      .query("effectivenessChecks")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();
  },
});

/** List effectiveness checks for a session */
export const listBySession = query({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainings:list");
    return await ctx.db
      .query("effectivenessChecks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

/** Internal: Check for due effectiveness checks (called by cron) */
export const checkDue = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // Find participants in FEEDBACK_DONE status
    const feedbackDoneParticipants = await ctx.db
      .query("trainingParticipants")
      .withIndex("by_status", (q) => q.eq("status", "FEEDBACK_DONE"))
      .collect();

    for (const participant of feedbackDoneParticipants) {
      // Get the session to find the training
      const session = await ctx.db.get(participant.sessionId);
      if (!session) continue;

      // Get the training to find effectivenessCheckAfterDays
      const training = await ctx.db.get(session.trainingId);
      if (!training) continue;

      // Check if enough time has passed since feedback was done
      const daysSinceFeedback = (now - participant.updatedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceFeedback >= training.effectivenessCheckAfterDays) {
        // Transition to EFFECTIVENESS_PENDING
        await ctx.db.patch(participant._id, {
          status: "EFFECTIVENESS_PENDING" as any,
          updatedAt: now,
        });

        // Get the participant's department lead or QMB for the review task
        const participantUser = await ctx.db.get(participant.userId);
        if (!participantUser) continue;

        // Find reviewer: department lead of participant's department, or fall back to session trainer
        let reviewerId = session.trainerId;
        if (participantUser.departmentId) {
          const deptUsers = await ctx.db
            .query("users")
            .withIndex("by_department", (q) =>
              q.eq("departmentId", participantUser.departmentId)
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("role"), "department_lead"),
                q.eq(q.field("isArchived"), false)
              )
            )
            .first();
          if (deptUsers) reviewerId = deptUsers._id;
        }

        if (reviewerId) {
          // Create effectiveness check task
          await ctx.db.insert("tasks", {
            type: "TRAINING_EFFECTIVENESS" as any,
            title: `Wirksamkeitsprüfung: ${training.title}`,
            description: `Bitte prüfen Sie die Wirksamkeit der Schulung für den Teilnehmer.`,
            assigneeId: reviewerId,
            dueDate: now + 7 * 24 * 60 * 60 * 1000, // 7 days to complete
            status: "OPEN" as any,
            priority: "MEDIUM" as any,
            resourceType: "trainingParticipants",
            resourceId: participant._id as string,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  },
});
