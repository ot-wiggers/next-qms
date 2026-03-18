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

/** Update manufacturer */
export const updateManufacturer = mutation({
  args: {
    id: v.id("manufacturers"),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Hersteller nicht gefunden");

    const updates: Record<string, any> = {
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.country !== undefined) updates.country = args.country;
    if (args.contactInfo !== undefined) updates.contactInfo = args.contactInfo;

    await ctx.db.patch(args.id, updates);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "manufacturers",
      entityId: args.id,
      metadata: { name: args.name ?? existing.name },
    });
  },
});

/** Archive manufacturer (soft delete) */
export const archiveManufacturer = mutation({
  args: { id: v.id("manufacturers") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    await archiveRecord(ctx, "manufacturers", args.id, user._id);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "ARCHIVE",
      entityType: "manufacturers",
      entityId: args.id,
    });
  },
});

/** Restore archived manufacturer */
export const restoreManufacturer = mutation({
  args: { id: v.id("manufacturers") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Hersteller nicht gefunden");

    await ctx.db.patch(args.id, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "RESTORE",
      entityType: "manufacturers",
      entityId: args.id,
    });
  },
});

/** List archived manufacturers */
export const listArchivedManufacturers = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "products:list");
    return await ctx.db
      .query("manufacturers")
      .filter((q) => q.eq(q.field("isArchived"), true))
      .collect();
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
    departmentId: v.optional(v.id("organizations")),
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
    if (args.departmentId) results = results.filter((p) => p.departmentId === args.departmentId);
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
    departmentId: v.optional(v.id("organizations")),
    riskClass: v.string(),
    hmvNummer: v.optional(v.string()),
    ceMarkPresent: v.optional(v.boolean()),
    instructionsPresent: v.optional(v.boolean()),
    regulatoryBasis: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const now = Date.now();

    const id = await ctx.db.insert("products", {
      ...args,
      riskClass: args.riskClass as any,
      hmvNummer: args.hmvNummer,
      ceMarkPresent: args.ceMarkPresent ?? false,
      instructionsPresent: args.instructionsPresent ?? false,
      regulatoryBasis: args.regulatoryBasis as any,
      migrationRequired: args.regulatoryBasis === "DIRECTIVE" ? true : undefined,
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
    departmentId: v.optional(v.id("organizations")),
    riskClass: v.optional(v.string()),
    status: v.optional(v.string()),
    hmvNummer: v.optional(v.string()),
    ceMarkPresent: v.optional(v.boolean()),
    instructionsPresent: v.optional(v.boolean()),
    regulatoryBasis: v.optional(v.string()),
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
    const patchData: Record<string, any> = {
      ...updates,
      updatedAt: now,
      updatedBy: user._id,
    };
    if (updates.hmvNummer !== undefined) patchData.hmvNummer = updates.hmvNummer;
    if (updates.ceMarkPresent !== undefined) patchData.ceMarkPresent = updates.ceMarkPresent;
    if (updates.instructionsPresent !== undefined) patchData.instructionsPresent = updates.instructionsPresent;
    if (updates.regulatoryBasis !== undefined) {
      patchData.regulatoryBasis = updates.regulatoryBasis;
      patchData.migrationRequired = updates.regulatoryBasis === "DIRECTIVE" ? true : undefined;
    }
    await ctx.db.patch(id, patchData as any);

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

/** Bulk-import products */
export const importProducts = mutation({
  args: {
    products: v.array(
      v.object({
        name: v.string(),
        articleNumber: v.string(),
        udi: v.optional(v.string()),
        productGroup: v.optional(v.string()),
        riskClass: v.string(),
        hmvNummer: v.optional(v.string()),
        ceMarkPresent: v.optional(v.boolean()),
        instructionsPresent: v.optional(v.boolean()),
        regulatoryBasis: v.optional(v.string()),
        notes: v.optional(v.string()),
        departmentId: v.optional(v.id("organizations")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const now = Date.now();
    const validRiskClasses = ["I", "IIa", "IIb", "III"];
    const ids: string[] = [];

    for (const product of args.products) {
      // Validate required fields
      if (!product.name || !product.articleNumber || !product.riskClass) {
        throw new Error(
          `Pflichtfelder fehlen: name, articleNumber und riskClass sind erforderlich (Artikel: ${product.articleNumber || "unbekannt"})`
        );
      }
      if (!validRiskClasses.includes(product.riskClass)) {
        throw new Error(
          `Ungültige Risikoklasse "${product.riskClass}" für Artikel ${product.articleNumber}. Erlaubt: ${validRiskClasses.join(", ")}`
        );
      }

      const id = await ctx.db.insert("products", {
        name: product.name,
        articleNumber: product.articleNumber,
        udi: product.udi,
        productGroup: product.productGroup,
        riskClass: product.riskClass as any,
        hmvNummer: product.hmvNummer,
        ceMarkPresent: product.ceMarkPresent ?? false,
        instructionsPresent: product.instructionsPresent ?? false,
        regulatoryBasis: product.regulatoryBasis as any,
        migrationRequired: product.regulatoryBasis === "DIRECTIVE" ? true : undefined,
        notes: product.notes,
        departmentId: product.departmentId,
        status: "ACTIVE",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
      ids.push(id);
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "products",
      entityId: ids[0] ?? "bulk-import",
      metadata: { bulkImport: true, count: args.products.length },
    });

    return { imported: ids.length, ids };
  },
});

/** Import products from Wiggers legacy Excel with manufacturer + DoC auto-creation */
export const importLegacyProducts = mutation({
  args: {
    products: v.array(
      v.object({
        name: v.string(),
        manufacturer: v.string(),
        productGroup: v.optional(v.string()),
        riskClass: v.string(),
        ceMarkPresent: v.boolean(),
        instructionsPresent: v.boolean(),
        docPresent: v.boolean(),
        regulatoryBasis: v.string(),       // "MDR" or "DIRECTIVE"
        externalUrl: v.optional(v.string()),
        issuedAt: v.optional(v.number()),
        validUntil: v.optional(v.number()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const now = Date.now();
    const validRiskClasses = ["I", "IIa", "IIb", "III"];
    const productIds: string[] = [];

    // Collect unique manufacturers and auto-create
    const manufacturerCache: Record<string, string> = {};
    const existingManufacturers = await ctx.db
      .query("manufacturers")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    for (const m of existingManufacturers) {
      manufacturerCache[m.name.toLowerCase()] = m._id;
    }

    for (let i = 0; i < args.products.length; i++) {
      const product = args.products[i];
      if (!product.name || !product.riskClass) {
        throw new Error(`Pflichtfelder fehlen für Produkt: ${product.name || "unbekannt"}`);
      }
      if (!validRiskClasses.includes(product.riskClass)) {
        throw new Error(`Ungültige Risikoklasse "${product.riskClass}" für ${product.name}`);
      }

      // Find or create manufacturer
      let manufacturerId: string | undefined;
      if (product.manufacturer) {
        const key = product.manufacturer.toLowerCase();
        if (manufacturerCache[key]) {
          manufacturerId = manufacturerCache[key];
        } else {
          const mId = await ctx.db.insert("manufacturers", {
            name: product.manufacturer,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
            createdBy: user._id,
            updatedBy: user._id,
          });
          manufacturerCache[key] = mId;
          manufacturerId = mId;
        }
      }

      // Create product (counter-based article number for guaranteed uniqueness)
      const productId = await ctx.db.insert("products", {
        name: product.name,
        articleNumber: `LEGACY-${String(i + 1).padStart(4, "0")}`,
        productGroup: product.productGroup,
        manufacturerId: manufacturerId as any,
        riskClass: product.riskClass as any,
        status: "ACTIVE",
        ceMarkPresent: product.ceMarkPresent,
        instructionsPresent: product.instructionsPresent,
        regulatoryBasis: product.regulatoryBasis as any,
        migrationRequired: product.regulatoryBasis === "DIRECTIVE" ? true : undefined,
        notes: product.notes,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
      productIds.push(productId);

      // Create Declaration of Conformity if present
      if (product.docPresent && (product.externalUrl || product.issuedAt)) {
        await ctx.db.insert("declarationsOfConformity", {
          productId: productId as any,
          version: "1.0",
          issuedAt: product.issuedAt ?? now,
          validFrom: product.issuedAt ?? now,
          validUntil: product.validUntil ?? now + 157680000000, // 5 years default
          status: product.validUntil && product.validUntil < now ? "EXPIRED" : "VALID",
          externalUrl: product.externalUrl,
          urlStatus: product.externalUrl ? "UNCHECKED" : undefined,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          createdBy: user._id,
          updatedBy: user._id,
        });
      }
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "products",
      entityId: productIds[0] ?? "legacy-import",
      metadata: { legacyImport: true, count: args.products.length },
    });

    return { imported: productIds.length, ids: productIds };
  },
});

/** Export all non-archived products for download */
export const exportProducts = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "products:list");

    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Resolve department names
    const departmentIds = [
      ...new Set(products.map((p) => p.departmentId).filter(Boolean)),
    ];
    const departments: Record<string, string> = {};
    for (const deptId of departmentIds) {
      if (deptId) {
        const dept = await ctx.db.get(deptId);
        if (dept) departments[deptId] = dept.name;
      }
    }

    // Resolve manufacturer names
    const manufacturerIds = [
      ...new Set(products.map((p) => p.manufacturerId).filter(Boolean)),
    ];
    const manufacturerNames: Record<string, string> = {};
    for (const mfId of manufacturerIds) {
      if (mfId) {
        const mf = await ctx.db.get(mfId);
        if (mf) manufacturerNames[mfId] = mf.name;
      }
    }

    return products.map((p) => ({
      name: p.name,
      articleNumber: p.articleNumber,
      udi: p.udi ?? "",
      productGroup: p.productGroup ?? "",
      riskClass: p.riskClass,
      status: p.status,
      notes: p.notes ?? "",
      departmentName: p.departmentId ? (departments[p.departmentId] ?? "") : "",
      manufacturerName: p.manufacturerId
        ? (manufacturerNames[p.manufacturerId] ?? "")
        : "",
    }));
  },
});

/** List products linked to a specific HMV number prefix */
export const listByHmv = query({
  args: { hmvPrefix: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "products:list");

    const allProducts = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return allProducts.filter(
      (p) => p.hmvNummer && p.hmvNummer.startsWith(args.hmvPrefix)
    );
  },
});
