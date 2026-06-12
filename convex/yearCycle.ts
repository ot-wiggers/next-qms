import { v } from "convex/values";
import { mutation, internalMutation, MutationCtx } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { createNotification } from "./lib/notificationHelpers";
import { findQmbAssignee } from "./lib/assignees";
import { instantiateChecklist } from "./audits";

// ============================================================
// Jahreszyklus-Automatik (Phase 7) — semi-automatische
// Erinnerungen + Auditplan-Generator nach Hausphilosophie
// (wie Finding→CAPA: System schlägt vor, Mensch entscheidet).
// ============================================================

/**
 * YEAR_CYCLE-Aufgabe genau einmal anlegen (Dedup über synthetische
 * resourceId wie "mgmtreview-2026"). Optional mit Benachrichtigung.
 * Liefert "created" oder "skipped" (Dedup-Treffer oder kein Zuständiger).
 *
 * Die resourceId ist jahresbezogen (z. B. "auditplan-2026"), daher blockiert
 * JEDE nicht-archivierte YEAR_CYCLE-Aufgabe mit dieser Id eine Neu-Anlage —
 * auch erledigte oder abgebrochene. So wird die Aufgabe genau einmal pro Jahr
 * erzeugt, selbst wenn der tägliche Cron mehrfach läuft.
 */
async function createYearCycleTask(
  ctx: MutationCtx,
  opts: {
    resourceId: string;
    title: string;
    description: string;
    dueDate: number;
    priority: "MEDIUM" | "HIGH";
    now: number;
    notification?: { type: string; title: string };
  }
): Promise<"created" | "skipped"> {
  // Dedup: existiert bereits irgendeine YEAR_CYCLE-Aufgabe zu dieser jahresbezogenen Id?
  // Status wird bewusst NICHT gefiltert — DONE/CANCELLED sollen ebenfalls blockieren.
  const existingTask = await ctx.db
    .query("tasks")
    .withIndex("by_resource", (q) =>
      q.eq("resourceType", "yearCycle").eq("resourceId", opts.resourceId)
    )
    .filter((q) =>
      q.and(
        q.eq(q.field("isArchived"), false),
        q.eq(q.field("type"), "YEAR_CYCLE")
      )
    )
    .first();
  if (existingTask) return "skipped";

  const assignee = await findQmbAssignee(ctx);
  if (!assignee) return "skipped";

  await ctx.db.insert("tasks", {
    type: "YEAR_CYCLE",
    title: opts.title,
    description: opts.description,
    assigneeId: assignee._id,
    dueDate: opts.dueDate,
    status: "OPEN",
    priority: opts.priority,
    resourceType: "yearCycle",
    resourceId: opts.resourceId,
    isArchived: false,
    createdAt: opts.now,
    updatedAt: opts.now,
  });

  if (opts.notification) {
    await createNotification(ctx, {
      userId: assignee._id,
      type: opts.notification.type,
      title: opts.notification.title,
      message: opts.title,
      resourceType: "yearCycle",
      resourceId: opts.resourceId,
    });
  }

  return "created";
}

/**
 * Internal (Cron): Jahresberichte anmahnen.
 * - Managementbewertung (FB 5.6.0): ab Oktober, falls für das laufende
 *   Jahr noch keine existiert — Stichtag 15.12.
 * - PMS-Bericht (MDR Art. 85, FB 7 1): Januar–März, falls für das
 *   Vorjahr noch keiner existiert — Stichtag 31.01.
 */
export const checkAnnualReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentYear = new Date(now).getUTCFullYear();
    const currentMonth = new Date(now).getUTCMonth() + 1;

    let created = 0;
    let skipped = 0;

    // Managementbewertung: ab Oktober fürs laufende Jahr erinnern
    if (currentMonth >= 10) {
      const existingReview = await ctx.db
        .query("managementReviews")
        .withIndex("by_year", (q) => q.eq("year", currentYear))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .first();
      if (!existingReview) {
        const result = await createYearCycleTask(ctx, {
          resourceId: `mgmtreview-${currentYear}`,
          title: `Managementbewertung ${currentYear} anlegen (FB 5.6.0)`,
          description: `Für ${currentYear} existiert noch keine Managementbewertung. Bitte bis zum Jahresende anlegen.`,
          dueDate: Date.UTC(currentYear, 11, 15), // 15.12.
          priority: "HIGH",
          now,
          notification: { type: "ANNUAL_REPORT_DUE", title: "Jahresbericht fällig" },
        });
        if (result === "created") created++;
        else skipped++;
      }
    }

    // PMS-Bericht: Januar–März fürs Vorjahr erinnern
    if (currentMonth <= 3) {
      const pmsYear = currentYear - 1;
      const existingPms = await ctx.db
        .query("pmsReports")
        .withIndex("by_year", (q) => q.eq("year", pmsYear))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .first();
      if (!existingPms) {
        const januaryDeadline = Date.UTC(currentYear, 0, 31); // 31.01.
        const result = await createYearCycleTask(ctx, {
          resourceId: `pmsreport-${pmsYear}`,
          title: `PMS-Bericht ${pmsYear} erstellen (MDR Art. 85, FB 7 1)`,
          description: `Für ${pmsYear} existiert noch kein PMS-Bericht. Bitte Überwachung nach dem Inverkehrbringen dokumentieren.`,
          dueDate: januaryDeadline > now ? januaryDeadline : now + 14 * 24 * 60 * 60 * 1000,
          priority: "HIGH",
          now,
          notification: { type: "ANNUAL_REPORT_DUE", title: "Jahresbericht fällig" },
        });
        if (result === "created") created++;
        else skipped++;
      }
    }

    return { created, skipped };
  },
});

/**
 * Internal (Cron): Jahreswechsel-Erinnerungen — nur im Januar aktiv.
 * Legt drei YEAR_CYCLE-Aufgaben für das neue Jahr an (Auditplan,
 * Qualitätsziele, Schulungsplan). Bewusst OHNE Benachrichtigungen:
 * die Aufgabenliste reicht als sanfter Jahresauftakt.
 */
export const yearOpeningTasks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentMonth = new Date(now).getUTCMonth() + 1;
    if (currentMonth !== 1) {
      return { created: 0, skipped: 0, reason: "nur im Januar aktiv" };
    }
    const year = new Date(now).getUTCFullYear();
    const dueDate = Date.UTC(year, 0, 31); // 31.01.

    let created = 0;
    let skipped = 0;

    const openingTasks: Array<{ resourceId: string; title: string; description: string }> = [
      {
        resourceId: `auditplan-${year}`,
        title: `Auditplan ${year} erstellen (Vorschlag aus Vorjahr im Auditplan generierbar)`,
        description: `Internes Jahres-Audit und externe Audits für ${year} planen — der Generator übernimmt die Themen-Zeilen des Vorjahres.`,
      },
      {
        resourceId: `qziele-${year}`,
        title: `Qualitätsziele ${year} anlegen (FB 5.4.1)`,
        description: `Qualitätsziele für ${year} mit SOLL-Werten festlegen.`,
      },
      {
        resourceId: `schulungsplan-${year}`,
        title: `Schulungsplan ${year} aus Bedarfsmatrix erzeugen (Plan-Entwurf in der Schulungsmatrix)`,
        description: `Schulungsplan ${year} aus der Schulungsbedarfsmatrix ableiten.`,
      },
    ];

    for (const task of openingTasks) {
      const result = await createYearCycleTask(ctx, {
        resourceId: task.resourceId,
        title: task.title,
        description: task.description,
        dueDate,
        priority: "MEDIUM",
        now,
      });
      if (result === "created") created++;
      else skipped++;
    }

    return { created, skipped };
  },
});

/**
 * Auditplan-Generator (Ein-Audit-Modell): erzeugt EIN internes Jahres-Audit
 * mit den Themen-Zeilen (planThemes) des Vorjahres-Audits sowie je eine Kopie
 * der externen Plan-Audits (area gesetzt). Vorschlag, kein Automatismus —
 * der Mensch löst aus und passt danach an.
 */
export const generateAuditPlan = mutation({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");

    if (!Number.isInteger(args.year) || args.year < 2020 || args.year > 2100) {
      throw new Error("Ungültiges Jahr");
    }

    // Schutz: Zieljahr darf noch keinen Auditplan haben
    const targetYearAudits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (targetYearAudits.some((a) => (a.planThemes && a.planThemes.length > 0) || a.area !== undefined)) {
      throw new Error(`Für ${args.year} existiert bereits ein Auditplan`);
    }

    // Quellen im Vorjahr: das interne Jahres-Audit (planThemes) + externe Plan-Audits (area)
    const previousYearAudits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", args.year - 1))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const internalSource = previousYearAudits.find(
      (a) => a.auditType === "INTERNAL" && a.planThemes && a.planThemes.length > 0,
    );
    const externalSources = previousYearAudits.filter(
      (a) => a.auditType === "EXTERNAL" && a.area !== undefined,
    );
    if (!internalSource && externalSources.length === 0) {
      throw new Error("Kein Auditplan im Vorjahr gefunden");
    }

    // Aktive Checklisten-Vorlage — exakt wie audits.create
    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) {
      throw new Error("Keine aktive Checklisten-Vorlage vorhanden — zuerst Vorlage anlegen/aktivieren");
    }

    const now = Date.now();
    let created = 0;

    if (internalSource) {
      const auditId = await ctx.db.insert("audits", {
        title: `Internes Audit ${args.year}`,
        auditYear: args.year,
        auditType: "INTERNAL",
        status: "PLANNED",
        leadAuditorId: user._id,
        auditTeam: internalSource.auditTeam,
        basis: internalSource.basis ?? template.basis,
        location: internalSource.location,
        planThemes: internalSource.planThemes,
        plannedMonths: internalSource.plannedMonths,
        templateId: template._id,
        templateVersion: template.version,
        isArchived: false,
        createdAt: now, createdBy: user._id,
        updatedAt: now, updatedBy: user._id,
      });
      await instantiateChecklist(ctx, auditId, template, now, user._id);
      await logAuditEvent(ctx, {
        userId: user._id, action: "CREATE",
        entityType: "audits", entityId: auditId,
        metadata: { generatedFrom: args.year - 1, planThemes: internalSource.planThemes!.length },
      });
      created++;
    }

    for (const source of externalSources) {
      const auditId = await ctx.db.insert("audits", {
        title: `${source.area} ${args.year}`,
        auditYear: args.year,
        auditType: "EXTERNAL",
        status: "PLANNED",
        leadAuditorId: user._id,
        auditTeam: source.auditTeam,
        basis: source.basis ?? template.basis,
        area: source.area,
        affectedAreas: source.affectedAreas,
        plannedMonths: source.plannedMonths,
        templateId: template._id,
        templateVersion: template.version,
        isArchived: false,
        createdAt: now, createdBy: user._id,
        updatedAt: now, updatedBy: user._id,
      });
      await instantiateChecklist(ctx, auditId, template, now, user._id);
      await logAuditEvent(ctx, {
        userId: user._id, action: "CREATE",
        entityType: "audits", entityId: auditId,
        metadata: { generatedFrom: args.year - 1, area: source.area },
      });
      created++;
    }

    return { created };
  },
});
