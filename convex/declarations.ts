import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";

/** List declarations (with optional filters) */
export const list = query({
  args: {
    productId: v.optional(v.id("products")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "declarations:list");
    let results;

    if (args.productId) {
      results = await ctx.db
        .query("declarationsOfConformity")
        .withIndex("by_product", (q) => q.eq("productId", args.productId!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      results = await ctx.db
        .query("declarationsOfConformity")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }

    if (args.status) {
      results = results.filter((d) => d.status === args.status);
    }
    return results;
  },
});

/** Get declaration by ID */
export const getById = query({
  args: { id: v.id("declarationsOfConformity") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "declarations:list");
    return await ctx.db.get(args.id);
  },
});

/** Upload a new declaration of conformity */
export const create = mutation({
  args: {
    productId: v.id("products"),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    version: v.string(),
    issuedAt: v.number(),
    validFrom: v.number(),
    validUntil: v.number(),
    notifiedBody: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:upload");

    if (!args.fileId && !args.externalUrl) {
      throw new Error("Entweder eine Datei oder eine externe URL muss angegeben werden");
    }

    const now = Date.now();

    const id = await ctx.db.insert("declarationsOfConformity", {
      ...args,
      externalUrl: args.externalUrl,
      urlStatus: args.externalUrl ? "UNCHECKED" : undefined,
      status: "IN_REVIEW",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "FILE_UPLOAD",
      entityType: "declarationsOfConformity",
      entityId: id,
      metadata: {
        productId: args.productId,
        fileName: args.fileName,
        version: args.version,
      },
    });

    return id;
  },
});

/** Review and change status of a declaration */
export const review = mutation({
  args: {
    id: v.id("declarationsOfConformity"),
    status: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:review");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    // Require comment for REJECTED and WITHDRAWN transitions
    if (
      (args.status === "REJECTED" || args.status === "WITHDRAWN") &&
      !args.comment?.trim()
    ) {
      throw new Error("Ein Kommentar ist für diesen Statuswechsel erforderlich");
    }

    validateTransition("docStatus", doc.status, args.status);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      reviewedById: user._id,
      reviewedAt: now,
      reviewComment: args.comment?.trim() || undefined,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "declarationsOfConformity",
      entityId: args.id,
      previousStatus: doc.status,
      newStatus: args.status,
      metadata: args.comment ? { comment: args.comment } : undefined,
    });
  },
});

/** Update declaration fields */
export const update = mutation({
  args: {
    id: v.id("declarationsOfConformity"),
    version: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    notifiedBody: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:upload");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    // Don't allow editing terminal states
    if (doc.status === "WITHDRAWN" || doc.status === "SUPERSEDED") {
      throw new Error("Konformitätserklärungen im Status 'Zurückgezogen' oder 'Ersetzt' können nicht bearbeitet werden");
    }

    const { id, ...updates } = args;
    const now = Date.now();

    // Build patch — only include provided fields
    const patch: Record<string, any> = {
      updatedAt: now,
      updatedBy: user._id,
    };

    if (updates.version !== undefined) patch.version = updates.version;
    if (updates.issuedAt !== undefined) patch.issuedAt = updates.issuedAt;
    if (updates.validFrom !== undefined) patch.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) patch.validUntil = updates.validUntil;
    if (updates.notifiedBody !== undefined) patch.notifiedBody = updates.notifiedBody || undefined;
    if (updates.certificateNumber !== undefined) patch.certificateNumber = updates.certificateNumber || undefined;
    if (updates.externalUrl !== undefined) {
      patch.externalUrl = updates.externalUrl || undefined;
      patch.urlStatus = updates.externalUrl ? "UNCHECKED" : undefined;
    }

    await ctx.db.patch(id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "declarationsOfConformity",
      entityId: id,
      metadata: { updatedFields: Object.keys(updates).filter((k) => (updates as any)[k] !== undefined) },
    });
  },
});

/** Soft-delete a declaration */
export const archive = mutation({
  args: { id: v.id("declarationsOfConformity") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:upload");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      archivedBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "ARCHIVE",
      entityType: "declarationsOfConformity",
      entityId: args.id,
    });
  },
});

/** Permanently delete a declaration (admin only) */
export const permanentDelete = mutation({
  args: { id: v.id("declarationsOfConformity") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:delete");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    // Delete associated file from storage
    if (doc.fileId) {
      await ctx.storage.delete(doc.fileId);
    }

    await ctx.db.delete(args.id);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "declarationsOfConformity",
      entityId: args.id,
      metadata: {
        productId: doc.productId,
        version: doc.version,
      },
    });
  },
});

/** Generate a file upload URL (for Convex file storage) */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requirePermission(ctx, "declarations:upload");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Get file download URL */
export const getFileUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
  },
});

/** Internal: Check DoC expirations (called by cron) */
export const checkExpirations = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    const allDocs = await ctx.db
      .query("declarationsOfConformity")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    for (const doc of allDocs) {
      // VALID → EXPIRING (within 90 days of expiry)
      if (doc.status === "VALID" && doc.validUntil - now <= ninetyDaysMs) {
        await ctx.db.patch(doc._id, {
          status: "EXPIRING" as any,
          updatedAt: now,
        });

        // Create warning task for QMB
        const qmb = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "qmb"))
          .filter((q) => q.eq(q.field("isArchived"), false))
          .first();

        if (qmb) {
          // Get product info for task description
          const product = await ctx.db.get(doc.productId);
          await ctx.db.insert("tasks", {
            type: "DOC_EXPIRY_WARNING" as any,
            title: `DoC läuft ab: ${product?.name || "Unbekanntes Produkt"}`,
            description: `Die Konformitätserklärung (Version ${doc.version}) läuft bald ab. Bitte erneuern.`,
            assigneeId: qmb._id,
            dueDate: doc.validUntil,
            status: "OPEN" as any,
            priority: "HIGH" as any,
            resourceType: "declarationsOfConformity",
            resourceId: doc._id as string,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // EXPIRING → EXPIRED (past validUntil)
      if (doc.status === "EXPIRING" && doc.validUntil <= now) {
        await ctx.db.patch(doc._id, {
          status: "EXPIRED" as any,
          updatedAt: now,
        });
      }
    }
  },
});
