import { v } from "convex/values";
import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";
import { createNotification } from "./lib/notificationHelpers";
import { findQmbAssignee } from "./lib/assignees";

/** SOLL-Monate validieren (ganze Zahlen 1–12), dedupliziert und aufsteigend sortiert zurückgeben */
function validatePlannedMonths(months: number[]): number[] {
  for (const m of months) {
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw new Error("Monate müssen ganze Zahlen von 1 bis 12 sein");
    }
  }
  return [...new Set(months)].sort((a, b) => a - b);
}

/**
 * Prüfpunkte der Vorlage als Antworten am Audit einfrieren —
 * spätere Vorlagenänderungen wirken nicht zurück.
 * userId entfällt beim System-Seed (createdBy/updatedBy bleiben dann leer).
 * Liefert die Anzahl der angelegten Antworten.
 * Exportiert (kein Convex-Export) zur Wiederverwendung in yearCycle.generateAuditPlan.
 */
export async function instantiateChecklist(
  ctx: MutationCtx,
  auditId: Id<"audits">,
  template: Doc<"auditChecklistTemplates">,
  now: number,
  userId?: Id<"users">
): Promise<number> {
  const items = await ctx.db
    .query("auditChecklistTemplateItems")
    .withIndex("by_template", (q) => q.eq("templateId", template._id))
    .filter((q) => q.eq(q.field("isArchived"), false))
    .collect();

  if (items.length === 0) {
    throw new Error("Aktive Vorlage enthält keine Prüfpunkte");
  }

  for (const item of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
    await ctx.db.insert("auditChecklistAnswers", {
      auditId,
      chapter: item.chapter,
      chapterTitle: item.chapterTitle,
      requirements: item.requirements,
      sortOrder: item.sortOrder,
      isArchived: false,
      createdAt: now, createdBy: userId,
      updatedAt: now, updatedBy: userId,
    });
  }
  return items.length;
}

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
    const findingsWithCapa = await Promise.all(
      findings.sort((a, b) => a.createdAt - b.createdAt).map(async (f) => {
        if (!f.capaId) return { ...f, capaNumber: undefined as string | undefined };
        const capa = await ctx.db.get(f.capaId);
        return { ...f, capaNumber: capa?.capaNumber };
      })
    );
    const leadAuditor = audit.leadAuditorId ? await ctx.db.get(audit.leadAuditorId) : null;
    return {
      ...audit,
      answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
      findings: findingsWithCapa,
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
    area: v.optional(v.string()),
    plannedMonths: v.optional(v.array(v.number())),
    affectedAreas: v.optional(v.string()),
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

    const now = Date.now();
    const auditId = await ctx.db.insert("audits", {
      ...args,
      basis: args.basis ?? template.basis,
      area: args.area?.trim() || undefined,
      affectedAreas: args.affectedAreas?.trim() || undefined,
      plannedMonths: args.plannedMonths && args.plannedMonths.length > 0
        ? validatePlannedMonths(args.plannedMonths)
        : undefined,
      status: "PLANNED",
      leadAuditorId: user._id,
      templateId: template._id,
      templateVersion: template.version,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });

    // Prüfpunkte einfrieren — spätere Vorlagenänderungen wirken nicht zurück
    const items = await instantiateChecklist(ctx, auditId, template, now, user._id);

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "audits", entityId: auditId,
      metadata: { templateVersion: template.version, items },
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
    area: v.optional(v.string()),
    plannedMonths: v.optional(v.array(v.number())),
    affectedAreas: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status === "CLOSED" || audit.status === "CANCELLED") {
      throw new Error("Abgeschlossene Audits können nicht geändert werden");
    }
    const patch: Partial<Doc<"audits">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    if (args.title !== undefined && args.title.trim()) patch.title = args.title.trim();
    if (args.auditTeam !== undefined) patch.auditTeam = args.auditTeam.trim() || undefined;
    if (args.basis !== undefined) patch.basis = args.basis.trim() || undefined;
    if (args.location !== undefined) patch.location = args.location.trim() || undefined;
    if (args.reportingPeriod !== undefined) patch.reportingPeriod = args.reportingPeriod.trim() || undefined;
    if (args.plannedFor !== undefined) patch.plannedFor = args.plannedFor.trim() || undefined;
    if (args.auditDate !== undefined) patch.auditDate = args.auditDate;
    if (args.area !== undefined) patch.area = args.area.trim() || undefined;
    if (args.affectedAreas !== undefined) patch.affectedAreas = args.affectedAreas.trim() || undefined;
    if (args.plannedMonths !== undefined) {
      // Leeres Array ⇒ Feld entfernen; sonst validieren + normalisieren
      patch.plannedMonths = args.plannedMonths.length === 0
        ? undefined
        : validatePlannedMonths(args.plannedMonths);
    }
    await ctx.db.patch(args.id, patch);
    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: args.id, changes,
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
    const patch: Partial<Doc<"auditChecklistAnswers">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    if (args.rating !== undefined) patch.rating = args.rating;
    if (args.evidence !== undefined) patch.evidence = args.evidence.trim() || undefined;
    if (args.sample !== undefined) patch.sample = args.sample.trim() || undefined;
    if (args.interviewedWith !== undefined) patch.interviewedWith = args.interviewedWith.trim() || undefined;
    if (args.comments !== undefined) patch.comments = args.comments.trim() || undefined;
    await ctx.db.patch(args.id, patch);
    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "auditChecklistAnswers", entityId: args.id, changes,
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
    const patch: Partial<Doc<"audits">> = {
      status: args.status as Doc<"audits">["status"], // validateTransition hat den Wert geprüft
      updatedAt: now,
      updatedBy: user._id,
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
      entityType: "audits", entityId: id, changes: {
        summaryResult: args.summaryResult !== undefined,
        chapterSummaries: args.chapterSummaries !== undefined,
      },
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
    if (audit.status !== "REPORT_DRAFT") {
      throw new Error("Bericht-PDF kann nur im Berichtsentwurf eingefroren werden");
    }
    await ctx.db.patch(args.id, {
      reportFileId: args.reportFileId,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "FILE_UPLOAD",
      entityType: "audits", entityId: args.id,
      metadata: { kind: "auditReport", reportFileId: args.reportFileId, previousFileId: audit.reportFileId },
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

/** Auditplan-Matrix (FB 8.2.4): nur Audits mit Thema (area), SOLL aus plannedMonths, IST aus auditDate */
export const planMatrix = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const rows = audits
      .filter((a) => a.area !== undefined)
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((a) => ({
        _id: a._id,
        area: a.area!,
        auditTeam: a.auditTeam,
        affectedAreas: a.affectedAreas,
        plannedMonths: a.plannedMonths ?? [],
        istMonth: a.auditDate ? new Date(a.auditDate).getUTCMonth() + 1 : null,
        status: a.status,
        title: a.title,
      }));

    return { year: args.year, rows };
  },
});

/**
 * Internal (Cron): geplante, aber nicht durchgeführte Audits anmahnen.
 * Fällig, sobald der aktuelle Monat hinter dem letzten SOLL-Monat liegt
 * und weder Audit-Datum noch Statusfortschritt existieren.
 */
export const checkPlanDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentYear = new Date(now).getUTCFullYear();
    const currentMonth = new Date(now).getUTCMonth() + 1;

    // Auch Vorjahres-Audits prüfen — Dezember-Pläne (oder nie durchgeführte
    // Audits) sollen über den Jahreswechsel hinaus weiter erinnern.
    const currentYearAudits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", currentYear))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const previousYearAudits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", currentYear - 1))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const audits = [...currentYearAudits, ...previousYearAudits];

    let created = 0;
    let skipped = 0;

    for (const audit of audits) {
      if (!audit.plannedMonths || audit.plannedMonths.length === 0) continue;
      if (audit.auditDate !== undefined) continue;
      if (audit.status !== "PLANNED") continue;
      // Fällig: Vorjahres-Audit nie durchgeführt ODER letzter SOLL-Monat überschritten
      const isDue =
        audit.auditYear < currentYear ||
        currentMonth > Math.max(...audit.plannedMonths);
      if (!isDue) continue;

      // Dedup: existiert bereits eine offene AUDIT_PLAN_DUE-Aufgabe zu diesem Audit?
      const existingTask = await ctx.db
        .query("tasks")
        .withIndex("by_resource", (q) =>
          q.eq("resourceType", "audits").eq("resourceId", audit._id as string)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("isArchived"), false),
            q.eq(q.field("type"), "AUDIT_PLAN_DUE"),
            q.neq(q.field("status"), "DONE"),
            q.neq(q.field("status"), "CANCELLED")
          )
        )
        .first();
      if (existingTask) {
        skipped++;
        continue;
      }

      const assignee = await findQmbAssignee(ctx);
      if (!assignee) {
        skipped++;
        continue;
      }

      const areaLabel = audit.area ?? audit.title;
      const title = `Auditplan: „${areaLabel}“ ${audit.auditYear} nicht durchgeführt`;
      await ctx.db.insert("tasks", {
        type: "AUDIT_PLAN_DUE",
        title,
        description: `Das Audit war laut Auditplan ${audit.auditYear} für folgende(n) Monat(e) vorgesehen: ${audit.plannedMonths.join(", ")}. Bitte Durchführung nachholen oder Plan anpassen.`,
        assigneeId: assignee._id,
        dueDate: now + 14 * 24 * 60 * 60 * 1000, // 14 Tage Frist
        status: "OPEN",
        priority: "HIGH",
        resourceType: "audits",
        resourceId: audit._id as string,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });

      await createNotification(ctx, {
        userId: assignee._id,
        type: "AUDIT_PLAN_DUE",
        title: "Auditplan: Audit fällig",
        message: title,
        resourceType: "audits",
        resourceId: audit._id as string,
      });

      created++;
    }

    return { created, skipped };
  },
});

// ============================================================
// Seed Auditplan 2026 — Themen-Audits laut FB 8.2.4 Rev. 5.
// IST-Daten (auditDate) werden bewusst NICHT gesetzt: das IST
// ergibt sich aus realer Durchführung, nicht aus dem Seed.
// ============================================================

const AUDIT_PLAN_2026 = [
  { area: "Reha / Rollstuhl", auditTeam: "AL / MA", affectedAreas: "MA der Werkstatt und Außendienst", plannedMonths: [4], internal: true },
  { area: "Sanitätshaus / Filiale", auditTeam: "AL / MA", affectedAreas: "MA Verkauf und Außendienst", plannedMonths: [4], internal: true },
  { area: "Orthopädietechnik", auditTeam: "AL / MA", affectedAreas: "MA Werkstatt und Außendienst", plannedMonths: [4], internal: true },
  { area: "Büro", auditTeam: "AL / MA", affectedAreas: "MA Verwaltung", plannedMonths: [4], internal: true },
  { area: "Überwachung-Zerti 13485", auditTeam: "extern / mdc", affectedAreas: "Unternehmen", plannedMonths: [6], internal: false },
] as const;

export const seedAuditPlan2026 = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotenz: existiert bereits ein nicht archiviertes Plan-Audit 2026 (area gesetzt) → skip
    const existing = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", 2026))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (existing.some((a) => a.area !== undefined)) {
      return { skipped: true, reason: "Auditplan 2026 bereits geseedet — seedPlanReset zuerst" };
    }

    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) {
      throw new Error("Keine aktive Checklisten-Vorlage vorhanden — zuerst Vorlage anlegen/aktivieren");
    }

    const now = Date.now();
    let answersPerAudit = 0;

    for (const entry of AUDIT_PLAN_2026) {
      // createdBy/updatedBy entfallen beim System-Seed (Haus-Muster risks.seedFromImport)
      const auditId = await ctx.db.insert("audits", {
        title: `${entry.area} 2026`,
        auditYear: 2026,
        auditType: entry.internal ? "INTERNAL" : "EXTERNAL",
        status: "PLANNED",
        auditTeam: entry.auditTeam,
        area: entry.area,
        plannedMonths: validatePlannedMonths([...entry.plannedMonths]),
        affectedAreas: entry.affectedAreas,
        templateId: template._id,
        templateVersion: template.version,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });

      answersPerAudit = await instantiateChecklist(ctx, auditId, template, now);

      await logAuditEvent(ctx, {
        action: "CREATE",
        entityType: "audits",
        entityId: auditId,
        metadata: { seed: true, area: entry.area },
      });
    }

    return { audits: AUDIT_PLAN_2026.length, answersPerAudit };
  },
});

// ============================================================
// seedPlanReset — Hard-Delete NUR der Plan-Audits 2026
// (auditYear === 2026 UND area gesetzt) inkl. Antworten/Findings.
// Nutzer-Audits ohne area (z.B. "Intern 2026") bleiben unangetastet.
// Nur für Seed-Korrekturen vor produktiver Pflege.
// ============================================================

export const seedPlanReset = internalMutation({
  args: {},
  handler: async (ctx) => {
    const audits2026 = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", 2026))
      .collect();
    const planAudits = audits2026.filter((a) => a.area !== undefined);

    let answers = 0;
    let findings = 0;
    for (const audit of planAudits) {
      const auditAnswers = await ctx.db
        .query("auditChecklistAnswers")
        .withIndex("by_audit", (q) => q.eq("auditId", audit._id))
        .collect();
      for (const a of auditAnswers) {
        await ctx.db.delete(a._id);
        answers++;
      }
      const auditFindings = await ctx.db
        .query("auditFindings")
        .withIndex("by_audit", (q) => q.eq("auditId", audit._id))
        .collect();
      for (const f of auditFindings) {
        await ctx.db.delete(f._id);
        findings++;
      }
      await ctx.db.delete(audit._id);
    }

    if (planAudits.length > 0) {
      await logAuditEvent(ctx, {
        action: "PERMANENT_DELETE",
        entityType: "audits",
        entityId: "seed-plan-reset",
        metadata: { seedReset: true, audits: planAudits.length, answers, findings },
      });
    }

    return { audits: planAudits.length, answers, findings };
  },
});
