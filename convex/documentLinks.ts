import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

/** List all links for a document (as source or target) */
export const listByDocument = query({
  args: { documentId: v.id("documentRecords") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");

    const asSource = await ctx.db
      .query("documentLinks")
      .withIndex("by_source", (q) => q.eq("sourceDocumentId", args.documentId))
      .collect();
    const asTarget = await ctx.db
      .query("documentLinks")
      .withIndex("by_target", (q) => q.eq("targetDocumentId", args.documentId))
      .collect();

    const all = [...asSource, ...asTarget];

    // Enrich with document info
    return Promise.all(
      all.map(async (link) => {
        const otherId =
          link.sourceDocumentId === args.documentId
            ? link.targetDocumentId
            : link.sourceDocumentId;
        const otherDoc = await ctx.db.get(otherId);
        return {
          ...link,
          otherDocumentId: otherId,
          otherDocumentCode: otherDoc?.documentCode ?? "Unbekannt",
          otherDocumentTitle: otherDoc?.title,
          otherDocumentStatus: otherDoc?.status ?? "UNKNOWN",
          direction:
            link.sourceDocumentId === args.documentId ? "outgoing" : "incoming",
        };
      })
    );
  },
});

/** List all document links (for full graph view) */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "documents:read");
    return await ctx.db.query("documentLinks").collect();
  },
});

/** Create a document link */
export const create = mutation({
  args: {
    sourceDocumentId: v.id("documentRecords"),
    targetDocumentId: v.id("documentRecords"),
    linkType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:link");

    // Validate both documents exist
    const source = await ctx.db.get(args.sourceDocumentId);
    const target = await ctx.db.get(args.targetDocumentId);
    if (!source) throw new Error("Quelldokument nicht gefunden");
    if (!target) throw new Error("Zieldokument nicht gefunden");
    if (args.sourceDocumentId === args.targetDocumentId) {
      throw new Error("Ein Dokument kann nicht mit sich selbst verknüpft werden");
    }

    // Check for duplicate
    const existing = await ctx.db
      .query("documentLinks")
      .withIndex("by_source", (q) =>
        q.eq("sourceDocumentId", args.sourceDocumentId)
      )
      .filter((q) => q.eq(q.field("targetDocumentId"), args.targetDocumentId))
      .first();
    if (existing) throw new Error("Verknüpfung existiert bereits");

    const id = await ctx.db.insert("documentLinks", {
      sourceDocumentId: args.sourceDocumentId,
      targetDocumentId: args.targetDocumentId,
      linkType: args.linkType,
      createdAt: Date.now(),
      createdBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "documentLinks",
      entityId: id,
      metadata: {
        source: args.sourceDocumentId,
        target: args.targetDocumentId,
        linkType: args.linkType,
      },
    });

    return id;
  },
});

/** Delete a document link */
export const remove = mutation({
  args: { id: v.id("documentLinks") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:link");
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Verknüpfung nicht gefunden");

    await ctx.db.delete(args.id);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "ARCHIVE",
      entityType: "documentLinks",
      entityId: args.id,
    });
  },
});
