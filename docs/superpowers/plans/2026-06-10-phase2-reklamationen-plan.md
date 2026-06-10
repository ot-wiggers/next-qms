# Phase 2: Reklamationen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reklamationen als manuelles QMS-Register mit Vigilanz-Frist-Tracking (MDR Art. 87), Bewertungs-Gate und CAPA-Verknüpfung — ersetzt den Phase-4-Platzhalter.

**Architecture:** Gleiche Muster wie Phase 1 (Audit/CAPA, gemergt in af2d436): Jahres-Nummernkreis `REK-{Jahr}-{NN}`, `requirePermission` → `validateTransition` → `logAuditEvent`, Soft-Delete, Status-Workflow EINGEGANGEN → IN_PRÜFUNG → IN_BEARBEITUNG → ABGESCHLOSSEN. Vigilanz-Frist wird serverseitig berechnet (Eingang + 15 Tage, überschreibbar), UI zeigt Überfälligkeit. `capas.createFromComplaint` analog `createFromFinding`. `otwinRef` als Abgleichschlüssel für die spätere Sybase-SQL-Anywhere-Anbindung.

**Tech Stack:** Next.js App Router, Convex, shadcn/ui (DataTable, PageHeader mit `actions`-Prop), sonner, formatDate.

**Verifikation:** `npx tsc --noEmit` + `npm run lint` je Task, `npm run build` am Ende. Kein Convex-Push/Browser-Test in der Implementierungs-Session (Nutzer-Schritt, siehe Phase-1-Übergabe). `convex/_generated/api.d.ts` von Hand nachziehen (Muster: Commit dc09c77).

**Lektionen aus Phase 1 (gelten als Spec):** keine Zod-Validatoren auf Vorrat (waren toter Code); Notification-Deep-Links (`NotificationItem.tsx` + `convex/email.ts`) sofort mitliefern; Sidebar-Eintrag braucht `permission`-Prop; trim-Guards serverseitig; idempotente Status-Flips; typed `Partial<Doc<…>>`-Patches.

---

### Task 1: Enums, Permission-Typen, RBAC-Matrix

**Files:**
- Modify: `lib/types/enums.ts` (am Ende anfügen)
- Modify: `lib/types/domain.ts` (PermissionAction)
- Modify: `convex/lib/permissions.ts` (ROLE_PERMISSIONS)

- [ ] **Step 1: Enums anfügen** — `lib/types/enums.ts`:

```ts
// ============================================================
// Reklamationen (ISO 13485 Kap. 8.2.2, MDR Art. 87) — Phase 2
// ============================================================
export const COMPLAINT_STATUSES = [
  "RECEIVED", "IN_REVIEW", "IN_PROGRESS", "CLOSED",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  RECEIVED: "Eingegangen",
  IN_REVIEW: "In Prüfung",
  IN_PROGRESS: "In Bearbeitung",
  CLOSED: "Abgeschlossen",
};

export const COMPLAINT_ASSESSMENTS = ["JUSTIFIED", "UNJUSTIFIED", "GOODWILL"] as const;
export type ComplaintAssessment = (typeof COMPLAINT_ASSESSMENTS)[number];
export const COMPLAINT_ASSESSMENT_LABELS: Record<ComplaintAssessment, string> = {
  JUSTIFIED: "Berechtigt",
  UNJUSTIFIED: "Unberechtigt",
  GOODWILL: "Kulanz",
};

// MDR Art. 87: Standard-Meldefrist 15 Tage; 2/10 Tage bei schweren Fällen (Frist überschreibbar)
export const VIGILANCE_DEFAULT_DEADLINE_DAYS = 15;
```

- [ ] **Step 2: PermissionAction erweitern** — `lib/types/domain.ts`, vor `| "admin:settings"`:

```ts
  | "complaints:list" | "complaints:create" | "complaints:manage" | "complaints:close"
```

- [ ] **Step 3: RBAC-Matrix** — `convex/lib/permissions.ts`:
  - `qmb`: `"complaints:list", "complaints:create", "complaints:manage", "complaints:close",`
  - `department_lead`: `"complaints:list", "complaints:create", "complaints:manage",`
  - `employee`: `"complaints:list", "complaints:create",` (Verkäufer/Werkstatt erfassen Reklamationen)
  - `auditor`: `"complaints:list",`
  - Platzierung jeweils nach den capa-/audits-Einträgen.

- [ ] **Step 4: Typecheck + Commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add lib/types/enums.ts lib/types/domain.ts convex/lib/permissions.ts
git commit -m "feat(complaints): Enums, Permission-Typen und RBAC für Phase 2"
```

---

### Task 2: Schema + State-Machine

**Files:**
- Modify: `convex/schema.ts` (Platzhalter `complaints` ersetzen; Status-Union ergänzen)
- Modify: `convex/lib/stateMachine.ts`

- [ ] **Step 1: Status-Union** — bei den anderen Enum-Unions:

```ts
const complaintStatus = v.union(
  v.literal("RECEIVED"), v.literal("IN_REVIEW"),
  v.literal("IN_PROGRESS"), v.literal("CLOSED")
);
const complaintAssessment = v.union(
  v.literal("JUSTIFIED"), v.literal("UNJUSTIFIED"), v.literal("GOODWILL")
);
```

- [ ] **Step 2: Platzhalter ersetzen** — den `complaints`-PLACEHOLDER-Block löschen und im Phase-1-Abschnitt (nach `capaMeasures`) einfügen:

```ts
  // ============================================================
  // PHASE 2 (QM-Jahreszyklus): Reklamationen (8.2.2, MDR Art. 87)
  // ============================================================
  complaints: defineTable({
    complaintNumber: v.string(),         // "REK-2026-01"
    year: v.number(),
    seq: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    receivedAt: v.number(),              // Eingangsdatum
    receivedVia: v.optional(v.string()), // Filiale, Telefon, E-Mail …
    customerName: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    productText: v.optional(v.string()), // Freitext, wenn Produkt nicht im Stamm
    failureCategory: v.optional(v.string()), // Fehlerart (vgl. OTWin-Fehlerbücher)
    assessment: v.optional(complaintAssessment), // Pflicht vor Abschluss
    assessmentNote: v.optional(v.string()),
    correctionNote: v.optional(v.string()),  // Sofortkorrektur
    isVigilanceRelevant: v.boolean(),
    vigilanceDeadline: v.optional(v.number()),     // berechnet: receivedAt + 15 Tage (überschreibbar)
    vigilanceReportedAt: v.optional(v.number()),
    vigilanceReportReference: v.optional(v.string()),
    vigilanceReportChannel: v.optional(v.string()), // BfArM-Portal, Hersteller …
    capaId: v.optional(v.id("capas")),   // autoritative Verknüpfung; capas.sourceId = Anzeige-Provenienz
    assigneeId: v.optional(v.id("users")),
    otwinRef: v.optional(v.string()),    // Abgleichschlüssel für spätere Sybase-Anbindung
    status: complaintStatus,
    closedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_year", ["year"])
    .index("by_status", ["status"])
    .index("by_number", ["complaintNumber"])
    .index("by_product", ["productId"]),
```

- [ ] **Step 3: State-Machine** — `convex/lib/stateMachine.ts`, nach `capaStatus`:

```ts
  complaintStatus: {
    RECEIVED: ["IN_REVIEW"],
    IN_REVIEW: ["IN_PROGRESS", "CLOSED"],   // unberechtigt → direkt abschließbar
    IN_PROGRESS: ["CLOSED"],
    CLOSED: [],
  },
```

- [ ] **Step 4: Typecheck + Commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add convex/schema.ts convex/lib/stateMachine.ts
git commit -m "feat(complaints): Schema ersetzt Platzhalter, State-Machine"
```

---

### Task 3: Convex-Modul Reklamationen + CAPA-Quelle + Deep-Links

**Files:**
- Create: `convex/complaints.ts`
- Modify: `convex/capas.ts` (`createFromComplaint` ergänzen)
- Modify: `components/notifications/NotificationItem.tsx` + `convex/email.ts` (Deep-Link-Cases `"complaints"` → `/complaints`)
- Modify: `convex/_generated/api.d.ts` (Modul-Eintrag `complaints`, Muster dc09c77)

- [ ] **Step 1: `convex/complaints.ts` anlegen**

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";
import { createNotification } from "./lib/notificationHelpers";

const assessmentArg = v.union(
  v.literal("JUSTIFIED"), v.literal("UNJUSTIFIED"), v.literal("GOODWILL")
);
const VIGILANCE_DEFAULT_DEADLINE_MS = 15 * 24 * 60 * 60 * 1000; // MDR Art. 87: 15 Tage Standard

/** Nächste Reklamationsnummer im Jahres-Nummernkreis (REK-2026-01) */
async function nextComplaintNumber(ctx: MutationCtx, year: number) {
  const existing = await ctx.db
    .query("complaints")
    .withIndex("by_year", (q) => q.eq("year", year))
    .collect();
  const seq = existing.length === 0 ? 1 : Math.max(...existing.map((c) => c.seq)) + 1;
  return { seq, complaintNumber: `REK-${year}-${String(seq).padStart(2, "0")}` };
}

/** Reklamationen auflisten (optional nach Status/Jahr) */
export const list = query({
  args: { status: v.optional(v.string()), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "complaints:list");
    let results = await ctx.db
      .query("complaints")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (args.status) results = results.filter((c) => c.status === args.status);
    if (args.year !== undefined) results = results.filter((c) => c.year === args.year);
    return results.sort((a, b) => b.year - a.year || b.seq - a.seq);
  },
});

/** Reklamation inkl. Produkt- und CAPA-Bezug */
export const getById = query({
  args: { id: v.id("complaints") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "complaints:list");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) return null;
    const product = complaint.productId ? await ctx.db.get(complaint.productId) : null;
    const capa = complaint.capaId ? await ctx.db.get(complaint.capaId) : null;
    const assignee = complaint.assigneeId ? await ctx.db.get(complaint.assigneeId) : null;
    return {
      ...complaint,
      productName: product?.name ?? null,
      capaNumber: capa?.capaNumber ?? null,
      assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
    };
  },
});

/** Reklamation erfassen */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    receivedAt: v.number(),
    receivedVia: v.optional(v.string()),
    customerName: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    productText: v.optional(v.string()),
    failureCategory: v.optional(v.string()),
    otwinRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:create");
    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");
    if (args.receivedAt > Date.now()) throw new Error("Eingangsdatum liegt in der Zukunft");
    // UTC-Jahresgrenze bewusst akzeptiert (Convex läuft UTC)
    const year = new Date(args.receivedAt).getFullYear();
    const { seq, complaintNumber } = await nextComplaintNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("complaints", {
      ...args,
      title,
      description: args.description?.trim() || undefined,
      customerName: args.customerName?.trim() || undefined,
      productText: args.productText?.trim() || undefined,
      complaintNumber, year, seq,
      isVigilanceRelevant: false,
      status: "RECEIVED",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "complaints", entityId: id,
      metadata: { complaintNumber },
    });
    return id;
  },
});

/** Felder ändern (vor Abschluss) */
export const update = mutation({
  args: {
    id: v.id("complaints"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    receivedVia: v.optional(v.string()),
    customerName: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    productText: v.optional(v.string()),
    failureCategory: v.optional(v.string()),
    correctionNote: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    otwinRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (complaint.status === "CLOSED") {
      throw new Error("Abgeschlossene Reklamationen können nicht geändert werden");
    }
    const patch: Partial<Doc<"complaints">> = {
      updatedAt: Date.now(), updatedBy: user._id,
    };
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Titel ist erforderlich");
      patch.title = title;
    }
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.receivedVia !== undefined) patch.receivedVia = args.receivedVia.trim() || undefined;
    if (args.customerName !== undefined) patch.customerName = args.customerName.trim() || undefined;
    if (args.productText !== undefined) patch.productText = args.productText.trim() || undefined;
    if (args.failureCategory !== undefined) patch.failureCategory = args.failureCategory.trim() || undefined;
    if (args.correctionNote !== undefined) patch.correctionNote = args.correctionNote.trim() || undefined;
    if (args.otwinRef !== undefined) patch.otwinRef = args.otwinRef.trim() || undefined;
    if (args.productId !== undefined) patch.productId = args.productId;
    if (args.assigneeId !== undefined) patch.assigneeId = args.assigneeId;
    await ctx.db.patch(args.id, patch);
    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "complaints", entityId: args.id, changes,
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "COMPLAINT_ASSIGNED",
        title: `Reklamation zugewiesen: ${complaint.complaintNumber}`,
        message: complaint.title,
        resourceType: "complaints",
        resourceId: args.id,
      });
    }
  },
});

/** Bewertung dokumentieren (Pflicht vor Abschluss) + Vigilanz-Einstufung */
export const assess = mutation({
  args: {
    id: v.id("complaints"),
    assessment: assessmentArg,
    assessmentNote: v.optional(v.string()),
    isVigilanceRelevant: v.boolean(),
    vigilanceDeadline: v.optional(v.number()), // Override für 2-/10-Tage-Fälle
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (complaint.status === "CLOSED") {
      throw new Error("Abgeschlossene Reklamationen können nicht geändert werden");
    }
    const patch: Partial<Doc<"complaints">> = {
      assessment: args.assessment,
      assessmentNote: args.assessmentNote?.trim() || undefined,
      isVigilanceRelevant: args.isVigilanceRelevant,
      updatedAt: Date.now(), updatedBy: user._id,
    };
    if (args.isVigilanceRelevant) {
      patch.vigilanceDeadline =
        args.vigilanceDeadline ?? complaint.receivedAt + VIGILANCE_DEFAULT_DEADLINE_MS;
    } else {
      patch.vigilanceDeadline = undefined;
    }
    await ctx.db.patch(args.id, patch);
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "complaints", entityId: args.id,
      changes: {
        assessment: args.assessment,
        isVigilanceRelevant: args.isVigilanceRelevant,
        vigilanceDeadline: patch.vigilanceDeadline,
      },
    });
  },
});

/** Vigilanz-Meldung dokumentieren */
export const recordVigilanceReport = mutation({
  args: {
    id: v.id("complaints"),
    vigilanceReportedAt: v.number(),
    vigilanceReportReference: v.optional(v.string()),
    vigilanceReportChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (!complaint.isVigilanceRelevant) {
      throw new Error("Reklamation ist nicht als vigilanzrelevant eingestuft");
    }
    await ctx.db.patch(args.id, {
      vigilanceReportedAt: args.vigilanceReportedAt,
      vigilanceReportReference: args.vigilanceReportReference?.trim() || undefined,
      vigilanceReportChannel: args.vigilanceReportChannel?.trim() || undefined,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "complaints", entityId: args.id,
      changes: { vigilanceReportedAt: args.vigilanceReportedAt },
    });
  },
});

/** Statuswechsel — Abschluss nur mit dokumentierter Bewertung; Vigilanz-Meldung muss vor Abschluss erfasst sein */
export const setStatus = mutation({
  args: { id: v.id("complaints"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx, args.status === "CLOSED" ? "complaints:close" : "complaints:manage"
    );
    const complaint = await ctx.db.get(args.id);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    validateTransition("complaintStatus", complaint.status, args.status);
    if (args.status === "CLOSED") {
      if (!complaint.assessment) {
        throw new Error("Abschluss nur mit dokumentierter Bewertung (berechtigt/unberechtigt/Kulanz)");
      }
      if (complaint.isVigilanceRelevant && !complaint.vigilanceReportedAt) {
        throw new Error("Vigilanzrelevante Reklamationen erst nach dokumentierter Meldung abschließbar");
      }
    }
    const now = Date.now();
    const patch: Partial<Doc<"complaints">> = {
      // validateTransition hat den Wert geprüft
      status: args.status as Doc<"complaints">["status"],
      closedAt: args.status === "CLOSED" ? now : complaint.closedAt,
      updatedAt: now, updatedBy: user._id,
    };
    await ctx.db.patch(args.id, patch);
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "complaints", entityId: args.id,
      previousStatus: complaint.status, newStatus: args.status,
    });
  },
});

/** Reklamation archivieren (Soft-Delete) */
export const archive = mutation({
  args: { id: v.id("complaints") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "complaints:manage");
    await archiveRecord(ctx, "complaints", args.id, user._id);
  },
});
```

- [ ] **Step 2: `capas.createFromComplaint`** — in `convex/capas.ts` nach `createFromFinding` einfügen (gleiche Muster: Guards, Nummernkreis, Back-Link, Notification):

```ts
/** Halbautomatik: vorausgefüllte CAPA aus einer Reklamation erzeugen */
export const createFromComplaint = mutation({
  args: {
    complaintId: v.id("complaints"),
    capaType: capaTypeArg,
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:create");
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new Error("Reklamation nicht gefunden");
    if (complaint.isArchived) throw new Error("Reklamation ist archiviert");
    if (complaint.capaId) {
      const linked = await ctx.db.get(complaint.capaId);
      // Ersatz-CAPA nur erlaubt, wenn die verknüpfte CAPA abgebrochen oder archiviert wurde
      if (linked && linked.status !== "CANCELLED" && !linked.isArchived) {
        throw new Error("Für diese Reklamation existiert bereits eine CAPA");
      }
    }
    // UTC-Jahresgrenze bewusst akzeptiert (Convex läuft UTC)
    const year = new Date().getFullYear();
    const { seq, capaNumber } = await nextCapaNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("capas", {
      capaNumber, year, seq,
      title: `${complaint.complaintNumber}: ${complaint.title.slice(0, 120)}`,
      description: [
        `Quelle: Reklamation ${complaint.complaintNumber}`,
        "",
        complaint.description ?? complaint.title,
      ].join("\n"),
      capaType: args.capaType,
      sourceType: "COMPLAINT",
      sourceId: args.complaintId as string,
      status: "OPEN",
      assigneeId: args.assigneeId,
      dueAt: args.dueAt,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await ctx.db.patch(args.complaintId, { capaId: id, updatedAt: now, updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capas", entityId: id,
      metadata: { capaNumber, fromComplaint: args.complaintId },
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_ASSIGNED",
        title: `CAPA zugewiesen: ${capaNumber}`,
        message: complaint.title.slice(0, 200),
        resourceType: "capa",
        resourceId: id,
      });
    }
    return id;
  },
});
```

- [ ] **Step 3: Deep-Links** — `getResourceHref` (NotificationItem.tsx): `case "complaints": return \`/complaints/${resourceId}\`;` — `resourceTypeToPath` (convex/email.ts): `case "complaints": return "complaints";`

- [ ] **Step 4: `convex/_generated/api.d.ts`** — Import + fullApi-Eintrag für `complaints` ergänzen (alphabetisch korrekt zwischen `capas` und … einsortieren; Muster der bestehenden Einträge).

- [ ] **Step 5: Typecheck + Commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add convex/complaints.ts convex/capas.ts components/notifications/NotificationItem.tsx convex/email.ts convex/_generated/api.d.ts
git commit -m "feat(complaints): Reklamations-Workflow mit Vigilanz-Frist, CAPA-Quelle, Deep-Links"
```

---

### Task 4: UI — Reklamations-Liste

**Files:**
- Modify: `app/(dashboard)/complaints/page.tsx` (Platzhalter ersetzen)

Aufbau analog `app/(dashboard)/capa/page.tsx` (gleiches Idiom: PageHeader mit `actions`, Status-Filter-Select, DataTable, Create-Dialog):

- Spalten: Nummer (mono) | Eingang (`formatDate(receivedAt)`) | Titel | Produkt (productName via list? — list liefert kein productName: Spalte zeigt `productText ?? "—"`; Detail zeigt den Stammdaten-Bezug) | Status (Farb-Badge: RECEIVED rot, IN_REVIEW amber, IN_PROGRESS blau, CLOSED grün) | Vigilanz (Badge „Vigilanz" + Frist `formatDate(vigilanceDeadline)`, **rot wenn überfällig**: `vigilanceDeadline < Date.now() && !vigilanceReportedAt`)
- Filter: Status-Select (ALL + 4 `COMPLAINT_STATUSES`)
- Create-Dialog (gated `can("complaints:create")`): Titel (Pflicht, trim-Toast), Beschreibung, Eingangsdatum (`<Input type="date">` → Timestamp via `new Date(value).getTime()`, Default heute), Eingang über (Freitext), Kunde (optional), Produkt-Freitext, Fehlerkategorie, OTWin-Referenz. Produkt-Stammdaten-Auswahl kommt im Detail (Task 5), nicht im Create-Dialog (YAGNI).
- Nach Create: `router.push(\`/complaints/${id}\`)`.

- [ ] **Step 1: Seite implementieren** (vollständiger Code analog capa/page.tsx — der Implementierer überträgt das Muster mit den oben definierten Spalten/Feldern; alle Labels aus `COMPLAINT_STATUS_LABELS`)
- [ ] **Step 2: `npx tsc --noEmit` + eslint auf der Datei** → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat(complaints): Reklamations-Liste ersetzt Platzhalterseite"`

---

### Task 5: UI — Reklamations-Detail

**Files:**
- Create: `app/(dashboard)/complaints/[id]/page.tsx`

Aufbau analog `app/(dashboard)/capa/[id]/page.tsx` (PageHeader-actions: Status-Badge + Übergangs-Buttons; Karten; Dialoge; keyed-draft für Freitexte). Inhalte:

1. **Übergangs-Buttons** (gated `can("complaints:manage")`, CLOSE-Button zusätzlich `can("complaints:close")` — disabled solange `!complaint.assessment` oder (vigilanzrelevant && keine Meldung), mit Hinweistext): RECEIVED→„Prüfung starten"; IN_REVIEW→„In Bearbeitung"/„Abschließen"; IN_PROGRESS→„Abschließen".
2. **Stammdaten-Karte**: Eingang, Eingang über, Kunde, Produkt (Select über `api.products.list` zum Verknüpfen via `update`, plus `productText`-Anzeige), Fehlerkategorie, OTWin-Ref, Sofortkorrektur (Textarea + Speichern via `update`, keyed-draft).
3. **Bewertungs-Karte**: Dialog „Bewerten" (gated manage, nicht CLOSED) mit Assessment-Select (`COMPLAINT_ASSESSMENT_LABELS`), Begründung, Checkbox „Vigilanzrelevant (MDR Art. 87)", bei aktiv: Fristfeld (`<Input type="date">`, vorbelegt Eingang + 15 Tage) → `assess`-Mutation. Anzeige des Ergebnisses mit Badge.
4. **Vigilanz-Karte** (nur wenn `isVigilanceRelevant`): Frist prominent, **rote Überfällig-Warnung** wenn `vigilanceDeadline < Date.now() && !vigilanceReportedAt`; Dialog „Meldung dokumentieren" (gemeldet am [date], Referenz, Meldeweg) → `recordVigilanceReport`; nach Meldung grünes Badge „Gemeldet am …" + Rechtzeitig/Verspätet-Kennzeichnung (`vigilanceReportedAt <= vigilanceDeadline`).
5. **CAPA-Karte**: wenn `capaId` → Link-Badge mit `capaNumber` (klickbar `/capa/{capaId}`); sonst Button „CAPA anlegen" (gated `can("capa:create")`) → `api.capas.createFromComplaint({complaintId, capaType: "CORRECTIVE"})` + Erfolgs-Toast.

- [ ] **Step 1: Seite implementieren** (vollständig, Muster capa/[id]; Hooks vor Early-Returns; Fehler-Toasts deutsch)
- [ ] **Step 2: `npx tsc --noEmit` + eslint** → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat(complaints): Reklamations-Detail mit Bewertung, Vigilanz-Frist und CAPA"`

---

### Task 6: Sidebar + End-Verifikation + Final-Review

- [ ] **Step 1: Sidebar** — `components/layout/sidebar.tsx`: Eintrag „Reklamationen" aus „In Planung" in die QM-Sektion verschieben, ohne `badge`, **mit** `permission: "complaints:list"`, `featureFlag: "COMPLAINTS"` beibehalten.
- [ ] **Step 2: Platzhalter-Stub entfernen** — `convex/placeholders/complaints.ts` löschen + `api.d.ts`-Einträge bereinigen (Muster b9397b8), sofern nichts mehr darauf zeigt (grep).
- [ ] **Step 3: `npm run build`** → muss durchlaufen (Routen `/complaints`, `/complaints/[id]`).
- [ ] **Step 4: Finaler Code-Review** über die gesamte Phase-2-Range (Integration, Cross-Modul-Konsistenz, Regressionsrisiko) — Fixes anwenden.
- [ ] **Step 5: Commit + Übergabe-Abschnitt** im Plan ergänzen (Nutzer-Schritte: Convex-Push, Feature-Flag COMPLAINTS aktivieren, Walkthrough inkl. Gegentests: Abschluss ohne Bewertung muss scheitern; vigilanzrelevant ohne Meldung muss scheitern; Vigilanz-Frist-Anzeige prüfen).

---

## Selbst-Review (beim Schreiben)

- **Spec-Abdeckung:** manuelles Register ✓ (create/update), Nummernkreis REK ✓, Bewertungs-Gate ✓ (setStatus), Vigilanz-Frist + Override + Meldefelder ✓ (assess/recordVigilanceReport), Vigilanz-Abschluss-Gate ✓, CAPA-Quelle ✓ (createFromComplaint + Back-Link), otwinRef ✓, Deep-Links ✓, RBAC-Leiter ✓, Soft-Delete + Audit-Trail ✓. Bewusst NICHT: Zod-Validatoren (Phase-1-Lektion), Produkt-Picker im Create-Dialog (Detail reicht), Vigilanz-Cron (Phase 7), OTWin-Import (späteres Vorhaben, Sybase).
- **Typ-Konsistenz:** Literale RECEIVED/IN_REVIEW/IN_PROGRESS/CLOSED und JUSTIFIED/UNJUSTIFIED/GOODWILL identisch in enums/schema/Modul; `complaints`-Tabelle trägt year/seq analog capas; `resourceType: "complaints"` konsistent in Notification + E-Mail + UI-Case.
- **Anpassungspunkte:** UI-Tasks 4/5 beschreiben Struktur statt Vollcode — Implementierer überträgt das erprobte capa-Seitenmuster (Phase-1-Dateien als direkte Vorlage im Repo).

---

## Übergabe — verbleibende Nutzer-Schritte (Stand 2026-06-10, Implementierung abgeschlossen)

Implementiert auf Branch `feature/qm-phase2-reklamationen` (Tasks 1–6, Build grün). Wie in Phase 1 brauchen Schema-Push und Browser-Walkthrough ein interaktives Terminal:

```bash
# 1. Schema + Funktionen deployen
npx convex dev --once

# 2. Feature-Flag aktivieren: Admin → Einstellungen → "Interne Audits"/"CAPA"/"Reklamationen"
#    (Flag-Keys sind jetzt mit der Sidebar harmonisiert: AUDITS, CAPA, COMPLAINTS, …)
```

Danach den Runtime-Walkthrough aus dem Final-Review durchspielen: Happy Path (REK-Nummernkreis, Prüfung → Bewertung mit Vigilanz-Haken → Frist-Vorbelegung → Meldung → Abschluss; CAPA aus Reklamation) und Gegentests (Abschluss ohne Bewertung scheitert; vigilanzrelevant ohne Meldung scheitert; Zukunfts-/leeres Eingangsdatum abgewiesen; Statussprung RECEIVED→CLOSED abgewiesen; Rollen: employee erfasst aber bewertet nicht, auditor nur lesend; Überfälligkeits-Badge bei Frist in der Vergangenheit).

**Dokumentierte Folgepunkte (bewusst nicht in Phase 2):**
- Assignee-Auswahl im UI (`update.assigneeId` + COMPLAINT_ASSIGNED-Notification existieren serverseitig)
- Ersatz-CAPA-Button im UI, wenn die verknüpfte CAPA abgebrochen/archiviert wurde (Server erlaubt es bereits)
- Archiv-Button im UI (`complaints.archive` existiert)
- ICON_MAP-Einträge für CAPA_/COMPLAINT_ASSIGNED (aktuell Bell-Fallback)
- UI sollte `VIGILANCE_DEFAULT_DEADLINE_DAYS` aus enums.ts nutzen statt hartem 15-Tage-Wert
- OTWin-Anbindung (Sybase SQL Anywhere) als eigenes späteres Vorhaben — `otwinRef` ist vorbereitet
