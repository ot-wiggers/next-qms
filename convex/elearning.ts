import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

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
