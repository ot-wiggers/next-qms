import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";
import { createNotification } from "./lib/notificationHelpers";
import { MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

const capaTypeArg = v.union(v.literal("CORRECTIVE"), v.literal("PREVENTIVE"));
const sourceTypeArg = v.union(
  v.literal("AUDIT"), v.literal("COMPLAINT"), v.literal("TRAINING"),
  v.literal("RISK"), v.literal("QUALITY_OBJECTIVE"),
  v.literal("MGMT_REVIEW"), v.literal("MANUAL")
);

/** Nächste CAPA-Nummer im Jahres-Nummernkreis (Format CAPA-2026-11) */
async function nextCapaNumber(ctx: MutationCtx, year: number) {
  const existing = await ctx.db
    .query("capas")
    .withIndex("by_year", (q) => q.eq("year", year))
    .collect();
  const seq = existing.length === 0 ? 1 : Math.max(...existing.map((c) => c.seq)) + 1;
  return { seq, capaNumber: `CAPA-${year}-${seq}` };
}

/** CAPAs auflisten (optional nach Status/Jahr) */
export const list = query({
  args: { status: v.optional(v.string()), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "capa:list");
    let results = await ctx.db
      .query("capas")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (args.status) results = results.filter((c) => c.status === args.status);
    if (args.year !== undefined) results = results.filter((c) => c.year === args.year);
    return results.sort((a, b) => b.year - a.year || b.seq - a.seq);
  },
});

/** CAPA inkl. Maßnahmen und Verantwortlichem */
export const getById = query({
  args: { id: v.id("capas") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "capa:list");
    const capa = await ctx.db.get(args.id);
    if (!capa) return null;
    const measures = await ctx.db
      .query("capaMeasures")
      .withIndex("by_capa", (q) => q.eq("capaId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const assignee = capa.assigneeId ? await ctx.db.get(capa.assigneeId) : null;
    return {
      ...capa,
      measures: measures.sort((a, b) => a.createdAt - b.createdAt),
      assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
    };
  },
});

/** CAPA manuell anlegen */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    capaType: capaTypeArg,
    sourceType: sourceTypeArg,
    sourceId: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    responsible: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    effectivenessCriterion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:create");
    // QA-1: trim title and guard empty
    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");
    const year = new Date().getFullYear();
    const { seq, capaNumber } = await nextCapaNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("capas", {
      ...args,
      title,
      capaNumber, year, seq,
      status: "OPEN",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capas", entityId: id,
      metadata: { capaNumber, sourceType: args.sourceType },
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_ASSIGNED",
        title: `CAPA zugewiesen: ${capaNumber}`,
        message: title,
        resourceType: "capa",
        resourceId: id,
      });
    }
    return id;
  },
});

/** Halbautomatik: vorausgefüllte CAPA aus einem Audit-Finding erzeugen */
export const createFromFinding = mutation({
  args: {
    findingId: v.id("auditFindings"),
    capaType: capaTypeArg,
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:create");
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new Error("Finding nicht gefunden");
    // QA-7: guard archived finding
    if (finding.isArchived) throw new Error("Finding ist archiviert");
    if (finding.capaId) throw new Error("Für dieses Finding existiert bereits eine CAPA");
    const audit = await ctx.db.get(finding.auditId);

    const year = new Date().getFullYear();
    const { seq, capaNumber } = await nextCapaNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("capas", {
      capaNumber, year, seq,
      title: `${finding.chapter ? `Kap. ${finding.chapter}: ` : ""}${finding.description.slice(0, 120)}`,
      description: [
        `Quelle: ${audit?.title ?? "Audit"} — Finding (${finding.classification})`,
        "",
        finding.description,
      ].join("\n"),
      capaType: args.capaType,
      sourceType: "AUDIT",
      sourceId: args.findingId as string,
      status: "OPEN",
      assigneeId: args.assigneeId,
      dueAt: args.dueAt,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await ctx.db.patch(args.findingId, { capaId: id, updatedAt: now, updatedBy: user._id });

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capas", entityId: id,
      metadata: { capaNumber, fromFinding: args.findingId },
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_ASSIGNED",
        title: `CAPA zugewiesen: ${capaNumber}`,
        message: finding.description.slice(0, 200),
        resourceType: "capa",
        resourceId: id,
      });
    }
    return id;
  },
});

/** Felder ändern (Titel, Beschreibung, Ursachenanalyse, Verantwortlicher, Termine) */
export const update = mutation({
  args: {
    id: v.id("capas"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    rootCauseAnalysis: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    responsible: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    effectivenessCriterion: v.optional(v.string()),
    effectivenessDueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const capa = await ctx.db.get(args.id);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.status === "CLOSED" || capa.status === "CANCELLED") {
      throw new Error("Abgeschlossene CAPAs können nicht geändert werden");
    }
    // QA-2: per-field patch construction with typed partial
    const { id, ...changes } = args;
    const patch: Partial<Doc<"capas">> = {};
    if (changes.title !== undefined) {
      const trimmed = changes.title.trim();
      if (trimmed) patch.title = trimmed;
    }
    if (changes.description !== undefined) {
      patch.description = changes.description.trim() || undefined;
    }
    if (changes.rootCauseAnalysis !== undefined) {
      patch.rootCauseAnalysis = changes.rootCauseAnalysis.trim() || undefined;
    }
    if (changes.responsible !== undefined) {
      patch.responsible = changes.responsible.trim() || undefined;
    }
    if (changes.effectivenessCriterion !== undefined) {
      patch.effectivenessCriterion = changes.effectivenessCriterion.trim() || undefined;
    }
    if (changes.assigneeId !== undefined) patch.assigneeId = changes.assigneeId;
    if (changes.dueAt !== undefined) patch.dueAt = changes.dueAt;
    if (changes.effectivenessDueAt !== undefined) patch.effectivenessDueAt = changes.effectivenessDueAt;

    await ctx.db.patch(id, { ...patch, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "capas", entityId: id, changes,
    });
  },
});

/** Statuswechsel — CLOSED nur mit dokumentierter Wirksamkeitsprüfung */
export const setStatus = mutation({
  args: { id: v.id("capas"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx, args.status === "CLOSED" ? "capa:close" : "capa:manage"
    );
    const capa = await ctx.db.get(args.id);
    if (!capa) throw new Error("CAPA nicht gefunden");
    validateTransition("capaStatus", capa.status, args.status);
    if (args.status === "CLOSED" && capa.effectivenessResult !== "EFFECTIVE") {
      throw new Error("Abschluss nur nach dokumentiert wirksamer Wirksamkeitsprüfung");
    }
    const now = Date.now();
    // QA-6: typed patch with cast — validateTransition hat den Wert geprüft
    const patch: Partial<Doc<"capas">> = {
      status: args.status as Doc<"capas">["status"],
      updatedAt: now,
      updatedBy: user._id,
    };
    if (args.status === "CLOSED") patch.closedAt = now;
    await ctx.db.patch(args.id, patch);
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "capas", entityId: args.id,
      previousStatus: capa.status, newStatus: args.status,
    });
  },
});

/** Wirksamkeitsprüfung dokumentieren (im Status EFFECTIVENESS_CHECK) */
export const recordEffectiveness = mutation({
  args: {
    id: v.id("capas"),
    effectivenessResult: v.union(v.literal("EFFECTIVE"), v.literal("INEFFECTIVE")),
    effectivenessNote: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const capa = await ctx.db.get(args.id);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.status !== "EFFECTIVENESS_CHECK") {
      throw new Error("Wirksamkeitsprüfung nur im Status Wirksamkeitsprüfung möglich");
    }
    // QA-3: trim note and guard empty
    const effectivenessNote = args.effectivenessNote.trim();
    if (!effectivenessNote) throw new Error("Begründung ist erforderlich");
    await ctx.db.patch(args.id, {
      effectivenessResult: args.effectivenessResult,
      effectivenessNote,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "capas", entityId: args.id,
      changes: { effectivenessResult: args.effectivenessResult },
    });
  },
});

/** Maßnahme hinzufügen */
export const addMeasure = mutation({
  args: {
    capaId: v.id("capas"),
    description: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const capa = await ctx.db.get(args.capaId);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.status === "CLOSED" || capa.status === "CANCELLED") {
      throw new Error("Abgeschlossene CAPAs können keine neuen Maßnahmen erhalten");
    }
    // QA-4: trim description and guard empty
    const description = args.description.trim();
    if (!description) throw new Error("Beschreibung ist erforderlich");
    const now = Date.now();
    const id = await ctx.db.insert("capaMeasures", {
      capaId: args.capaId,
      description,
      assigneeId: args.assigneeId,
      dueAt: args.dueAt,
      status: "OPEN",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capaMeasures", entityId: id,
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_MEASURE_ASSIGNED",
        title: `Maßnahme zugewiesen (${capa.capaNumber})`,
        message: description.slice(0, 200),
        resourceType: "capa",
        resourceId: args.capaId as string,
      });
    }
    return id;
  },
});

/** Maßnahme erledigen */
export const completeMeasure = mutation({
  args: { id: v.id("capaMeasures") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const measure = await ctx.db.get(args.id);
    if (!measure) throw new Error("Maßnahme nicht gefunden");
    // QA-5: idempotency guard
    if (measure.status === "DONE") return;
    // QA-5: parent CAPA guard
    const capa = await ctx.db.get(measure.capaId);
    if (capa && (capa.status === "CLOSED" || capa.status === "CANCELLED")) {
      throw new Error("Abgeschlossene CAPAs können nicht geändert werden");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "DONE", doneAt: now, updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "capaMeasures", entityId: args.id,
      previousStatus: measure.status, newStatus: "DONE",
    });
  },
});

/** CAPA archivieren (Soft-Delete) */
export const archive = mutation({
  args: { id: v.id("capas") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    await archiveRecord(ctx, "capas", args.id, user._id);
  },
});
