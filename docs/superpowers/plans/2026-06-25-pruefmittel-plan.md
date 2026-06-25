# Prüfmittel & Kalibrierung (§7.6) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Platzhalter-Modul „Prüfmittel" wird zur Lenkung von Überwachungs- und Messmitteln nach ISO 13485 §7.6 — Inventar, Kalibrierintervalle, Kalibrierhistorie mit Zertifikat-Upload, Fälligkeits-Ampel (±30-Tage-Toleranz wie FB 7.6.0 Rev. 3) und wöchentliche Fälligkeits-Aufgaben für die QMB.

**Architecture:** Strukturell der Zwilling des Konformitätserklärungs-Moduls (`convex/declarations.ts`): Inventar-Tabelle + Historie-Tabelle + Upload + Fälligkeits-Cron. Zwei Tabellen: `deviceRecords` (ein Prüfmittel; speichert nur den manuellen Lifecycle `status: ACTIVE|DECOMMISSIONED` + `nextDueDate`) und `deviceCalibrations` (Kalibrier-/Prüfhistorie je Gerät, je mit Zertifikat). Die Ampel (OK/DUE/OVERDUE/UNSCHEDULED) wird **abgeleitet** aus `nextDueDate` ± 30-Tage-Toleranz — nicht gespeichert, daher kein Drift; der Cron erzeugt nur Erinnerungs-Aufgaben. UI nach Hausmuster: Listenseite mit Ampel + Anlegen-Dialog, Detailseite mit Bearbeiten + „Kalibrierung erfassen" + Außerdienststellung + Zertifikat-Links. Plus eine kompakte Prüfmittel-Ampel-Karte auf dem Dashboard.

**Tech Stack:** Next.js 15 (App Router), Convex (Storage, Crons, internalMutation), Tailwind v4 + shadcn/ui.

**Verifikation:** Kein Test-Framework — Hauskonvention: `npx tsc --noEmit` (+ `npx convex dev --once` bei Convex-Tasks) und Commit pro Task; am Ende Browser-Walkthrough (Memory „Runtime-Verifikation Pflicht") inkl. manuellem Cron-Testlauf per `npx convex run`.

**Beschluss-Referenz:** Grill-me 2026-06-12, Punkt 7 (Memory `qm-backlog-beschluesse-2026-06`): „Inventar + Intervalle + Zertifikats-Upload + Fälligkeits-Erinnerung + Dashboard-Ampel (§7.6); Start ohne Datenimport." FB 7.6.0 Rev. 3 (Auditbericht 2026): KPI-Methodik mit Toleranz ±30 Tage zum Soll-Termin, eingezogene Geräte als „außer Dienst" markiert.

**Verifizierte Fakten (2026-06-25):**
- Platzhalter: `deviceRecords` + `deviceCalibrations` sind Stubs (`status: v.literal("PLACEHOLDER")`, schema.ts:1104/1111), Tabellen leer. Feature-Flag `DEVICES` existiert (admin/settings/page.tsx:59), Sidebar-Eintrag „Prüfmittel" mit Badge „IN PLANUNG" (sidebar.tsx:115). PlaceholderPage unter `app/(dashboard)/devices/page.tsx`.
- Vorlage `convex/declarations.ts`: `list/getById/create/update/archive`, `generateUploadUrl` (`return await ctx.storage.generateUploadUrl()`), `getFileUrl` (`ctx.storage.getUrl(fileId)`), `checkExpirations` internalMutation (Cron) erzeugt `tasks`-Einträge für die QMB via `users.by_role("qmb")`.
- Task-Typ-Union `taskType` in schema.ts:37–51 (Literale wie `AUDIT_PLAN_DUE`); muss um `DEVICE_CALIBRATION_DUE` erweitert werden.
- Cron-Registrierung in `convex/crons.ts` (tägliche Slots, `crons.daily(name, {hourUTC, minuteUTC}, internal.x.y)`).
- PermissionAction-Union endet in `lib/types/domain.ts` mit `| "admin:settings" | "admin:featureFlags"`; RBAC-Matrix in `convex/lib/permissions.ts` (admin = Wildcard).
- `dueDate`-Erinnerungs-Cron-Muster (Dedup über offene Task gleichen Typs + resourceId) in `convex/audits.ts checkPlanDue`.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `lib/types/enums.ts` | Modify | DEVICE_STATUSES, DEVICE_AMPEL, CALIBRATION_RESULTS, Labels, Toleranz-Konstante |
| `lib/types/domain.ts` + `convex/lib/permissions.ts` | Modify | `devices:list/manage` + RBAC |
| `convex/schema.ts` | Modify | deviceRecords (echt), deviceCalibrations (echt), taskType += DEVICE_CALIBRATION_DUE |
| `convex/devices.ts` | Create | CRUD, recordCalibration, list/getById/summary-Queries, Upload, checkCalibrationDue (Cron) |
| `convex/crons.ts` | Modify | täglicher Kalibrier-Fällig-Check |
| `components/domain/devices/device-form-dialog.tsx` | Create | Anlegen/Bearbeiten-Dialog |
| `components/domain/devices/calibration-dialog.tsx` | Create | „Kalibrierung erfassen" (mit Zertifikat-Upload) |
| `app/(dashboard)/devices/page.tsx` | Replace | Liste + Ampel + Filter + Summary + Anlegen |
| `app/(dashboard)/devices/[id]/page.tsx` | Create | Detail + Historie + Bearbeiten + Kalibrieren + Außerdienst |
| `components/domain/dashboard/devices-ampel-card.tsx` | Create | Dashboard-Karte Prüfmittel-Ampel |
| `app/(dashboard)/page.tsx` | Modify | Dashboard-Karte einhängen |
| `components/layout/sidebar.tsx` | Modify | Badge „IN PLANUNG" entfernen |

**Ausführungskontext:** Branch: `git checkout -b feature/pruefmittel` (vor Task 1). Convex-Push nach jedem Convex-Task: `npx convex dev --once`.

---

### Task 1: Enums + Permissions

**Files:**
- Modify: `lib/types/enums.ts` (ans Dateiende)
- Modify: `lib/types/domain.ts` (PermissionAction-Union)
- Modify: `convex/lib/permissions.ts` (RBAC-Matrix)

- [ ] **Step 1: Enums anfügen** — ans Ende von `lib/types/enums.ts`:

```ts
// ============================================================
// Prüfmittel & Kalibrierung (ISO 13485 §7.6, FB 7.6.0)
// ============================================================

// Manueller Lifecycle eines Prüfmittels (gespeichert)
export const DEVICE_STATUSES = ["ACTIVE", "DECOMMISSIONED"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: "Aktiv",
  DECOMMISSIONED: "Außer Dienst",
};

// Abgeleitete Kalibrier-Ampel (NICHT gespeichert — aus nextDueDate ± Toleranz)
export const DEVICE_AMPEL = ["OK", "DUE", "OVERDUE", "UNSCHEDULED", "DECOMMISSIONED"] as const;
export type DeviceAmpel = (typeof DEVICE_AMPEL)[number];
export const DEVICE_AMPEL_LABELS: Record<DeviceAmpel, string> = {
  OK: "Im Intervall",
  DUE: "Kalibrierung fällig",
  OVERDUE: "Überfällig",
  UNSCHEDULED: "Kein Intervall geplant",
  DECOMMISSIONED: "Außer Dienst",
};

// Ergebnis einer Kalibrierung/Prüfung
export const CALIBRATION_RESULTS = ["PASSED", "CONDITIONAL", "FAILED"] as const;
export type CalibrationResult = (typeof CALIBRATION_RESULTS)[number];
export const CALIBRATION_RESULT_LABELS: Record<CalibrationResult, string> = {
  PASSED: "Bestanden",
  CONDITIONAL: "Bedingt (mit Einschränkung)",
  FAILED: "Nicht bestanden",
};

// Toleranz ±30 Tage zum Soll-Termin (FB 7.6.0 Rev. 3). Warnfenster = 30 Tage vor Fälligkeit,
// als überfällig erst 30 Tage nach Soll-Termin.
export const CALIBRATION_TOLERANCE_MS = 30 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 2: PermissionAction erweitern** — in `lib/types/domain.ts` in der Union vor `| "admin:settings"` einfügen:

```ts
  | "devices:list" | "devices:manage"
```

- [ ] **Step 3: RBAC erweitern** — in `convex/lib/permissions.ts`:

In `qmb` (vor `"tasks:all",`):

```ts
    "devices:list", "devices:manage",
```

In `department_lead` (vor `"tasks:team",`) — Werkstattleitung pflegt die Prüfmittel:

```ts
    "devices:list", "devices:manage",
```

In `employee` (vor `"tasks:own",`) — Techniker sehen Fälligkeiten:

```ts
    "devices:list",
```

In `auditor` (vor `"tasks:own",`):

```ts
    "devices:list",
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add lib/types/enums.ts lib/types/domain.ts convex/lib/permissions.ts
git commit -m "feat(pruefmittel): Enums (Status/Ampel/Ergebnis, ±30d-Toleranz) + Permissions"
```

---

### Task 2: Schema — echte Tabellen + Task-Typ

**Files:**
- Modify: `convex/schema.ts` (taskType ~Zeile 37; deviceRecords/deviceCalibrations ~Zeile 1104)

- [ ] **Step 1: Task-Typ ergänzen** — in der `taskType`-Union (vor der schließenden `)` nach `"YEAR_CYCLE"`) — Achtung: nach `"YEAR_CYCLE"` ein Komma setzen:

```ts
  v.literal("YEAR_CYCLE"),             // Phase 7: Jahreswechsel-Erinnerungen
  v.literal("DEVICE_CALIBRATION_DUE")  // §7.6: Prüfmittel-Kalibrierung fällig/überfällig
```

- [ ] **Step 2: Platzhalter ersetzen** — die beiden Stub-Blöcke

```ts
  deviceRecords: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),

  // TODO: Phase 4 — Gerätekalibrierungen
  deviceCalibrations: defineTable({
    title: v.optional(v.string()),
    deviceId: v.optional(v.id("deviceRecords")),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),
```

ersetzen durch (Tabellen sind leer — verifiziert):

```ts
  // Prüfmittel/Messgerät (ISO 13485 §7.6, FB 7.6.0)
  deviceRecords: defineTable({
    inventoryNumber: v.string(),             // Prüfmittel-Nr.
    name: v.string(),                        // Bezeichnung
    manufacturer: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    location: v.optional(v.string()),        // Standort/Werkstatt
    responsible: v.optional(v.string()),     // Verantwortlich (Freitext)
    calibrationIntervalMonths: v.number(),   // Prüf-/Kalibrierintervall in Monaten
    lastCalibrationDate: v.optional(v.number()),
    nextDueDate: v.optional(v.number()),     // Soll-Termin nächste Kalibrierung
    status: v.union(v.literal("ACTIVE"), v.literal("DECOMMISSIONED")),
    certFileId: v.optional(v.id("_storage")),// jüngstes Zertifikat (Bequemlichkeit)
    notes: v.optional(v.string()),
    ...auditFields,
  })
    .index("by_status", ["status"])
    .index("by_nextDue", ["nextDueDate"]),

  // Kalibrier-/Prüfhistorie je Gerät
  deviceCalibrations: defineTable({
    deviceId: v.id("deviceRecords"),
    calibrationDate: v.number(),
    performedBy: v.optional(v.string()),     // Labor/Person
    result: v.union(v.literal("PASSED"), v.literal("CONDITIONAL"), v.literal("FAILED")),
    nextDueDate: v.number(),                 // berechnet: calibrationDate + Intervall
    certFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    ...auditFields,
  }).index("by_device", ["deviceId"]),
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(pruefmittel): Schema — deviceRecords/deviceCalibrations (echt) + Task-Typ DEVICE_CALIBRATION_DUE"
```

---

### Task 3: Convex — CRUD, Kalibrierung, Queries, Cron

**Files:**
- Create: `convex/devices.ts`
- Modify: `convex/crons.ts`

- [ ] **Step 1: Datei anlegen** — `convex/devices.ts`:

```ts
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
```

- [ ] **Step 2: Cron registrieren** — in `convex/crons.ts` vor `export default crons;`:

```ts
// §7.6: Prüfmittel-Kalibrierfälligkeit täglich prüfen
crons.daily(
  "check-calibration-due",
  { hourUTC: 4, minuteUTC: 45 },
  internal.devices.checkCalibrationDue,
);
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/devices.ts convex/crons.ts
git commit -m "feat(pruefmittel): Convex — CRUD, recordCalibration, Ampel-Queries, Upload, Fällig-Cron"
```

---

### Task 4: UI-Dialoge — Anlegen/Bearbeiten + Kalibrierung erfassen

**Files:**
- Create: `components/domain/devices/device-form-dialog.tsx`
- Create: `components/domain/devices/calibration-dialog.tsx`

- [ ] **Step 1: Geräte-Dialog anlegen** — `components/domain/devices/device-form-dialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Device = Doc<"deviceRecords">;

function toDateInput(ts: number | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : "";
}

export function DeviceFormDialog({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Device;
  onSaved?: (id: Id<"deviceRecords">) => void;
}) {
  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);

  const [form, setForm] = useState({
    inventoryNumber: "", name: "", manufacturer: "", serialNumber: "",
    location: "", responsible: "", calibrationIntervalMonths: "12", nextDueDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Beim Öffnen (Bearbeiten) befüllen
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        inventoryNumber: initial.inventoryNumber,
        name: initial.name,
        manufacturer: initial.manufacturer ?? "",
        serialNumber: initial.serialNumber ?? "",
        location: initial.location ?? "",
        responsible: initial.responsible ?? "",
        calibrationIntervalMonths: String(initial.calibrationIntervalMonths),
        nextDueDate: toDateInput(initial.nextDueDate),
        notes: initial.notes ?? "",
      });
    } else {
      setForm({
        inventoryNumber: "", name: "", manufacturer: "", serialNumber: "",
        location: "", responsible: "", calibrationIntervalMonths: "12", nextDueDate: "", notes: "",
      });
    }
  }, [open, initial]);

  async function handleSave() {
    if (saving) return;
    if (!form.inventoryNumber.trim()) { toast.error("Prüfmittel-Nr. ist erforderlich"); return; }
    if (!form.name.trim()) { toast.error("Bezeichnung ist erforderlich"); return; }
    const interval = Number(form.calibrationIntervalMonths);
    if (!Number.isFinite(interval) || interval <= 0) { toast.error("Intervall (Monate) muss größer 0 sein"); return; }
    setSaving(true);
    try {
      const payload = {
        inventoryNumber: form.inventoryNumber,
        name: form.name,
        manufacturer: form.manufacturer.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        location: form.location.trim() || undefined,
        responsible: form.responsible.trim() || undefined,
        calibrationIntervalMonths: interval,
        nextDueDate: form.nextDueDate ? new Date(form.nextDueDate).getTime() : undefined,
        notes: form.notes.trim() || undefined,
      };
      if (initial) {
        await updateDevice({ id: initial._id, ...payload });
        toast.success("Prüfmittel gespeichert");
        onSaved?.(initial._id);
      } else {
        const id = await createDevice(payload);
        toast.success("Prüfmittel angelegt");
        onSaved?.(id as Id<"deviceRecords">);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Prüfmittel bearbeiten" : "Prüfmittel anlegen"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="dev-inv">Prüfmittel-Nr. *</Label>
            <Input id="dev-inv" value={form.inventoryNumber}
              onChange={(e) => setForm({ ...form, inventoryNumber: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-name">Bezeichnung *</Label>
            <Input id="dev-name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-mfg">Hersteller</Label>
            <Input id="dev-mfg" value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-sn">Seriennummer</Label>
            <Input id="dev-sn" value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-loc">Standort</Label>
            <Input id="dev-loc" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-resp">Verantwortlich</Label>
            <Input id="dev-resp" value={form.responsible}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-interval">Intervall (Monate) *</Label>
            <Input id="dev-interval" type="number" min="1" value={form.calibrationIntervalMonths}
              onChange={(e) => setForm({ ...form, calibrationIntervalMonths: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-due">Nächster Soll-Termin</Label>
            <Input id="dev-due" type="date" value={form.nextDueDate}
              onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">Optional — wird bei erfasster Kalibrierung automatisch neu berechnet.</p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="dev-notes">Bemerkungen</Label>
            <Textarea id="dev-notes" rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Kalibrier-Dialog anlegen** — `components/domain/devices/calibration-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CALIBRATION_RESULTS, CALIBRATION_RESULT_LABELS, type CalibrationResult } from "@/lib/types/enums";
import { toast } from "sonner";

export function CalibrationDialog({
  open, onOpenChange, deviceId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deviceId: Id<"deviceRecords">;
  onSaved?: () => void;
}) {
  const recordCalibration = useMutation(api.devices.recordCalibration);
  const generateUploadUrl = useMutation(api.devices.generateUploadUrl);

  const [form, setForm] = useState({
    calibrationDate: new Date().toISOString().slice(0, 10),
    performedBy: "",
    result: "PASSED" as CalibrationResult,
    notes: "",
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    if (!form.calibrationDate) { toast.error("Kalibrierdatum ist erforderlich"); return; }
    setSaving(true);
    try {
      let certFileId: Id<"_storage"> | undefined;
      if (certFile) {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": certFile.type || "application/octet-stream" },
          body: certFile,
        });
        if (!res.ok) throw new Error("Zertifikat-Upload fehlgeschlagen");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        certFileId = storageId;
      }
      await recordCalibration({
        deviceId,
        calibrationDate: new Date(form.calibrationDate).getTime(),
        performedBy: form.performedBy.trim() || undefined,
        result: form.result,
        certFileId,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Kalibrierung erfasst");
      setCertFile(null);
      setForm({ calibrationDate: new Date().toISOString().slice(0, 10), performedBy: "", result: "PASSED", notes: "" });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Kalibrierung erfassen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cal-date">Kalibrierdatum *</Label>
            <Input id="cal-date" type="date" value={form.calibrationDate}
              onChange={(e) => setForm({ ...form, calibrationDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cal-by">Durchgeführt von (Labor/Person)</Label>
            <Input id="cal-by" value={form.performedBy}
              onChange={(e) => setForm({ ...form, performedBy: e.target.value })} />
          </div>
          <div>
            <Label>Ergebnis *</Label>
            <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as CalibrationResult })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CALIBRATION_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{CALIBRATION_RESULT_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cal-cert">Kalibrierzertifikat (PDF/Bild)</Label>
            <Input id="cal-cert" type="file" accept="application/pdf,image/*"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label htmlFor="cal-notes">Bemerkungen</Label>
            <Textarea id="cal-notes" rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Der nächste Soll-Termin wird automatisch als Kalibrierdatum + Intervall gesetzt.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add components/domain/devices/
git commit -m "feat(pruefmittel): Dialoge — Gerät anlegen/bearbeiten + Kalibrierung erfassen (mit Zertifikat-Upload)"
```

---

### Task 5: Listenseite mit Ampel + Filter + Summary

**Files:**
- Replace: `app/(dashboard)/devices/page.tsx`

- [ ] **Step 1: Seite ersetzen** — `app/(dashboard)/devices/page.tsx` komplett:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  DEVICE_AMPEL_LABELS, DEVICE_STATUS_LABELS,
  type DeviceAmpel, type DeviceStatus,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { DeviceFormDialog } from "@/components/domain/devices/device-form-dialog";
import { Plus } from "lucide-react";

interface DeviceRow {
  _id: string;
  inventoryNumber: string;
  name: string;
  location?: string;
  responsible?: string;
  calibrationIntervalMonths: number;
  lastCalibrationDate?: number;
  nextDueDate?: number;
  status: DeviceStatus;
  ampel: DeviceAmpel;
}

const AMPEL_BADGE: Record<DeviceAmpel, string> = {
  OK: "bg-green-100 text-green-800",
  DUE: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  UNSCHEDULED: "bg-blue-100 text-blue-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-600",
};

export default function DevicesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const devices = useQuery(api.devices.list, {});
  const summary = useQuery(api.devices.summary, {});

  const [createOpen, setCreateOpen] = useState(false);
  const [filterAmpel, setFilterAmpel] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = ((devices ?? []) as DeviceRow[]).filter((d) => {
    if (filterAmpel !== "ALL" && d.ampel !== filterAmpel) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${d.inventoryNumber} ${d.name} ${d.location ?? ""} ${d.responsible ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const columns: Column<DeviceRow>[] = [
    { key: "inv", header: "Prüfmittel-Nr.", cell: (r) => <span className="font-mono text-sm">{r.inventoryNumber}</span> },
    { key: "name", header: "Bezeichnung", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "location", header: "Standort", cell: (r) => r.location ?? "—" },
    { key: "interval", header: "Intervall", cell: (r) => `${r.calibrationIntervalMonths} Mon.` },
    { key: "last", header: "Letzte Kal.", cell: (r) => (r.lastCalibrationDate ? formatDate(r.lastCalibrationDate) : "—") },
    { key: "next", header: "Soll-Termin", cell: (r) => (r.nextDueDate ? formatDate(r.nextDueDate) : "—") },
    {
      key: "ampel", header: "Status",
      cell: (r) => (
        <Badge className={AMPEL_BADGE[r.ampel]} variant="secondary">
          {DEVICE_AMPEL_LABELS[r.ampel]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prüfmittel"
        description="Lenkung von Überwachungs- und Messmitteln (ISO 13485 §7.6, FB 7.6.0) — Kalibrierintervalle & Fälligkeiten"
        actions={
          can("devices:manage") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Prüfmittel anlegen
            </Button>
          ) : undefined
        }
      />

      {/* Ampel-Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-red-50 p-3">
            <p className="text-2xl font-semibold text-red-800">{summary.overdue}</p>
            <p className="text-xs text-red-700">überfällig</p>
          </div>
          <div className="rounded-md border bg-amber-50 p-3">
            <p className="text-2xl font-semibold text-amber-800">{summary.due}</p>
            <p className="text-xs text-amber-700">fällig (±30 Tage)</p>
          </div>
          <div className="rounded-md border bg-green-50 p-3">
            <p className="text-2xl font-semibold text-green-800">{summary.ok}</p>
            <p className="text-xs text-green-700">im Intervall</p>
          </div>
          <div className="rounded-md border bg-muted p-3">
            <p className="text-2xl font-semibold">{summary.unscheduled + summary.decommissioned}</p>
            <p className="text-xs text-muted-foreground">ungeplant / außer Dienst</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterAmpel} onValueChange={setFilterAmpel}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            {(Object.keys(DEVICE_AMPEL_LABELS) as DeviceAmpel[]).map((a) => (
              <SelectItem key={a} value={a}>{DEVICE_AMPEL_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="w-[240px]" placeholder="Suchen (Nr., Bezeichnung, Standort…)"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/devices/${r._id}`)}
        emptyMessage="Noch keine Prüfmittel erfasst"
      />

      <DeviceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => router.push(`/devices/${id}`)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/devices/page.tsx"
git commit -m "feat(pruefmittel): Listenseite — Ampel-Spalte, Status-Filter, Suche, Summary-Kacheln, Anlegen"
```

---

### Task 6: Detailseite — Historie + Kalibrieren + Bearbeiten + Außerdienst

**Files:**
- Create: `app/(dashboard)/devices/[id]/page.tsx`

- [ ] **Step 1: Detailseite anlegen** — `app/(dashboard)/devices/[id]/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  DEVICE_AMPEL_LABELS, DEVICE_STATUS_LABELS, CALIBRATION_RESULT_LABELS,
  type DeviceAmpel, type CalibrationResult,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { DeviceFormDialog } from "@/components/domain/devices/device-form-dialog";
import { CalibrationDialog } from "@/components/domain/devices/calibration-dialog";
import { toast } from "sonner";

const AMPEL_BADGE: Record<DeviceAmpel, string> = {
  OK: "bg-green-100 text-green-800",
  DUE: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  UNSCHEDULED: "bg-blue-100 text-blue-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-600",
};

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line">{value || "—"}</span>
    </div>
  );
}

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const deviceId = params.id as Id<"deviceRecords">;
  const router = useRouter();
  const { can } = usePermissions();
  const device = useQuery(api.devices.getById, { id: deviceId });
  const setStatus = useMutation(api.devices.setStatus);
  const archive = useMutation(api.devices.archive);

  const [editOpen, setEditOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (device === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (device === null) return <div className="p-8">Prüfmittel nicht gefunden.</div>;

  const canManage = can("devices:manage");
  const ampel = device.ampel as DeviceAmpel;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${device.name}`}
        description={`Prüfmittel-Nr. ${device.inventoryNumber} · ${DEVICE_STATUS_LABELS[device.status]}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={AMPEL_BADGE[ampel]} variant="secondary">{DEVICE_AMPEL_LABELS[ampel]}</Badge>
            {canManage && (
              <>
                <Button onClick={() => setCalOpen(true)}>Kalibrierung erfassen</Button>
                <Button variant="outline" onClick={() => setEditOpen(true)}>Bearbeiten</Button>
                {device.status === "ACTIVE" ? (
                  <Button variant="outline"
                    onClick={async () => {
                      try { await setStatus({ id: deviceId, status: "DECOMMISSIONED" }); toast.success("Außer Dienst gestellt"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                    }}>
                    Außer Dienst
                  </Button>
                ) : (
                  <Button variant="outline"
                    onClick={async () => {
                      try { await setStatus({ id: deviceId, status: "ACTIVE" }); toast.success("Wieder in Dienst"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                    }}>
                    Wieder in Dienst
                  </Button>
                )}
                <Button variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setArchiveOpen(true)}>
                  Archivieren
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Stammdaten</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Prüfmittel-Nr." value={device.inventoryNumber} />
          <Row label="Bezeichnung" value={device.name} />
          <Row label="Hersteller" value={device.manufacturer} />
          <Row label="Seriennummer" value={device.serialNumber} />
          <Row label="Standort" value={device.location} />
          <Row label="Verantwortlich" value={device.responsible} />
          <Row label="Intervall" value={`${device.calibrationIntervalMonths} Monate`} />
          <Row label="Letzte Kalibrierung" value={device.lastCalibrationDate ? formatDate(device.lastCalibrationDate) : undefined} />
          <Row label="Nächster Soll-Termin" value={device.nextDueDate ? formatDate(device.nextDueDate) : undefined} />
          <Row label="Bemerkungen" value={device.notes} />
          {device.certUrl && (
            <div className="pt-1">
              <Button variant="outline" size="sm" asChild>
                <a href={device.certUrl} target="_blank" rel="noopener noreferrer">Jüngstes Zertifikat</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kalibrierhistorie ({device.history.length})</CardTitle></CardHeader>
        <CardContent>
          {device.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Kalibrierung erfasst.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Durchgeführt von</TableHead>
                  <TableHead>Nächster Soll-Termin</TableHead>
                  <TableHead>Zertifikat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(device.history as Array<{
                  _id: string; calibrationDate: number; result: CalibrationResult;
                  performedBy?: string; nextDueDate: number; notes?: string; certUrl: string | null;
                }>).map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>{formatDate(c.calibrationDate)}</TableCell>
                    <TableCell>{CALIBRATION_RESULT_LABELS[c.result]}</TableCell>
                    <TableCell className="text-muted-foreground">{c.performedBy ?? "—"}</TableCell>
                    <TableCell>{formatDate(c.nextDueDate)}</TableCell>
                    <TableCell>
                      {c.certUrl ? (
                        <a href={c.certUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">öffnen</a>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeviceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={device as unknown as Doc<"deviceRecords">}
      />
      <CalibrationDialog open={calOpen} onOpenChange={setCalOpen} deviceId={deviceId} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfmittel archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              „{device.name}" (Nr. {device.inventoryNumber}) verschwindet aus Liste und Ampel.
              Die Kalibrierhistorie bleibt in der Datenbank erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await archive({ id: deviceId });
                toast.success("Prüfmittel archiviert");
                router.push("/devices");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler beim Archivieren");
              } finally {
                setArchiveOpen(false);
              }
            }}>Archivieren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/devices/[id]/page.tsx"
git commit -m "feat(pruefmittel): Detailseite — Stammdaten, Kalibrierhistorie, Kalibrieren/Bearbeiten/Außerdienst/Archivieren"
```

---

### Task 7: Dashboard-Ampel-Karte + Sidebar-Badge

**Files:**
- Create: `components/domain/dashboard/devices-ampel-card.tsx`
- Modify: `app/(dashboard)/page.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Dashboard-Karte anlegen** — `components/domain/dashboard/devices-ampel-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/hooks/usePermissions";

/** Kompakte §7.6-Prüfmittel-Ampel fürs Dashboard. Rendert nichts ohne devices:list. */
export function DevicesAmpelCard() {
  const { can } = usePermissions();
  const summary = useQuery(api.devices.summary, can("devices:list") ? {} : "skip");

  if (!can("devices:list") || !summary) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          <Link href="/devices" className="hover:underline">Prüfmittel (§7.6)</Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-2xl font-semibold text-red-700">{summary.overdue}</p>
            <p className="text-xs text-muted-foreground">überfällig</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-700">{summary.due}</p>
            <p className="text-xs text-muted-foreground">fällig</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-green-700">{summary.ok}</p>
            <p className="text-xs text-muted-foreground">im Intervall</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Karte ins Dashboard einhängen** — in `app/(dashboard)/page.tsx`: den Import ergänzen

```tsx
import { DevicesAmpelCard } from "@/components/domain/dashboard/devices-ampel-card";
```

und die Karte in einer bestehenden Karten-/Grid-Sektion rendern. Lies die Datei zuerst und platziere `<DevicesAmpelCard />` neben den anderen Übersichts-Karten (z. B. direkt nach dem KPI-/Status-Grid). Falls die Seite ein Grid wie `<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">…</div>` für Widgets nutzt, dort als weiteres Kind einfügen; sonst als eigenständige Karte in den vertikalen Fluss (`space-y-*`) vor den Listen-Widgets.

- [ ] **Step 3: Sidebar-Badge entfernen** — in `components/layout/sidebar.tsx` den Prüfmittel-Eintrag ändern von:

```tsx
      { label: "Prüfmittel", href: "/devices", icon: Wrench, featureFlag: "DEVICES", badge: "IN PLANUNG" },
```

zu:

```tsx
      { label: "Prüfmittel", href: "/devices", icon: Wrench, featureFlag: "DEVICES", permission: "devices:list" },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add components/domain/dashboard/devices-ampel-card.tsx "app/(dashboard)/page.tsx" components/layout/sidebar.tsx
git commit -m "feat(pruefmittel): Dashboard-Ampel-Karte + Sidebar live (Badge entfernt)"
```

---

### Task 8: Runtime-Verifikation (Pflicht)

**Files:** keine Code-Änderungen (nur Fixes aus dem Walkthrough)

- [ ] **Step 1: Dev-Server frisch starten** (Stale-Server-Memory beachten: alten Prozess beenden, `.next/dev/lock` entfernen)

- [ ] **Step 2: Anlegen + Ampel-Logik prüfen**

1. Sidebar: „Prüfmittel" ohne Badge → Seite lädt, leere Liste, Summary alle 0.
2. „Prüfmittel anlegen": Nr. „PM-001", Bezeichnung „Messschieber", Intervall 12, **Soll-Termin auf gestern** setzen → speichern → Detailseite. Ampel = „Überfällig" (gestern + 0…, now > nextDue + 30d? Nein — gestern liegt im ±30d-Fenster) → **erwartet „Kalibrierung fällig" (DUE)**, da gestern innerhalb −30…+30 Tage. Zur OVERDUE-Prüfung: ein zweites Gerät „PM-002" mit Soll-Termin vor 40 Tagen → Ampel „Überfällig".
3. Drittes Gerät „PM-003" ohne Soll-Termin → Ampel „Kein Intervall geplant"; Summary zeigt 1 fällig / 1 überfällig / 0 im Intervall / 1 ungeplant.

- [ ] **Step 3: Kalibrierung + Folgewirkung prüfen**

4. PM-002 (überfällig) → „Kalibrierung erfassen": heutiges Datum, Ergebnis „Bestanden", eine Test-PDF/Bild als Zertifikat hochladen → speichern.
5. Detailseite: Historie hat 1 Eintrag mit Zertifikat-Link (öffnet); „Letzte Kalibrierung" = heute, „Nächster Soll-Termin" = heute + 12 Monate; Ampel jetzt „Im Intervall" (grün); „Jüngstes Zertifikat" oben sichtbar.
6. Liste: PM-002 grün; Summary aktualisiert.
7. „Außer Dienst" bei PM-003 → Ampel „Außer Dienst" (grau); „Wieder in Dienst" kehrt zurück.

- [ ] **Step 4: Cron + Dashboard prüfen**

8. Cron-Testlauf:

```bash
npx convex run devices:checkCalibrationDue
```

Expected: `{ created: N, checked: M }` — für PM-001 (DUE) wird eine `DEVICE_CALIBRATION_DUE`-Aufgabe für die QMB erzeugt; PM-002 (jetzt OK) und außer-Dienst/ungeplante Geräte erzeugen keine. Zweiter Lauf → `created: 0` (Dedup). Prüfen: `npx convex data tasks | grep DEVICE_CALIBRATION_DUE`. Danach: bei PM-001 eine Kalibrierung erfassen → die offene Aufgabe wird auf DONE gesetzt (recordCalibration schließt sie).
9. Dashboard (`/`): Prüfmittel-Karte zeigt die Ampel-Zahlen, Klick führt auf `/devices`.
10. Konsole ohne Fehler.

- [ ] **Step 5: Aufräumen + Befunde fixen + Commit**

Test-Geräte (PM-001…003) über die Detailseite archivieren; die erzeugte Test-Aufgabe bleibt (historisch, harmlos) oder über `tasks`-Archivierung entfernen, falls vorhanden.

```bash
git add -A
git commit -m "fix(pruefmittel): Findings aus Runtime-Walkthrough"
```

(Entfällt, wenn der Walkthrough sauber durchläuft.)

---

## Bewusst NICHT in diesem Plan

- **KPI-Engine FB 7.6.0 Rev. 3** (KPI A Pro-rata-Erfüllungsgrad rolling 12 Monate ≥95 %, KPI B Anteil überfälliger Prüfungen am Stichtag ≤5 %, über zwei Quartale) — die ±30-Tage-Toleranz ist umgesetzt, die quartalsweise KPI-Auswertung ist spätere Ausbaustufe (analog Beschluss „KPI-Auswertungen spätere Ausbaustufe" beim Berichts-Modul).
- **PDF-Export Prüfgerätekartei** — das hochgeladene Zertifikat IST der Nachweis; eine gedruckte Kartei ist nicht beschlossen.
- **Datenimport** — Beschluss: „Start ohne Datenimport". Bestand wird manuell in der UI angelegt.
- **Berichtsarchiv** — eigener Plan (Beschluss-Punkt 8).
