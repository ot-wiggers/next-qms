import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

const classification = v.union(
  v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"), v.literal("EMPFEHLUNG")
);

/** Findings eines Audits */
export const listByAudit = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    return await ctx.db
      .query("auditFindings")
      .withIndex("by_audit", (q) => q.eq("auditId", args.auditId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Finding erfassen — optional aus einer bewerteten Antwort heraus */
export const create = mutation({
  args: {
    auditId: v.id("audits"),
    answerId: v.optional(v.id("auditChecklistAnswers")),
    classification,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.auditId);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status === "CLOSED" || audit.status === "CANCELLED") {
      throw new Error("Abgeschlossene Audits können keine neuen Findings erhalten");
    }
    const description = args.description.trim();
    if (!description) throw new Error("Beschreibung ist erforderlich");
    let chapter: string | undefined;
    if (args.answerId) {
      const answer = await ctx.db.get(args.answerId);
      if (answer) chapter = answer.chapter;
    }
    const now = Date.now();
    const id = await ctx.db.insert("auditFindings", {
      auditId: args.auditId,
      answerId: args.answerId,
      chapter,
      classification: args.classification,
      description,
      status: "OPEN",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "auditFindings", entityId: id,
      metadata: { classification: args.classification, chapter },
    });
    return id;
  },
});

/** Finding als erledigt markieren (z.B. nach CAPA-Abschluss) */
export const resolve = mutation({
  args: { id: v.id("auditFindings") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const finding = await ctx.db.get(args.id);
    if (!finding) throw new Error("Finding nicht gefunden");
    if (finding.status === "RESOLVED") return;
    await ctx.db.patch(args.id, {
      status: "RESOLVED", updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "auditFindings", entityId: args.id,
      previousStatus: finding.status, newStatus: "RESOLVED",
    });
  },
});
