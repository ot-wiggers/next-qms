import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";
import { Doc } from "./_generated/dataModel";

// ============================================================
// Ampel-Helper — exakt wie FB 5.4.1 Prozent-Logik
// ============================================================

function computePercentAndStatus(targetType: "MIN" | "MAX", soll: number, ist: number) {
  // Prozent-Logik exakt wie FB 5.4.1: min-Typ IST/SOLL, max-Typ SOLL/IST (Ziel 1: SOLL 6, IST 5 → 120 %)
  let percent: number;
  if (targetType === "MIN") {
    percent = soll === 0 ? 100 : Math.round((ist / soll) * 100);
  } else {
    percent = ist === 0 ? 999 : Math.round((soll / ist) * 100); // IST 0 bei max-Ziel = bestmöglich
  }
  const status: "GREEN" | "YELLOW" | "RED" = percent >= 100 ? "GREEN" : percent >= 70 ? "YELLOW" : "RED";
  return { percent, status };
}

// ============================================================
// 1. listByYear — Ziele + Readings + currentStatus + needsCapa + capaNumber-Join
// ============================================================

export const listByYear = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "qualityObjectives:list");

    const objectives = await ctx.db
      .query("qualityObjectives")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Sortieren nach seq (Formblatt-Reihenfolge)
    objectives.sort((a, b) => a.seq - b.seq);

    return Promise.all(
      objectives.map(async (obj) => {
        // Readings für dieses Ziel — nicht archiviert, nach Quartal sortiert
        const readings = await ctx.db
          .query("qualityObjectiveReadings")
          .withIndex("by_objective", (q) => q.eq("objectiveId", obj._id))
          .filter((q) => q.eq(q.field("isArchived"), false))
          .collect();
        readings.sort((a, b) => a.quarter - b.quarter);

        // currentStatus = Ampel des höchsten Quartals MIT erfasstem IST-Wert
        const readingsWithIst = readings.filter((r) => r.actualValue !== undefined);
        const latestReading = readingsWithIst.length > 0
          ? readingsWithIst[readingsWithIst.length - 1]
          : null;
        const currentStatus = latestReading?.status ?? null;

        // needsCapa: aktuell Gelb/Rot und noch kein CAPA verknüpft
        const needsCapa =
          (currentStatus === "YELLOW" || currentStatus === "RED") && !obj.capaId;

        // capaNumber-Join
        const capa = obj.capaId ? await ctx.db.get(obj.capaId) : null;
        const capaNumber = capa?.capaNumber ?? null;

        return { ...obj, readings, currentStatus, needsCapa, capaNumber };
      })
    );
  },
});

// ============================================================
// 2. create — neues Qualitätsziel anlegen
// ============================================================

const targetTypeArg = v.union(v.literal("MIN"), v.literal("MAX"));

export const create = mutation({
  args: {
    year: v.number(),
    area: v.string(),
    title: v.string(),
    kpiDefinition: v.optional(v.string()),
    dataSource: v.optional(v.string()),
    responsible: v.optional(v.string()),
    targetType: targetTypeArg,
    targetValue: v.number(),
    unit: v.optional(v.string()),
    isPhaseModel: v.boolean(),
    kpiKey: v.optional(v.string()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "qualityObjectives:manage");

    // Trim-Guards
    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");
    const area = args.area.trim();
    if (!area) throw new Error("Bereich ist erforderlich");

    // seq = max+1 im Jahr
    const existing = await ctx.db
      .query("qualityObjectives")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .collect();
    const seq = existing.length === 0 ? 1 : Math.max(...existing.map((o) => o.seq)) + 1;

    const now = Date.now();
    const id = await ctx.db.insert("qualityObjectives", {
      year: args.year,
      seq,
      area,
      title,
      kpiDefinition: args.kpiDefinition?.trim() || undefined,
      dataSource: args.dataSource?.trim() || undefined,
      responsible: args.responsible?.trim() || undefined,
      targetType: args.targetType,
      targetValue: args.targetValue,
      unit: args.unit?.trim() || undefined,
      isPhaseModel: args.isPhaseModel,
      kpiKey: args.kpiKey?.trim() || undefined,
      comment: args.comment?.trim() || undefined,
      isArchived: false,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "qualityObjectives",
      entityId: id,
      metadata: { year: args.year, seq, area, title },
    });

    return id;
  },
});

// ============================================================
// 3. update — Felder ändern (per-field patch)
// ============================================================

export const update = mutation({
  args: {
    id: v.id("qualityObjectives"),
    area: v.optional(v.string()),
    title: v.optional(v.string()),
    kpiDefinition: v.optional(v.string()),
    dataSource: v.optional(v.string()),
    responsible: v.optional(v.string()),
    targetType: v.optional(targetTypeArg),
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    isPhaseModel: v.optional(v.boolean()),
    kpiKey: v.optional(v.string()),
    capaId: v.optional(v.id("capas")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "qualityObjectives:manage");

    const objective = await ctx.db.get(args.id);
    if (!objective) throw new Error("Qualitätsziel nicht gefunden");
    if (objective.isArchived) throw new Error("Archivierte Ziele können nicht geändert werden");

    const patch: Partial<Doc<"qualityObjectives">> = {};

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Titel ist erforderlich");
      patch.title = title;
    }
    if (args.area !== undefined) {
      const area = args.area.trim();
      if (!area) throw new Error("Bereich ist erforderlich");
      patch.area = area;
    }
    // Clearable optional texts (trim||undefined)
    if (args.kpiDefinition !== undefined) patch.kpiDefinition = args.kpiDefinition.trim() || undefined;
    if (args.dataSource !== undefined) patch.dataSource = args.dataSource.trim() || undefined;
    if (args.responsible !== undefined) patch.responsible = args.responsible.trim() || undefined;
    if (args.unit !== undefined) patch.unit = args.unit.trim() || undefined;
    if (args.kpiKey !== undefined) patch.kpiKey = args.kpiKey.trim() || undefined;
    if (args.comment !== undefined) patch.comment = args.comment.trim() || undefined;
    // Settable non-text fields
    if (args.targetType !== undefined) patch.targetType = args.targetType;
    if (args.targetValue !== undefined) patch.targetValue = args.targetValue;
    if (args.isPhaseModel !== undefined) patch.isPhaseModel = args.isPhaseModel;
    if (args.capaId !== undefined) patch.capaId = args.capaId;

    await ctx.db.patch(args.id, { ...patch, updatedAt: Date.now(), updatedBy: user._id });

    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "qualityObjectives",
      entityId: args.id,
      changes,
    });
  },
});

// ============================================================
// 4. setQuarterTargets — SOLL-Werte je Quartal anlegen/aktualisieren (upsert)
// ============================================================

export const setQuarterTargets = mutation({
  args: {
    objectiveId: v.id("qualityObjectives"),
    targets: v.array(v.object({
      quarter: v.number(),
      targetValue: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "qualityObjectives:manage");

    const objective = await ctx.db.get(args.objectiveId);
    if (!objective) throw new Error("Qualitätsziel nicht gefunden");
    if (objective.isArchived) throw new Error("Archivierte Ziele können nicht geändert werden");

    const now = Date.now();

    for (const t of args.targets) {
      // Guard: Quartal 1–4
      if (!Number.isInteger(t.quarter) || t.quarter < 1 || t.quarter > 4) {
        throw new Error(`Ungültiges Quartal: ${t.quarter} — erlaubt 1–4`);
      }

      // Bestehende Reading für dieses Quartal suchen
      const existing = await ctx.db
        .query("qualityObjectiveReadings")
        .withIndex("by_objective", (q) => q.eq("objectiveId", args.objectiveId))
        .filter((q) => q.eq(q.field("quarter"), t.quarter))
        .first();

      if (existing) {
        // Nur SOLL-Wert ändern; IST-Wert unangetastet lassen
        // Wenn IST bereits erfasst: percent/status neu berechnen mit aktuellem SOLL
        const patch: Partial<Doc<"qualityObjectiveReadings">> = {
          targetValue: t.targetValue,
          updatedAt: now,
          updatedBy: user._id,
        };
        if (existing.actualValue !== undefined) {
          const computed = computePercentAndStatus(
            objective.targetType,
            t.targetValue,
            existing.actualValue
          );
          patch.percent = computed.percent;
          patch.status = computed.status;
        }
        await ctx.db.patch(existing._id, patch);
      } else {
        // Neue Reading anlegen — nur targetValue (IST noch nicht erfasst)
        await ctx.db.insert("qualityObjectiveReadings", {
          objectiveId: args.objectiveId,
          quarter: t.quarter,
          targetValue: t.targetValue,
          isArchived: false,
          createdAt: now,
          createdBy: user._id,
          updatedAt: now,
          updatedBy: user._id,
        });
      }
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "qualityObjectives",
      entityId: args.objectiveId,
      metadata: { action: "setQuarterTargets", quarters: args.targets.map((t) => t.quarter) },
    });
  },
});

// ============================================================
// 5. recordReading — IST-Wert erfassen + Ampel berechnen
// ============================================================

export const recordReading = mutation({
  args: {
    objectiveId: v.id("qualityObjectives"),
    quarter: v.number(),
    actualValue: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "qualityObjectives:manage");

    // Guards
    const objective = await ctx.db.get(args.objectiveId);
    if (!objective) throw new Error("Qualitätsziel nicht gefunden");
    if (objective.isArchived) throw new Error("Archivierte Ziele können nicht bearbeitet werden");
    if (!Number.isInteger(args.quarter) || args.quarter < 1 || args.quarter > 4) {
      throw new Error(`Ungültiges Quartal: ${args.quarter} — erlaubt 1–4`);
    }
    if (!Number.isFinite(args.actualValue)) throw new Error("Ungültiger IST-Wert");

    // Reading für dieses Quartal muss existieren (SOLL muss zuerst gesetzt werden)
    const reading = await ctx.db
      .query("qualityObjectiveReadings")
      .withIndex("by_objective", (q) => q.eq("objectiveId", args.objectiveId))
      .filter((q) => q.eq(q.field("quarter"), args.quarter))
      .first();

    if (!reading) {
      throw new Error("Erst Quartals-SOLL-Werte festlegen");
    }

    const { percent, status } = computePercentAndStatus(
      objective.targetType,
      reading.targetValue,
      args.actualValue
    );

    const now = Date.now();
    await ctx.db.patch(reading._id, {
      actualValue: args.actualValue,
      note: args.note?.trim() || undefined,
      percent,
      status,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "qualityObjectiveReadings",
      entityId: reading._id,
      changes: { quarter: args.quarter, actualValue: args.actualValue, percent, status },
    });

    // needsCapa: status nicht GREEN und kein CAPA verknüpft
    const needsCapa = status !== "GREEN" && !objective.capaId;
    return { percent, status, needsCapa };
  },
});

// ============================================================
// 6. archive — Soft-Delete
// ============================================================

export const archive = mutation({
  args: { id: v.id("qualityObjectives") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "qualityObjectives:manage");
    await archiveRecord(ctx, "qualityObjectives", args.id, user._id);
  },
});

// ============================================================
// 7. linkCapa — CAPA verknüpfen (nach Gelb/Rot-Erfassung)
// ============================================================

export const linkCapa = mutation({
  args: {
    objectiveId: v.id("qualityObjectives"),
    capaId: v.id("capas"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "qualityObjectives:manage");

    const objective = await ctx.db.get(args.objectiveId);
    if (!objective) throw new Error("Qualitätsziel nicht gefunden");
    if (objective.isArchived) throw new Error("Archivierte Ziele können nicht geändert werden");

    // CAPA muss existieren und nicht archiviert sein
    const capa = await ctx.db.get(args.capaId);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.isArchived) throw new Error("Archivierte CAPAs können nicht verknüpft werden");

    const now = Date.now();
    await ctx.db.patch(args.objectiveId, {
      capaId: args.capaId,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "qualityObjectives",
      entityId: args.objectiveId,
      changes: { capaId: args.capaId, capaNumber: capa.capaNumber },
    });
  },
});

// ============================================================
// 8. seedFromImport — idempotenter Seed via year+seq
// ============================================================

export const seedFromImport = internalMutation({
  args: {
    year: v.number(),
    items: v.array(v.object({
      seq: v.number(),
      area: v.string(),
      title: v.string(),
      kpiDefinition: v.optional(v.string()),
      dataSource: v.optional(v.string()),
      responsible: v.optional(v.string()),
      targetType: v.union(v.literal("MIN"), v.literal("MAX")),
      targetValue: v.number(),
      unit: v.optional(v.string()),
      isPhaseModel: v.boolean(),
      comment: v.optional(v.string()),
      capaNumber: v.optional(v.string()),  // z.B. "CAPA-2026-01" → capaId via by_number
      quarters: v.array(v.object({
        quarter: v.number(),
        targetValue: v.number(),
        actualValue: v.optional(v.number()),
      })),
    })),
  },
  handler: async (ctx, args) => {
    // Idempotenz: alle vorhandenen Ziele des Jahres sammeln (by_year collect + JS-Filter ok bei dieser Größe)
    const existing = await ctx.db
      .query("qualityObjectives")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .collect();
    const existingSeqs = new Set(existing.map((o) => o.seq));

    const now = Date.now();
    let inserted = 0;
    let skipped = 0;
    const warnings: string[] = [];

    for (const item of args.items) {
      // Idempotenz-Prüfung: year+seq bereits vorhanden → überspringen
      if (existingSeqs.has(item.seq)) {
        skipped++;
        continue;
      }

      // capaNumber → capaId via by_number-Lookup
      let capaId: Doc<"capas">["_id"] | undefined;
      if (item.capaNumber) {
        const capa = await ctx.db
          .query("capas")
          .withIndex("by_number", (q) => q.eq("capaNumber", item.capaNumber!))
          .first();
        if (capa) {
          capaId = capa._id;
        } else {
          // CAPA nicht gefunden → Warnung, kein Link (kein Hard-Fail)
          warnings.push(`Ziel ${item.seq}: CAPA ${item.capaNumber} nicht gefunden — Link übersprungen`);
        }
      }

      const objectiveId = await ctx.db.insert("qualityObjectives", {
        year: args.year,
        seq: item.seq,
        area: item.area,
        title: item.title,
        kpiDefinition: item.kpiDefinition || undefined,
        dataSource: item.dataSource || undefined,
        responsible: item.responsible || undefined,
        targetType: item.targetType,
        targetValue: item.targetValue,
        unit: item.unit || undefined,
        isPhaseModel: item.isPhaseModel,
        kpiKey: undefined,
        capaId,
        comment: item.comment || undefined,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });

      // Readings anlegen (mit percent/status wenn actualValue vorhanden)
      for (const q of item.quarters) {
        if (!Number.isInteger(q.quarter) || q.quarter < 1 || q.quarter > 4) {
          warnings.push(`Ziel ${item.seq}: Ungültiges Quartal ${q.quarter} — übersprungen`);
          continue;
        }

        let percent: number | undefined;
        let status: "GREEN" | "YELLOW" | "RED" | undefined;

        if (q.actualValue !== undefined) {
          const computed = computePercentAndStatus(item.targetType, q.targetValue, q.actualValue);
          percent = computed.percent;
          status = computed.status;
        }

        await ctx.db.insert("qualityObjectiveReadings", {
          objectiveId,
          quarter: q.quarter,
          targetValue: q.targetValue,
          actualValue: q.actualValue,
          percent,
          status,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      existingSeqs.add(item.seq); // Doppelten Eintrag in derselben Seed-Payload verhindern
      inserted++;
    }

    // Audit-Log-Marker nur wenn etwas eingefügt wurde
    if (inserted > 0) {
      await logAuditEvent(ctx, {
        action: "CREATE",
        entityType: "qualityObjectives",
        entityId: "seed",
        metadata: { seed: true, year: args.year, inserted, skipped, warnings },
      });
    }

    return { inserted, skipped, warnings };
  },
});
