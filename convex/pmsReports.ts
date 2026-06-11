import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { QueryCtx, MutationCtx } from "./_generated/server";

// ============================================================
// PMS-Bericht (MDR Art. 85, FB „7 1") — Phase 6
// Die 8 festen Abschnitte des realen Berichts (Rev. 1, Stand 01.2026)
// ============================================================

// gespiegelt aus PMS_SECTIONS in lib/types/enums.ts (Convex kann nicht aus lib/ importieren)
const SECTION_KEYS = [
  "goal",
  "dataSources",
  "metrics",
  "riskAssessment",
  "capa",
  "pmsSystemAssessment",
  "conclusion",
  "recommendations",
] as const;

type PmsSectionKey = (typeof SECTION_KEYS)[number];

// gespiegelt aus PMS_DEFAULT_PRODUCT_GROUP in lib/types/enums.ts
const DEFAULT_PRODUCT_GROUP =
  "Sonderanfertigungen der Klasse I (Orthesen, Einlagen, Prothesen, Maßschuhe etc.)";

// gespiegelt aus PMS_TEMPLATE_TEXTS in lib/types/enums.ts
const TEMPLATE_TEXTS: Partial<Record<string, string>> = {
  goal: "Sicherstellung der Sicherheit, Leistungsfähigkeit und frühzeitigen Erkennung von Risiken.",
  dataSources:
    "– Reklamationen (OTWin)\n– Interne Fehler (Kunden-, Lieferanten-, interne Fehler - OTWin)\n– Klinische Nachbeobachtung (MPG-Wiedervorlage)\n– Qualitätsziele und Managementbewertung",
};

// gespiegelt aus RPZ_ACCEPT_THRESHOLD in lib/types/enums.ts
const RPZ_ACCEPT_THRESHOLD = 100;

// ============================================================
// buildAutoData — interner Helfer (kein Convex-Export)
// Erstellt einen Daten-Snapshot je Abschnitt aus echten App-Daten.
// Nur Abschnitte mit vorhandenen Daten erhalten autoData
// (metrics/riskAssessment/capa); rein manuelle Abschnitte
// (goal/dataSources/pmsSystemAssessment/conclusion/recommendations)
// bleiben undefined — bewusst ehrlich, nichts erfinden.
// ============================================================

async function buildAutoData(
  ctx: QueryCtx | MutationCtx,
  year: number
): Promise<Record<PmsSectionKey, string | undefined>> {
  // UTC-Jahresgrenzen (Convex läuft UTC)
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);

  // Volltabellen-Scan ok bei dieser Datenmenge (QMS einer 30-MA-Organisation)
  const [allComplaints, allRisks, allCapas] = await Promise.all([
    ctx.db
      .query("complaints")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect(),
    ctx.db
      .query("risks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect(),
    ctx.db
      .query("capas")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect(),
  ]);

  // ── 3. Kennzahlen und Auswertung (Reklamationen) ────────────
  const complaintsOfYear = allComplaints.filter(
    (c) => c.receivedAt >= yearStart && c.receivedAt < yearEnd
  );

  let metricsAutoData: string;
  if (complaintsOfYear.length === 0) {
    // Keine Daten → ehrliche Leermeldung, keine erfundenen Zahlen
    metricsAutoData = "Keine Reklamationen im Berichtszeitraum in der App erfasst.";
  } else {
    const vigilanceCount = complaintsOfYear.filter((c) => c.isVigilanceRelevant).length;
    const reportedCount = complaintsOfYear.filter(
      (c) => c.vigilanceReportedAt !== undefined
    ).length;
    // complaintStatus: RECEIVED | IN_REVIEW | IN_PROGRESS | CLOSED — offen = alles außer CLOSED
    const openCount = complaintsOfYear.filter((c) => c.status !== "CLOSED").length;

    // Top-3-Fehlerarten (failureCategory; Reklamationen ohne Kategorie werden übersprungen)
    const categoryCounts = new Map<string, number>();
    for (const c of complaintsOfYear) {
      if (c.failureCategory === undefined) continue;
      categoryCounts.set(c.failureCategory, (categoryCounts.get(c.failureCategory) ?? 0) + 1);
    }
    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => `${category} (${count})`);

    metricsAutoData =
      `${complaintsOfYear.length} Reklamation${complaintsOfYear.length !== 1 ? "en" : ""} im Berichtszeitraum` +
      ` · davon vigilanzrelevant: ${vigilanceCount}` +
      ` · gemeldet: ${reportedCount}` +
      ` · noch offen: ${openCount}` +
      (topCategories.length > 0 ? `\nTop-Fehlerarten: ${topCategories.join(", ")}` : "");
  }

  // ── 4. Risikobewertung (Risikoregister) ─────────────────────
  // RPZ wird NIE gespeichert, immer berechnet (s. convex/risks.ts)
  let riskAssessmentAutoData: string;
  if (allRisks.length === 0) {
    riskAssessmentAutoData = "Keine Risiken im Risikoregister der App erfasst.";
  } else {
    const withRpz = allRisks.map((risk) => ({
      risk,
      rpz: risk.occurrenceProbability * risk.severity * risk.consequences,
    }));
    const aboveThreshold = withRpz.filter((e) => e.rpz >= RPZ_ACCEPT_THRESHOLD).length;
    const highest = withRpz.reduce((max, e) => (e.rpz > max.rpz ? e : max));
    const newlyAdded = allRisks.filter((r) => r.addedInRevision !== undefined).length;

    riskAssessmentAutoData =
      `${allRisks.length} Risik${allRisks.length !== 1 ? "en" : "o"} im Register` +
      ` · RPZ ≥ ${RPZ_ACCEPT_THRESHOLD}: ${aboveThreshold}` +
      ` · höchste RPZ: ${highest.rpz} (${highest.risk.riskNumber} ${highest.risk.title})` +
      ` · neu aufgenommen: ${newlyAdded}`;
  }

  // ── 5. CAPA (Jahrgang = Berichtsjahr) ───────────────────────
  const capasOfYear = allCapas.filter((c) => c.year === year);

  let capaAutoData: string;
  if (capasOfYear.length === 0) {
    capaAutoData = `Keine CAPAs für ${year} in der App erfasst.`;
  } else {
    // capaStatusEnum: OPEN|ANALYSIS|MEASURES_DEFINED|IN_PROGRESS|EFFECTIVENESS_CHECK|CLOSED|CANCELLED
    const closedCount = capasOfYear.filter((c) => c.status === "CLOSED").length;
    const openCount = capasOfYear.length - closedCount;
    const effectiveCount = capasOfYear.filter(
      (c) => c.effectivenessResult === "EFFECTIVE"
    ).length;

    capaAutoData =
      `${capasOfYear.length} CAPA${capasOfYear.length !== 1 ? "s" : ""} für ${year}` +
      ` · abgeschlossen: ${closedCount}` +
      ` · offen: ${openCount}` +
      ` · Wirksamkeit bestätigt: ${effectiveCount}`;
  }

  // ── 1/2/6/7/8 — rein manuelle Abschnitte, autoData bleibt undefined ──
  return {
    goal: undefined,
    dataSources: undefined,
    metrics: metricsAutoData,
    riskAssessment: riskAssessmentAutoData,
    capa: capaAutoData,
    pmsSystemAssessment: undefined,
    conclusion: undefined,
    recommendations: undefined,
  };
}

// ============================================================
// invalidateFrozenReport — Inhaltsänderungen nach dem Einfrieren
// machen das Nachweis-PDF ungültig: reportFileId wird entfernt,
// die Freigabe erzwingt damit ein erneutes Einfrieren.
// Nur in Content-Mutations aufrufen — NICHT in attachReport/approve.
// ============================================================

function invalidateFrozenReport(
  report: Doc<"pmsReports">,
  patch: Partial<Doc<"pmsReports">>
) {
  if (report.reportFileId !== undefined) {
    patch.reportFileId = undefined;
  }
}

// ============================================================
// 1. list — nicht-archivierte PMS-Berichte, nach Jahr desc
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "pmsReports:list");
    const results = await ctx.db
      .query("pmsReports")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return results.sort((a, b) => b.year - a.year);
  },
});

// ============================================================
// 2. getById — einzelner PMS-Bericht
// ============================================================

export const getById = query({
  args: { id: v.id("pmsReports") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "pmsReports:list");
    const report = await ctx.db.get(args.id);
    if (!report) return null;
    return report;
  },
});

// ============================================================
// 3. createDraft — Entwurf anlegen mit Auto-Snapshot
// ============================================================

export const createDraft = mutation({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "pmsReports:manage");

    // Guard: plausibles Berichtsjahr
    if (!Number.isInteger(args.year) || args.year < 2020 || args.year > 2100) {
      throw new Error("Ungültiges Berichtsjahr");
    }

    // Guard: ein nicht-archivierter Bericht pro Jahr
    const existing = await ctx.db
      .query("pmsReports")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (existing) {
      throw new Error("Für dieses Jahr existiert bereits ein PMS-Bericht");
    }

    // autoData-Snapshot für alle Abschnitte generieren
    const autoDataByKey = await buildAutoData(ctx, args.year);

    // Sections-Array in fester Berichts-Reihenfolge (1–8),
    // Vorlagen-Texte aus dem realen Bericht als Startwerte
    const sections = SECTION_KEYS.map((key) => ({
      key: key as string,
      autoData: autoDataByKey[key],
      text: TEMPLATE_TEXTS[key],
    }));

    const now = Date.now();
    const id = await ctx.db.insert("pmsReports", {
      year: args.year,
      reportingPeriod: `01.01.${args.year} – 31.12.${args.year}`,
      revision: 1,
      standText: undefined,
      productGroup: DEFAULT_PRODUCT_GROUP,
      status: "DRAFT",
      sections,
      isArchived: false,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "pmsReports",
      entityId: id,
      metadata: { year: args.year },
    });

    return id;
  },
});

// ============================================================
// 4. refreshAutoData — Snapshot neu generieren (nur DRAFT)
// ============================================================

export const refreshAutoData = mutation({
  args: { id: v.id("pmsReports") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "pmsReports:manage");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("PMS-Bericht nicht gefunden");
    if (report.status !== "DRAFT") {
      throw new Error("Freigegebene Berichte können nicht aktualisiert werden");
    }

    const autoDataByKey = await buildAutoData(ctx, report.year);

    // Read-modify-write — unter Convex OCC (optimistic concurrency control) korrekt:
    // Convex transaktioniert read+write atomar, Konflikte werden automatisch zurückgerollt.
    const updatedSections = report.sections.map((s) => ({
      ...s,
      // autoData wird neu gesetzt; text bleibt erhalten
      autoData: autoDataByKey[s.key as PmsSectionKey] ?? s.autoData,
    }));

    const patch: Partial<Doc<"pmsReports">> = {
      sections: updatedSections,
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(report, patch);
    const reportInvalidated =
      patch.reportFileId === undefined && report.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "pmsReports",
      entityId: args.id,
      changes: { autoDataRefreshed: true, ...(reportInvalidated && { reportInvalidated: true }) },
    });

    return { reportInvalidated };
  },
});

// ============================================================
// 5. updateSection — Abschnittstext speichern (nur DRAFT)
// ============================================================

export const updateSection = mutation({
  args: {
    id: v.id("pmsReports"),
    key: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "pmsReports:manage");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("PMS-Bericht nicht gefunden");
    if (report.status !== "DRAFT") {
      throw new Error("Abschnitte können nur im Entwurf geändert werden");
    }

    if (!(SECTION_KEYS as readonly string[]).includes(args.key)) {
      throw new Error(`Unbekannter Abschnitt: ${args.key}`);
    }

    // Read-modify-write (Convex OCC, s. refreshAutoData)
    // Clearing-Semantik: leerer/fehlender Text entfernt den Abschnittstext
    const updatedSections = report.sections.map((s) =>
      s.key === args.key ? { ...s, text: args.text?.trim() || undefined } : s
    );

    const patch: Partial<Doc<"pmsReports">> = {
      sections: updatedSections,
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(report, patch);
    const reportInvalidated =
      patch.reportFileId === undefined && report.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "pmsReports",
      entityId: args.id,
      metadata: { section: args.key, ...(reportInvalidated && { reportInvalidated: true }) },
    });

    return { reportInvalidated };
  },
});

// ============================================================
// 6. updateGeneral — Kopf-Angaben ändern (nur DRAFT)
// ============================================================

export const updateGeneral = mutation({
  args: {
    id: v.id("pmsReports"),
    reportingPeriod: v.optional(v.string()),
    revision: v.optional(v.number()),
    standText: v.optional(v.string()),
    productGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "pmsReports:manage");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("PMS-Bericht nicht gefunden");
    if (report.status !== "DRAFT") {
      throw new Error("Kopf-Angaben können nur im Entwurf geändert werden");
    }

    const patch: Partial<Doc<"pmsReports">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };

    // Pflichtfelder: nicht leerbar
    if (args.reportingPeriod !== undefined) {
      const reportingPeriod = args.reportingPeriod.trim();
      if (!reportingPeriod) throw new Error("Berichtszeitraum ist erforderlich");
      patch.reportingPeriod = reportingPeriod;
    }
    if (args.productGroup !== undefined) {
      const productGroup = args.productGroup.trim();
      if (!productGroup) throw new Error("Produktgruppe ist erforderlich");
      patch.productGroup = productGroup;
    }

    // Revision: ganze Zahl ≥ 1
    if (args.revision !== undefined) {
      if (!Number.isInteger(args.revision) || args.revision < 1) {
        throw new Error("Revision muss eine ganze Zahl ≥ 1 sein");
      }
      patch.revision = args.revision;
    }

    // standText: clearable (trim || undefined)
    if (args.standText !== undefined) {
      patch.standText = args.standText.trim() || undefined;
    }

    invalidateFrozenReport(report, patch);
    const reportInvalidated =
      patch.reportFileId === undefined && report.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "pmsReports",
      entityId: args.id,
      changes: {
        ...(args.reportingPeriod !== undefined && { reportingPeriod: args.reportingPeriod }),
        ...(args.revision !== undefined && { revision: args.revision }),
        ...(args.standText !== undefined && { standText: args.standText }),
        ...(args.productGroup !== undefined && { productGroup: args.productGroup }),
        ...(reportInvalidated && { reportInvalidated: true }),
      },
    });

    return { reportInvalidated };
  },
});

// ============================================================
// 7. generateUploadUrl — Upload-URL für Bericht-PDF
// ============================================================

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "pmsReports:manage");
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================================
// 8. attachReport — Bericht-PDF einfrieren (nur DRAFT)
// Die vorherige Datei wird NICHT aus dem Storage gelöscht —
// previousFileId wandert ins Audit-Log (Haus-Muster managementReviews)
// ============================================================

export const attachReport = mutation({
  args: {
    id: v.id("pmsReports"),
    reportFileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "pmsReports:manage");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("PMS-Bericht nicht gefunden");
    if (report.status !== "DRAFT") {
      throw new Error("Bericht-PDF kann nur im Entwurf eingefroren werden");
    }

    const previousFileId = report.reportFileId;

    await ctx.db.patch(args.id, {
      reportFileId: args.reportFileId,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "FILE_UPLOAD",
      entityType: "pmsReports",
      entityId: args.id,
      metadata: {
        kind: "pmsReport",
        reportFileId: args.reportFileId,
        previousFileId,
      },
    });
  },
});

// ============================================================
// 9. approve — Freigeben (DRAFT → APPROVED)
// ============================================================

export const approve = mutation({
  args: { id: v.id("pmsReports") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "pmsReports:approve");

    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("PMS-Bericht nicht gefunden");

    validateTransition("pmsReportStatus", report.status, "APPROVED");

    // Freigabe-Gate: PDF muss eingefroren sein
    if (!report.reportFileId) {
      throw new Error("Erst PDF einfrieren, dann freigeben");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      approvedAt: now,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "pmsReports",
      entityId: args.id,
      previousStatus: report.status,
      newStatus: "APPROVED",
    });
  },
});

// ============================================================
// 10. getReportUrl — Download-URL für eingefrorenes Bericht-PDF
// ============================================================

export const getReportUrl = query({
  args: { id: v.id("pmsReports") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "pmsReports:list");
    const report = await ctx.db.get(args.id);
    if (!report?.reportFileId) return null;
    return await ctx.storage.getUrl(report.reportFileId);
  },
});

// ============================================================
// 11. seedFromImport — idempotenter Seed (internalMutation)
// Idempotenz: skip wenn bereits ein nicht-archivierter Bericht
// für das Jahr existiert. autoData = ehrlicher Snapshot der
// App-Daten zum Seed-Zeitpunkt (buildAutoData).
// ============================================================

export const seedFromImport = internalMutation({
  args: {
    year: v.number(),
    reportingPeriod: v.string(),
    revision: v.number(),
    standText: v.optional(v.string()),
    productGroup: v.string(),
    status: v.union(v.literal("DRAFT"), v.literal("APPROVED")),
    approvedAt: v.optional(v.number()),
    sections: v.array(
      v.object({
        key: v.string(),
        text: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Idempotenz: nicht-archivierter Bericht für das Jahr existiert → skip
    const existing = await ctx.db
      .query("pmsReports")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (existing) {
      return {
        skipped: true,
        reason: `PMS-Bericht ${args.year} bereits geseedet — seedReset zuerst`,
      };
    }

    // Abschnitts-Keys hart validieren — Fehler bricht den Seed ab
    for (const s of args.sections) {
      if (!(SECTION_KEYS as readonly string[]).includes(s.key)) {
        throw new Error(`Unbekannter Abschnitt: ${s.key}`);
      }
    }

    // Freigegebener Seed braucht ein Freigabedatum
    if (args.status === "APPROVED" && args.approvedAt === undefined) {
      throw new Error("Freigegebener Seed braucht approvedAt");
    }

    // autoData = ehrlicher Snapshot der App-Daten zum Seed-Zeitpunkt
    const autoDataByKey = await buildAutoData(ctx, args.year);
    const textByKey = new Map(args.sections.map((s) => [s.key, s.text]));

    // Sections in fester Berichts-Reihenfolge (1–8)
    const sections = SECTION_KEYS.map((key) => ({
      key: key as string,
      autoData: autoDataByKey[key],
      text: textByKey.get(key),
    }));

    const now = Date.now();
    // createdBy/updatedBy entfallen beim System-Seed (Haus-Muster risks.seedFromImport)
    const id = await ctx.db.insert("pmsReports", {
      year: args.year,
      reportingPeriod: args.reportingPeriod,
      revision: args.revision,
      standText: args.standText,
      productGroup: args.productGroup,
      status: args.status,
      sections,
      // reportFileId bleibt undefined — Original-PDF liegt extern vor
      approvedAt: args.approvedAt,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    // Audit-Marker
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "pmsReports",
      entityId: id,
      metadata: { seed: true, year: args.year, status: args.status },
    });

    return { created: true };
  },
});

// ============================================================
// 12. seedReset — Hard-Delete aller PMS-Berichte (internalMutation)
// Nur für Seed-Korrekturen vor produktiver Pflege.
// ============================================================

export const seedReset = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Hard-Delete: vollständiger Wipe — nur für Seed-Korrekturen vor produktiver Pflege
    const reports = await ctx.db.query("pmsReports").collect();
    for (const r of reports) await ctx.db.delete(r._id);

    if (reports.length > 0) {
      await logAuditEvent(ctx, {
        action: "PERMANENT_DELETE",
        entityType: "pmsReports",
        entityId: "seed-reset",
        metadata: { seedReset: true, pmsReports: reports.length },
      });
    }

    return { pmsReports: reports.length };
  },
});
