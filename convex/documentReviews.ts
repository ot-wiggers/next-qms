import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { createNotification } from "./lib/notificationHelpers";

/** List all reviews for a document */
export const listByDocument = query({
  args: { documentId: v.id("documentRecords") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    const reviews = await ctx.db
      .query("documentReviews")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Enrich with reviewer info
    return Promise.all(
      reviews.map(async (review) => {
        const reviewer = await ctx.db.get(review.reviewerId);
        return {
          ...review,
          reviewerName: reviewer
            ? `${reviewer.firstName} ${reviewer.lastName}`
            : "Unbekannt",
        };
      })
    );
  },
});

/** Get current user's review for a document */
export const getMyReview = query({
  args: { documentId: v.id("documentRecords") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("documentReviews")
      .withIndex("by_reviewer", (q) => q.eq("reviewerId", user._id))
      .filter((q) => q.eq(q.field("documentId"), args.documentId))
      .first();
  },
});

/** Assign reviewers to a document */
export const assignReviewers = mutation({
  args: {
    documentId: v.id("documentRecords"),
    reviewerIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:review");
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Dokument nicht gefunden");

    const now = Date.now();

    // Remove existing PENDING reviews
    const existing = await ctx.db
      .query("documentReviews")
      .withIndex("by_document_status", (q) =>
        q.eq("documentId", args.documentId).eq("status", "PENDING")
      )
      .collect();
    for (const r of existing) {
      await ctx.db.delete(r._id);
    }

    // Create new reviews
    for (const reviewerId of args.reviewerIds) {
      await ctx.db.insert("documentReviews", {
        documentId: args.documentId,
        version: parseInt(doc.version) || 1,
        reviewerId,
        status: "PENDING",
        createdAt: now,
      });

      await createNotification(ctx, {
        userId: reviewerId,
        type: "DOCUMENT_REVIEW_REQUESTED",
        title: "Dokument zur Prüfung zugewiesen",
        message: `Sie wurden als Prüfer für „${doc.documentCode}" zugewiesen.`,
        resourceType: "documentRecords",
        resourceId: args.documentId as string,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "documentRecords",
      entityId: args.documentId,
      metadata: { action: "assign_reviewers", reviewerIds: args.reviewerIds },
    });
  },
});

/** Submit a review */
export const submitReview = mutation({
  args: {
    documentId: v.id("documentRecords"),
    status: v.string(), // APPROVED or CHANGES_REQUESTED
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const review = await ctx.db
      .query("documentReviews")
      .withIndex("by_reviewer", (q) => q.eq("reviewerId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("documentId"), args.documentId),
          q.eq(q.field("status"), "PENDING")
        )
      )
      .first();

    if (!review) throw new Error("Keine ausstehende Prüfung gefunden");

    validateTransition("reviewStatus", review.status, args.status);

    const now = Date.now();
    await ctx.db.patch(review._id, {
      status: args.status,
      comments: args.comments,
      reviewedAt: now,
    });

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Dokument nicht gefunden");

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "documentReviews",
      entityId: review._id,
      previousStatus: "PENDING",
      newStatus: args.status,
    });

    // Check if all reviews are complete
    const allReviews = await ctx.db
      .query("documentReviews")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const pendingReviews = allReviews.filter((r) => r.status === "PENDING");
    const changesRequested = allReviews.filter((r) => r.status === "CHANGES_REQUESTED");

    if (args.status === "CHANGES_REQUESTED" && doc.createdBy) {
      // Notify document author about requested changes
      await createNotification(ctx, {
        userId: doc.createdBy,
        type: "DOCUMENT_STATUS_CHANGED",
        title: "Änderungen angefordert",
        message: `${user.firstName} ${user.lastName} hat Änderungen an „${doc.documentCode}" angefordert.${args.comments ? ` Kommentar: ${args.comments}` : ""}`,
        resourceType: "documentRecords",
        resourceId: args.documentId as string,
      });
    }

    if (pendingReviews.length === 0 && changesRequested.length === 0) {
      // All reviews approved — notify document author
      if (doc.createdBy) {
        await createNotification(ctx, {
          userId: doc.createdBy,
          type: "REVIEW_COMPLETED",
          title: "Alle Prüfungen abgeschlossen",
          message: `Alle Prüfer haben „${doc.documentCode}" freigegeben. Das Dokument kann nun genehmigt werden.`,
          resourceType: "documentRecords",
          resourceId: args.documentId as string,
        });
      }
    }
  },
});

/** Remove a pending reviewer */
export const removeReviewer = mutation({
  args: { reviewId: v.id("documentReviews") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:review");
    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new Error("Prüfung nicht gefunden");
    if (review.status !== "PENDING") {
      throw new Error("Nur ausstehende Prüfungen können entfernt werden");
    }
    await ctx.db.delete(args.reviewId);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "ARCHIVE",
      entityType: "documentReviews",
      entityId: args.reviewId,
    });
  },
});
