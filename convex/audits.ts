import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";

/** Audits auflisten (optional nach Jahr/Status gefiltert) */
export const list = query({
  args: {
    year: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    let results;
    if (args.year !== undefined) {
      results = await ctx.db
        .query("audits")
        .withIndex("by_year", (q) => q.eq("auditYear", args.year!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      results = await ctx.db
        .query("audits")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }
    if (args.status) results = results.filter((a) => a.status === args.status);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Audit inkl. Antworten und Findings */
export const getById = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audit = await ctx.db.get(args.id);
    if (!audit) return null;
    const answers = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const findings = await ctx.db
      .query("auditFindings")
      .withIndex("by_audit", (q) => q.eq("auditId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const leadAuditor = audit.leadAuditorId ? await ctx.db.get(audit.leadAuditorId) : null;
    return {
      ...audit,
      answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
      findings: findings.sort((a, b) => a.createdAt - b.createdAt),
      leadAuditorName: leadAuditor ? `${leadAuditor.firstName} ${leadAuditor.lastName}` : null,
    };
  },
});

/** Audit anlegen — friert die Prüfpunkte der aktiven Vorlage als Antworten ein */
export const create = mutation({
  args: {
    title: v.string(),
    auditYear: v.number(),
    auditType: v.union(v.literal("INTERNAL"), v.literal("EXTERNAL")),
    auditTeam: v.optional(v.string()),
    basis: v.optional(v.string()),
    location: v.optional(v.string()),
    reportingPeriod: v.optional(v.string()),
    plannedFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) {
      throw new Error("Keine aktive Checklisten-Vorlage vorhanden — zuerst Vorlage anlegen/aktivieren");
    }
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", template._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const now = Date.now();
    const auditId = await ctx.db.insert("audits", {
      ...args,
      status: "PLANNED",
      leadAuditorId: user._id,
      templateId: template._id,
      templateVersion: template.version,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });

    // Prüfpunkte einfrieren — spätere Vorlagenänderungen wirken nicht zurück
    for (const item of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
      await ctx.db.insert("auditChecklistAnswers", {
        auditId,
        chapter: item.chapter,
        chapterTitle: item.chapterTitle,
        requirements: item.requirements,
        sortOrder: item.sortOrder,
        isArchived: false,
        createdAt: now, createdBy: user._id,
        updatedAt: now, updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "audits", entityId: auditId,
      metadata: { templateVersion: template.version, items: items.length },
    });
    return auditId;
  },
});

/** Kopfdaten ändern (nicht nach Abschluss) */
export const updateHeader = mutation({
  args: {
    id: v.id("audits"),
    title: v.optional(v.string()),
    auditTeam: v.optional(v.string()),
    basis: v.optional(v.string()),
    location: v.optional(v.string()),
    reportingPeriod: v.optional(v.string()),
    plannedFor: v.optional(v.string()),
    auditDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status === "CLOSED" || audit.status === "CANCELLED") {
      throw new Error("Abgeschlossene Audits können nicht geändert werden");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: id, changes,
    });
  },
});

/** Antwort (Prüfpunkt-Bewertung) erfassen */
export const updateAnswer = mutation({
  args: {
    id: v.id("auditChecklistAnswers"),
    rating: v.optional(v.union(
      v.literal("KONFORM"), v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"),
      v.literal("EMPFEHLUNG"), v.literal("NICHT_ANWENDBAR")
    )),
    evidence: v.optional(v.string()),
    sample: v.optional(v.string()),
    interviewedWith: v.optional(v.string()),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const answer = await ctx.db.get(args.id);
    if (!answer) throw new Error("Prüfpunkt nicht gefunden");
    const audit = await ctx.db.get(answer.auditId);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status !== "IN_PROGRESS") {
      throw new Error("Bewertungen nur möglich, während das Audit in Durchführung ist");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "auditChecklistAnswers", entityId: id, changes,
    });
  },
});

/** Statuswechsel über State-Machine */
export const setStatus = mutation({
  args: { id: v.id("audits"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    validateTransition("auditStatus", audit.status, args.status);

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status, updatedAt: now, updatedBy: user._id,
    };
    if (args.status === "IN_PROGRESS" && !audit.auditDate) patch.auditDate = now;
    if (args.status === "CLOSED") patch.closedAt = now;
    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "audits", entityId: args.id,
      previousStatus: audit.status, newStatus: args.status,
    });
  },
});

/** Berichtstexte (Zusammenfassung + Kapitel-Abschnitte) speichern */
export const updateSummary = mutation({
  args: {
    id: v.id("audits"),
    summaryResult: v.optional(v.string()),
    chapterSummaries: v.optional(v.array(v.object({
      chapter: v.string(),
      summary: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:report");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status !== "REPORT_DRAFT" && audit.status !== "IN_PROGRESS") {
      throw new Error("Berichtstexte nur im Entwurfsstadium änderbar");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: id, changes: { reportTexts: true },
    });
  },
});

/** Upload-URL für eingefrorenes Bericht-PDF */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audits:report");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Generiertes Bericht-PDF am Audit einfrieren */
export const attachReport = mutation({
  args: { id: v.id("audits"), reportFileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:report");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    await ctx.db.patch(args.id, {
      reportFileId: args.reportFileId,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "FILE_UPLOAD",
      entityType: "audits", entityId: args.id,
      metadata: { kind: "auditReport" },
    });
  },
});

/** Bericht-PDF herunterladen */
export const getReportUrl = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audit = await ctx.db.get(args.id);
    if (!audit?.reportFileId) return null;
    return await ctx.storage.getUrl(audit.reportFileId);
  },
});

/** Audit archivieren (Soft-Delete) */
export const archive = mutation({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    await archiveRecord(ctx, "audits", args.id, user._id);
  },
});
