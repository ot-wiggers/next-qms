import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";

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

/** Get document record by Sanity document ID */
export const getBySanityId = query({
  args: { sanityDocumentId: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    return await ctx.db
      .query("documentRecords")
      .withIndex("by_sanityId", (q) => q.eq("sanityDocumentId", args.sanityDocumentId))
      .first();
  },
});

/** Create a new document record */
export const create = mutation({
  args: {
    sanityDocumentId: v.optional(v.string()),
    documentType: v.string(),
    documentCode: v.string(),
    version: v.string(),
    content: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    responsibleUserId: v.id("users"),
    reviewerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:create");
    const now = Date.now();

    const id = await ctx.db.insert("documentRecords", {
      ...args,
      documentType: args.documentType as any,
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
    documentCode: v.optional(v.string()),
    version: v.optional(v.string()),
    content: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    responsibleUserId: v.optional(v.id("users")),
    reviewerId: v.optional(v.id("users")),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requirePermission(ctx, "documents:create");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Dokument nicht gefunden");

    const now = Date.now();
    const patch: Record<string, any> = { updatedAt: now, updatedBy: user._id };
    if (updates.documentCode !== undefined) patch.documentCode = updates.documentCode;
    if (updates.version !== undefined) patch.version = updates.version;
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.validFrom !== undefined) patch.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) patch.validUntil = updates.validUntil;
    if (updates.responsibleUserId !== undefined) patch.responsibleUserId = updates.responsibleUserId;
    if (updates.reviewerId !== undefined) patch.reviewerId = updates.reviewerId;

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
