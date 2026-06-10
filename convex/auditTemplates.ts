import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

/** Alle Vorlagen (neueste zuerst) */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audits:list");
    const templates = await ctx.db
      .query("auditChecklistTemplates")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return templates.sort((a, b) => b.version - a.version);
  },
});

/** Aktive Vorlage inkl. Prüfpunkten */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audits:list");
    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) return null;
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", template._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return { ...template, items: items.sort((a, b) => a.sortOrder - b.sortOrder) };
  },
});

/** Vorlage nach ID inkl. Prüfpunkten */
export const getById = query({
  args: { id: v.id("auditChecklistTemplates") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const template = await ctx.db.get(args.id);
    if (!template) return null;
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return { ...template, items: items.sort((a, b) => a.sortOrder - b.sortOrder) };
  },
});

/** Neue Vorlagen-Version als Entwurf anlegen (Version = höchste + 1).
 *  copyFromActive=true übernimmt die Prüfpunkte der aktiven Vorlage. */
export const createDraft = mutation({
  args: {
    name: v.string(),
    formNumber: v.string(),
    basis: v.optional(v.string()),
    copyFromActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const now = Date.now();
    const all = await ctx.db.query("auditChecklistTemplates").collect();
    const version = all.length === 0 ? 1 : Math.max(...all.map((t) => t.version)) + 1;

    const id = await ctx.db.insert("auditChecklistTemplates", {
      name: args.name,
      formNumber: args.formNumber,
      version,
      status: "DRAFT",
      basis: args.basis,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });

    if (args.copyFromActive) {
      const active = all.find((t) => t.status === "ACTIVE" && !t.isArchived);
      if (active) {
        const items = await ctx.db
          .query("auditChecklistTemplateItems")
          .withIndex("by_template", (q) => q.eq("templateId", active._id))
          .filter((q) => q.eq(q.field("isArchived"), false))
          .collect();
        for (const item of items) {
          await ctx.db.insert("auditChecklistTemplateItems", {
            templateId: id,
            chapter: item.chapter,
            chapterTitle: item.chapterTitle,
            requirements: item.requirements,
            sortOrder: item.sortOrder,
            isArchived: false,
            createdAt: now, createdBy: user._id,
            updatedAt: now, updatedBy: user._id,
          });
        }
      }
    }

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "auditChecklistTemplates", entityId: id,
      metadata: { version },
    });
    return id;
  },
});

/** Prüfpunkt zu einer DRAFT-Vorlage hinzufügen */
export const addItem = mutation({
  args: {
    templateId: v.id("auditChecklistTemplates"),
    chapter: v.string(),
    chapterTitle: v.string(),
    requirements: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Vorlage nicht gefunden");
    if (template.status !== "DRAFT") {
      throw new Error("Nur Entwurfs-Vorlagen können bearbeitet werden");
    }
    const existing = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert("auditChecklistTemplateItems", {
      templateId: args.templateId,
      chapter: args.chapter,
      chapterTitle: args.chapterTitle,
      requirements: args.requirements,
      sortOrder: existing.length === 0 ? 1 : Math.max(...existing.map((i) => i.sortOrder)) + 1,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "auditChecklistTemplateItems", entityId: id,
    });
    return id;
  },
});

/** Prüfpunkt einer DRAFT-Vorlage ändern */
export const updateItem = mutation({
  args: {
    id: v.id("auditChecklistTemplateItems"),
    chapter: v.optional(v.string()),
    chapterTitle: v.optional(v.string()),
    requirements: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Prüfpunkt nicht gefunden");
    const template = await ctx.db.get(item.templateId);
    if (!template || template.status !== "DRAFT") {
      throw new Error("Nur Entwurfs-Vorlagen können bearbeitet werden");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "auditChecklistTemplateItems", entityId: id,
      changes,
    });
  },
});

/** Vorlage aktivieren — löst die bisher aktive Version ab */
export const activate = mutation({
  args: { id: v.id("auditChecklistTemplates") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const template = await ctx.db.get(args.id);
    if (!template) throw new Error("Vorlage nicht gefunden");
    if (template.status !== "DRAFT") throw new Error("Nur Entwürfe können aktiviert werden");
    if (template.isArchived) throw new Error("Archivierte Vorlagen können nicht aktiviert werden");

    const now = Date.now();
    const active = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    for (const prev of active) {
      await ctx.db.patch(prev._id, { status: "SUPERSEDED", updatedAt: now, updatedBy: user._id });
    }
    await ctx.db.patch(args.id, { status: "ACTIVE", updatedAt: now, updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "auditChecklistTemplates", entityId: args.id,
      previousStatus: "DRAFT", newStatus: "ACTIVE",
    });
  },
});

/** Seed-Import (npx convex run) — legt eine Version direkt als ACTIVE an.
 *  Bricht ab, wenn die Version bereits existiert (idempotent). */
export const seedFromImport = internalMutation({
  args: {
    name: v.string(),
    formNumber: v.string(),
    version: v.number(),
    basis: v.optional(v.string()),
    items: v.array(v.object({
      chapter: v.string(),
      chapterTitle: v.string(),
      requirements: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("auditChecklistTemplates").collect();
    if (existing.some((t) => t.version === args.version)) {
      return { skipped: true, reason: `Version ${args.version} existiert bereits` };
    }
    const maxVersion = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.version));
    if (args.version < maxVersion) {
      return { skipped: true, reason: `Neuere Version ${maxVersion} existiert bereits — Seed von v${args.version} würde sie ablösen` };
    }
    const now = Date.now();
    for (const prev of existing.filter((t) => t.status === "ACTIVE")) {
      await ctx.db.patch(prev._id, { status: "SUPERSEDED", updatedAt: now });
    }
    const id = await ctx.db.insert("auditChecklistTemplates", {
      name: args.name,
      formNumber: args.formNumber,
      version: args.version,
      status: "ACTIVE",
      basis: args.basis,
      isArchived: false,
      createdAt: now, updatedAt: now,
    });
    let sortOrder = 1;
    for (const item of args.items) {
      await ctx.db.insert("auditChecklistTemplateItems", {
        templateId: id,
        chapter: item.chapter,
        chapterTitle: item.chapterTitle,
        requirements: item.requirements,
        sortOrder: sortOrder++,
        isArchived: false,
        createdAt: now, updatedAt: now,
      });
    }
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "auditChecklistTemplates", entityId: id,
      metadata: { seed: true, version: args.version, items: args.items.length },
    });
    return { skipped: false, templateId: id, items: args.items.length };
  },
});
