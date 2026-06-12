import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { Doc, Id } from "./_generated/dataModel";
import { MANDATORY_LEVELS, RequirementLevel, StaffingStatus } from "../lib/types/enums";

// ============================================================
// Schema-lokale Unions (gespiegelt aus convex/schema.ts)
// ============================================================
const requirementLevelArg = v.union(
  v.literal("REQUIRED_DEEP"),
  v.literal("REQUIRED_BASIC"),
  v.literal("RECOMMENDED"),
  v.literal("ON_DEMAND"),
);
const staffingStatusArg = v.union(
  v.literal("FILLED"),
  v.literal("INTERNAL_DEVELOP"),
  v.literal("EXTERNAL_HIRE"),
  v.literal("IN_CLARIFICATION"),
);

// ============================================================
// Helper: Ampel-Berechnung je Funktion
// 100 % → GREEN / ≥70 % → YELLOW / <70 % → RED / null wenn kein Soll
// ============================================================
function computeAmpel(
  total: number,
  fulfilled: number,
): { percent: number | null; ampel: "GREEN" | "YELLOW" | "RED" | null } {
  if (total === 0) return { percent: null, ampel: null };
  const percent = Math.round((fulfilled / total) * 100);
  const ampel: "GREEN" | "YELLOW" | "RED" =
    percent >= 100 ? "GREEN" : percent >= 70 ? "YELLOW" : "RED";
  return { percent, ampel };
}

// ============================================================
// 1. overview — Soll-Ist je Funktion (trainingMatrix:list)
// ============================================================

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const now = Date.now();

    // Alle nicht-archivierten Funktionen nach sortOrder
    const functions = await ctx.db
      .query("jobFunctions")
      .withIndex("by_sortOrder")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Alle nicht-archivierten Requirements + Fulfillments (vollständige collects — Matrix ist klein)
    const allRequirements = await ctx.db
      .query("trainingRequirements")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const allFulfillments = await ctx.db
      .query("trainingFulfillments")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return functions.map((fn) => {
      // Pflicht-Themen für diese Funktion (level in MANDATORY_LEVELS)
      const mandatoryReqs = allRequirements.filter(
        (r) =>
          r.functionId === fn._id &&
          (MANDATORY_LEVELS as readonly string[]).includes(r.level),
      );
      const mandatoryTotal = mandatoryReqs.length;

      // Fulfillments für diese Funktion
      const fnFulfillments = allFulfillments.filter(
        (f) => f.functionId === fn._id,
      );

      // Erfüllt = fulfilled===true UND (validUntil undefined ODER validUntil >= now)
      // Abgelaufene Nachweise (validUntil < now) zählen NICHT als erfüllt
      const mandatoryFulfilled = mandatoryReqs.filter((req) => {
        const ff = fnFulfillments.find((f) => f.topicId === req.topicId);
        if (!ff || !ff.fulfilled) return false;
        if (ff.validUntil !== undefined && ff.validUntil < now) return false;
        return true;
      }).length;

      const { percent, ampel } = computeAmpel(mandatoryTotal, mandatoryFulfilled);

      return {
        _id: fn._id,
        name: fn.name,
        holder: fn.holder,
        staffingStatus: fn.staffingStatus,
        sortOrder: fn.sortOrder,
        userId: fn.userId,
        notes: fn.notes,
        successionPath: fn.successionPath,
        successionState: fn.successionState,
        successionNextSteps: fn.successionNextSteps,
        successionResponsible: fn.successionResponsible,
        successionDueText: fn.successionDueText,
        successionStatus: fn.successionStatus,
        mandatoryTotal,
        mandatoryFulfilled,
        percent,
        ampel,
      };
    });
  },
});

// ============================================================
// 2. matrix — Rohdaten für Grid-Ansicht (trainingMatrix:list)
// Requirements als Array {topicId, functionId, level} — UI baut Lookup
// ============================================================

export const matrix = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "trainingMatrix:list");

    // Themen: by_cluster, sortiert cluster+sortOrder
    const rawTopics = await ctx.db
      .query("trainingTopics")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    rawTopics.sort((a, b) =>
      a.cluster !== b.cluster
        ? a.cluster.localeCompare(b.cluster)
        : a.sortOrder - b.sortOrder,
    );

    // Funktionen: sortOrder
    const functions = await ctx.db
      .query("jobFunctions")
      .withIndex("by_sortOrder")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Requirements (nicht archiviert)
    const requirements = await ctx.db
      .query("trainingRequirements")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return {
      topics: rawTopics.map((t) => ({
        _id: t._id,
        cluster: t.cluster,
        title: t.title,
        frequency: t.frequency,
        provider: t.provider,
        sortOrder: t.sortOrder,
      })),
      functions: functions.map((f) => ({
        _id: f._id,
        name: f.name,
        holder: f.holder,
        sortOrder: f.sortOrder,
      })),
      requirements: requirements.map((r) => ({
        topicId: r.topicId,
        functionId: r.functionId,
        level: r.level,
      })),
    };
  },
});

// ============================================================
// 3. functionDetail — Funktion + Themen mit Fulfillment-Stand (trainingMatrix:list)
// ============================================================

export const functionDetail = query({
  args: { functionId: v.id("jobFunctions") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const now = Date.now();

    const fn = await ctx.db.get(args.functionId);
    if (!fn || fn.isArchived) throw new Error("Funktion nicht gefunden");

    // Requirements dieser Funktion
    const reqs = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_function", (q) => q.eq("functionId", args.functionId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Fulfillments dieser Funktion
    const fulfillments = await ctx.db
      .query("trainingFulfillments")
      .withIndex("by_function", (q) => q.eq("functionId", args.functionId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Join: Requirement + Thema + Fulfillment-Stand
    const items = await Promise.all(
      reqs.map(async (req) => {
        const topic = await ctx.db.get(req.topicId);
        const ff = fulfillments.find((f) => f.topicId === req.topicId);
        // expired: validUntil gesetzt und überschritten
        const expired =
          ff?.validUntil !== undefined && ff.validUntil < now;
        return {
          topicId: req.topicId,
          level: req.level,
          cluster: topic?.cluster ?? "",
          topicTitle: topic?.title ?? "",
          topicSortOrder: topic?.sortOrder ?? 0,
          frequency: topic?.frequency,
          provider: topic?.provider,
          fulfilled: ff?.fulfilled ?? false,
          validUntil: ff?.validUntil,
          note: ff?.note,
          expired,
        };
      }),
    );

    // Sortiert: cluster, dann topicSortOrder
    items.sort((a, b) =>
      a.cluster !== b.cluster
        ? a.cluster.localeCompare(b.cluster)
        : a.topicSortOrder - b.topicSortOrder,
    );

    return {
      _id: fn._id,
      name: fn.name,
      holder: fn.holder,
      staffingStatus: fn.staffingStatus,
      sortOrder: fn.sortOrder,
      userId: fn.userId,
      notes: fn.notes,
      successionPath: fn.successionPath,
      successionState: fn.successionState,
      successionNextSteps: fn.successionNextSteps,
      successionResponsible: fn.successionResponsible,
      successionDueText: fn.successionDueText,
      successionStatus: fn.successionStatus,
      items,
    };
  },
});

// ============================================================
// 4. setFulfillment — Upsert Ist-Stand (trainingMatrix:manage)
// ============================================================

export const setFulfillment = mutation({
  args: {
    functionId: v.id("jobFunctions"),
    topicId: v.id("trainingTopics"),
    fulfilled: v.boolean(),
    validUntil: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    // Guard: Funktion und Thema müssen existieren und nicht archiviert sein
    const fn = await ctx.db.get(args.functionId);
    if (!fn || fn.isArchived) throw new Error("Funktion nicht gefunden oder archiviert");

    const topic = await ctx.db.get(args.topicId);
    if (!topic || topic.isArchived) throw new Error("Thema nicht gefunden oder archiviert");

    // Guard: Requirement für das Paar muss existieren
    const reqCheck = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_function", (q) => q.eq("functionId", args.functionId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const req = reqCheck.find((r) => r.topicId === args.topicId);
    if (!req) {
      throw new Error("Thema ist für diese Funktion nicht relevant");
    }

    const now = Date.now();

    // Upsert: bestehenden Eintrag via by_function + JS-Filter topicId suchen
    const existing = await ctx.db
      .query("trainingFulfillments")
      .withIndex("by_function", (q) => q.eq("functionId", args.functionId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const existingFF = existing.find((f) => f.topicId === args.topicId);

    if (existingFF) {
      await ctx.db.patch(existingFF._id, {
        fulfilled: args.fulfilled,
        validUntil: args.validUntil,
        note: args.note?.trim() || undefined,
        updatedAt: now,
        updatedBy: user._id,
      });
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "UPDATE",
        entityType: "trainingFulfillments",
        entityId: existingFF._id,
        changes: {
          topicId: args.topicId,
          fulfilled: args.fulfilled,
          validUntil: args.validUntil,
        },
      });
    } else {
      const id = await ctx.db.insert("trainingFulfillments", {
        functionId: args.functionId,
        topicId: args.topicId,
        fulfilled: args.fulfilled,
        validUntil: args.validUntil,
        note: args.note?.trim() || undefined,
        isArchived: false,
        createdAt: now,
        createdBy: user._id,
        updatedAt: now,
        updatedBy: user._id,
      });
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "CREATE",
        entityType: "trainingFulfillments",
        entityId: id,
        changes: {
          topicId: args.topicId,
          fulfilled: args.fulfilled,
          validUntil: args.validUntil,
        },
      });
    }
  },
});

// ============================================================
// 5. updateFunction — per-field Patch (trainingMatrix:manage)
// ============================================================

export const updateFunction = mutation({
  args: {
    id: v.id("jobFunctions"),
    name: v.optional(v.string()),
    holder: v.optional(v.string()),
    staffingStatus: v.optional(staffingStatusArg),
    userId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    successionPath: v.optional(v.string()),
    successionState: v.optional(v.string()),
    successionNextSteps: v.optional(v.string()),
    successionResponsible: v.optional(v.string()),
    successionDueText: v.optional(v.string()),
    successionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    const fn = await ctx.db.get(args.id);
    if (!fn || fn.isArchived) throw new Error("Funktion nicht gefunden oder archiviert");

    const patch: Partial<Doc<"jobFunctions">> = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name ist erforderlich");
      patch.name = name;
    }

    // Clearable text fields (trim || undefined)
    if (args.holder !== undefined) patch.holder = args.holder.trim() || undefined;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.successionPath !== undefined) patch.successionPath = args.successionPath.trim() || undefined;
    if (args.successionState !== undefined) patch.successionState = args.successionState.trim() || undefined;
    if (args.successionNextSteps !== undefined) patch.successionNextSteps = args.successionNextSteps.trim() || undefined;
    if (args.successionResponsible !== undefined) patch.successionResponsible = args.successionResponsible.trim() || undefined;
    if (args.successionDueText !== undefined) patch.successionDueText = args.successionDueText.trim() || undefined;
    if (args.successionStatus !== undefined) patch.successionStatus = args.successionStatus.trim() || undefined;

    // Direct fields
    if (args.staffingStatus !== undefined) patch.staffingStatus = args.staffingStatus;
    if (args.userId !== undefined) patch.userId = args.userId;

    await ctx.db.patch(args.id, { ...patch, updatedAt: Date.now(), updatedBy: user._id });

    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "jobFunctions",
      entityId: args.id,
      changes,
    });
  },
});

// ============================================================
// 6. createFunction — neue Funktion anlegen (trainingMatrix:manage)
// ============================================================

export const createFunction = mutation({
  args: {
    name: v.string(),
    holder: v.optional(v.string()),
    staffingStatus: staffingStatusArg,
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    const name = args.name.trim();
    if (!name) throw new Error("Name ist erforderlich");

    // sortOrder = given or max+1
    let sortOrder = args.sortOrder;
    if (sortOrder === undefined) {
      const existing = await ctx.db
        .query("jobFunctions")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      sortOrder =
        existing.length === 0 ? 1 : Math.max(...existing.map((f) => f.sortOrder)) + 1;
    }

    const now = Date.now();
    const id = await ctx.db.insert("jobFunctions", {
      name,
      holder: args.holder?.trim() || undefined,
      staffingStatus: args.staffingStatus,
      sortOrder,
      isArchived: false,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "jobFunctions",
      entityId: id,
      metadata: { name, sortOrder },
    });

    return id;
  },
});

// ============================================================
// 7. createTopic — neues Schulungsthema anlegen (trainingMatrix:manage)
// ============================================================

export const createTopic = mutation({
  args: {
    cluster: v.string(),
    title: v.string(),
    frequency: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    // Cluster A–G validieren (gespiegelt aus TOPIC_CLUSTERS in lib/types/enums.ts)
    if (!["A", "B", "C", "D", "E", "F", "G"].includes(args.cluster)) {
      throw new Error("Ungültiger Cluster — erlaubt: A, B, C, D, E, F, G");
    }

    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");

    // sortOrder = max+1 innerhalb des Clusters
    const existing = await ctx.db
      .query("trainingTopics")
      .withIndex("by_cluster", (q) => q.eq("cluster", args.cluster))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const sortOrder =
      existing.length === 0 ? 1 : Math.max(...existing.map((t) => t.sortOrder)) + 1;

    const now = Date.now();
    const id = await ctx.db.insert("trainingTopics", {
      cluster: args.cluster,
      title,
      frequency: args.frequency?.trim() || undefined,
      provider: args.provider?.trim() || undefined,
      sortOrder,
      isArchived: false,
      createdAt: now,
      createdBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "trainingTopics",
      entityId: id,
      metadata: { cluster: args.cluster, title, sortOrder },
    });

    return id;
  },
});

// ============================================================
// 7b. updateTopic — per-field Patch (trainingMatrix:manage)
// ============================================================

export const updateTopic = mutation({
  args: {
    id: v.id("trainingTopics"),
    cluster: v.optional(v.string()),
    title: v.optional(v.string()),
    frequency: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    const topic = await ctx.db.get(args.id);
    if (!topic || topic.isArchived) throw new Error("Thema nicht gefunden oder archiviert");

    const patch: Partial<Doc<"trainingTopics">> = {};

    if (args.cluster !== undefined) {
      // Cluster A–G validieren (gespiegelt aus createTopic)
      if (!["A", "B", "C", "D", "E", "F", "G"].includes(args.cluster)) {
        throw new Error("Ungültiger Cluster — erlaubt: A, B, C, D, E, F, G");
      }
      patch.cluster = args.cluster;
    }
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Titel ist erforderlich");
      patch.title = title;
    }
    // Clearable text fields (trim || undefined)
    if (args.frequency !== undefined) patch.frequency = args.frequency.trim() || undefined;
    if (args.provider !== undefined) patch.provider = args.provider.trim() || undefined;

    await ctx.db.patch(args.id, { ...patch, updatedAt: Date.now(), updatedBy: user._id });

    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "trainingTopics",
      entityId: args.id,
      changes,
    });
  },
});

// ============================================================
// 8. setRequirement — Upsert/Hard-Delete Zuordnung (trainingMatrix:manage)
// Hard-Delete: Stammdaten-Zuordnung — kein soft-delete, Audit-Marker PERMANENT_DELETE
// ============================================================

export const setRequirement = mutation({
  args: {
    functionId: v.id("jobFunctions"),
    topicId: v.id("trainingTopics"),
    level: v.optional(requirementLevelArg), // required wenn remove !== true
    remove: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    // Guard: Funktion + Thema müssen existieren
    const fn = await ctx.db.get(args.functionId);
    if (!fn || fn.isArchived) throw new Error("Funktion nicht gefunden oder archiviert");

    const topic = await ctx.db.get(args.topicId);
    if (!topic || topic.isArchived) throw new Error("Thema nicht gefunden oder archiviert");

    // Bestehendes Requirement suchen
    const existing = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_function", (q) => q.eq("functionId", args.functionId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const existingReq = existing.find((r) => r.topicId === args.topicId);

    if (args.remove === true) {
      // Hard-Delete: Stammdaten-Zuordnung — kein Soft-Delete, Audit-Marker PERMANENT_DELETE
      if (existingReq) {
        await ctx.db.delete(existingReq._id);
        await logAuditEvent(ctx, {
          userId: user._id,
          action: "PERMANENT_DELETE",
          entityType: "trainingRequirements",
          entityId: existingReq._id,
          metadata: {
            functionId: args.functionId,
            topicId: args.topicId,
            level: existingReq.level,
            functionName: fn.name,
            topicTitle: topic.title,
          },
        });
      }
      // Kein Fehler wenn nicht existent — idempotent
      return;
    }

    // Upsert: level muss angegeben sein
    if (!args.level) throw new Error("Einstufung (level) ist erforderlich");

    const now = Date.now();
    if (existingReq) {
      await ctx.db.patch(existingReq._id, {
        level: args.level,
        updatedAt: now,
        updatedBy: user._id,
      });
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "UPDATE",
        entityType: "trainingRequirements",
        entityId: existingReq._id,
        changes: { level: args.level },
      });
    } else {
      const id = await ctx.db.insert("trainingRequirements", {
        functionId: args.functionId,
        topicId: args.topicId,
        level: args.level,
        isArchived: false,
        createdAt: now,
        createdBy: user._id,
        updatedAt: now,
        updatedBy: user._id,
      });
      await logAuditEvent(ctx, {
        userId: user._id,
        action: "CREATE",
        entityType: "trainingRequirements",
        entityId: id,
        metadata: { functionId: args.functionId, topicId: args.topicId, level: args.level },
      });
    }
  },
});

// ============================================================
// 9. planDraft — unerfüllte Pflicht-Themen je Funktion (trainingMatrix:list)
// Query, kein eigener Datenbestand (YAGNI). Jahr-Argument entfällt — aktueller Stand.
// ============================================================

export const planDraft = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const now = Date.now();

    const functions = await ctx.db
      .query("jobFunctions")
      .withIndex("by_sortOrder")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const allRequirements = await ctx.db
      .query("trainingRequirements")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const allFulfillments = await ctx.db
      .query("trainingFulfillments")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const rows: Array<{
      functionId: Id<"jobFunctions">;
      functionName: string;
      holder: string | undefined;
      topicId: Id<"trainingTopics">;
      topicTitle: string;
      cluster: string;
      level: RequirementLevel;
      frequency: string | undefined;
      provider: string | undefined;
      functionSortOrder: number;
      clusterKey: string;
    }> = [];

    for (const fn of functions) {
      const mandatoryReqs = allRequirements.filter(
        (r) =>
          r.functionId === fn._id &&
          (MANDATORY_LEVELS as readonly string[]).includes(r.level),
      );
      const fnFulfillments = allFulfillments.filter((f) => f.functionId === fn._id);

      for (const req of mandatoryReqs) {
        // Unerfüllt ODER abgelaufen
        const ff = fnFulfillments.find((f) => f.topicId === req.topicId);
        const isUnfulfilled =
          !ff || !ff.fulfilled || (ff.validUntil !== undefined && ff.validUntil < now);

        if (!isUnfulfilled) continue;

        const topic = await ctx.db.get(req.topicId);
        if (!topic || topic.isArchived) continue;

        rows.push({
          functionId: fn._id,
          functionName: fn.name,
          holder: fn.holder,
          topicId: req.topicId,
          topicTitle: topic.title,
          cluster: topic.cluster,
          level: req.level as RequirementLevel,
          frequency: topic.frequency,
          provider: topic.provider,
          functionSortOrder: fn.sortOrder,
          clusterKey: topic.cluster,
        });
      }
    }

    // Sortiert: cluster dann functionSortOrder
    rows.sort((a, b) =>
      a.clusterKey !== b.clusterKey
        ? a.clusterKey.localeCompare(b.clusterKey)
        : a.functionSortOrder - b.functionSortOrder,
    );

    // clusterKey + functionSortOrder aus Output entfernen (interne Sortierfelder)
    return rows.map(({ clusterKey: _c, functionSortOrder: _fs, ...rest }) => rest);
  },
});

// ============================================================
// 12. setTopicArchived / setFunctionArchived — Archivieren/Wiederherstellen
// (trainingMatrix:manage) — Soft-Delete, Historie bleibt nachweisbar
// ============================================================

export const setTopicArchived = mutation({
  args: { id: v.id("trainingTopics"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Thema nicht gefunden");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: args.archived,
      archivedAt: args.archived ? now : undefined,
      archivedBy: args.archived ? user._id : undefined,
      updatedAt: now,
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: args.archived ? "ARCHIVE" : "RESTORE",
      entityType: "trainingTopics",
      entityId: args.id,
      metadata: { title: topic.title, cluster: topic.cluster },
    });
  },
});

export const setFunctionArchived = mutation({
  args: { id: v.id("jobFunctions"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const fn = await ctx.db.get(args.id);
    if (!fn) throw new Error("Funktion nicht gefunden");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: args.archived,
      archivedAt: args.archived ? now : undefined,
      archivedBy: args.archived ? user._id : undefined,
      updatedAt: now,
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: args.archived ? "ARCHIVE" : "RESTORE",
      entityType: "jobFunctions",
      entityId: args.id,
      metadata: { name: fn.name },
    });
  },
});

// ============================================================
// 13. deleteTopicPermanent / deleteFunctionPermanent — Hard-Delete
// NUR für unverknüpfte Einträge (Tippfehler-Anlagen). Guard zählt
// auch archivierte Verknüpfungen — QM-Historie darf nie brechen.
// ============================================================

export const deleteTopicPermanent = mutation({
  args: { id: v.id("trainingTopics") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Thema nicht gefunden");

    const reqs = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_topic", (q) => q.eq("topicId", args.id))
      .collect();
    if (reqs.length > 0) {
      throw new Error("Thema hat Matrix-Zuordnungen — bitte archivieren statt löschen");
    }
    const fulfillments = (await ctx.db.query("trainingFulfillments").collect()).filter(
      (f) => f.topicId === args.id,
    );
    if (fulfillments.length > 0) {
      throw new Error("Thema hat Erfüllungseinträge — bitte archivieren statt löschen");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "trainingTopics",
      entityId: args.id,
      metadata: { title: topic.title, cluster: topic.cluster },
    });
  },
});

export const deleteFunctionPermanent = mutation({
  args: { id: v.id("jobFunctions") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const fn = await ctx.db.get(args.id);
    if (!fn) throw new Error("Funktion nicht gefunden");

    const reqs = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_function", (q) => q.eq("functionId", args.id))
      .collect();
    if (reqs.length > 0) {
      throw new Error("Funktion hat Matrix-Zuordnungen — bitte archivieren statt löschen");
    }
    const fulfillments = await ctx.db
      .query("trainingFulfillments")
      .withIndex("by_function", (q) => q.eq("functionId", args.id))
      .collect();
    if (fulfillments.length > 0) {
      throw new Error("Funktion hat Erfüllungseinträge — bitte archivieren statt löschen");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "jobFunctions",
      entityId: args.id,
      metadata: { name: fn.name },
    });
  },
});

// ============================================================
// 14. topicsAdminList / functionsAdminList — Listenansichten
// (trainingMatrix:list) — linkCount steuert den Löschen-Button in der UI
// ============================================================

export const topicsAdminList = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const topics = await ctx.db.query("trainingTopics").collect();
    const requirements = await ctx.db.query("trainingRequirements").collect();
    const fulfillments = await ctx.db.query("trainingFulfillments").collect();

    return topics
      .filter((t) => (args.includeArchived ? true : !t.isArchived))
      .sort((a, b) =>
        a.cluster !== b.cluster
          ? a.cluster.localeCompare(b.cluster)
          : a.sortOrder - b.sortOrder,
      )
      .map((t) => ({
        _id: t._id,
        cluster: t.cluster,
        title: t.title,
        frequency: t.frequency,
        provider: t.provider,
        sortOrder: t.sortOrder,
        isArchived: t.isArchived,
        linkCount:
          requirements.filter((r) => r.topicId === t._id).length +
          fulfillments.filter((f) => f.topicId === t._id).length,
      }));
  },
});

export const functionsAdminList = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const functions = await ctx.db.query("jobFunctions").collect();
    const requirements = await ctx.db.query("trainingRequirements").collect();
    const fulfillments = await ctx.db.query("trainingFulfillments").collect();

    return functions
      .filter((f) => (args.includeArchived ? true : !f.isArchived))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        _id: f._id,
        name: f.name,
        holder: f.holder,
        staffingStatus: f.staffingStatus,
        sortOrder: f.sortOrder,
        isArchived: f.isArchived,
        linkCount:
          requirements.filter((r) => r.functionId === f._id).length +
          fulfillments.filter((ff) => ff.functionId === f._id).length,
      }));
  },
});

// ============================================================
// 10. seedFromImport — idempotenter Seed (internalMutation)
// Indizes referenzieren die Arrays aus der Payload (Seed kennt keine Ids).
// Idempotenz: skip wenn bereits jobFunctions (nicht archiviert) existieren.
// ============================================================

export const seedFromImport = internalMutation({
  args: {
    functions: v.array(v.object({
      name: v.string(),
      holder: v.optional(v.string()),
      staffingStatus: staffingStatusArg,
      sortOrder: v.number(),
      successionPath: v.optional(v.string()),
      successionState: v.optional(v.string()),
      successionNextSteps: v.optional(v.string()),
      successionResponsible: v.optional(v.string()),
      successionDueText: v.optional(v.string()),
      successionStatus: v.optional(v.string()),
    })),
    topics: v.array(v.object({
      cluster: v.string(),
      title: v.string(),
      frequency: v.optional(v.string()),
      provider: v.optional(v.string()),
      sortOrder: v.number(),
    })),
    requirements: v.array(v.object({
      functionIndex: v.number(),
      topicIndex: v.number(),
      level: requirementLevelArg,
    })),
  },
  handler: async (ctx, args) => {
    // Idempotenz: wenn bereits nicht-archivierte jobFunctions existieren → skip
    const existing = await ctx.db
      .query("jobFunctions")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (existing.length > 0) {
      return {
        skipped: true,
        reason: "Matrix bereits geseedet — seedReset zuerst",
      };
    }

    const now = Date.now();

    // Funktionen einfügen, IDs merken
    const functionIds: Array<Id<"jobFunctions">> = [];
    for (const fn of args.functions) {
      const id = await ctx.db.insert("jobFunctions", {
        name: fn.name,
        holder: fn.holder || undefined,
        staffingStatus: fn.staffingStatus,
        sortOrder: fn.sortOrder,
        successionPath: fn.successionPath || undefined,
        successionState: fn.successionState || undefined,
        successionNextSteps: fn.successionNextSteps || undefined,
        successionResponsible: fn.successionResponsible || undefined,
        successionDueText: fn.successionDueText || undefined,
        successionStatus: fn.successionStatus || undefined,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      functionIds.push(id);
    }

    // Themen einfügen, IDs merken
    const topicIds: Array<Id<"trainingTopics">> = [];
    for (const t of args.topics) {
      const id = await ctx.db.insert("trainingTopics", {
        cluster: t.cluster,
        title: t.title,
        frequency: t.frequency || undefined,
        provider: t.provider || undefined,
        sortOrder: t.sortOrder,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      topicIds.push(id);
    }

    // Requirements einfügen — Index-Validierung
    let reqCount = 0;
    for (const req of args.requirements) {
      if (req.functionIndex < 0 || req.functionIndex >= functionIds.length) {
        throw new Error(
          `Ungültiger functionIndex ${req.functionIndex} — erlaubt 0–${functionIds.length - 1}`,
        );
      }
      if (req.topicIndex < 0 || req.topicIndex >= topicIds.length) {
        throw new Error(
          `Ungültiger topicIndex ${req.topicIndex} — erlaubt 0–${topicIds.length - 1}`,
        );
      }
      await ctx.db.insert("trainingRequirements", {
        functionId: functionIds[req.functionIndex],
        topicId: topicIds[req.topicIndex],
        level: req.level,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      reqCount++;
    }

    // Audit-Marker
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "trainingMatrix",
      entityId: "seed",
      metadata: {
        seed: true,
        functions: functionIds.length,
        topics: topicIds.length,
        requirements: reqCount,
      },
    });

    return {
      skipped: false,
      functions: functionIds.length,
      topics: topicIds.length,
      requirements: reqCount,
    };
  },
});

// ============================================================
// 11. seedReset — Hard-Delete aller Matrix-Daten (internalMutation)
// Matrix ist ein Datensatz — vollständiger Wipe (jobFunctions + trainingTopics +
// trainingRequirements + trainingFulfillments). Nur für Seed-Korrekturen.
// ============================================================

export const seedReset = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Hard-Delete: vollständiger Wipe — Matrix ist ein Datensatz
    const functions = await ctx.db.query("jobFunctions").collect();
    const topics = await ctx.db.query("trainingTopics").collect();
    const requirements = await ctx.db.query("trainingRequirements").collect();
    const fulfillments = await ctx.db.query("trainingFulfillments").collect();

    for (const r of fulfillments) await ctx.db.delete(r._id);
    for (const r of requirements) await ctx.db.delete(r._id);
    for (const t of topics) await ctx.db.delete(t._id);
    for (const f of functions) await ctx.db.delete(f._id);

    if (
      functions.length > 0 ||
      topics.length > 0 ||
      requirements.length > 0 ||
      fulfillments.length > 0
    ) {
      await logAuditEvent(ctx, {
        action: "PERMANENT_DELETE",
        entityType: "trainingMatrix",
        entityId: "seed-reset",
        metadata: {
          seedReset: true,
          functions: functions.length,
          topics: topics.length,
          requirements: requirements.length,
          fulfillments: fulfillments.length,
        },
      });
    }

    return {
      functions: functions.length,
      topics: topics.length,
      requirements: requirements.length,
      fulfillments: fulfillments.length,
    };
  },
});
