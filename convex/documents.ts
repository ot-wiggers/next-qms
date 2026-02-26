import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";
import { createNotification } from "./lib/notificationHelpers";

/** Recursively extract plaintext from a Tiptap JSON document tree */
function extractPlaintext(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  let text = "";
  if (node.text) text += node.text;
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      const childText = extractPlaintext(child);
      if (childText) {
        if (text && !text.endsWith("\n")) text += " ";
        text += childText;
      }
    }
  }
  return text;
}

/** List all document records (with optional status filter) */
export const list = query({
  args: { status: v.optional(v.string()), documentType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    let results = await ctx.db
      .query("documentRecords")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    if (args.status) {
      results = results.filter((d) => d.status === args.status);
    }
    if (args.documentType) {
      results = results.filter((d) => d.documentType === args.documentType);
    }
    return results;
  },
});

/** Get a single document record by ID */
export const getById = query({
  args: { id: v.id("documentRecords") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    return await ctx.db.get(args.id);
  },
});

/** Create a new document record */
export const create = mutation({
  args: {
    documentType: v.string(),
    documentCode: v.string(),
    version: v.string(),
    content: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    responsibleUserId: v.id("users"),
    reviewerId: v.optional(v.id("users")),
    // New rich content fields
    title: v.optional(v.string()),
    richContent: v.optional(v.any()),
    category: v.optional(v.string()),
    parentDocumentId: v.optional(v.id("documentRecords")),
    sortOrder: v.optional(v.number()),
    reviewIntervalDays: v.optional(v.number()),
    requiresReconfirmation: v.optional(v.boolean()),
    reconfirmationType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:create");
    const now = Date.now();

    // Extract plaintext from rich content for search
    const contentPlaintext = args.richContent ? extractPlaintext(args.richContent) : undefined;

    const id = await ctx.db.insert("documentRecords", {
      documentType: args.documentType as any,
      documentCode: args.documentCode,
      version: args.version,
      content: args.content,
      validFrom: args.validFrom,
      validUntil: args.validUntil,
      responsibleUserId: args.responsibleUserId,
      reviewerId: args.reviewerId,
      title: args.title,
      richContent: args.richContent,
      contentPlaintext,
      category: args.category,
      parentDocumentId: args.parentDocumentId,
      sortOrder: args.sortOrder,
      reviewIntervalDays: args.reviewIntervalDays ?? 365,
      requiresReconfirmation: args.requiresReconfirmation ?? true,
      reconfirmationType: args.reconfirmationType,
      status: "DRAFT",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "documentRecords",
      entityId: id,
      metadata: { documentCode: args.documentCode, documentType: args.documentType },
    });

    return id;
  },
});

/** Update document record fields */
export const update = mutation({
  args: {
    id: v.id("documentRecords"),
    documentType: v.optional(v.string()),
    documentCode: v.optional(v.string()),
    version: v.optional(v.string()),
    content: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    responsibleUserId: v.optional(v.id("users")),
    reviewerId: v.optional(v.id("users")),
    // New rich content fields
    title: v.optional(v.string()),
    richContent: v.optional(v.any()),
    category: v.optional(v.string()),
    parentDocumentId: v.optional(v.id("documentRecords")),
    sortOrder: v.optional(v.number()),
    reviewIntervalDays: v.optional(v.number()),
    requiresReconfirmation: v.optional(v.boolean()),
    reconfirmationType: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requirePermission(ctx, "documents:create");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Dokument nicht gefunden");

    const now = Date.now();
    const patch: Record<string, any> = { updatedAt: now, updatedBy: user._id };
    if (updates.documentType !== undefined) patch.documentType = updates.documentType;
    if (updates.documentCode !== undefined) patch.documentCode = updates.documentCode;
    if (updates.version !== undefined) patch.version = updates.version;
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.validFrom !== undefined) patch.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) patch.validUntil = updates.validUntil;
    if (updates.responsibleUserId !== undefined) patch.responsibleUserId = updates.responsibleUserId;
    if (updates.reviewerId !== undefined) patch.reviewerId = updates.reviewerId;
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.richContent !== undefined) {
      patch.richContent = updates.richContent;
      patch.contentPlaintext = extractPlaintext(updates.richContent);
    }
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.parentDocumentId !== undefined) patch.parentDocumentId = updates.parentDocumentId;
    if (updates.sortOrder !== undefined) patch.sortOrder = updates.sortOrder;
    if (updates.reviewIntervalDays !== undefined) patch.reviewIntervalDays = updates.reviewIntervalDays;
    if (updates.requiresReconfirmation !== undefined) patch.requiresReconfirmation = updates.requiresReconfirmation;
    if (updates.reconfirmationType !== undefined) patch.reconfirmationType = updates.reconfirmationType;

    await ctx.db.patch(id, patch as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "documentRecords",
      entityId: id,
      changes: updates,
    });
  },
});

/** Update document status (with state machine validation) */
export const updateStatus = mutation({
  args: {
    id: v.id("documentRecords"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Dokument nicht gefunden");

    // Determine required permission based on target status
    let requiredAction: "documents:review" | "documents:approve" | "documents:archive" = "documents:review";
    if (args.status === "APPROVED") requiredAction = "documents:approve";
    if (args.status === "ARCHIVED") requiredAction = "documents:archive";

    const user = await requirePermission(ctx, requiredAction);

    validateTransition("documentStatus", doc.status, args.status);

    const now = Date.now();
    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: now,
      updatedBy: user._id,
    };

    if (args.status === "APPROVED") {
      patch.approvedAt = now;
      patch.approvedById = user._id;
    }

    await ctx.db.patch(args.id, patch as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "documentRecords",
      entityId: args.id,
      previousStatus: doc.status,
      newStatus: args.status,
    });

    // --- Notification triggers ---

    if (args.status === "IN_REVIEW") {
      // Notify assigned reviewers
      const reviews = await ctx.db
        .query("documentReviews")
        .withIndex("by_document_status", (q) =>
          q.eq("documentId", args.id).eq("status", "PENDING")
        )
        .collect();
      for (const review of reviews) {
        await createNotification(ctx, {
          userId: review.reviewerId,
          type: "DOCUMENT_REVIEW_REQUESTED",
          title: "Dokument zur Prüfung",
          message: `„${doc.documentCode}" wurde zur Prüfung eingereicht.`,
          resourceType: "documentRecords",
          resourceId: args.id as string,
        });
      }
      // Also notify reviewer if set directly on document
      if (doc.reviewerId && !reviews.some((r) => r.reviewerId === doc.reviewerId)) {
        await createNotification(ctx, {
          userId: doc.reviewerId,
          type: "DOCUMENT_REVIEW_REQUESTED",
          title: "Dokument zur Prüfung",
          message: `„${doc.documentCode}" wurde zur Prüfung eingereicht.`,
          resourceType: "documentRecords",
          resourceId: args.id as string,
        });
      }
    }

    if (args.status === "APPROVED" && doc.createdBy) {
      // Notify document author
      await createNotification(ctx, {
        userId: doc.createdBy,
        type: "DOCUMENT_APPROVED",
        title: "Dokument freigegeben",
        message: `„${doc.documentCode}" wurde freigegeben.`,
        resourceType: "documentRecords",
        resourceId: args.id as string,
      });
    }
  },
});

/** Archive a document record */
export const archive = mutation({
  args: { id: v.id("documentRecords") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:archive");
    await archiveRecord(ctx, "documentRecords", args.id, user._id);
  },
});

// ============================================================
// Read Confirmations
// ============================================================

/** List read confirmations for a document */
export const listReadConfirmations = query({
  args: { documentRecordId: v.id("documentRecords") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    return await ctx.db
      .query("readConfirmations")
      .withIndex("by_document", (q) => q.eq("documentRecordId", args.documentRecordId))
      .collect();
  },
});

/** Check if current user has confirmed reading a document */
export const hasUserConfirmed = query({
  args: { documentRecordId: v.id("documentRecords") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const confirmation = await ctx.db
      .query("readConfirmations")
      .withIndex("by_document_user", (q) =>
        q.eq("documentRecordId", args.documentRecordId).eq("userId", user._id)
      )
      .first();
    return confirmation !== null;
  },
});

/** Submit read confirmation for current user */
export const confirmRead = mutation({
  args: {
    documentRecordId: v.id("documentRecords"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:read");

    // Check document exists and is approved
    const doc = await ctx.db.get(args.documentRecordId);
    if (!doc) throw new Error("Dokument nicht gefunden");
    if (doc.status !== "APPROVED") throw new Error("Dokument ist noch nicht freigegeben");

    // Check not already confirmed for this version
    const existing = await ctx.db
      .query("readConfirmations")
      .withIndex("by_document_user", (q) =>
        q.eq("documentRecordId", args.documentRecordId).eq("userId", user._id)
      )
      .first();

    if (existing && existing.documentVersion === doc.version) {
      throw new Error("Lesebestätigung für diese Version bereits vorhanden");
    }

    const now = Date.now();
    const id = await ctx.db.insert("readConfirmations", {
      documentRecordId: args.documentRecordId,
      userId: user._id,
      documentVersion: doc.version,
      confirmedAt: now,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "readConfirmations",
      entityId: id,
      metadata: { documentRecordId: args.documentRecordId, version: doc.version },
    });

    // Mark associated READ_DOCUMENT task as DONE if exists
    const readTask = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", "documentRecords").eq("resourceId", args.documentRecordId as string)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("assigneeId"), user._id),
          q.eq(q.field("type"), "READ_DOCUMENT"),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED")
        )
      )
      .first();

    if (readTask) {
      await ctx.db.patch(readTask._id, {
        status: "DONE" as any,
        updatedAt: now,
        updatedBy: user._id,
      });
    }

    return id;
  },
});

// ============================================================
// Internal: Review Date Checks (called by cron)
// ============================================================

/** Check documents approaching their review date and notify responsible users */
export const checkReviewDates = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const sixtyDaysFromNow = now + 60 * 24 * 60 * 60 * 1000;

    const documents = await ctx.db
      .query("documentRecords")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("status"), "APPROVED")
        )
      )
      .collect();

    for (const doc of documents) {
      if (!doc.nextReviewDate || !doc.responsibleUserId) continue;
      if (doc.nextReviewDate > sixtyDaysFromNow) continue;

      const daysUntilDue = Math.floor(
        (doc.nextReviewDate - now) / (24 * 60 * 60 * 1000)
      );

      if (daysUntilDue <= 0) {
        await createNotification(ctx, {
          userId: doc.responsibleUserId,
          type: "DOCUMENT_REVIEW_DUE",
          title: "Dokumentenprüfung überfällig",
          message: `„${doc.documentCode}" ist seit ${Math.abs(daysUntilDue)} Tag(en) überfällig.`,
          resourceType: "documentRecords",
          resourceId: doc._id as string,
        });
      } else if (daysUntilDue <= 30) {
        await createNotification(ctx, {
          userId: doc.responsibleUserId,
          type: "DOCUMENT_REVIEW_DUE",
          title: "Dokumentenprüfung fällig",
          message: `„${doc.documentCode}" muss innerhalb von ${daysUntilDue} Tag(en) geprüft werden.`,
          resourceType: "documentRecords",
          resourceId: doc._id as string,
        });
      } else {
        await createNotification(ctx, {
          userId: doc.responsibleUserId,
          type: "DOCUMENT_EXPIRING",
          title: "Dokumentenprüfung anstehend",
          message: `„${doc.documentCode}" muss in ${daysUntilDue} Tagen geprüft werden.`,
          resourceType: "documentRecords",
          resourceId: doc._id as string,
        });
      }
    }
  },
});
