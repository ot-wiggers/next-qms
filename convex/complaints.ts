import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";
import { createNotification } from "./lib/notificationHelpers";

const assessmentArg = v.union(
  v.literal("JUSTIFIED"), v.literal("UNJUSTIFIED"), v.literal("GOODWILL")
);
const VIGILANCE_DEFAULT_DEADLINE_MS = 15 * 24 * 60 * 60 * 1000; // MDR Art. 87: 15 Tage Standard

/** Nächste Reklamationsnummer im Jahres-Nummernkreis (REK-2026-01) */
async function nextComplaintNumber(ctx: MutationCtx, year: number) {
  const existing = await ctx.db
    .query("complaints")
    .withIndex("by_year", (q) => q.eq("year", year))
    .collect();
  const seq = existing.length === 0 ? 1 : Math.max(...existing.map((c) => c.seq)) + 1;
  return { seq, complaintNumber: `REK-${year}-${String(seq).padStart(2, "0")}` };
}

/** Reklamationen auflisten (optional nach Status/Jahr) */
export const list = query({
  args: { status: v.optional(v.string()), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "complaints:list");
    let results = await ctx.db
      .query("complaints")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (args.status) results = results.filter((c) => c.status === args.status);
    if (args.year !== undefined) results = results.filter((c) => c.year === args.year);
    return results.sort((a, b) => b.year - a.year || b.seq - a.seq);
  },
});

/** Reklamation inkl. Produkt- und CAPA-Bezug */
export const getById = query({
  args: { id: v.id("complaints") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "complaints:list");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) return null;
    const product = complaint.productId ? await ctx.db.get(complaint.productId) : null;
    const capa = complaint.capaId ? await ctx.db.get(complaint.capaId) : null;
    const assignee = complaint.assigneeId ? await ctx.db.get(complaint.assigneeId) : null;
    return {
      ...complaint,
      productName: product?.name ?? null,
      capaNumber: capa?.capaNumber ?? null,
      assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
    };
  },
});

/** Reklamation erfassen */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    receivedAt: v.number(),
    receivedVia: v.optional(v.string()),
    customerName: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    productText: v.optional(v.string()),
    failureCategory: v.optional(v.string()),
    otwinRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:create");
    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");
    if (args.receivedAt > Date.now()) throw new Error("Eingangsdatum liegt in der Zukunft");
    // UTC-Jahresgrenze bewusst akzeptiert (Convex läuft UTC)
    const year = new Date(args.receivedAt).getFullYear();
    const { seq, complaintNumber } = await nextComplaintNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("complaints", {
      ...args,
      title,
      description: args.description?.trim() || undefined,
      customerName: args.customerName?.trim() || undefined,
      productText: args.productText?.trim() || undefined,
      complaintNumber, year, seq,
      isVigilanceRelevant: false,
      status: "RECEIVED",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "complaints", entityId: id,
      metadata: { complaintNumber },
    });
    return id;
  },
});

/** Felder ändern (vor Abschluss) */
export const update = mutation({
  args: {
    id: v.id("complaints"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    receivedVia: v.optional(v.string()),
    customerName: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    productText: v.optional(v.string()),
    failureCategory: v.optional(v.string()),
    correctionNote: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    otwinRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (complaint.status === "CLOSED") {
      throw new Error("Abgeschlossene Reklamationen können nicht geändert werden");
    }
    const patch: Partial<Doc<"complaints">> = {
      updatedAt: Date.now(), updatedBy: user._id,
    };
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Titel ist erforderlich");
      patch.title = title;
    }
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.receivedVia !== undefined) patch.receivedVia = args.receivedVia.trim() || undefined;
    if (args.customerName !== undefined) patch.customerName = args.customerName.trim() || undefined;
    if (args.productText !== undefined) patch.productText = args.productText.trim() || undefined;
    if (args.failureCategory !== undefined) patch.failureCategory = args.failureCategory.trim() || undefined;
    if (args.correctionNote !== undefined) patch.correctionNote = args.correctionNote.trim() || undefined;
    if (args.otwinRef !== undefined) patch.otwinRef = args.otwinRef.trim() || undefined;
    if (args.productId !== undefined) patch.productId = args.productId;
    if (args.assigneeId !== undefined) patch.assigneeId = args.assigneeId;
    await ctx.db.patch(args.id, patch);
    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "complaints", entityId: args.id, changes,
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "COMPLAINT_ASSIGNED",
        title: `Reklamation zugewiesen: ${complaint.complaintNumber}`,
        message: complaint.title,
        resourceType: "complaints",
        resourceId: args.id,
      });
    }
  },
});

/** Bewertung dokumentieren (Pflicht vor Abschluss) + Vigilanz-Einstufung */
export const assess = mutation({
  args: {
    id: v.id("complaints"),
    assessment: assessmentArg,
    assessmentNote: v.optional(v.string()),
    isVigilanceRelevant: v.boolean(),
    vigilanceDeadline: v.optional(v.number()), // Override für 2-/10-Tage-Fälle
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (complaint.status === "CLOSED") {
      throw new Error("Abgeschlossene Reklamationen können nicht geändert werden");
    }
    const patch: Partial<Doc<"complaints">> = {
      assessment: args.assessment,
      assessmentNote: args.assessmentNote?.trim() || undefined,
      isVigilanceRelevant: args.isVigilanceRelevant,
      updatedAt: Date.now(), updatedBy: user._id,
    };
    if (args.isVigilanceRelevant) {
      patch.vigilanceDeadline =
        args.vigilanceDeadline ?? complaint.receivedAt + VIGILANCE_DEFAULT_DEADLINE_MS;
    } else {
      patch.vigilanceDeadline = undefined;
    }
    await ctx.db.patch(args.id, patch);
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "complaints", entityId: args.id,
      changes: {
        assessment: args.assessment,
        isVigilanceRelevant: args.isVigilanceRelevant,
        vigilanceDeadline: patch.vigilanceDeadline,
      },
    });
  },
});

/** Vigilanz-Meldung dokumentieren */
export const recordVigilanceReport = mutation({
  args: {
    id: v.id("complaints"),
    vigilanceReportedAt: v.number(),
    vigilanceReportReference: v.optional(v.string()),
    vigilanceReportChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (!complaint.isVigilanceRelevant) {
      throw new Error("Reklamation ist nicht als vigilanzrelevant eingestuft");
    }
    await ctx.db.patch(args.id, {
      vigilanceReportedAt: args.vigilanceReportedAt,
      vigilanceReportReference: args.vigilanceReportReference?.trim() || undefined,
      vigilanceReportChannel: args.vigilanceReportChannel?.trim() || undefined,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "complaints", entityId: args.id,
      changes: { vigilanceReportedAt: args.vigilanceReportedAt },
    });
  },
});

/** Statuswechsel — Abschluss nur mit dokumentierter Bewertung; Vigilanz-Meldung muss vor Abschluss erfasst sein */
export const setStatus = mutation({
  args: { id: v.id("complaints"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx, args.status === "CLOSED" ? "complaints:close" : "complaints:manage"
    );
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    validateTransition("complaintStatus", complaint.status, args.status);
    if (args.status === "CLOSED") {
      if (!complaint.assessment) {
        throw new Error("Abschluss nur mit dokumentierter Bewertung (berechtigt/unberechtigt/Kulanz)");
      }
      if (complaint.isVigilanceRelevant && !complaint.vigilanceReportedAt) {
        throw new Error("Vigilanzrelevante Reklamationen erst nach dokumentierter Meldung abschließbar");
      }
    }
    const now = Date.now();
    const patch: Partial<Doc<"complaints">> = {
      // validateTransition hat den Wert geprüft
      status: args.status as Doc<"complaints">["status"],
      closedAt: args.status === "CLOSED" ? now : complaint.closedAt,
      updatedAt: now, updatedBy: user._id,
    };
    await ctx.db.patch(args.id, patch);
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "complaints", entityId: args.id,
      previousStatus: complaint.status, newStatus: args.status,
    });
  },
});

/** Reklamation archivieren (Soft-Delete) */
export const archive = mutation({
  args: { id: v.id("complaints") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    await archiveRecord(ctx, "complaints", args.id, user._id);
  },
});
