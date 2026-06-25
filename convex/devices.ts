import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";
import { CALIBRATION_TOLERANCE_MS, type DeviceAmpel } from "../lib/types/enums";

const resultArg = v.union(v.literal("PASSED"), v.literal("CONDITIONAL"), v.literal("FAILED"));

/** nextDue = Kalibrierdatum + Intervall (Monate), via Kalender-Monatsaddition */
function addMonths(ts: number, months: number): number {
  const d = new Date(ts);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

/** Ampel aus Lifecycle-Status + nextDueDate ± Toleranz ableiten (nicht gespeichert) */
export function computeAmpel(device: Pick<Doc<"deviceRecords">, "status" | "nextDueDate">, now: number): DeviceAmpel {
  if (device.status === "DECOMMISSIONED") return "DECOMMISSIONED";
  if (device.nextDueDate === undefined) return "UNSCHEDULED";
  if (now > device.nextDueDate + CALIBRATION_TOLERANCE_MS) return "OVERDUE";
  if (now >= device.nextDueDate - CALIBRATION_TOLERANCE_MS) return "DUE";
  return "OK";
}

// ============================================================
// list — alle Prüfmittel mit abgeleiteter Ampel (Filter im Client)
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "devices:list");
    const now = Date.now();
    const devices = await ctx.db
      .query("deviceRecords")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return devices
      .sort((a, b) => (a.nextDueDate ?? Infinity) - (b.nextDueDate ?? Infinity))
      .map((d) => ({
        _id: d._id,
        inventoryNumber: d.inventoryNumber,
        name: d.name,
        location: d.location,
        responsible: d.responsible,
        calibrationIntervalMonths: d.calibrationIntervalMonths,
        lastCalibrationDate: d.lastCalibrationDate,
        nextDueDate: d.nextDueDate,
        status: d.status,
        ampel: computeAmpel(d, now),
      }));
  },
});

// ============================================================
// summary — Ampel-Zählung fürs Dashboard
// ============================================================

export const summary = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "devices:list");
    const now = Date.now();
    const devices = await ctx.db
      .query("deviceRecords")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    let overdue = 0, due = 0, ok = 0, unscheduled = 0, decommissioned = 0;
    for (const d of devices) {
      switch (computeAmpel(d, now)) {
        case "OVERDUE": overdue++; break;
        case "DUE": due++; break;
        case "OK": ok++; break;
        case "UNSCHEDULED": unscheduled++; break;
        case "DECOMMISSIONED": decommissioned++; break;
      }
    }
    return { total: devices.length, overdue, due, ok, unscheduled, decommissioned };
  },
});

// ============================================================
// getById — Gerät + Kalibrierhistorie + Datei-URLs
// ============================================================

export const getById = query({
  args: { id: v.id("deviceRecords") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "devices:list");
    const device = await ctx.db.get(args.id);
    if (!device) return null;
    const calibrations = await ctx.db
      .query("deviceCalibrations")
      .withIndex("by_device", (q) => q.eq("deviceId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const history = await Promise.all(
      calibrations
        .sort((a, b) => b.calibrationDate - a.calibrationDate)
        .map(async (c) => ({
          _id: c._id,
          calibrationDate: c.calibrationDate,
          performedBy: c.performedBy,
          result: c.result,
          nextDueDate: c.nextDueDate,
          notes: c.notes,
          certUrl: c.certFileId ? await ctx.storage.getUrl(c.certFileId) : null,
        })),
    );
    return {
      ...device,
      ampel: computeAmpel(device, Date.now()),
      certUrl: device.certFileId ? await ctx.storage.getUrl(device.certFileId) : null,
      history,
    };
  },
});

// ============================================================
// create / update / decommission / reactivate
// ============================================================

const deviceFields = {
  inventoryNumber: v.string(),
  name: v.string(),
  manufacturer: v.optional(v.string()),
  serialNumber: v.optional(v.string()),
  location: v.optional(v.string()),
  responsible: v.optional(v.string()),
  calibrationIntervalMonths: v.number(),
  nextDueDate: v.optional(v.number()),   // optional manueller Erst-Soll-Termin
  notes: v.optional(v.string()),
};

export const create = mutation({
  args: deviceFields,
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    if (!args.inventoryNumber.trim()) throw new Error("Prüfmittel-Nr. ist erforderlich");
    if (!args.name.trim()) throw new Error("Bezeichnung ist erforderlich");
    if (!Number.isFinite(args.calibrationIntervalMonths) || args.calibrationIntervalMonths <= 0) {
      throw new Error("Intervall (Monate) muss größer 0 sein");
    }
    const now = Date.now();
    const id = await ctx.db.insert("deviceRecords", {
      inventoryNumber: args.inventoryNumber.trim(),
      name: args.name.trim(),
      manufacturer: args.manufacturer?.trim() || undefined,
      serialNumber: args.serialNumber?.trim() || undefined,
      location: args.location?.trim() || undefined,
      responsible: args.responsible?.trim() || undefined,
      calibrationIntervalMonths: args.calibrationIntervalMonths,
      nextDueDate: args.nextDueDate,
      status: "ACTIVE",
      notes: args.notes?.trim() || undefined,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "deviceRecords", entityId: id,
      metadata: { inventoryNumber: args.inventoryNumber, name: args.name },
    });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("deviceRecords"), ...deviceFields },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.isArchived) throw new Error("Prüfmittel nicht gefunden");
    if (!args.inventoryNumber.trim()) throw new Error("Prüfmittel-Nr. ist erforderlich");
    if (!args.name.trim()) throw new Error("Bezeichnung ist erforderlich");
    if (!Number.isFinite(args.calibrationIntervalMonths) || args.calibrationIntervalMonths <= 0) {
      throw new Error("Intervall (Monate) muss größer 0 sein");
    }
    await ctx.db.patch(args.id, {
      inventoryNumber: args.inventoryNumber.trim(),
      name: args.name.trim(),
      manufacturer: args.manufacturer?.trim() || undefined,
      serialNumber: args.serialNumber?.trim() || undefined,
      location: args.location?.trim() || undefined,
      responsible: args.responsible?.trim() || undefined,
      calibrationIntervalMonths: args.calibrationIntervalMonths,
      nextDueDate: args.nextDueDate,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "deviceRecords", entityId: args.id,
      changes: { inventoryNumber: args.inventoryNumber, name: args.name },
    });
  },
});

export const setStatus = mutation({
  args: { id: v.id("deviceRecords"), status: v.union(v.literal("ACTIVE"), v.literal("DECOMMISSIONED")) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.isArchived) throw new Error("Prüfmittel nicht gefunden");
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "deviceRecords", entityId: args.id,
      previousStatus: existing.status, newStatus: args.status,
    });
  },
});

export const archive = mutation({
  args: { id: v.id("deviceRecords") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    await archiveRecord(ctx, "deviceRecords", args.id, user._id);
  },
});

// ============================================================
// recordCalibration — Historieneintrag + Gerät aktualisieren
// (lastCalibrationDate, nextDueDate, jüngstes Zertifikat)
// ============================================================

export const recordCalibration = mutation({
  args: {
    deviceId: v.id("deviceRecords"),
    calibrationDate: v.number(),
    performedBy: v.optional(v.string()),
    result: resultArg,
    certFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.isArchived) throw new Error("Prüfmittel nicht gefunden");

    const nextDueDate = addMonths(args.calibrationDate, device.calibrationIntervalMonths);
    const now = Date.now();
    const calId = await ctx.db.insert("deviceCalibrations", {
      deviceId: args.deviceId,
      calibrationDate: args.calibrationDate,
      performedBy: args.performedBy?.trim() || undefined,
      result: args.result,
      nextDueDate,
      certFileId: args.certFileId,
      notes: args.notes?.trim() || undefined,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });

    // Gerät fortschreiben — nur wenn dies die jüngste Kalibrierung ist
    if (device.lastCalibrationDate === undefined || args.calibrationDate >= device.lastCalibrationDate) {
      await ctx.db.patch(args.deviceId, {
        lastCalibrationDate: args.calibrationDate,
        nextDueDate,
        certFileId: args.certFileId ?? device.certFileId,
        updatedAt: now, updatedBy: user._id,
      });
    }

    // Offene DEVICE_CALIBRATION_DUE-Aufgabe zu diesem Gerät schließen (erledigt)
    const openTasks = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", "deviceRecords").eq("resourceId", args.deviceId as string),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("type"), "DEVICE_CALIBRATION_DUE"),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED"),
        ),
      )
      .collect();
    for (const t of openTasks) {
      await ctx.db.patch(t._id, { status: "DONE", updatedAt: now });
    }

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "deviceCalibrations", entityId: calId,
      metadata: { deviceId: args.deviceId, result: args.result, nextDueDate },
    });
    return calId;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "devices:manage");
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================================
// checkCalibrationDue — Cron: Aufgabe für QMB, sobald ein aktives
// Gerät ins DUE/OVERDUE-Fenster läuft (nextDue − 30d). Dedup pro Gerät.
// ============================================================

export const checkCalibrationDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const devices = await ctx.db
      .query("deviceRecords")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const qmb = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "qmb"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();

    let created = 0;
    for (const device of devices) {
      if (device.nextDueDate === undefined) continue;
      const ampel = computeAmpel(device, now);
      if (ampel !== "DUE" && ampel !== "OVERDUE") continue;

      // Dedup: existiert bereits eine offene DUE-Aufgabe zu diesem Gerät?
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_resource", (q) =>
          q.eq("resourceType", "deviceRecords").eq("resourceId", device._id as string),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("isArchived"), false),
            q.eq(q.field("type"), "DEVICE_CALIBRATION_DUE"),
            q.neq(q.field("status"), "DONE"),
            q.neq(q.field("status"), "CANCELLED"),
          ),
        )
        .first();
      if (existing || !qmb) continue;

      await ctx.db.insert("tasks", {
        type: "DEVICE_CALIBRATION_DUE",
        title: `Kalibrierung ${ampel === "OVERDUE" ? "überfällig" : "fällig"}: ${device.name} (${device.inventoryNumber})`,
        description: `Das Prüfmittel „${device.name}" (Nr. ${device.inventoryNumber}) ist zur Kalibrierung fällig. Soll-Termin: ${new Date(device.nextDueDate).toLocaleDateString("de-DE")}. Bitte kalibrieren oder außer Dienst stellen.`,
        assigneeId: qmb._id,
        dueDate: device.nextDueDate,
        status: "OPEN",
        priority: ampel === "OVERDUE" ? "HIGH" : "MEDIUM",
        resourceType: "deviceRecords",
        resourceId: device._id as string,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
    return { created, checked: devices.length };
  },
});
