import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { MGMT_REVIEW_SECTIONS } from "../lib/types/enums";

// ============================================================
// Section-Keys (exakt nach FB 5.6.0 Rev. 8, Abschnitte 2.1–2.8)
// Abgeleitet aus dem zentralen Enum — keine Duplikation.
// ============================================================

const SECTION_KEYS = MGMT_REVIEW_SECTIONS.map((s) => s.key);

type SectionKey = (typeof MGMT_REVIEW_SECTIONS)[number]["key"];

// ============================================================
// backfillMissingSections — Migration bestehender Dokumente:
// Reviews, die vor einer Enum-Erweiterung angelegt wurden (z. B.
// 2.9 regulatory / 2.10 followup), haben die neuen Keys nicht im
// persistierten sections-Array. Fehlende Enum-Keys werden in
// Enum-Reihenfolge angehängt (autoData/assessment leer), damit
// updateSection/refreshAutoData sie behandeln können.
// ============================================================

function backfillMissingSections(
  sections: Doc<"managementReviews">["sections"]
): Doc<"managementReviews">["sections"] {
  const existingKeys = new Set(sections.map((s) => s.key));
  const missing = SECTION_KEYS.filter((key) => !existingKeys.has(key)).map(
    (key) => ({
      key,
      autoData: undefined as string | undefined,
      assessment: undefined as string | undefined,
    })
  );
  return missing.length > 0 ? [...sections, ...missing] : sections;
}

// ============================================================
// buildAutoData — interner Helfer (kein Convex-Export)
// Erstellt einen Daten-Snapshot je Abschnitt aus echten App-Daten.
// Nur Abschnitte mit vorhandenen Daten erhalten autoData; rein
// manuelle Abschnitte (processes/changes/resources/risks) bleiben
// undefined — bewusst ehrlich, nichts erfinden.
// ============================================================

async function buildAutoData(
  ctx: QueryCtx | MutationCtx,
  year: number
): Promise<Record<SectionKey, string | undefined>> {
  // UTC-Jahresgrenzen (Convex läuft UTC)
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);
  const now = Date.now();

  // Volltabellen-Scan ok bei dieser Datenmenge (QMS einer 30-MA-Organisation)
  const [allAudits, allFindings, allComplaints, allCapas, allObjectives, allReadings] =
    await Promise.all([
      ctx.db
        .query("audits")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
      ctx.db
        .query("auditFindings")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
      ctx.db
        .query("complaints")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
      ctx.db
        .query("capas")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
      ctx.db
        .query("qualityObjectives")
        .withIndex("by_year", (q) => q.eq("year", year))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
      ctx.db
        .query("qualityObjectiveReadings")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
    ]);

  // ── 2.1 Audits ──────────────────────────────────────────────
  const auditsOfYear = allAudits.filter((a) => a.auditYear === year);
  const closedAudits = auditsOfYear.filter((a) => a.status === "CLOSED");
  const auditIds = new Set(auditsOfYear.map((a) => a._id));
  const findingsOfYear = allFindings.filter((f) => auditIds.has(f.auditId));
  const abweichungen = findingsOfYear.filter((f) => f.classification === "ABWEICHUNG").length;
  const feststellungen = findingsOfYear.filter(
    (f) => f.classification === "FESTSTELLUNG"
  ).length;
  const empfehlungen = findingsOfYear.filter((f) => f.classification === "EMPFEHLUNG").length;

  const findingsParts: string[] = [];
  if (abweichungen > 0) findingsParts.push(`${abweichungen} Abweichung${abweichungen !== 1 ? "en" : ""}`);
  if (feststellungen > 0)
    findingsParts.push(`${feststellungen} Feststellung${feststellungen !== 1 ? "en" : ""}`);
  if (empfehlungen > 0) findingsParts.push(`${empfehlungen} Empfehlung${empfehlungen !== 1 ? "en" : ""}`);
  const findingsStr =
    findingsParts.length > 0
      ? `Findings: ${findingsParts.join(", ")}`
      : "keine Findings";

  const auditsAutoData =
    `${auditsOfYear.length} Audit${auditsOfYear.length !== 1 ? "s" : ""} ` +
    `(${closedAudits.length} abgeschlossen) · ${findingsStr}`;

  // ── 2.2 Kundenfeedback / Reklamationen ──────────────────────
  // Logik gespiegelt zu convex/kpis.ts (bewusste Duplikation, beide kommentiert)
  const complaintsOfYear = allComplaints.filter(
    (c) => c.receivedAt >= yearStart && c.receivedAt < yearEnd
  );
  const vigilanceCases = complaintsOfYear.filter((c) => c.isVigilanceRelevant);
  let vigilanceOnTimeStr: string;
  if (vigilanceCases.length === 0) {
    // FB-Regel: kein vigilanzrelevanter Fall → 100 % (auch wenn IST = 0)
    vigilanceOnTimeStr = "100 % (kein Fall)";
  } else {
    const onTime = vigilanceCases.filter(
      (c) =>
        c.vigilanceReportedAt !== undefined &&
        c.vigilanceDeadline !== undefined &&
        c.vigilanceReportedAt <= c.vigilanceDeadline
    ).length;
    const rate = Math.round((onTime / vigilanceCases.length) * 100);
    vigilanceOnTimeStr = `${rate} % (${onTime}/${vigilanceCases.length})`;
  }
  const openComplaints = complaintsOfYear.filter((c) => c.status !== "CLOSED").length;

  const complaintsAutoData =
    `${complaintsOfYear.length} Reklamation${complaintsOfYear.length !== 1 ? "en" : ""} im Jahr` +
    ` · davon vigilanzrelevant: ${vigilanceCases.length}` +
    ` · fristgerecht gemeldet: ${vigilanceOnTimeStr}` +
    ` · noch offen: ${openComplaints}`;

  // ── 2.3 PMS ─────────────────────────────────────────────────
  // PMS-Bericht desselben Berichtsjahres aus dem Phase-6-Modul (beide rückblickend auf year)
  const pmsReport = await ctx.db
    .query("pmsReports")
    .withIndex("by_year", (q) => q.eq("year", year))
    .filter((q) => q.eq(q.field("isArchived"), false))
    .first();
  const pmsAutoData = pmsReport
    ? `PMS-Bericht ${pmsReport.year} (${pmsReport.reportingPeriod}): Rev. ${pmsReport.revision}, ` +
      `${pmsReport.status === "APPROVED" ? "freigegeben" : "Entwurf"} — Details im Modul PMS-Bericht`
    : "Kein PMS-Bericht für dieses Jahr in der App erfasst — Reklamationskennzahlen siehe Abschnitt 2.2";

  // ── 2.5 CAPA (inkl. Q-Ziele-Jahresstand) ───────────────────
  const openCAPAs = allCapas.filter(
    (c) =>
      c.status !== "CLOSED" &&
      c.status !== "CANCELLED"
  );
  const overdueCount = openCAPAs.filter(
    (c) => c.dueAt !== undefined && c.dueAt < now
  ).length;
  const closedInYear = allCapas.filter(
    (c) =>
      c.status === "CLOSED" &&
      c.closedAt !== undefined &&
      c.closedAt >= yearStart &&
      c.closedAt < yearEnd
  ).length;

  // Q-Ziele-Jahresstand: höchstes Quartal mit IST-Wert je Ziel = currentStatus
  let qGreen = 0;
  let qYellow = 0;
  let qRed = 0;
  let qNoMeasurement = 0;

  for (const obj of allObjectives) {
    const readings = allReadings
      .filter((r) => r.objectiveId === obj._id && r.actualValue !== undefined)
      .sort((a, b) => a.quarter - b.quarter);
    const latest = readings.length > 0 ? readings[readings.length - 1] : null;
    if (!latest || latest.status === undefined) {
      qNoMeasurement++;
    } else if (latest.status === "GREEN") {
      qGreen++;
    } else if (latest.status === "YELLOW") {
      qYellow++;
    } else {
      qRed++;
    }
  }

  const qParts: string[] = [];
  if (qGreen > 0) qParts.push(`${qGreen} grün`);
  if (qYellow > 0) qParts.push(`${qYellow} gelb`);
  if (qRed > 0) qParts.push(`${qRed} rot`);
  if (qNoMeasurement > 0) qParts.push(`${qNoMeasurement} ohne Messung`);
  const qZieleStr =
    allObjectives.length > 0
      ? `Q-Ziele ${year}: ${qParts.join(", ") || "keine Daten"}`
      : `Q-Ziele ${year}: keine Ziele erfasst`;

  const capaAutoData =
    `CAPAs offen/in Bearbeitung: ${openCAPAs.length}` +
    ` · davon überfällig: ${overdueCount}` +
    ` · im Jahr abgeschlossen: ${closedInYear}` +
    ` · ${qZieleStr}`;

  // ── 2.4 Prozesse / 2.6 Änderungen / 2.7 Ressourcen / 2.8 Risiken ──
  // Rein manuelle Abschnitte — nichts erfinden, autoData bleibt undefined

  return {
    audits: auditsAutoData,
    complaints: complaintsAutoData,
    pms: pmsAutoData,
    processes: undefined,
    capa: capaAutoData,
    changes: undefined,
    resources: undefined,
    risks: undefined,
    regulatory: undefined,
    followup: undefined,
  };
}

// ============================================================
// invalidateFrozenReport — Inhaltsänderungen nach dem Einfrieren
// machen das Nachweis-PDF ungültig: reportFileId wird entfernt,
// die Freigabe erzwingt damit ein erneutes Einfrieren.
// Nur in Content-Mutations aufrufen — NICHT in attachReport/approve.
// ============================================================

function invalidateFrozenReport(
  review: Doc<"managementReviews">,
  patch: Partial<Doc<"managementReviews">>
) {
  if (review.reportFileId !== undefined) {
    patch.reportFileId = undefined;
  }
}

// ============================================================
// 1. list — nicht-archivierte Managementbewertungen, nach Jahr desc
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "mgmtReview:list");
    const results = await ctx.db
      .query("managementReviews")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return results.sort((a, b) => b.year - a.year);
  },
});

// ============================================================
// 2. getById — Review + measures angereichert mit capaNumber-Join
// ============================================================

export const getById = query({
  args: { id: v.id("managementReviews") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "mgmtReview:list");
    const review = await ctx.db.get(args.id);
    if (!review) return null;

    // measures: capaId → capaNumber-Join
    const measuresWithCapa = await Promise.all(
      review.measures.map(async (m) => {
        if (!m.capaId) return { ...m, capaNumber: undefined as string | undefined };
        const capa = await ctx.db.get(m.capaId);
        return { ...m, capaNumber: capa?.capaNumber };
      })
    );

    return { ...review, measures: measuresWithCapa };
  },
});

// ============================================================
// 3. createDraft — Entwurf anlegen mit Auto-Snapshot
// ============================================================

export const createDraft = mutation({
  args: {
    year: v.number(),
    reportingPeriod: v.string(),
    participants: v.optional(v.string()),
    companyNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    // Guard: ein nicht-archivierter Entwurf pro Jahr
    const existing = await ctx.db
      .query("managementReviews")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (existing) {
      throw new Error(
        "Für dieses Jahr existiert bereits eine Managementbewertung"
      );
    }

    const reportingPeriod = args.reportingPeriod.trim();
    if (!reportingPeriod) throw new Error("Berichtszeitraum ist erforderlich");

    // autoData-Snapshot für alle Abschnitte generieren
    const autoDataByKey = await buildAutoData(ctx, args.year);

    // Sections-Array nach FB-Reihenfolge (2.1–2.8)
    const sections = SECTION_KEYS.map((key) => ({
      key,
      autoData: autoDataByKey[key],
      assessment: undefined as string | undefined,
    }));

    const now = Date.now();
    const id = await ctx.db.insert("managementReviews", {
      year: args.year,
      reportingPeriod,
      participants: args.participants?.trim() || undefined,
      companyNote: args.companyNote?.trim() || undefined,
      status: "DRAFT",
      sections,
      measures: [],
      isArchived: false,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "managementReviews",
      entityId: id,
      metadata: { year: args.year, reportingPeriod },
    });

    return id;
  },
});

// ============================================================
// 4. refreshAutoData — Snapshot neu generieren (nur DRAFT)
// ============================================================

export const refreshAutoData = mutation({
  args: { id: v.id("managementReviews") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Auto-Snapshot kann nur im Entwurf aktualisiert werden");
    }

    const autoDataByKey = await buildAutoData(ctx, review.year);

    // Read-modify-write — unter Convex OCC (optimistic concurrency control) korrekt:
    // Convex transaktioniert read+write atomar, Konflikte werden automatisch zurückgerollt.
    // Backfill: vor Enum-Erweiterung angelegte Reviews erhalten fehlende Abschnitte.
    const updatedSections = backfillMissingSections(review.sections).map((s) => ({
      ...s,
      // autoData wird neu gesetzt; assessment bleibt erhalten
      autoData: autoDataByKey[s.key as SectionKey] ?? s.autoData,
    }));

    const patch: Partial<Doc<"managementReviews">> = {
      sections: updatedSections,
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patch);
    const reportInvalidated = patch.reportFileId === undefined && review.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { autoDataRefreshed: true, ...(reportInvalidated && { reportInvalidated: true }) },
    });
  },
});

// ============================================================
// 5. updateSection — Bewertungstext eines Abschnitts speichern (nur DRAFT)
// ============================================================

export const updateSection = mutation({
  args: {
    id: v.id("managementReviews"),
    key: v.string(),
    assessment: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Abschnitte können nur im Entwurf geändert werden");
    }

    // Backfill: vor Enum-Erweiterung angelegte Reviews erhalten fehlende
    // Abschnitte, damit deren Bewertungstext direkt speicherbar ist.
    const sections = backfillMissingSections(review.sections);

    const sectionIndex = sections.findIndex((s) => s.key === args.key);
    if (sectionIndex === -1) {
      throw new Error(`Unbekannter Abschnitt: ${args.key}`);
    }

    // Read-modify-write (Convex OCC, s. refreshAutoData)
    const updatedSections = sections.map((s, i) =>
      i === sectionIndex
        ? { ...s, assessment: args.assessment.trim() || undefined }
        : s
    );

    const patch: Partial<Doc<"managementReviews">> = {
      sections: updatedSections,
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patch);
    const reportInvalidated = patch.reportFileId === undefined && review.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { section: args.key, ...(reportInvalidated && { reportInvalidated: true }) },
    });
  },
});

// ============================================================
// 6. updateGeneral — Allgemeine Angaben ändern (nur DRAFT)
// ============================================================

export const updateGeneral = mutation({
  args: {
    id: v.id("managementReviews"),
    reportingPeriod: v.optional(v.string()),
    participants: v.optional(v.string()),
    companyNote: v.optional(v.string()),
    overallAssessment: v.optional(v.string()),
    improvements: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Allgemeine Angaben können nur im Entwurf geändert werden");
    }

    const patch: Partial<Doc<"managementReviews">> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };

    // Per-field clearable (trim || undefined)
    if (args.reportingPeriod !== undefined) {
      patch.reportingPeriod = args.reportingPeriod.trim() || review.reportingPeriod;
    }
    if (args.participants !== undefined) {
      patch.participants = args.participants.trim() || undefined;
    }
    if (args.companyNote !== undefined) {
      patch.companyNote = args.companyNote.trim() || undefined;
    }
    if (args.overallAssessment !== undefined) {
      patch.overallAssessment = args.overallAssessment.trim() || undefined;
    }
    if (args.improvements !== undefined) {
      patch.improvements = args.improvements.trim() || undefined;
    }

    invalidateFrozenReport(review, patch);
    const reportInvalidated = patch.reportFileId === undefined && review.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { ...changes, ...(reportInvalidated && { reportInvalidated: true }) },
    });
  },
});

// ============================================================
// 7. addMeasure — Maßnahme anhängen (nur DRAFT)
// ============================================================

export const addMeasure = mutation({
  args: {
    id: v.id("managementReviews"),
    description: v.string(),
    responsible: v.optional(v.string()),
    dueText: v.optional(v.string()),
    effectivenessCheck: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Maßnahmen können nur im Entwurf ergänzt werden");
    }

    const description = args.description.trim();
    if (!description) throw new Error("Maßnahmenbeschreibung ist erforderlich");

    // Read-modify-write (Convex OCC, s. refreshAutoData)
    const newMeasure = {
      description,
      responsible: args.responsible?.trim() || undefined,
      dueText: args.dueText?.trim() || undefined,
      effectivenessCheck: args.effectivenessCheck?.trim() || undefined,
    };

    const patch: Partial<Doc<"managementReviews">> = {
      measures: [...review.measures, newMeasure],
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patch);
    const reportInvalidated = patch.reportFileId === undefined && review.reportFileId !== undefined;

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { addedMeasure: description.slice(0, 100), ...(reportInvalidated && { reportInvalidated: true }) },
    });
  },
});

// ============================================================
// 8. updateMeasure — Maßnahme bearbeiten (nur DRAFT)
// ============================================================

export const updateMeasure = mutation({
  args: {
    id: v.id("managementReviews"),
    index: v.number(),
    description: v.optional(v.string()),
    responsible: v.optional(v.string()),
    dueText: v.optional(v.string()),
    effectivenessCheck: v.optional(v.string()),
    capaId: v.optional(v.id("capas")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Maßnahmen können nur im Entwurf geändert werden");
    }

    // Index-Bounds-Guard
    if (!Number.isInteger(args.index) || args.index < 0 || args.index >= review.measures.length) {
      throw new Error(
        `Ungültiger Maßnahmen-Index: ${args.index} — vorhanden: ${review.measures.length}`
      );
    }

    // capaId: Existenz- und Nicht-Archiviert-Check
    if (args.capaId !== undefined) {
      const capa = await ctx.db.get(args.capaId);
      if (!capa) throw new Error("CAPA nicht gefunden");
      if (capa.isArchived) throw new Error("Archivierte CAPAs können nicht verknüpft werden");
    }

    // Read-modify-write (Convex OCC, s. refreshAutoData)
    const updatedMeasures = review.measures.map((m, i) => {
      if (i !== args.index) return m;
      const updated = { ...m };
      if (args.description !== undefined) {
        updated.description = args.description.trim() || m.description;
      }
      if (args.responsible !== undefined) {
        updated.responsible = args.responsible.trim() || undefined;
      }
      if (args.dueText !== undefined) {
        updated.dueText = args.dueText.trim() || undefined;
      }
      if (args.effectivenessCheck !== undefined) {
        updated.effectivenessCheck = args.effectivenessCheck.trim() || undefined;
      }
      if (args.capaId !== undefined) {
        updated.capaId = args.capaId;
      }
      return updated;
    });

    const patchMeasure: Partial<Doc<"managementReviews">> = {
      measures: updatedMeasures,
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patchMeasure);
    const reportInvalidated = patchMeasure.reportFileId === undefined && review.reportFileId !== undefined;

    await ctx.db.patch(args.id, patchMeasure);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { updatedMeasureIndex: args.index, ...(reportInvalidated && { reportInvalidated: true }) },
    });
  },
});

// ============================================================
// 9. removeMeasure — Maßnahme entfernen (nur DRAFT)
// ============================================================

export const removeMeasure = mutation({
  args: {
    id: v.id("managementReviews"),
    index: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Maßnahmen können nur im Entwurf entfernt werden");
    }

    // Index-Bounds-Guard
    if (!Number.isInteger(args.index) || args.index < 0 || args.index >= review.measures.length) {
      throw new Error(
        `Ungültiger Maßnahmen-Index: ${args.index} — vorhanden: ${review.measures.length}`
      );
    }

    // Read-modify-write (Convex OCC, s. refreshAutoData)
    const updatedMeasures = review.measures.filter((_, i) => i !== args.index);

    const patchRemove: Partial<Doc<"managementReviews">> = {
      measures: updatedMeasures,
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patchRemove);
    const reportInvalidated = patchRemove.reportFileId === undefined && review.reportFileId !== undefined;

    await ctx.db.patch(args.id, patchRemove);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { removedMeasureIndex: args.index, ...(reportInvalidated && { reportInvalidated: true }) },
    });
  },
});

// ============================================================
// 10. generateUploadUrl — Upload-URL für Bericht-PDF
// ============================================================

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "mgmtReview:approve");
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================================
// 11. attachReport — Bericht-PDF einfrieren (nur DRAFT)
// ============================================================

export const attachReport = mutation({
  args: {
    id: v.id("managementReviews"),
    reportFileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:approve");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Bericht-PDF kann nur im Entwurf eingefroren werden");
    }

    const previousFileId = review.reportFileId;

    await ctx.db.patch(args.id, {
      reportFileId: args.reportFileId,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "FILE_UPLOAD",
      entityType: "managementReviews",
      entityId: args.id,
      metadata: {
        kind: "mgmtReviewReport",
        reportFileId: args.reportFileId,
        previousFileId,
      },
    });
  },
});

// ============================================================
// 12. approve — Freigeben (DRAFT → APPROVED)
// ============================================================

export const approve = mutation({
  args: { id: v.id("managementReviews") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:approve");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");

    validateTransition("mgmtReviewStatus", review.status, "APPROVED");

    // Freigabe-Gate: PDF muss eingefroren sein
    if (!review.reportFileId) {
      throw new Error("Erst PDF einfrieren, dann freigeben");
    }

    const now = Date.now();
    const patch: Partial<Doc<"managementReviews">> = {
      status: "APPROVED",
      approvedAt: now,
      updatedAt: now,
      updatedBy: user._id,
    };

    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "managementReviews",
      entityId: args.id,
      previousStatus: review.status,
      newStatus: "APPROVED",
    });
  },
});

// ============================================================
// 13. getReportUrl — Download-URL für eingefrorenes Bericht-PDF
// ============================================================

export const getReportUrl = query({
  args: { id: v.id("managementReviews") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "mgmtReview:list");
    const review = await ctx.db.get(args.id);
    if (!review?.reportFileId) return null;
    return await ctx.storage.getUrl(review.reportFileId);
  },
});
