import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";

/** List all versions for a document (newest first) */
export const listByDocument = query({
  args: { documentId: v.id("documentRecords") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Enrich with user names
    const enriched = await Promise.all(
      versions.map(async (v) => {
        const user = await ctx.db.get(v.changedBy);
        return {
          ...v,
          changedByName: user
            ? `${user.firstName} ${user.lastName}`
            : "Unbekannt",
        };
      })
    );

    return enriched.sort((a, b) => b.version - a.version);
  },
});

/** Get a specific version snapshot */
export const getVersion = query({
  args: { documentId: v.id("documentRecords"), version: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    return await ctx.db
      .query("documentVersions")
      .withIndex("by_document_version", (q) =>
        q.eq("documentId", args.documentId).eq("version", args.version)
      )
      .first();
  },
});

/** Internal: Create a version snapshot (called when document is approved) */
export const createSnapshot = internalMutation({
  args: { documentId: v.id("documentRecords"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;

    // Get current max version number
    const existing = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    const maxVersion = existing.reduce(
      (max, v) => Math.max(max, v.version),
      0
    );

    // Extract plaintext for diff
    const plaintext = extractPlaintext(doc.richContent);

    await ctx.db.insert("documentVersions", {
      documentId: args.documentId,
      version: maxVersion + 1,
      content: doc.richContent ?? null,
      contentPlaintext: plaintext,
      changedBy: args.userId,
      changedAt: Date.now(),
      changeDescription: `Version ${maxVersion + 1} freigegeben`,
      status: "APPROVED",
    });
  },
});

/** Recursively extract plaintext from Tiptap JSON */
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
