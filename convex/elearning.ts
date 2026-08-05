import { v } from "convex/values";
import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission, getAuthenticatedUser } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { createNotification } from "./lib/notificationHelpers";

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

/** Fällige Auffrischung: Abschluss älter als refreshAfterMonths. */
function isRefreshDue(p: Doc<"trainingParticipants">, training: Doc<"trainings">, now: number) {
  return !!p.completedAt && !!training.refreshAfterMonths &&
    p.completedAt + training.refreshAfterMonths * MONTH_MS <= now;
}

/** Neue implizite E-Learning-Session (Ort "E-Learning") anlegen. */
async function createElearningSession(
  ctx: MutationCtx, training: Doc<"trainings">, userId: Id<"users">
): Promise<Doc<"trainingSessions">> {
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
    if (training.isArchived || training.status !== "ACTIVE")
      throw new Error("Diese Schulung ist archiviert oder nicht aktiv.");
    // Laufende oder noch gültige Teilnahme wiederverwenden; fällige Auffrischung → Neuanlage
    const sessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_training", (q) => q.eq("trainingId", training._id))
      .filter((q) => q.eq(q.field("location"), "E-Learning"))
      .collect();
    const nowCheck = Date.now();
    let participant: Doc<"trainingParticipants"> | null = null;
    let freeSession: Doc<"trainingSessions"> | null = null;
    for (const s of sessions) {
      const p = await getParticipant(ctx, s._id, user._id);
      if (!p) { freeSession = freeSession ?? s; continue; }
      if (!isRefreshDue(p, training, nowCheck)) { participant = p; break; }
    }
    if (!participant) {
      const session = freeSession ?? await createElearningSession(ctx, training, user._id);
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
    const session = (await ctx.db.get(p.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    if (training.deliveryType !== "elearning") throw new Error("Nur für E-Learning-Schulungen");
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
        .withIndex("by_participant", (q) => q.eq("participantId", p._id))
        .first();
      if (!existing) throw new Error("Zertifikat fehlt trotz abgeschlossener Teilnahme");
      return { certificateId: existing._id };
    }

    const session = (await ctx.db.get(p.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    if (training.deliveryType !== "elearning") throw new Error("Nur für E-Learning-Schulungen");
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

const orgRatingsValidator = v.object({
  venueAccessibility: v.number(), conferenceRooms: v.number(),
  catering: v.number(), staffSupport: v.number(),
});
const orgNaValidator = v.object({
  venueAccessibility: v.boolean(), conferenceRooms: v.boolean(),
  catering: v.boolean(), staffSupport: v.boolean(),
});
const eventRatingsValidator = v.object({
  overallEvent: v.number(), knowledgeUsefulness: v.number(),
  structurePresentation: v.number(), seminarContent: v.number(),
  questionOpportunity: v.number(), seminarMaterials: v.number(),
  speakerExpertise: v.number(), presentationQuality: v.number(),
});

export const generatePackageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "trainings:manage");
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachPackage = mutation({
  args: { trainingId: v.id("trainings"), fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const training = await ctx.db.get(args.trainingId);
    if (!training) throw new Error("Training nicht gefunden");
    await ctx.db.patch(args.trainingId, {
      packageFileId: args.fileId,
      packageVersion: (training.packageVersion ?? 0) + 1,
      deliveryType: "elearning",
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      entityType: "trainings",
      entityId: args.trainingId,
      action: "UPDATE",
      userId: user._id,
      metadata: { packageVersion: (training.packageVersion ?? 0) + 1 },
    });
  },
});

/** Bewertungsbogen 6.2.0: Kurzbericht + Bewertungen, Status FEEDBACK_PENDING → FEEDBACK_DONE. */
export const submitFeedback = mutation({
  args: {
    participantId: v.id("trainingParticipants"),
    shortReport: v.string(),
    organizationRatings: orgRatingsValidator,
    organizationRatingsNa: orgNaValidator,
    eventRatings: eventRatingsValidator,
    badRatingReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:feedback:submit");
    const p = await ctx.db.get(args.participantId);
    if (!p || p.userId !== user._id) throw new Error("Nicht Ihr Teilnahmedatensatz");
    const session = (await ctx.db.get(p.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    if (training.deliveryType !== "elearning") throw new Error("Nur für E-Learning-Schulungen");
    if (p.status !== "FEEDBACK_PENDING") throw new Error("Bogen bereits abgegeben oder Schulung nicht abgeschlossen");

    const words = args.shortReport.trim().split(/\s+/).filter(Boolean).length;
    if (words < 80) throw new Error(`Der Kurzbericht braucht mindestens 80 Wörter (aktuell ${words}).`);

    const eventVals = Object.values(args.eventRatings);
    const orgVals = (Object.keys(args.organizationRatings) as (keyof typeof args.organizationRatings)[])
      .filter((k) => !args.organizationRatingsNa[k])
      .map((k) => args.organizationRatings[k]);
    for (const val of [...eventVals, ...orgVals])
      if (val < 1 || val > 6) throw new Error("Bewertungen müssen zwischen 1 und 6 liegen (oder „entfällt\").");
    if ([...eventVals, ...orgVals].some((r) => r >= 5) && !args.badRatingReason?.trim())
      throw new Error("Sie haben eine 5/6 vergeben — bitte begründen.");

    const now = Date.now();
    const previousStatus = p.status;
    const feedbackId = await ctx.db.insert("trainingFeedback", {
      participantId: p._id, sessionId: p.sessionId, userId: user._id,
      shortReport: args.shortReport,
      organizationRatings: args.organizationRatings,
      organizationRatingsNa: args.organizationRatingsNa,
      eventRatings: args.eventRatings,
      badRatingReason: args.badRatingReason,
      confirmedAt: now,
      isArchived: false, createdAt: now, updatedAt: now, createdBy: user._id, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainingFeedback",
      entityId: feedbackId,
      metadata: { participantId: p._id },
    });

    validateTransition("participantStatus", p.status, "FEEDBACK_DONE");
    await ctx.db.patch(p._id, { status: "FEEDBACK_DONE", updatedAt: now, updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "trainingParticipants",
      entityId: p._id,
      previousStatus,
      newStatus: "FEEDBACK_DONE",
    });
  },
});

/** Bewertungsbogen für Druckansicht: Selbstzugriff oder trainings:manage. */
export const feedbackById = query({
  args: { feedbackId: v.id("trainingFeedback") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const fb = await ctx.db.get(args.feedbackId);
    if (!fb) return null;
    if (fb.userId !== user._id) await requirePermission(ctx, "trainings:manage");
    const p = (await ctx.db.get(fb.participantId))!;
    const session = (await ctx.db.get(fb.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    const author = (await ctx.db.get(fb.userId))!;
    return { fb, trainingTitle: training.title, userName: `${author.firstName} ${author.lastName}`, completedAt: p.completedAt };
  },
});

/** "Meine Schulungen": E-Learning-Trainings des Users mit Fortschritt/Zertifikatsstatus. */
export const myElearning = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const trainings = await ctx.db.query("trainings")
      .withIndex("by_deliveryType", (q) => q.eq("deliveryType", "elearning"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const result = [];
    for (const training of trainings) {
      const sessions = await ctx.db.query("trainingSessions")
        .withIndex("by_training", (q) => q.eq("trainingId", training._id)).collect();
      let participant = null;
      for (const s of sessions) {
        const p = await ctx.db.query("trainingParticipants")
          .withIndex("by_session_user", (q) => q.eq("sessionId", s._id).eq("userId", user._id)).first();
        if (p) participant = p;
      }
      const cert = participant ? await ctx.db.query("certificates")
        .withIndex("by_participant", (q) => q.eq("participantId", participant!._id)).first() : null;
      result.push({
        trainingId: training._id, title: training.title,
        completedAt: participant?.completedAt ?? null,
        validUntil: cert?.validUntil ?? null,
        overdue: cert?.validUntil ? cert.validUntil < Date.now() : false,
        status: participant?.status ?? "OFFEN",
      });
    }
    return result;
  },
});

/** Cron (05:30 UTC): fällige E-Learning-Auffrischungen anmahnen (eine Notification je Fälligkeit). */
export const checkRefreshDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const trainings = await ctx.db
      .query("trainings")
      .withIndex("by_deliveryType", (q) => q.eq("deliveryType", "elearning"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    for (const training of trainings.filter((t) => t.refreshAfterMonths)) {
      const sessions = await ctx.db
        .query("trainingSessions")
        .withIndex("by_training", (q) => q.eq("trainingId", training._id))
        .collect();
      // Teilnahmen je User bündeln: nur mahnen, wenn keine laufende/gültige Teilnahme existiert
      const byUser = new Map<string, Doc<"trainingParticipants">[]>();
      for (const session of sessions) {
        const participants = await ctx.db
          .query("trainingParticipants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const p of participants) {
          const list = byUser.get(String(p.userId)) ?? [];
          list.push(p);
          byUser.set(String(p.userId), list);
        }
      }
      for (const ps of byUser.values()) {
        if (ps.some((p) => !isRefreshDue(p, training, now))) continue;
        // alle Teilnahmen abgelaufen → jüngsten Abschluss anmahnen
        const p = ps.reduce((a, b) => (a.completedAt! >= b.completedAt! ? a : b));

        // Dedup: bereits eine Auffrischungs-Notification zu dieser Teilnahme?
        const existing = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", p.userId))
          .filter((q) =>
            q.and(
              q.eq(q.field("type"), "training_refresh_due"),
              q.eq(q.field("resourceId"), String(p._id))
            )
          )
          .first();
        if (existing) continue;

        await createNotification(ctx, {
          userId: p.userId,
          type: "training_refresh_due",
          title: `Auffrischung fällig: ${training.title}`,
          message: `Ihre Schulung „${training.title}" ist älter als ${training.refreshAfterMonths} Monate. Bitte erneut absolvieren.`,
          resourceType: "trainingParticipants",
          resourceId: String(p._id),
        });
      }
    }
  },
});
