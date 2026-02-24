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
    fileId: v.id("_storage"),
    fileName: v.string(),
    version: v.string(),
    issuedAt: v.number(),
    validFrom: v.number(),
    validUntil: v.number(),
    notifiedBody: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:upload");
    const now = Date.now();

    const id = await ctx.db.insert("declarationsOfConformity", {
      ...args,
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

/** Review and approve a declaration */
export const review = mutation({
  args: {
    id: v.id("declarationsOfConformity"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:review");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    validateTransition("docStatus", doc.status, args.status);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      reviewedById: user._id,
      reviewedAt: now,
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
