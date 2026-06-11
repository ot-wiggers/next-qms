import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================
// Risikoregister (FB 7.1.0) — RPZ-Modell
// RPZ = Auftretenswahrscheinlichkeit × Schweregrad × Folgen
// RPZ wird NIE gespeichert, immer berechnet.
// ============================================================

// gespiegelt aus RPZ_ACCEPT_THRESHOLD in lib/types/enums.ts (Convex kann nicht aus lib/ importieren)
const RPZ_ACCEPT_THRESHOLD = 100;

// ============================================================
// Helper: Faktor-Validierung — jeder übergebene Faktor muss
// eine ganze Zahl von 1 bis 10 sein (undefined wird übersprungen)
// ============================================================
function validateFactors(...factors: Array<number | undefined>): void {
  for (const f of factors) {
    if (f === undefined) continue;
    if (!Number.isInteger(f) || f < 1 || f > 10) {
      throw new Error("Faktoren müssen ganze Zahlen von 1 bis 10 sein");
    }
  }
}

// ============================================================
// 1. list — alle nicht-archivierten Risiken nach seq (risks:list)
// Liefert pro Risiko zusätzlich: rpz, acceptable, initialRpz,
// aufgelöste CAPA-Links (archivierte CAPAs bleiben als Link sichtbar)
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "risks:list");

    const risks = await ctx.db
      .query("risks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    risks.sort((a, b) => a.seq - b.seq);

    return Promise.all(
      risks.map(async (risk) => {
        const rpz =
          risk.occurrenceProbability * risk.severity * risk.consequences;

        // initialRpz nur wenn ALLE drei Vor-Maßnahme-Faktoren gesetzt sind
        const initialRpz =
          risk.initialOccurrenceProbability !== undefined &&
          risk.initialSeverity !== undefined &&
          risk.initialConsequences !== undefined
            ? risk.initialOccurrenceProbability *
              risk.initialSeverity *
              risk.initialConsequences
            : undefined;

        // CAPA-Links auflösen — archivierte CAPAs bleiben sichtbar,
        // nicht mehr existierende Ids werden übersprungen
        const capas: Array<{
          _id: Id<"capas">;
          capaNumber: string;
          title: string;
          status: Doc<"capas">["status"];
        }> = [];
        for (const capaId of risk.capaIds ?? []) {
          const capa = await ctx.db.get(capaId);
          if (!capa) continue;
          capas.push({
            _id: capa._id,
            capaNumber: capa.capaNumber,
            title: capa.title,
            status: capa.status,
          });
        }

        return {
          ...risk,
          rpz,
          acceptable: rpz < RPZ_ACCEPT_THRESHOLD,
          initialRpz,
          capas,
        };
      }),
    );
  },
});

// ============================================================
// 2. create — neues Risiko anlegen (risks:manage)
// Nummernkreis: max(seq)+1 über ALLE Risiken inkl. archivierter
// ============================================================

export const create = mutation({
  args: {
    title: v.string(),
    measures: v.optional(v.string()),
    responsible: v.optional(v.string()),
    sourceNote: v.optional(v.string()),
    occurrenceProbability: v.number(),
    severity: v.number(),
    consequences: v.number(),
    initialOccurrenceProbability: v.optional(v.number()),
    initialSeverity: v.optional(v.number()),
    initialConsequences: v.optional(v.number()),
    capaIds: v.optional(v.array(v.id("capas"))),
    nextReviewAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "risks:manage");

    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");

    validateFactors(
      args.occurrenceProbability,
      args.severity,
      args.consequences,
      args.initialOccurrenceProbability,
      args.initialSeverity,
      args.initialConsequences,
    );

    // Vor-Maßnahme-Werte: alle drei oder keiner
    const initialCount = [
      args.initialOccurrenceProbability,
      args.initialSeverity,
      args.initialConsequences,
    ].filter((f) => f !== undefined).length;
    if (initialCount !== 0 && initialCount !== 3) {
      throw new Error(
        "Werte vor Maßnahme: entweder alle drei Faktoren oder keiner",
      );
    }

    // CAPA-Links müssen existieren
    for (const capaId of args.capaIds ?? []) {
      const capa = await ctx.db.get(capaId);
      if (!capa) throw new Error("Verknüpfte CAPA nicht gefunden");
    }

    // Nummernkreis: max(seq)+1 über ALLE Risiken (inkl. archivierter),
    // damit Nummern auch nach Archivierung nie doppelt vergeben werden
    const all = await ctx.db.query("risks").collect();
    const seq = all.length === 0 ? 1 : Math.max(...all.map((r) => r.seq)) + 1;
    const riskNumber = `RS-${String(seq).padStart(2, "0")}`;

    const now = Date.now();
    const id = await ctx.db.insert("risks", {
      riskNumber,
      seq,
      title,
      measures: args.measures?.trim() || undefined,
      responsible: args.responsible?.trim() || undefined,
      sourceNote: args.sourceNote?.trim() || undefined,
      occurrenceProbability: args.occurrenceProbability,
      severity: args.severity,
      consequences: args.consequences,
      initialOccurrenceProbability: args.initialOccurrenceProbability,
      initialSeverity: args.initialSeverity,
      initialConsequences: args.initialConsequences,
      capaIds: args.capaIds,
      nextReviewAt: args.nextReviewAt,
      isArchived: false,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "risks",
      entityId: id,
      metadata: { riskNumber, title },
    });

    return id;
  },
});

// ============================================================
// 3. update — per-field Patch (risks:manage)
// Clearing-Semantik: Textfelder trim()||undefined bei leerem String,
// clearInitial entfernt alle drei Vor-Maßnahme-Faktoren,
// clearNextReview entfernt das Wiedervorlage-Datum
// ============================================================

export const update = mutation({
  args: {
    id: v.id("risks"),
    title: v.optional(v.string()),
    measures: v.optional(v.string()),
    responsible: v.optional(v.string()),
    sourceNote: v.optional(v.string()),
    occurrenceProbability: v.optional(v.number()),
    severity: v.optional(v.number()),
    consequences: v.optional(v.number()),
    initialOccurrenceProbability: v.optional(v.number()),
    initialSeverity: v.optional(v.number()),
    initialConsequences: v.optional(v.number()),
    capaIds: v.optional(v.array(v.id("capas"))),
    nextReviewAt: v.optional(v.number()),
    clearInitial: v.optional(v.boolean()),
    clearNextReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "risks:manage");

    const risk = await ctx.db.get(args.id);
    if (!risk) throw new Error("Risiko nicht gefunden");
    if (risk.isArchived) throw new Error("Risiko ist archiviert");

    const patch: Partial<Doc<"risks">> = {};

    // Titel: Pflichtfeld — kann nicht geleert werden
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Titel ist erforderlich");
      patch.title = title;
    }

    // Clearable Textfelder (trim || undefined)
    if (args.measures !== undefined) patch.measures = args.measures.trim() || undefined;
    if (args.responsible !== undefined) patch.responsible = args.responsible.trim() || undefined;
    if (args.sourceNote !== undefined) patch.sourceNote = args.sourceNote.trim() || undefined;

    // Faktoren validieren (nur übergebene)
    validateFactors(
      args.occurrenceProbability,
      args.severity,
      args.consequences,
      args.initialOccurrenceProbability,
      args.initialSeverity,
      args.initialConsequences,
    );
    if (args.occurrenceProbability !== undefined) patch.occurrenceProbability = args.occurrenceProbability;
    if (args.severity !== undefined) patch.severity = args.severity;
    if (args.consequences !== undefined) patch.consequences = args.consequences;

    // Vor-Maßnahme-Faktoren: clearInitial entfernt alle drei;
    // sonst muss das EFFEKTIVE Trio nach dem Update vollständig sein
    if (args.clearInitial === true) {
      patch.initialOccurrenceProbability = undefined;
      patch.initialSeverity = undefined;
      patch.initialConsequences = undefined;
    } else if (
      args.initialOccurrenceProbability !== undefined ||
      args.initialSeverity !== undefined ||
      args.initialConsequences !== undefined
    ) {
      const effOcc = args.initialOccurrenceProbability ?? risk.initialOccurrenceProbability;
      const effSev = args.initialSeverity ?? risk.initialSeverity;
      const effCons = args.initialConsequences ?? risk.initialConsequences;
      if (effOcc === undefined || effSev === undefined || effCons === undefined) {
        throw new Error(
          "Werte vor Maßnahme: entweder alle drei Faktoren oder keiner",
        );
      }
      if (args.initialOccurrenceProbability !== undefined) patch.initialOccurrenceProbability = args.initialOccurrenceProbability;
      if (args.initialSeverity !== undefined) patch.initialSeverity = args.initialSeverity;
      if (args.initialConsequences !== undefined) patch.initialConsequences = args.initialConsequences;
    }

    // Wiedervorlage: clearNextReview entfernt, sonst setzen wenn übergeben
    if (args.clearNextReview === true) {
      patch.nextReviewAt = undefined;
    } else if (args.nextReviewAt !== undefined) {
      patch.nextReviewAt = args.nextReviewAt;
    }

    // CAPA-Links: Existenz prüfen — leeres Array erlaubt (= alle Links entfernen)
    if (args.capaIds !== undefined) {
      for (const capaId of args.capaIds) {
        const capa = await ctx.db.get(capaId);
        if (!capa) throw new Error("Verknüpfte CAPA nicht gefunden");
      }
      patch.capaIds = args.capaIds;
    }

    await ctx.db.patch(args.id, {
      ...patch,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    // Geänderte Argument-Namen für das Audit-Log sammeln
    const fields = Object.entries(args)
      .filter(([key, value]) => key !== "id" && value !== undefined)
      .map(([key]) => key);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "risks",
      entityId: args.id,
      metadata: { riskNumber: risk.riskNumber, fields },
    });
  },
});

// ============================================================
// 4. archive — Soft-Delete (risks:manage)
// archiveRecord setzt isArchived und loggt ARCHIVE (Haus-Muster wie capas.archive)
// ============================================================

export const archive = mutation({
  args: { id: v.id("risks") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "risks:manage");

    const risk = await ctx.db.get(args.id);
    if (!risk) throw new Error("Risiko nicht gefunden");

    await archiveRecord(ctx, "risks", args.id, user._id);
  },
});

// ============================================================
// 5. seedFromImport — idempotenter Seed (internalMutation)
// seq/riskNumber in Array-Reihenfolge ab 1; CAPA-Nummern werden
// über den by_number-Index aufgelöst — fehlende Nummer bricht hart ab.
// Idempotenz: skip wenn bereits nicht-archivierte Risiken existieren.
// ============================================================

export const seedFromImport = internalMutation({
  args: {
    risks: v.array(v.object({
      title: v.string(),
      measures: v.optional(v.string()),
      responsible: v.optional(v.string()),
      occurrenceProbability: v.number(),
      severity: v.number(),
      consequences: v.number(),
      capaNumbers: v.optional(v.array(v.string())),
      addedInRevision: v.optional(v.number()),
      sourceNote: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Idempotenz: wenn bereits nicht-archivierte Risiken existieren → skip
    const existing = await ctx.db
      .query("risks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (existing.length > 0) {
      return {
        skipped: true,
        reason: "Risikoregister bereits geseedet — seedReset zuerst",
      };
    }

    const now = Date.now();
    let capaLinks = 0;
    let seq = 0;

    for (const row of args.risks) {
      seq++;

      // Faktoren hart validieren — Fehler bricht den gesamten Seed ab
      validateFactors(
        row.occurrenceProbability,
        row.severity,
        row.consequences,
      );

      // CAPA-Nummern auflösen — KEIN stilles Überspringen fehlender Nummern
      let capaIds: Array<Id<"capas">> | undefined;
      if (row.capaNumbers && row.capaNumbers.length > 0) {
        capaIds = [];
        for (const nr of row.capaNumbers) {
          const capa = await ctx.db
            .query("capas")
            .withIndex("by_number", (q) => q.eq("capaNumber", nr))
            .first();
          if (!capa) {
            throw new Error(`CAPA ${nr} nicht gefunden — Seed abgebrochen`);
          }
          capaIds.push(capa._id);
          capaLinks++;
        }
      }

      // createdBy/updatedBy entfallen beim System-Seed
      // (Haus-Muster trainingMatrix.seedFromImport)
      await ctx.db.insert("risks", {
        riskNumber: `RS-${String(seq).padStart(2, "0")}`,
        seq,
        title: row.title,
        measures: row.measures || undefined,
        responsible: row.responsible || undefined,
        occurrenceProbability: row.occurrenceProbability,
        severity: row.severity,
        consequences: row.consequences,
        capaIds,
        addedInRevision: row.addedInRevision,
        sourceNote: row.sourceNote || undefined,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Audit-Marker
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "risks",
      entityId: "seed",
      metadata: { seed: true, risks: args.risks.length, capaLinks },
    });

    return { risks: args.risks.length, capaLinks, skipped: false };
  },
});

// ============================================================
// 6. seedReset — Hard-Delete aller Risiken (internalMutation)
// Nur für Seed-Korrekturen vor produktiver Pflege.
// ============================================================

export const seedReset = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Hard-Delete: vollständiger Wipe — nur für Seed-Korrekturen vor produktiver Pflege
    const risks = await ctx.db.query("risks").collect();
    for (const r of risks) await ctx.db.delete(r._id);

    if (risks.length > 0) {
      await logAuditEvent(ctx, {
        action: "PERMANENT_DELETE",
        entityType: "risks",
        entityId: "seed-reset",
        metadata: { seedReset: true, risks: risks.length },
      });
    }

    return { risks: risks.length };
  },
});
