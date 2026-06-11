import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { KpiKey, MANDATORY_LEVELS } from "../lib/types/enums";

/**
 * KPI-Engine für Qualitätsziele und Managementbewertung (ISO 13485 Kap. 5.4.1 / 5.6).
 * Berechnet alle 6 registrierten KPI-Schlüssel für ein gegebenes Jahr.
 */
export const compute = query({
  args: { year: v.number() },
  handler: async (ctx, args): Promise<Record<KpiKey, number>> => {
    await requirePermission(ctx, "qualityObjectives:list");

    const { year } = args;

    // UTC-Jahresgrenzen bewusst (Convex läuft UTC)
    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year + 1, 0, 1);

    // ============================================================
    // Volltabellen-Scan ok bei dieser Datenmenge (QMS einer 30-MA-Organisation)
    // ============================================================

    const [allComplaints, allCapas, allAudits, allFindings, allRequirements, allFulfillments] = await Promise.all([
      ctx.db.query("complaints").filter((q) => q.eq(q.field("isArchived"), false)).collect(),
      ctx.db.query("capas").filter((q) => q.eq(q.field("isArchived"), false)).collect(),
      ctx.db.query("audits").filter((q) => q.eq(q.field("isArchived"), false)).collect(),
      ctx.db.query("auditFindings").filter((q) => q.eq(q.field("isArchived"), false)).collect(),
      // Phase 4: nicht-archivierte Requirements — Funktion+Thema-Archivierung über Requirement-Archiv geprüft (einfach)
      ctx.db.query("trainingRequirements").filter((q) => q.eq(q.field("isArchived"), false)).collect(),
      ctx.db.query("trainingFulfillments").filter((q) => q.eq(q.field("isArchived"), false)).collect(),
    ]);

    // --- Reklamationen ---
    // complaintsYearCount: Anzahl nicht-archivierter Reklamationen mit receivedAt im Jahr
    const complaintsYearCount = allComplaints.filter(
      (c) => c.receivedAt >= yearStart && c.receivedAt < yearEnd
    ).length;

    // vigilanceOnTimeRate: Fristgerechte Vigilanz-Meldungen unter den vigilanzrelevanten Reklamationen des Jahres
    // FB-Regel „KPI auch wenn IST = 0": 100 zurückgeben wenn keine vigilanzrelevanten Fälle im Jahr
    // Hinweis: noch nicht gemeldete Fälle ohne abgelaufene Frist werden konservativ als nicht-fristgerecht gezählt
    // Logik gespiegelt in convex/managementReviews.ts buildAutoData (bewusste Duplikation, beide kommentiert)
    const vigilanceCases = allComplaints.filter(
      (c) =>
        c.isVigilanceRelevant &&
        c.receivedAt >= yearStart &&
        c.receivedAt < yearEnd
    );
    let vigilanceOnTimeRate: number;
    if (vigilanceCases.length === 0) {
      // FB-Regel „KPI auch wenn IST = 0": kein Fall → 100 %
      vigilanceOnTimeRate = 100;
    } else {
      const onTime = vigilanceCases.filter(
        (c) =>
          c.vigilanceReportedAt !== undefined &&
          c.vigilanceDeadline !== undefined &&
          c.vigilanceReportedAt <= c.vigilanceDeadline
      ).length;
      vigilanceOnTimeRate = Math.round((onTime / vigilanceCases.length) * 100);
    }

    // --- CAPAs ---
    // capaClosedInYearCount: nicht-archivierte CAPAs mit Status CLOSED und closedAt im Jahr
    const capaClosedInYearCount = allCapas.filter(
      (c) =>
        c.status === "CLOSED" &&
        c.closedAt !== undefined &&
        c.closedAt >= yearStart &&
        c.closedAt < yearEnd
    ).length;

    // Stichtags-KPIs: capaOpenOverdueCount und auditOpenFindingsCount sind bewusst
    // JAHRESUNABHÄNGIG (aktueller Zustand) — das year-Argument wirkt nur auf die 4 Jahres-KPIs.
    // capaOpenOverdueCount: nicht-archivierte CAPAs, Status nicht CLOSED/CANCELLED, dueAt gesetzt und überschritten
    const now = Date.now();
    const capaOpenOverdueCount = allCapas.filter(
      (c) =>
        c.status !== "CLOSED" &&
        c.status !== "CANCELLED" &&
        c.dueAt !== undefined &&
        c.dueAt < now
    ).length;

    // --- Audits ---
    // auditsClosedInYearCount: nicht-archivierte Audits mit Status CLOSED und closedAt im Jahr
    const auditsClosedInYearCount = allAudits.filter(
      (a) =>
        a.status === "CLOSED" &&
        a.closedAt !== undefined &&
        a.closedAt >= yearStart &&
        a.closedAt < yearEnd
    ).length;

    // --- Audit-Findings ---
    // auditOpenFindingsCount: nicht-archivierte Audit-Findings mit Status OPEN
    const auditOpenFindingsCount = allFindings.filter(
      (f) => f.status === "OPEN"
    ).length;

    // --- Schulungsbedarfsmatrix (Phase 4) ---
    // trainingFulfillmentRate: erfüllte Pflicht-Paare ÷ alle Pflicht-Paare × 100 (gerundet)
    // Erfüllt = fulfilled===true UND (validUntil undefined ODER validUntil >= now) —
    // abgelaufene Nachweise zählen NICHT als erfüllt (konsistent mit overview + planDraft)
    // 100 zurückgeben wenn keine Pflicht-Paare (kein Soll = kein Makel — wie vigilanceOnTimeRate)
    const mandatoryPairs = allRequirements.filter((r) =>
      (MANDATORY_LEVELS as readonly string[]).includes(r.level),
    );
    let trainingFulfillmentRate: number;
    if (mandatoryPairs.length === 0) {
      // Keine Pflicht-Paare → 100 (kein Soll = kein Makel)
      trainingFulfillmentRate = 100;
    } else {
      const fulfilledPairs = mandatoryPairs.filter((req) => {
        const ff = allFulfillments.find(
          (f) => f.functionId === req.functionId && f.topicId === req.topicId,
        );
        if (!ff || !ff.fulfilled) return false;
        if (ff.validUntil !== undefined && ff.validUntil < now) return false;
        return true;
      }).length;
      trainingFulfillmentRate = Math.round((fulfilledPairs / mandatoryPairs.length) * 100);
    }

    return {
      complaintsYearCount,
      vigilanceOnTimeRate,
      capaClosedInYearCount,
      capaOpenOverdueCount,
      auditsClosedInYearCount,
      auditOpenFindingsCount,
      trainingFulfillmentRate,
    };
  },
});
