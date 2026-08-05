import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

/** Implizite Session je E-Learning-Training (genau eine, Ort "E-Learning"). */
async function getOrCreateElearningSession(
  ctx: MutationCtx, training: Doc<"trainings">, userId: Id<"users">
): Promise<Doc<"trainingSessions">> {
  const existing = await ctx.db
    .query("trainingSessions")
    .withIndex("by_training", (q) => q.eq("trainingId", training._id))
    .filter((q) => q.eq(q.field("location"), "E-Learning"))
    .first();
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("trainingSessions", {
    trainingId: training._id, scheduledDate: now, location: "E-Learning",
    status: "PLANNED", isArchived: false,
    createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
  });
  await logAuditEvent(ctx, {
    userId,
    action: "CREATE",
    entityType: "trainingSessions",
    entityId: id,
    metadata: { trainingId: training._id, location: "E-Learning" },
  });
  return (await ctx.db.get(id))!;
}

async function getParticipant(ctx: MutationCtx, sessionId: Id<"trainingSessions">, userId: Id<"users">) {
  return await ctx.db
    .query("trainingParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", sessionId).eq("userId", userId))
    .first();
}

/** Player-Start: Teilnehmer anlegen/finden, Wiedereinstiegsdaten liefern. */
export const start = mutation({
  args: { trainingId: v.id("trainings") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:list");
    const training = await ctx.db.get(args.trainingId);
    if (!training || training.deliveryType !== "elearning")
      throw new Error("Kein E-Learning-Training");
    const session = await getOrCreateElearningSession(ctx, training, user._id);
    let participant = await getParticipant(ctx, session._id, user._id);
    if (!participant) {
      const now = Date.now();
      const pid = await ctx.db.insert("trainingParticipants", {
        sessionId: session._id, userId: user._id, status: "INVITED", progress: 0,
        isArchived: false, createdAt: now, updatedAt: now, createdBy: user._id, updatedBy: user._id,
      });
      participant = (await ctx.db.get(pid))!;
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "CREATE",
        entityType: "trainingParticipants",
        entityId: pid,
        metadata: { sessionId: session._id, trainingId: training._id },
      });
    }
    const packageUrl = training.packageFileId ? await ctx.storage.getUrl(training.packageFileId) : null;
    return {
      participantId: participant._id,
      progress: participant.progress ?? 0,
      userName: `${user.firstName} ${user.lastName}`,
      packageUrl,
    };
  },
});

/** Player-Fortschritt: höchstes erreichtes Level speichern (nur aufwärts). */
export const reportProgress = mutation({
  args: { participantId: v.id("trainingParticipants"), level: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:list");
    const p = await ctx.db.get(args.participantId);
    if (!p || p.userId !== user._id) throw new Error("Nicht Ihr Teilnahmedatensatz");
    if ((p.progress ?? 0) < args.level) {
      await ctx.db.patch(p._id, { progress: args.level, updatedAt: Date.now(), updatedBy: user._id });
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "UPDATE",
        entityType: "trainingParticipants",
        entityId: p._id,
        changes: { progress: args.level },
      });
    }
  },
});

/** Player-Abschluss: Status setzen, Score speichern, Zertifikat ausstellen (idempotent). */
export const complete = mutation({
  args: { participantId: v.id("trainingParticipants"), score: v.number(), maxScore: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:list");
    const p = await ctx.db.get(args.participantId);
    if (!p || p.userId !== user._id) throw new Error("Nicht Ihr Teilnahmedatensatz");

    // Idempotent: erster Abschluss gewinnt
    if (p.completedAt) {
      const existing = await ctx.db
        .query("certificates")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("participantId"), p._id))
        .first();
      if (!existing) throw new Error("Zertifikat fehlt trotz abgeschlossener Teilnahme");
      return { certificateId: existing._id };
    }

    const session = (await ctx.db.get(p.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    const now = Date.now();
    const previousStatus = p.status;

    validateTransition("participantStatus", p.status, "ATTENDED");
    validateTransition("participantStatus", "ATTENDED", "FEEDBACK_PENDING");
    await ctx.db.patch(p._id, {
      status: "FEEDBACK_PENDING", attendedAt: now, completedAt: now,
      score: args.score, maxScore: args.maxScore, updatedAt: now, updatedBy: user._id,
    });

    const certificateId = await ctx.db.insert("certificates", {
      userId: user._id, trainingId: training._id, participantId: p._id,
      issuedAt: now,
      validUntil: training.refreshAfterMonths ? now + training.refreshAfterMonths * MONTH_MS : undefined,
      score: args.score, maxScore: args.maxScore,
      snapshotUserName: `${user.firstName} ${user.lastName}`, snapshotTrainingTitle: training.title,
      isArchived: false, createdAt: now, updatedAt: now, createdBy: user._id, updatedBy: user._id,
    });
    // "elearning-complete" ist kein gültiger Audit-Action-String (siehe lib/auditLog.ts);
    // STATUS_CHANGE + previous/newStatus folgt der Konvention aus trainings.ts markAttendance().
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingParticipants",
      entityId: p._id,
      previousStatus,
      newStatus: "FEEDBACK_PENDING",
    });
    return { certificateId };
  },
});
