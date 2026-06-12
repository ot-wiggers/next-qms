import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

// ============================================================
// Wareneingangsprüfung (MDR Art. 14, AA 7.4.3)
// Abschnitts-Validatoren gespiegelt aus convex/schema.ts
// ============================================================

const dutiesArg = v.object({
  isMedizinprodukt: v.optional(v.boolean()),
  hasCeKennzeichnung: v.optional(v.boolean()),
  hasHerstellerInfos: v.optional(v.boolean()),
  hasEuKonformitaet: v.optional(v.boolean()),
  hasUdi: v.optional(v.boolean()),
  hasLagerungBedingungen: v.optional(v.boolean()),
  entsprichtMdr: v.optional(v.boolean()),
  keineGefahr: v.optional(v.boolean()),
});
const labelingArg = v.object({
  produktName: v.optional(v.string()),
  ceKennzeichnung: v.optional(v.boolean()),
  herstellerName: v.optional(v.string()),
  haendlerName: v.optional(v.string()),
  importeursName: v.optional(v.string()),
  bevollmaechtigten: v.optional(v.string()),
});
const identificationArg = v.object({
  hasRef: v.optional(v.boolean()), ref: v.optional(v.string()),
  hasLot: v.optional(v.boolean()), lot: v.optional(v.string()),
  hasSn: v.optional(v.boolean()), sn: v.optional(v.string()),
  hasUdiTraeger: v.optional(v.boolean()), udiTraeger: v.optional(v.string()),
  haltbarkeitsdatum: v.optional(v.string()),
  herstelldatum: v.optional(v.string()),
});
const storageArg = v.object({
  trockenLagern: v.optional(v.boolean()),
  sonnenlichtSchutz: v.optional(v.boolean()),
  zerbrechlich: v.optional(v.boolean()),
  temperaturbegrenzung: v.optional(v.boolean()),
  luftfeuchte: v.optional(v.boolean()),
  warnhinweise: v.optional(v.string()),
  gebrauchshinweise: v.optional(v.string()),
  patientHinweise: v.optional(v.string()),
  aufbereitungszyklen: v.optional(v.string()),
  beschraenkungZyklen: v.optional(v.string()),
});
const customArg = v.object({
  isSonderanfertigung: v.optional(v.boolean()),
  mdKennzeichnung: v.optional(v.boolean()),
  nurKlinischePruefung: v.optional(v.boolean()),
  sichereEntsorgung: v.optional(v.string()),
});
const resultArg = v.union(v.literal("PASSED"), v.literal("FAILED"));

const checkPayloadArgs = {
  locationId: v.id("organizations"),
  checkDate: v.number(),
  inspectorName: v.optional(v.string()),
  manufacturer: v.string(),
  productArea: v.string(),
  deliveryDate: v.optional(v.number()),
  duties: dutiesArg,
  labeling: labelingArg,
  identification: identificationArg,
  storage: storageArg,
  custom: customArg,
  result: resultArg,
  failureReason: v.optional(v.string()),
  remarks: v.optional(v.string()),
  signatureFileId: v.optional(v.id("_storage")),
  attachmentFileIds: v.optional(v.array(v.id("_storage"))),
};

/** Gemeinsame Payload-Validierung für create/update */
async function validatePayload(
  ctx: MutationCtx,
  args: { locationId: Id<"organizations">; manufacturer: string; result: "PASSED" | "FAILED"; failureReason?: string },
) {
  const location = await ctx.db.get(args.locationId);
  if (!location || location.isArchived || location.type !== "location") {
    throw new Error("Ungültige Filiale");
  }
  if (!args.manufacturer.trim()) throw new Error("Hersteller ist erforderlich");
  if (args.result === "FAILED" && !args.failureReason?.trim()) {
    throw new Error("Bei „nicht erfüllt“ ist eine Begründung erforderlich");
  }
}

// ============================================================
// list — alle Prüfungen mit Filialname (Filter macht der Client)
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "incomingGoods:list");
    const checks = await ctx.db
      .query("incomingGoodsChecks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgName = new Map(orgs.map((o) => [o._id, o.name]));
    return checks
      .sort((a, b) => b.checkDate - a.checkDate)
      .map((c) => ({
        _id: c._id,
        checkDate: c.checkDate,
        locationId: c.locationId,
        locationName: orgName.get(c.locationId) ?? "—",
        manufacturer: c.manufacturer,
        productArea: c.productArea,
        result: c.result,
        inspectorName: c.inspectorName,
      }));
  },
});

// ============================================================
// getById — Prüfung + Filialname + Datei-URLs (Unterschrift, Anhänge)
// ============================================================

export const getById = query({
  args: { id: v.id("incomingGoodsChecks") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "incomingGoods:list");
    const check = await ctx.db.get(args.id);
    if (!check) return null;
    const location = await ctx.db.get(check.locationId);
    const signatureUrl = check.signatureFileId
      ? await ctx.storage.getUrl(check.signatureFileId)
      : null;
    const attachments = await Promise.all(
      (check.attachmentFileIds ?? []).map(async (fileId) => ({
        fileId,
        url: await ctx.storage.getUrl(fileId),
      })),
    );
    return {
      ...check,
      locationName: location?.name ?? "—",
      signatureUrl,
      attachments,
    };
  },
});

// ============================================================
// monthlyStatus — Ampel Filiale × Monat (Anzahl Prüfungen je Monat)
// ============================================================

export const monthlyStatus = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "incomingGoods:list");
    const yearStart = Date.UTC(args.year, 0, 1);
    const yearEnd = Date.UTC(args.year + 1, 0, 1);

    const locations = (await ctx.db.query("organizations").collect())
      .filter((o) => o.type === "location" && !o.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    const checks = (
      await ctx.db
        .query("incomingGoodsChecks")
        .withIndex("by_checkDate", (q) => q.gte("checkDate", yearStart).lt("checkDate", yearEnd))
        .collect()
    ).filter((c) => !c.isArchived);

    const rows = locations.map((loc) => {
      const months = Array.from({ length: 12 }, () => 0);
      for (const c of checks) {
        if (c.locationId !== loc._id) continue;
        months[new Date(c.checkDate).getUTCMonth()]++;
      }
      return {
        locationId: loc._id,
        name: loc.name,
        hasReminderEmails: !!loc.reminderEmails?.trim(),
        months,
      };
    });

    return { year: args.year, rows };
  },
});

// ============================================================
// create / update / archive / Upload
// ============================================================

export const create = mutation({
  args: checkPayloadArgs,
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "incomingGoods:record");
    await validatePayload(ctx, args);

    const now = Date.now();
    const id = await ctx.db.insert("incomingGoodsChecks", {
      ...args,
      manufacturer: args.manufacturer.trim(),
      inspectorName: args.inspectorName?.trim() || `${user.firstName} ${user.lastName}`,
      failureReason: args.failureReason?.trim() || undefined,
      remarks: args.remarks?.trim() || undefined,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "incomingGoodsChecks", entityId: id,
      metadata: { manufacturer: args.manufacturer, productArea: args.productArea, result: args.result },
    });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("incomingGoodsChecks"), ...checkPayloadArgs },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "incomingGoods:manage");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.isArchived) throw new Error("Prüfung nicht gefunden");
    await validatePayload(ctx, args);

    const { id, ...payload } = args;
    await ctx.db.patch(id, {
      ...payload,
      manufacturer: payload.manufacturer.trim(),
      inspectorName: payload.inspectorName?.trim() || undefined,
      failureReason: payload.failureReason?.trim() || undefined,
      remarks: payload.remarks?.trim() || undefined,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "incomingGoodsChecks", entityId: id,
      changes: { manufacturer: payload.manufacturer, result: payload.result },
    });
  },
});

export const archive = mutation({
  args: { id: v.id("incomingGoodsChecks") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "incomingGoods:manage");
    await archiveRecord(ctx, "incomingGoodsChecks", args.id, user._id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "incomingGoods:record");
    return await ctx.storage.generateUploadUrl();
  },
});
