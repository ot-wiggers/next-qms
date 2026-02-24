import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

// ============================================================
// Manufacturers
// ============================================================

/** List all manufacturers */
export const listManufacturers = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "products:list");
    return await ctx.db
      .query("manufacturers")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Get manufacturer by ID */
export const getManufacturer = query({
  args: { id: v.id("manufacturers") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "products:list");
    return await ctx.db.get(args.id);
  },
});

/** Create a manufacturer */
export const createManufacturer = mutation({
  args: {
    name: v.string(),
    country: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const now = Date.now();

    const id = await ctx.db.insert("manufacturers", {
      ...args,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "manufacturers",
      entityId: id,
      metadata: { name: args.name },
    });

    return id;
  },
});

// ============================================================
// Products
// ============================================================

/** List products with optional filters */
export const list = query({
  args: {
    status: v.optional(v.string()),
    riskClass: v.optional(v.string()),
    manufacturerId: v.optional(v.id("manufacturers")),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "products:list");
    let results = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    if (args.status) results = results.filter((p) => p.status === args.status);
    if (args.riskClass) results = results.filter((p) => p.riskClass === args.riskClass);
    if (args.manufacturerId) results = results.filter((p) => p.manufacturerId === args.manufacturerId);
    return results;
  },
});

/** Get product by ID */
export const getById = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "products:list");
    return await ctx.db.get(args.id);
  },
});

/** Create a product */
export const create = mutation({
  args: {
    name: v.string(),
    articleNumber: v.string(),
    udi: v.optional(v.string()),
    productGroup: v.optional(v.string()),
    manufacturerId: v.optional(v.id("manufacturers")),
    riskClass: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const now = Date.now();

    const id = await ctx.db.insert("products", {
      ...args,
      riskClass: args.riskClass as any,
      status: "ACTIVE",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "products",
      entityId: id,
      metadata: { name: args.name, articleNumber: args.articleNumber },
    });

    return id;
  },
});

/** Update a product */
export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    articleNumber: v.optional(v.string()),
    udi: v.optional(v.string()),
    productGroup: v.optional(v.string()),
    manufacturerId: v.optional(v.id("manufacturers")),
    riskClass: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const user = await requirePermission(ctx, "products:update");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Produkt nicht gefunden");

    // Business rule: check feature flag — block activation without valid DoC
    if (updates.status === "ACTIVE" && existing.status !== "ACTIVE") {
      const enforceFlag = await ctx.db
        .query("featureFlags")
        .withIndex("by_key", (q) => q.eq("key", "enforceDocForActiveProduct"))
        .first();

      if (enforceFlag?.enabled) {
        const validDoc = await ctx.db
          .query("declarationsOfConformity")
          .withIndex("by_product", (q) => q.eq("productId", id))
          .filter((q) => q.eq(q.field("status"), "VALID"))
          .first();

        if (!validDoc) {
          throw new Error(
            "Produkt kann nicht aktiviert werden: Keine gültige Konformitätserklärung vorhanden"
          );
        }
      }
    }

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    } as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: updates.status && updates.status !== existing.status ? "STATUS_CHANGE" : "UPDATE",
      entityType: "products",
      entityId: id,
      changes: updates,
      previousStatus: existing.status,
      newStatus: updates.status || existing.status,
    });
  },
});

/** Archive a product */
export const archive = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:update");
    await archiveRecord(ctx, "products", args.id, user._id);
  },
});
