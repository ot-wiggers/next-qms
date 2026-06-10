# Phase 1: Audit-Kette + CAPA — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interne Audits (Vorlage → Durchführung → Findings → Bericht-PDF) und CAPA-Verwaltung als strukturierte Module, die die Phase-4-Platzhalter ersetzen; Seed der echten Auditcheckliste 2026 v5.

**Architecture:** Versionierte Checklisten-Vorlage; jedes Audit friert die Prüfpunkte als `auditChecklistAnswers` ein. Findings werden aus bewerteten Antworten klassifiziert (Bewertungslegende des echten FB 8.2.4) und erzeugen halbautomatisch vorausgefüllte CAPAs (Nummernkreis `CAPA-{Jahr}-{Nr.}`). Der Auditbericht wird per jsPDF mit FB-Kennung generiert. Alle Mutationen: `requirePermission` → `validateTransition` → `logAuditEvent`; Löschen nur Soft-Delete.

**Tech Stack:** Next.js App Router, Convex (queries/mutations + Schema), zod-Validatoren, shadcn/ui (`DataTable`, `PageHeader`, `StatusBadge`), jsPDF, xlsx (Seed-Import).

**Verifikation:** Repo hat keine Test-Infrastruktur (Konvention der bestehenden Pläne): nach jedem Task `npx tsc --noEmit` + `npm run lint`, am Ende `npm run build` + Preview-Walkthrough.

**Kontext-Dokumente:** Design: `docs/superpowers/plans/2026-06-10-qm-jahreszyklus-design.md`. Reale Formblatt-Strukturen dort in §3 (Spalten, Bewertungslegende, CAPA-Nummernformat).

---

### Task 1: Enums & Permission-Typen

**Files:**
- Modify: `lib/types/enums.ts` (am Ende anfügen)
- Modify: `lib/types/domain.ts` (PermissionAction-Union erweitern)

- [ ] **Step 1: Enums anfügen** — in `lib/types/enums.ts` am Dateiende:

```ts
// ============================================================
// Audits (ISO 13485 Kap. 8.2.4) — Phase 1
// ============================================================
export const AUDIT_TYPES = ["INTERNAL", "EXTERNAL"] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];
export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  INTERNAL: "Internes Audit",
  EXTERNAL: "Externes Audit",
};

export const AUDIT_STATUSES = [
  "PLANNED", "IN_PROGRESS", "REPORT_DRAFT", "CLOSED", "CANCELLED",
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];
export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  PLANNED: "Geplant",
  IN_PROGRESS: "In Durchführung",
  REPORT_DRAFT: "Berichtsentwurf",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Abgebrochen",
};

// Bewertungslegende exakt nach FB 8.2.4 Auditcheckliste v5
export const AUDIT_RATINGS = [
  "KONFORM", "ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG", "NICHT_ANWENDBAR",
] as const;
export type AuditRating = (typeof AUDIT_RATINGS)[number];
export const AUDIT_RATING_LABELS: Record<AuditRating, string> = {
  KONFORM: "Konform",
  ABWEICHUNG: "Abweichung",
  FESTSTELLUNG: "Feststellung",
  EMPFEHLUNG: "Empfehlung",
  NICHT_ANWENDBAR: "nicht anwendbar",
};
export const AUDIT_RATING_DESCRIPTIONS: Record<AuditRating, string> = {
  KONFORM: "Anforderung vollständig erfüllt",
  ABWEICHUNG: "Erhebliche Nichterfüllung der Anforderung",
  FESTSTELLUNG: "Geringfügige Abweichung / Handlungsbedarf",
  EMPFEHLUNG: "Hinweis zur Verbesserung ohne Abweichung",
  NICHT_ANWENDBAR: "Ausschluss laut QM-Handbuch Kap. 4.3",
};

export const FINDING_CLASSIFICATIONS = [
  "ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG",
] as const;
export type FindingClassification = (typeof FINDING_CLASSIFICATIONS)[number];
export const FINDING_CLASSIFICATION_LABELS: Record<FindingClassification, string> = {
  ABWEICHUNG: "Abweichung",
  FESTSTELLUNG: "Feststellung",
  EMPFEHLUNG: "Empfehlung",
};

export const CHECKLIST_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED"] as const;
export type ChecklistTemplateStatus = (typeof CHECKLIST_TEMPLATE_STATUSES)[number];
export const CHECKLIST_TEMPLATE_STATUS_LABELS: Record<ChecklistTemplateStatus, string> = {
  DRAFT: "Entwurf",
  ACTIVE: "Aktiv",
  SUPERSEDED: "Abgelöst",
};

// ============================================================
// CAPA (ISO 13485 Kap. 8.5.2 / 8.5.3) — Phase 1
// ============================================================
export const CAPA_TYPES = ["CORRECTIVE", "PREVENTIVE"] as const;
export type CapaType = (typeof CAPA_TYPES)[number];
export const CAPA_TYPE_LABELS: Record<CapaType, string> = {
  CORRECTIVE: "Korrekturmaßnahme (8.5.2)",
  PREVENTIVE: "Vorbeugemaßnahme (8.5.3)",
};

export const CAPA_STATUSES = [
  "OPEN", "ANALYSIS", "MEASURES_DEFINED", "IN_PROGRESS",
  "EFFECTIVENESS_CHECK", "CLOSED", "CANCELLED",
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];
export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  OPEN: "Offen",
  ANALYSIS: "Ursachenanalyse",
  MEASURES_DEFINED: "Maßnahmen definiert",
  IN_PROGRESS: "In Umsetzung",
  EFFECTIVENESS_CHECK: "Wirksamkeitsprüfung",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Abgebrochen",
};

export const CAPA_SOURCE_TYPES = [
  "AUDIT", "COMPLAINT", "TRAINING", "RISK", "QUALITY_OBJECTIVE", "MGMT_REVIEW", "MANUAL",
] as const;
export type CapaSourceType = (typeof CAPA_SOURCE_TYPES)[number];
export const CAPA_SOURCE_TYPE_LABELS: Record<CapaSourceType, string> = {
  AUDIT: "Audit",
  COMPLAINT: "Reklamation",
  TRAINING: "Schulung",
  RISK: "Risiko",
  QUALITY_OBJECTIVE: "Qualitätsziel",   // FB 5.4.1: Ziel Gelb/Rot → CAPA-Pflichtverknüpfung
  MGMT_REVIEW: "Managementbewertung",
  MANUAL: "Manuell",
};
```

- [ ] **Step 2: PermissionAction erweitern** — in `lib/types/domain.ts` in der `PermissionAction`-Union vor `| "admin:settings"` einfügen:

```ts
  | "audits:list" | "audits:manage" | "audits:report"
  | "capa:list" | "capa:create" | "capa:manage" | "capa:close"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler (Permission-Matrix folgt in Task 3 — solange niemand die neuen Actions nutzt, ist das hier fehlerfrei).

- [ ] **Step 4: Commit**

```bash
git add lib/types/enums.ts lib/types/domain.ts
git commit -m "feat(audit/capa): Enums und Permission-Typen für Phase 1"
```

---

### Task 2: Schema + State-Machine

**Files:**
- Modify: `convex/schema.ts` (Platzhalter `audits`, `auditFindings`, `capaActions` ersetzen; neue Tabellen)
- Modify: `convex/lib/stateMachine.ts` (zwei neue Maschinen)

**Vorbedingung prüfen:** Die Platzhalter-Tabellen müssen leer sein (sie waren nie beschreibbar — Status-Literal `"PLACEHOLDER"`, keine Mutationen existieren). Kurz im Convex-Dashboard verifizieren, dann ist das Ersetzen gefahrlos.

- [ ] **Step 1: Status-Unions ergänzen** — in `convex/schema.ts` bei den anderen Enum-Unions (nach `taskPriority`, ca. Zeile 60) einfügen:

```ts
const auditType = v.union(v.literal("INTERNAL"), v.literal("EXTERNAL"));
const auditStatusEnum = v.union(
  v.literal("PLANNED"), v.literal("IN_PROGRESS"), v.literal("REPORT_DRAFT"),
  v.literal("CLOSED"), v.literal("CANCELLED")
);
const auditRating = v.union(
  v.literal("KONFORM"), v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"),
  v.literal("EMPFEHLUNG"), v.literal("NICHT_ANWENDBAR")
);
const findingClassification = v.union(
  v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"), v.literal("EMPFEHLUNG")
);
const checklistTemplateStatus = v.union(
  v.literal("DRAFT"), v.literal("ACTIVE"), v.literal("SUPERSEDED")
);
const capaStatusEnum = v.union(
  v.literal("OPEN"), v.literal("ANALYSIS"), v.literal("MEASURES_DEFINED"),
  v.literal("IN_PROGRESS"), v.literal("EFFECTIVENESS_CHECK"),
  v.literal("CLOSED"), v.literal("CANCELLED")
);
const capaTypeEnum = v.union(v.literal("CORRECTIVE"), v.literal("PREVENTIVE"));
const capaSourceType = v.union(
  v.literal("AUDIT"), v.literal("COMPLAINT"), v.literal("TRAINING"),
  v.literal("RISK"), v.literal("QUALITY_OBJECTIVE"),
  v.literal("MGMT_REVIEW"), v.literal("MANUAL")
);
```

- [ ] **Step 2: Platzhalter ersetzen** — in `convex/schema.ts` die drei Platzhalter-Blöcke `audits`, `auditFindings`, `capaActions` (im Abschnitt „PHASE 4: Placeholders") **löschen** und stattdessen vor dem Placeholder-Abschnitt einen neuen Abschnitt einfügen. Die übrigen Platzhalter (`complaints`, `incomingGoodsChecks`, `deviceRecords`, `deviceCalibrations`) bleiben unverändert:

```ts
  // ============================================================
  // PHASE 1 (QM-Jahreszyklus): Interne Audits (8.2.4) + CAPA (8.5.2/8.5.3)
  // Design: docs/superpowers/plans/2026-06-10-qm-jahreszyklus-design.md
  // ============================================================

  auditChecklistTemplates: defineTable({
    name: v.string(),                    // z.B. "Auditcheckliste 2026"
    formNumber: v.string(),              // "8.2.4"
    version: v.number(),                 // 5
    status: checklistTemplateStatus,
    basis: v.optional(v.string()),       // Normen/QMH-Bezug
    ...auditFields,
  }).index("by_status", ["status"]),

  auditChecklistTemplateItems: defineTable({
    templateId: v.id("auditChecklistTemplates"),
    chapter: v.string(),                 // "4.1.1"
    chapterTitle: v.string(),            // "Regulatorische Anforderungen & Rollen"
    requirements: v.string(),            // Prüfpunkte/Anforderungen
    sortOrder: v.number(),
    ...auditFields,
  }).index("by_template", ["templateId"]),

  audits: defineTable({
    title: v.string(),                   // "Internes Audit 2026"
    auditYear: v.number(),
    auditType: auditType,
    status: auditStatusEnum,
    leadAuditorId: v.optional(v.id("users")),
    auditTeam: v.optional(v.string()),   // Auditor/Fachexperte/Mitarbeiter des Bereichs
    basis: v.optional(v.string()),
    location: v.optional(v.string()),
    reportingPeriod: v.optional(v.string()),
    plannedFor: v.optional(v.string()),  // z.B. "05/2026"
    auditDate: v.optional(v.number()),
    templateId: v.optional(v.id("auditChecklistTemplates")),
    templateVersion: v.optional(v.number()),
    summaryResult: v.optional(v.string()),   // Zusammenfassendes Ergebnis
    chapterSummaries: v.optional(v.array(v.object({
      chapter: v.string(),               // "Kapitel 4 – Qualitätsmanagementsystem"
      summary: v.string(),
    }))),
    reportFileId: v.optional(v.id("_storage")),
    closedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_year", ["auditYear"])
    .index("by_status", ["status"]),

  auditChecklistAnswers: defineTable({
    auditId: v.id("audits"),
    chapter: v.string(),                 // eingefrorene Kopie aus der Vorlage
    chapterTitle: v.string(),
    requirements: v.string(),
    sortOrder: v.number(),
    rating: v.optional(auditRating),
    evidence: v.optional(v.string()),    // Nachweis (PA/AA/FB/QMH inkl. Rev.)
    sample: v.optional(v.string()),      // Stichprobe (konkrete Aufzeichnung)
    interviewedWith: v.optional(v.string()),
    comments: v.optional(v.string()),
    ...auditFields,
  }).index("by_audit", ["auditId"]),

  auditFindings: defineTable({
    auditId: v.id("audits"),
    answerId: v.optional(v.id("auditChecklistAnswers")),
    chapter: v.optional(v.string()),
    classification: findingClassification,
    description: v.string(),
    capaId: v.optional(v.id("capas")),
    status: v.union(v.literal("OPEN"), v.literal("RESOLVED")),
    ...auditFields,
  }).index("by_audit", ["auditId"]),

  capas: defineTable({
    capaNumber: v.string(),              // "CAPA-2026-11" (reales Format)
    year: v.number(),
    seq: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    capaType: capaTypeEnum,
    sourceType: capaSourceType,
    sourceId: v.optional(v.string()),    // z.B. auditFindings-Id als String
    rootCauseAnalysis: v.optional(v.string()),
    status: capaStatusEnum,
    assigneeId: v.optional(v.id("users")),
    responsible: v.optional(v.string()),          // Freitext-Rollen wie im echten FB ("BDL / IT", "GF / BDL")
    dueAt: v.optional(v.number()),
    effectivenessCriterion: v.optional(v.string()), // vorab definiert, wie im FB: "Wirksam: Q3/Q4-Auswertung ≥ 95 %"
    effectivenessDueAt: v.optional(v.number()),
    effectivenessResult: v.optional(v.union(v.literal("EFFECTIVE"), v.literal("INEFFECTIVE"))),
    effectivenessNote: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_year", ["year"])
    .index("by_status", ["status"]),

  capaMeasures: defineTable({
    capaId: v.id("capas"),
    description: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
    status: v.union(v.literal("OPEN"), v.literal("DONE")),
    doneAt: v.optional(v.number()),
    ...auditFields,
  }).index("by_capa", ["capaId"]),
```

- [ ] **Step 3: State-Machines ergänzen** — in `convex/lib/stateMachine.ts` im `TRANSITIONS`-Objekt nach `reviewStatus` einfügen:

```ts
  auditStatus: {
    PLANNED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["REPORT_DRAFT", "CANCELLED"],
    REPORT_DRAFT: ["CLOSED", "IN_PROGRESS"],
    CLOSED: [],
    CANCELLED: [],
  },
  capaStatus: {
    OPEN: ["ANALYSIS", "CANCELLED"],
    ANALYSIS: ["MEASURES_DEFINED", "CANCELLED"],
    MEASURES_DEFINED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["EFFECTIVENESS_CHECK", "CANCELLED"],
    EFFECTIVENESS_CHECK: ["CLOSED", "IN_PROGRESS"],
    CLOSED: [],
    CANCELLED: [],
  },
```

- [ ] **Step 4: Schema deployen + Typecheck**

Run: `npx convex dev --once` (pusht Schema; schlägt fehl, falls die alten Platzhalter-Tabellen doch Daten enthielten) und danach `npx tsc --noEmit`
Expected: Schema-Push OK, keine Typfehler.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/lib/stateMachine.ts
git commit -m "feat(audit/capa): Schema-Tabellen ersetzen Phase-4-Platzhalter, State-Machines"
```

---

### Task 3: Permission-Matrix

**Files:**
- Modify: `convex/lib/permissions.ts` (ROLE_PERMISSIONS)

- [ ] **Step 1: Rollen erweitern** — in `ROLE_PERMISSIONS`:

In `qmb` ergänzen:
```ts
    "audits:list", "audits:manage", "audits:report",
    "capa:list", "capa:create", "capa:manage", "capa:close",
```

In `auditor` ergänzen:
```ts
    "audits:list", "audits:manage", "audits:report",
    "capa:list", "capa:create",
```

In `department_lead` ergänzen:
```ts
    "audits:list",
    "capa:list",
```

`employee` bleibt unverändert (kein Audit-/CAPA-Zugriff); `admin` hat Wildcard.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/permissions.ts
git commit -m "feat(audit/capa): RBAC-Permissions für QMB, Auditor, Abteilungsleitung"
```

---

### Task 4: Zod-Validatoren

**Files:**
- Create: `lib/validators/audit.ts`
- Create: `lib/validators/capa.ts`

- [ ] **Step 1: `lib/validators/audit.ts` anlegen**

```ts
import { z } from "zod";

export const createAuditSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  auditYear: z.number().int().min(2020).max(2100),
  auditType: z.enum(["INTERNAL", "EXTERNAL"]),
  auditTeam: z.string().max(500).optional(),
  basis: z.string().max(1000).optional(),
  location: z.string().max(500).optional(),
  reportingPeriod: z.string().max(200).optional(),
  plannedFor: z.string().max(50).optional(),
});

export const updateAnswerSchema = z.object({
  rating: z
    .enum(["KONFORM", "ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG", "NICHT_ANWENDBAR"])
    .optional(),
  evidence: z.string().max(2000).optional(),
  sample: z.string().max(2000).optional(),
  interviewedWith: z.string().max(500).optional(),
  comments: z.string().max(2000).optional(),
});

export const createFindingSchema = z.object({
  classification: z.enum(["ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG"]),
  description: z.string().min(1, "Beschreibung ist erforderlich").max(2000),
});

export const templateItemSchema = z.object({
  chapter: z.string().min(1, "Kapitel ist erforderlich").max(20),
  chapterTitle: z.string().min(1, "Überschrift ist erforderlich").max(300),
  requirements: z.string().min(1, "Prüfpunkte sind erforderlich").max(3000),
});

export type CreateAuditInput = z.infer<typeof createAuditSchema>;
export type UpdateAnswerInput = z.infer<typeof updateAnswerSchema>;
export type CreateFindingInput = z.infer<typeof createFindingSchema>;
export type TemplateItemInput = z.infer<typeof templateItemSchema>;
```

- [ ] **Step 2: `lib/validators/capa.ts` anlegen**

```ts
import { z } from "zod";

export const createCapaSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(3000).optional(),
  capaType: z.enum(["CORRECTIVE", "PREVENTIVE"]),
  sourceType: z.enum(["AUDIT", "COMPLAINT", "TRAINING", "RISK", "MGMT_REVIEW", "MANUAL"]),
  dueAt: z.number().optional(),
});

export const capaMeasureSchema = z.object({
  description: z.string().min(1, "Beschreibung ist erforderlich").max(2000),
  dueAt: z.number().optional(),
});

export const effectivenessSchema = z.object({
  effectivenessResult: z.enum(["EFFECTIVE", "INEFFECTIVE"]),
  effectivenessNote: z.string().min(1, "Begründung ist erforderlich").max(2000),
});

export type CreateCapaInput = z.infer<typeof createCapaSchema>;
export type CapaMeasureInput = z.infer<typeof capaMeasureSchema>;
export type EffectivenessInput = z.infer<typeof effectivenessSchema>;
```

- [ ] **Step 3: Typecheck + Commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add lib/validators/audit.ts lib/validators/capa.ts
git commit -m "feat(audit/capa): Zod-Validatoren"
```

---

### Task 5: Convex-Modul Checklisten-Vorlagen

**Files:**
- Create: `convex/auditTemplates.ts`

- [ ] **Step 1: Datei anlegen** (Muster: `convex/declarations.ts` — requirePermission/logAuditEvent durchgängig)

```ts
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

/** Alle Vorlagen (neueste zuerst) */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audits:list");
    const templates = await ctx.db
      .query("auditChecklistTemplates")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return templates.sort((a, b) => b.version - a.version);
  },
});

/** Aktive Vorlage inkl. Prüfpunkten */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audits:list");
    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) return null;
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", template._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return { ...template, items: items.sort((a, b) => a.sortOrder - b.sortOrder) };
  },
});

/** Vorlage nach ID inkl. Prüfpunkten */
export const getById = query({
  args: { id: v.id("auditChecklistTemplates") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const template = await ctx.db.get(args.id);
    if (!template) return null;
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    return { ...template, items: items.sort((a, b) => a.sortOrder - b.sortOrder) };
  },
});

/** Neue Vorlagen-Version als Entwurf anlegen (Version = höchste + 1).
 *  copyFromActive=true übernimmt die Prüfpunkte der aktiven Vorlage. */
export const createDraft = mutation({
  args: {
    name: v.string(),
    formNumber: v.string(),
    basis: v.optional(v.string()),
    copyFromActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const now = Date.now();
    const all = await ctx.db.query("auditChecklistTemplates").collect();
    const version = all.length === 0 ? 1 : Math.max(...all.map((t) => t.version)) + 1;

    const id = await ctx.db.insert("auditChecklistTemplates", {
      name: args.name,
      formNumber: args.formNumber,
      version,
      status: "DRAFT",
      basis: args.basis,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });

    if (args.copyFromActive) {
      const active = all.find((t) => t.status === "ACTIVE" && !t.isArchived);
      if (active) {
        const items = await ctx.db
          .query("auditChecklistTemplateItems")
          .withIndex("by_template", (q) => q.eq("templateId", active._id))
          .filter((q) => q.eq(q.field("isArchived"), false))
          .collect();
        for (const item of items) {
          await ctx.db.insert("auditChecklistTemplateItems", {
            templateId: id,
            chapter: item.chapter,
            chapterTitle: item.chapterTitle,
            requirements: item.requirements,
            sortOrder: item.sortOrder,
            isArchived: false,
            createdAt: now, createdBy: user._id,
            updatedAt: now, updatedBy: user._id,
          });
        }
      }
    }

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "auditChecklistTemplates", entityId: id,
      metadata: { version },
    });
    return id;
  },
});

/** Prüfpunkt zu einer DRAFT-Vorlage hinzufügen */
export const addItem = mutation({
  args: {
    templateId: v.id("auditChecklistTemplates"),
    chapter: v.string(),
    chapterTitle: v.string(),
    requirements: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Vorlage nicht gefunden");
    if (template.status !== "DRAFT") {
      throw new Error("Nur Entwurfs-Vorlagen können bearbeitet werden");
    }
    const existing = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert("auditChecklistTemplateItems", {
      templateId: args.templateId,
      chapter: args.chapter,
      chapterTitle: args.chapterTitle,
      requirements: args.requirements,
      sortOrder: existing.length === 0 ? 1 : Math.max(...existing.map((i) => i.sortOrder)) + 1,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "auditChecklistTemplateItems", entityId: id,
    });
    return id;
  },
});

/** Prüfpunkt einer DRAFT-Vorlage ändern */
export const updateItem = mutation({
  args: {
    id: v.id("auditChecklistTemplateItems"),
    chapter: v.optional(v.string()),
    chapterTitle: v.optional(v.string()),
    requirements: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Prüfpunkt nicht gefunden");
    const template = await ctx.db.get(item.templateId);
    if (!template || template.status !== "DRAFT") {
      throw new Error("Nur Entwurfs-Vorlagen können bearbeitet werden");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "auditChecklistTemplateItems", entityId: id,
      changes,
    });
  },
});

/** Vorlage aktivieren — löst die bisher aktive Version ab */
export const activate = mutation({
  args: { id: v.id("auditChecklistTemplates") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const template = await ctx.db.get(args.id);
    if (!template) throw new Error("Vorlage nicht gefunden");
    if (template.status !== "DRAFT") throw new Error("Nur Entwürfe können aktiviert werden");

    const now = Date.now();
    const active = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .collect();
    for (const prev of active) {
      await ctx.db.patch(prev._id, { status: "SUPERSEDED", updatedAt: now, updatedBy: user._id });
    }
    await ctx.db.patch(args.id, { status: "ACTIVE", updatedAt: now, updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "auditChecklistTemplates", entityId: args.id,
      previousStatus: "DRAFT", newStatus: "ACTIVE",
    });
  },
});

/** Seed-Import (npx convex run) — legt eine Version direkt als ACTIVE an.
 *  Bricht ab, wenn die Version bereits existiert (idempotent). */
export const seedFromImport = internalMutation({
  args: {
    name: v.string(),
    formNumber: v.string(),
    version: v.number(),
    basis: v.optional(v.string()),
    items: v.array(v.object({
      chapter: v.string(),
      chapterTitle: v.string(),
      requirements: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("auditChecklistTemplates").collect();
    if (existing.some((t) => t.version === args.version)) {
      return { skipped: true, reason: `Version ${args.version} existiert bereits` };
    }
    const now = Date.now();
    for (const prev of existing.filter((t) => t.status === "ACTIVE")) {
      await ctx.db.patch(prev._id, { status: "SUPERSEDED", updatedAt: now });
    }
    const id = await ctx.db.insert("auditChecklistTemplates", {
      name: args.name,
      formNumber: args.formNumber,
      version: args.version,
      status: "ACTIVE",
      basis: args.basis,
      isArchived: false,
      createdAt: now, updatedAt: now,
    });
    let sortOrder = 1;
    for (const item of args.items) {
      await ctx.db.insert("auditChecklistTemplateItems", {
        templateId: id,
        chapter: item.chapter,
        chapterTitle: item.chapterTitle,
        requirements: item.requirements,
        sortOrder: sortOrder++,
        isArchived: false,
        createdAt: now, updatedAt: now,
      });
    }
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "auditChecklistTemplates", entityId: id,
      metadata: { seed: true, version: args.version, items: args.items.length },
    });
    return { skipped: false, templateId: id, items: args.items.length };
  },
});
```

- [ ] **Step 2: Typecheck + Convex-Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: PASS, Funktionen deployed.

- [ ] **Step 3: Commit**

```bash
git add convex/auditTemplates.ts
git commit -m "feat(audit): Checklisten-Vorlagen mit Versionierung und Seed-Import"
```

---

### Task 6: Convex-Modul Audits

**Files:**
- Create: `convex/audits.ts`

- [ ] **Step 1: Datei anlegen**

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";

/** Audits auflisten (optional nach Jahr/Status gefiltert) */
export const list = query({
  args: {
    year: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    let results;
    if (args.year !== undefined) {
      results = await ctx.db
        .query("audits")
        .withIndex("by_year", (q) => q.eq("auditYear", args.year!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      results = await ctx.db
        .query("audits")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }
    if (args.status) results = results.filter((a) => a.status === args.status);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Audit inkl. Antworten und Findings */
export const getById = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audit = await ctx.db.get(args.id);
    if (!audit) return null;
    const answers = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const findings = await ctx.db
      .query("auditFindings")
      .withIndex("by_audit", (q) => q.eq("auditId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const leadAuditor = audit.leadAuditorId ? await ctx.db.get(audit.leadAuditorId) : null;
    return {
      ...audit,
      answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
      findings: findings.sort((a, b) => a.createdAt - b.createdAt),
      leadAuditorName: leadAuditor ? `${leadAuditor.firstName} ${leadAuditor.lastName}` : null,
    };
  },
});

/** Audit anlegen — friert die Prüfpunkte der aktiven Vorlage als Antworten ein */
export const create = mutation({
  args: {
    title: v.string(),
    auditYear: v.number(),
    auditType: v.union(v.literal("INTERNAL"), v.literal("EXTERNAL")),
    auditTeam: v.optional(v.string()),
    basis: v.optional(v.string()),
    location: v.optional(v.string()),
    reportingPeriod: v.optional(v.string()),
    plannedFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) {
      throw new Error("Keine aktive Checklisten-Vorlage vorhanden — zuerst Vorlage anlegen/aktivieren");
    }
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", template._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const now = Date.now();
    const auditId = await ctx.db.insert("audits", {
      ...args,
      status: "PLANNED",
      leadAuditorId: user._id,
      templateId: template._id,
      templateVersion: template.version,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });

    // Prüfpunkte einfrieren — spätere Vorlagenänderungen wirken nicht zurück
    for (const item of items.sort((a, b) => a.sortOrder - b.sortOrder)) {
      await ctx.db.insert("auditChecklistAnswers", {
        auditId,
        chapter: item.chapter,
        chapterTitle: item.chapterTitle,
        requirements: item.requirements,
        sortOrder: item.sortOrder,
        isArchived: false,
        createdAt: now, createdBy: user._id,
        updatedAt: now, updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "audits", entityId: auditId,
      metadata: { templateVersion: template.version, items: items.length },
    });
    return auditId;
  },
});

/** Kopfdaten ändern (nicht nach Abschluss) */
export const updateHeader = mutation({
  args: {
    id: v.id("audits"),
    title: v.optional(v.string()),
    auditTeam: v.optional(v.string()),
    basis: v.optional(v.string()),
    location: v.optional(v.string()),
    reportingPeriod: v.optional(v.string()),
    plannedFor: v.optional(v.string()),
    auditDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status === "CLOSED" || audit.status === "CANCELLED") {
      throw new Error("Abgeschlossene Audits können nicht geändert werden");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: id, changes,
    });
  },
});

/** Antwort (Prüfpunkt-Bewertung) erfassen */
export const updateAnswer = mutation({
  args: {
    id: v.id("auditChecklistAnswers"),
    rating: v.optional(v.union(
      v.literal("KONFORM"), v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"),
      v.literal("EMPFEHLUNG"), v.literal("NICHT_ANWENDBAR")
    )),
    evidence: v.optional(v.string()),
    sample: v.optional(v.string()),
    interviewedWith: v.optional(v.string()),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const answer = await ctx.db.get(args.id);
    if (!answer) throw new Error("Prüfpunkt nicht gefunden");
    const audit = await ctx.db.get(answer.auditId);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status !== "IN_PROGRESS") {
      throw new Error("Bewertungen nur möglich, während das Audit in Durchführung ist");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "auditChecklistAnswers", entityId: id, changes,
    });
  },
});

/** Statuswechsel über State-Machine */
export const setStatus = mutation({
  args: { id: v.id("audits"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    validateTransition("auditStatus", audit.status, args.status);

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status, updatedAt: now, updatedBy: user._id,
    };
    if (args.status === "IN_PROGRESS" && !audit.auditDate) patch.auditDate = now;
    if (args.status === "CLOSED") patch.closedAt = now;
    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "audits", entityId: args.id,
      previousStatus: audit.status, newStatus: args.status,
    });
  },
});

/** Berichtstexte (Zusammenfassung + Kapitel-Abschnitte) speichern */
export const updateSummary = mutation({
  args: {
    id: v.id("audits"),
    summaryResult: v.optional(v.string()),
    chapterSummaries: v.optional(v.array(v.object({
      chapter: v.string(),
      summary: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:report");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status !== "REPORT_DRAFT" && audit.status !== "IN_PROGRESS") {
      throw new Error("Berichtstexte nur im Entwurfsstadium änderbar");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: id, changes: { reportTexts: true },
    });
  },
});

/** Upload-URL für eingefrorenes Bericht-PDF */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audits:report");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Generiertes Bericht-PDF am Audit einfrieren */
export const attachReport = mutation({
  args: { id: v.id("audits"), reportFileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:report");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    await ctx.db.patch(args.id, {
      reportFileId: args.reportFileId,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "FILE_UPLOAD",
      entityType: "audits", entityId: args.id,
      metadata: { kind: "auditReport" },
    });
  },
});

/** Bericht-PDF herunterladen */
export const getReportUrl = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audit = await ctx.db.get(args.id);
    if (!audit?.reportFileId) return null;
    return await ctx.storage.getUrl(audit.reportFileId);
  },
});

/** Audit archivieren (Soft-Delete) */
export const archive = mutation({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    await archiveRecord(ctx, "audits", args.id, user._id);
  },
});
```

- [ ] **Step 2: Typecheck + Convex-Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/audits.ts
git commit -m "feat(audit): Audit-Lebenszyklus mit eingefrorener Checkliste"
```

---

### Task 7: Convex-Modul Findings

**Files:**
- Create: `convex/auditFindings.ts`

- [ ] **Step 1: Datei anlegen**

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

const classification = v.union(
  v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"), v.literal("EMPFEHLUNG")
);

/** Findings eines Audits */
export const listByAudit = query({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    return await ctx.db
      .query("auditFindings")
      .withIndex("by_audit", (q) => q.eq("auditId", args.auditId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Finding erfassen — optional aus einer bewerteten Antwort heraus */
export const create = mutation({
  args: {
    auditId: v.id("audits"),
    answerId: v.optional(v.id("auditChecklistAnswers")),
    classification,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.auditId);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status === "CLOSED" || audit.status === "CANCELLED") {
      throw new Error("Abgeschlossene Audits können keine neuen Findings erhalten");
    }
    let chapter: string | undefined;
    if (args.answerId) {
      const answer = await ctx.db.get(args.answerId);
      if (answer) chapter = answer.chapter;
    }
    const now = Date.now();
    const id = await ctx.db.insert("auditFindings", {
      auditId: args.auditId,
      answerId: args.answerId,
      chapter,
      classification: args.classification,
      description: args.description,
      status: "OPEN",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "auditFindings", entityId: id,
      metadata: { classification: args.classification, chapter },
    });
    return id;
  },
});

/** Finding als erledigt markieren (z.B. nach CAPA-Abschluss) */
export const resolve = mutation({
  args: { id: v.id("auditFindings") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const finding = await ctx.db.get(args.id);
    if (!finding) throw new Error("Finding nicht gefunden");
    await ctx.db.patch(args.id, {
      status: "RESOLVED", updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "auditFindings", entityId: args.id,
      previousStatus: "OPEN", newStatus: "RESOLVED",
    });
  },
});
```

- [ ] **Step 2: Typecheck + Push + Commit**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: PASS.

```bash
git add convex/auditFindings.ts
git commit -m "feat(audit): Findings mit Klassifizierung nach Bewertungslegende"
```

---

### Task 8: Convex-Modul CAPA

**Files:**
- Create: `convex/capas.ts`

- [ ] **Step 1: Datei anlegen**

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";
import { archiveRecord } from "./lib/softDelete";
import { createNotification } from "./lib/notificationHelpers";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

const capaTypeArg = v.union(v.literal("CORRECTIVE"), v.literal("PREVENTIVE"));
const sourceTypeArg = v.union(
  v.literal("AUDIT"), v.literal("COMPLAINT"), v.literal("TRAINING"),
  v.literal("RISK"), v.literal("QUALITY_OBJECTIVE"),
  v.literal("MGMT_REVIEW"), v.literal("MANUAL")
);

/** Nächste CAPA-Nummer im Jahres-Nummernkreis (Format CAPA-2026-11) */
async function nextCapaNumber(ctx: MutationCtx, year: number) {
  const existing = await ctx.db
    .query("capas")
    .withIndex("by_year", (q) => q.eq("year", year))
    .collect();
  const seq = existing.length === 0 ? 1 : Math.max(...existing.map((c) => c.seq)) + 1;
  return { seq, capaNumber: `CAPA-${year}-${seq}` };
}

/** CAPAs auflisten (optional nach Status/Jahr) */
export const list = query({
  args: { status: v.optional(v.string()), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "capa:list");
    let results = await ctx.db
      .query("capas")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (args.status) results = results.filter((c) => c.status === args.status);
    if (args.year !== undefined) results = results.filter((c) => c.year === args.year);
    return results.sort((a, b) => b.year - a.year || b.seq - a.seq);
  },
});

/** CAPA inkl. Maßnahmen und Verantwortlichem */
export const getById = query({
  args: { id: v.id("capas") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "capa:list");
    const capa = await ctx.db.get(args.id);
    if (!capa) return null;
    const measures = await ctx.db
      .query("capaMeasures")
      .withIndex("by_capa", (q) => q.eq("capaId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const assignee = capa.assigneeId ? await ctx.db.get(capa.assigneeId) : null;
    return {
      ...capa,
      measures: measures.sort((a, b) => a.createdAt - b.createdAt),
      assigneeName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
    };
  },
});

/** CAPA manuell anlegen */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    capaType: capaTypeArg,
    sourceType: sourceTypeArg,
    sourceId: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    responsible: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    effectivenessCriterion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:create");
    const year = new Date().getFullYear();
    const { seq, capaNumber } = await nextCapaNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("capas", {
      ...args,
      capaNumber, year, seq,
      status: "OPEN",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capas", entityId: id,
      metadata: { capaNumber, sourceType: args.sourceType },
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_ASSIGNED",
        title: `CAPA zugewiesen: ${capaNumber}`,
        message: args.title,
        resourceType: "capa",
        resourceId: id,
      });
    }
    return id;
  },
});

/** Halbautomatik: vorausgefüllte CAPA aus einem Audit-Finding erzeugen */
export const createFromFinding = mutation({
  args: {
    findingId: v.id("auditFindings"),
    capaType: capaTypeArg,
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:create");
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new Error("Finding nicht gefunden");
    if (finding.capaId) throw new Error("Für dieses Finding existiert bereits eine CAPA");
    const audit = await ctx.db.get(finding.auditId);

    const year = new Date().getFullYear();
    const { seq, capaNumber } = await nextCapaNumber(ctx, year);
    const now = Date.now();
    const id = await ctx.db.insert("capas", {
      capaNumber, year, seq,
      title: `${finding.chapter ? `Kap. ${finding.chapter}: ` : ""}${finding.description.slice(0, 120)}`,
      description: [
        `Quelle: ${audit?.title ?? "Audit"} — Finding (${finding.classification})`,
        "",
        finding.description,
      ].join("\n"),
      capaType: args.capaType,
      sourceType: "AUDIT",
      sourceId: args.findingId as string,
      status: "OPEN",
      assigneeId: args.assigneeId,
      dueAt: args.dueAt,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await ctx.db.patch(args.findingId, { capaId: id, updatedAt: now, updatedBy: user._id });

    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capas", entityId: id,
      metadata: { capaNumber, fromFinding: args.findingId },
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_ASSIGNED",
        title: `CAPA zugewiesen: ${capaNumber}`,
        message: finding.description.slice(0, 200),
        resourceType: "capa",
        resourceId: id,
      });
    }
    return id;
  },
});

/** Felder ändern (Titel, Beschreibung, Ursachenanalyse, Verantwortlicher, Termine) */
export const update = mutation({
  args: {
    id: v.id("capas"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    rootCauseAnalysis: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    responsible: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    effectivenessCriterion: v.optional(v.string()),
    effectivenessDueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const capa = await ctx.db.get(args.id);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.status === "CLOSED" || capa.status === "CANCELLED") {
      throw new Error("Abgeschlossene CAPAs können nicht geändert werden");
    }
    const { id, ...changes } = args;
    await ctx.db.patch(id, { ...changes, updatedAt: Date.now(), updatedBy: user._id });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "capas", entityId: id, changes,
    });
  },
});

/** Statuswechsel — CLOSED nur mit dokumentierter Wirksamkeitsprüfung */
export const setStatus = mutation({
  args: { id: v.id("capas"), status: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(
      ctx, args.status === "CLOSED" ? "capa:close" : "capa:manage"
    );
    const capa = await ctx.db.get(args.id);
    if (!capa) throw new Error("CAPA nicht gefunden");
    validateTransition("capaStatus", capa.status, args.status);
    if (args.status === "CLOSED" && capa.effectivenessResult !== "EFFECTIVE") {
      throw new Error("Abschluss nur nach dokumentiert wirksamer Wirksamkeitsprüfung");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status,
      closedAt: args.status === "CLOSED" ? now : capa.closedAt,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "capas", entityId: args.id,
      previousStatus: capa.status, newStatus: args.status,
    });
  },
});

/** Wirksamkeitsprüfung dokumentieren (im Status EFFECTIVENESS_CHECK) */
export const recordEffectiveness = mutation({
  args: {
    id: v.id("capas"),
    effectivenessResult: v.union(v.literal("EFFECTIVE"), v.literal("INEFFECTIVE")),
    effectivenessNote: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const capa = await ctx.db.get(args.id);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.status !== "EFFECTIVENESS_CHECK") {
      throw new Error("Wirksamkeitsprüfung nur im Status Wirksamkeitsprüfung möglich");
    }
    await ctx.db.patch(args.id, {
      effectivenessResult: args.effectivenessResult,
      effectivenessNote: args.effectivenessNote,
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "capas", entityId: args.id,
      changes: { effectivenessResult: args.effectivenessResult },
    });
  },
});

/** Maßnahme hinzufügen */
export const addMeasure = mutation({
  args: {
    capaId: v.id("capas"),
    description: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const capa = await ctx.db.get(args.capaId);
    if (!capa) throw new Error("CAPA nicht gefunden");
    if (capa.status === "CLOSED" || capa.status === "CANCELLED") {
      throw new Error("Abgeschlossene CAPAs können keine neuen Maßnahmen erhalten");
    }
    const now = Date.now();
    const id = await ctx.db.insert("capaMeasures", {
      capaId: args.capaId,
      description: args.description,
      assigneeId: args.assigneeId,
      dueAt: args.dueAt,
      status: "OPEN",
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "capaMeasures", entityId: id,
    });
    if (args.assigneeId && args.assigneeId !== user._id) {
      await createNotification(ctx, {
        userId: args.assigneeId,
        type: "CAPA_MEASURE_ASSIGNED",
        title: `Maßnahme zugewiesen (${capa.capaNumber})`,
        message: args.description.slice(0, 200),
        resourceType: "capa",
        resourceId: args.capaId as string,
      });
    }
    return id;
  },
});

/** Maßnahme erledigen */
export const completeMeasure = mutation({
  args: { id: v.id("capaMeasures") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    const measure = await ctx.db.get(args.id);
    if (!measure) throw new Error("Maßnahme nicht gefunden");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "DONE", doneAt: now, updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "STATUS_CHANGE",
      entityType: "capaMeasures", entityId: args.id,
      previousStatus: "OPEN", newStatus: "DONE",
    });
  },
});

/** CAPA archivieren (Soft-Delete) */
export const archive = mutation({
  args: { id: v.id("capas") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "capa:manage");
    await archiveRecord(ctx, "capas", args.id, user._id);
  },
});
```

- [ ] **Step 2: Typecheck + Push + Commit**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: PASS.

```bash
git add convex/capas.ts
git commit -m "feat(capa): CAPA-Workflow mit Jahres-Nummernkreis, Maßnahmen, Wirksamkeitsprüfung"
```

---

### Task 9: Seed-Import Checkliste v5 + Audit 2026

**Files:**
- Create: `scripts/import-audit-checklist.mjs`
- Modify: `convex/capas.ts` (internalMutation `seedFromImport` anfügen)

**Vorbedingung erfüllt (2026-06-10):** Alle Quelldokumente liegen lokal in `PDF/`, inkl. der Original-xlsx `PDF/8 2 4 Auditcheckliste_2026_v5.xlsx` (Dateiname mit Leerzeichen!). Dry-Run gegen die echte Datei verifiziert: 2 Blätter („Deckblatt" mit Kopfdaten, „Auditcheckliste" mit den Prüfpunkten), **60 Prüfpunkte**, Spaltenreihenfolge exakt wie im Skript angenommen. Skript-Variante B (PDF) ist damit obsolet.

- [ ] **Step 1: Import-Skript anlegen** — `scripts/import-audit-checklist.mjs`:

```js
// Liest die Auditcheckliste-xlsx und erzeugt scripts/out/audit-checklist-v5.json
// Spalten lt. FB 8.2.4: Kap. | Überschrift | Prüfpunkte | Bewertung | Nachweis | Stichprobe | Gespräch mit | Bemerkungen
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const SRC = process.argv[2];
if (!SRC) {
  console.error("Usage: node scripts/import-audit-checklist.mjs <pfad-zur-xlsx>");
  process.exit(1);
}

const wb = XLSX.readFile(SRC);
const items = [];
const answers = [];
const chapterRe = /^\d+(\.\d+)*$/;

for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  for (const row of rows) {
    const [chapter, chapterTitle, requirements, rating, evidence, sample, interviewedWith, comments] =
      row.map((c) => String(c).trim());
    // Nur echte Prüfpunkt-Zeilen: numerisches Kapitel + Prüfpunkte-Text
    if (!chapterRe.test(chapter) || !requirements) continue;
    items.push({ chapter, chapterTitle, requirements });
    answers.push({ chapter, chapterTitle, requirements, rating, evidence, sample, interviewedWith, comments });
  }
}

const RATING_MAP = {
  "Konform": "KONFORM",
  "Abweichung": "ABWEICHUNG",
  "Feststellung": "FESTSTELLUNG",
  "Empfehlung": "EMPFEHLUNG",
  "nicht anwendbar": "NICHT_ANWENDBAR",
};
for (const a of answers) {
  a.rating = RATING_MAP[a.rating] ?? undefined;
}

mkdirSync("scripts/out", { recursive: true });
writeFileSync(
  "scripts/out/audit-checklist-v5.json",
  JSON.stringify(
    {
      template: {
        name: "Auditcheckliste 2026",
        formNumber: "8.2.4",
        version: 5,
        basis:
          "DIN EN ISO 13485:2021, MDR (EU) 2017/745, QM-Handbuch Rev. 5 (05.2025), VA, AA, FB gem. FB 4.2.4",
        items,
      },
      answers,
    },
    null,
    2
  )
);
console.log(`OK: ${items.length} Prüfpunkte extrahiert -> scripts/out/audit-checklist-v5.json`);
```

Variante B (nur PDF verfügbar): gleiche Ausgabe-Struktur, aber Quelle `pdf-parse` (`pdf-parse/lib/pdf-parse.js` wie in `app/api/analyze-pdf/route.ts`); die Spalten stehen im Textfluss hintereinander — danach `scripts/out/audit-checklist-v5.json` **manuell reviewen**, bevor Step 3 läuft.

- [ ] **Step 2: Skript ausführen + Ergebnis prüfen**

Run:
```bash
node scripts/import-audit-checklist.mjs "PDF/8 2 4 Auditcheckliste_2026_v5.xlsx"
```
Expected: `OK: 60 Prüfpunkte extrahiert` (per Dry-Run am 2026-06-10 verifiziert; Kapitel-Überschriftszeilen wie „4 | Qualitätsmanagementsystem" ohne Prüfpunkte-Text werden korrekt übersprungen). JSON stichprobenartig gegen das PDF prüfen (z.B. 4.1.1 „Regulatorische Anforderungen & Rollen").

- [ ] **Step 3: Vorlage seeden**

Run:
```bash
node -e '
const d = require("./scripts/out/audit-checklist-v5.json");
process.stdout.write(JSON.stringify(d.template));
' > /tmp/seed-template.json
npx convex run auditTemplates:seedFromImport "$(cat /tmp/seed-template.json)"
```
Expected: `{ skipped: false, items: <N> }`. Zweiter Lauf: `{ skipped: true }` (idempotent).

- [ ] **Step 4: CAPA-Seed-Mutation anfügen** — am Ende von `convex/capas.ts`:

```ts
import { internalMutation } from "./_generated/server"; // beim bestehenden Import ergänzen

/** Seed-Import der CAPA-Liste 2026 (npx convex run) — idempotent über capaNumber */
export const seedFromImport = internalMutation({
  args: {
    items: v.array(v.object({
      capaNumber: v.string(),          // "CAPA-2026-11"
      title: v.string(),
      description: v.optional(v.string()),
      capaType: v.union(v.literal("CORRECTIVE"), v.literal("PREVENTIVE")),
      sourceType: v.union(
        v.literal("AUDIT"), v.literal("COMPLAINT"), v.literal("TRAINING"),
        v.literal("RISK"), v.literal("QUALITY_OBJECTIVE"),
        v.literal("MGMT_REVIEW"), v.literal("MANUAL")
      ),
      status: v.union(
        v.literal("OPEN"), v.literal("ANALYSIS"), v.literal("MEASURES_DEFINED"),
        v.literal("IN_PROGRESS"), v.literal("EFFECTIVENESS_CHECK"),
        v.literal("CLOSED"), v.literal("CANCELLED")
      ),
      responsible: v.optional(v.string()),
      effectivenessCriterion: v.optional(v.string()),
      dueAt: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("capas").collect();
    const known = new Set(existing.map((c) => c.capaNumber));
    const now = Date.now();
    let inserted = 0;
    for (const item of args.items) {
      if (known.has(item.capaNumber)) continue;
      const match = item.capaNumber.match(/^CAPA-(\d{4})-(\d+)$/);
      if (!match) throw new Error(`Ungültige CAPA-Nummer: ${item.capaNumber}`);
      await ctx.db.insert("capas", {
        ...item,
        year: Number(match[1]),
        seq: Number(match[2]),
        isArchived: false,
        createdAt: now, updatedAt: now,
      });
      inserted++;
    }
    return { inserted, skipped: args.items.length - inserted };
  },
});
```

- [ ] **Step 5: CAPA-Liste 2026 übernehmen** — Quelle: `PDF/8 5 2 - 8 5 3 Korrektur Vorbeugemassnahmen 2026_Rev1.pdf` (2 Seiten, **11 Einträge**, Struktur am 2026-06-10 extrahiert und verifiziert). Spalten: `Nr. | Maßnahme (Titel + Beschreibung) | Bewertung / zeitnahe Abarbeitung | Verantw. | Termin | Status`. Mapping-Regeln:

| Quelle | Ziel |
|---|---|
| Nr. `N` | `capaNumber: "CAPA-2026-N"` (bestätigt: Nr. 11 = „CAPA-2026-11" im Auditbericht; CAPA-2026-01/-02/-03 in FB 5.4.1) |
| Maßnahmen-Titel (erste Zeile) | `title` |
| Beschreibung + Spalte „Bewertung / zeitnahe Abarbeitung" (ohne „Wirksam:"-Satz) | `description` |
| Teilsatz ab „Wirksam:" | `effectivenessCriterion` |
| Verantw. („Werkstatt", „BDL / IT", „GF", …) | `responsible` (Freitext) |
| Termin (z.B. „30.06.2026", leer bei Nr. 1) | `dueAt` (Timestamp; `new Date("2026-06-30").getTime()`) |
| Status „erledigt" / „in Arbeit" / „offen" | `status: "CLOSED"` / `"IN_PROGRESS"` / `"OPEN"` |
| capaType | alle `"CORRECTIVE"` außer eindeutig präventiv (Nr. 4 Nachfolgeregelung → `"PREVENTIVE"`) |
| sourceType | Nr. 3, 6, 10 stammen lt. Fußnote aus FB 5.4.1/5.6.0 → `"QUALITY_OBJECTIVE"` bzw. `"MGMT_REVIEW"`; Nr. 11 (QSV-Eskalation aus Audit) → `"AUDIT"`; Rest `"MANUAL"` |

Die 11 Einträge manuell als `scripts/out/capas-2026.json` (`{"items":[…]}`) kuratieren — bei 11 Zeilen zuverlässiger als ein Parser. Beispiel-Eintrag (Nr. 11):

```json
{
  "capaNumber": "CAPA-2026-11",
  "title": "QSV ausstehend – Eskalation",
  "description": "Mail 11.06.25 + 20.04.26 + Telefonat 29.04.26 dokumentiert; nächster Schritt: Einschreiben mit 14-Tage-Frist; Plan B Ersatz-Lieferant in FB 7.4.1 vorbereitet.",
  "effectivenessCriterion": "Unterzeichnete QSV oder dokumentierter Lieferantenwechsel",
  "responsible": "Einkauf / BDL",
  "dueAt": 1782770400000,
  "capaType": "CORRECTIVE",
  "sourceType": "AUDIT",
  "status": "IN_PROGRESS"
}
```

Dann:

```bash
npx convex run capas:seedFromImport "$(cat scripts/out/capas-2026.json)"
```
Expected: `{ inserted: 11, skipped: 0 }`. **Achtung Nummernkreis:** `nextCapaNumber` zählt ab der höchsten Bestands-`seq` weiter — nach dem Seed beginnen neue 2026er-CAPAs bei CAPA-2026-12. Seed daher **vor** dem ersten produktiven CAPA-Anlegen ausführen.

- [ ] **Step 6: Commit** (JSON-Ausgaben nicht einchecken — enthalten reale QM-Daten)

```bash
echo "scripts/out/" >> .gitignore
git add scripts/import-audit-checklist.mjs convex/capas.ts .gitignore
git commit -m "feat(audit/capa): Seed-Import für Checkliste v5 und CAPA-Liste 2026"
```

---

### Task 10: UI — Audit-Liste

**Files:**
- Modify: `app/(dashboard)/audits/page.tsx` (Platzhalter komplett ersetzen)

- [ ] **Step 1: Seite ersetzen**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
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
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  AUDIT_STATUS_LABELS, AUDIT_TYPE_LABELS, type AuditStatus, type AuditType,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AuditRow {
  _id: string;
  title: string;
  auditYear: number;
  auditType: string;
  status: string;
  auditDate?: number;
  templateVersion?: number;
}

const STATUS_VARIANT: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  REPORT_DRAFT: "bg-purple-100 text-purple-800",
  CLOSED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function AuditsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const audits = useQuery(api.audits.list, {});
  const createAudit = useMutation(api.audits.create);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    auditYear: new Date().getFullYear(),
    auditType: "INTERNAL" as AuditType,
    auditTeam: "",
    location: "",
    reportingPeriod: "",
    plannedFor: "",
  });

  async function handleCreate() {
    if (!form.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    try {
      const id = await createAudit({
        title: form.title,
        auditYear: form.auditYear,
        auditType: form.auditType,
        auditTeam: form.auditTeam || undefined,
        location: form.location || undefined,
        reportingPeriod: form.reportingPeriod || undefined,
        plannedFor: form.plannedFor || undefined,
      });
      setOpen(false);
      toast.success("Audit angelegt — Checkliste wurde eingefroren");
      router.push(`/audits/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<AuditRow>[] = [
    { key: "title", header: "Titel", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "year", header: "Jahr", cell: (r) => r.auditYear },
    { key: "type", header: "Typ", cell: (r) => AUDIT_TYPE_LABELS[r.auditType as AuditType] ?? r.auditType },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge className={STATUS_VARIANT[r.status] ?? ""} variant="secondary">
          {AUDIT_STATUS_LABELS[r.status as AuditStatus] ?? r.status}
        </Badge>
      ),
    },
    { key: "date", header: "Auditdatum", cell: (r) => (r.auditDate ? formatDate(r.auditDate) : "—") },
    { key: "tpl", header: "Checkliste", cell: (r) => (r.templateVersion ? `v${r.templateVersion}` : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interne Audits"
        description="Planung, Durchführung und Nachverfolgung interner Audits (ISO 13485 Kap. 8.2.4)"
      >
        {can("audits:manage") && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Audit anlegen
          </Button>
        )}
      </PageHeader>

      <DataTable
        columns={columns}
        data={(audits ?? []) as AuditRow[]}
        onRowClick={(r) => router.push(`/audits/${r._id}`)}
        emptyMessage="Noch keine Audits vorhanden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Audit anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titel</Label>
              <Input id="title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={`Internes Audit ${form.auditYear}`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Jahr</Label>
                <Input id="year" type="number" value={form.auditYear}
                  onChange={(e) => setForm({ ...form, auditYear: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={form.auditType}
                  onValueChange={(v) => setForm({ ...form, auditType: v as AuditType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="team">Auditteam</Label>
              <Input id="team" value={form.auditTeam}
                onChange={(e) => setForm({ ...form, auditTeam: e.target.value })}
                placeholder="Leitender Auditor, Fachexperten …" />
            </div>
            <div>
              <Label htmlFor="loc">Standort</Label>
              <Input id="loc" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="period">Berichtszeitraum</Label>
                <Input id="period" value={form.reportingPeriod}
                  onChange={(e) => setForm({ ...form, reportingPeriod: e.target.value })}
                  placeholder="01.01.2025 – 31.12.2025" />
              </div>
              <div>
                <Label htmlFor="planned">Geplant für</Label>
                <Input id="planned" value={form.plannedFor}
                  onChange={(e) => setForm({ ...form, plannedFor: e.target.value })}
                  placeholder="05/2026" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate}>Anlegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/audits/page.tsx"
git commit -m "feat(audit): Audit-Liste ersetzt Platzhalterseite"
```

---

### Task 11: Auditbericht-PDF-Exporter

**Files:**
- Create: `lib/export/audit-report-exporter.ts`

- [ ] **Step 1: Datei anlegen** (jsPDF-Idiom analog `lib/export/document-exporter.ts`; FB-Kennung gemäß Design §5)

```ts
import { jsPDF } from "jspdf";
import {
  AUDIT_RATING_LABELS, FINDING_CLASSIFICATION_LABELS,
  type AuditRating, type FindingClassification,
} from "@/lib/types/enums";

export interface AuditReportData {
  title: string;
  formNumber: string;          // "8.2.4"
  revision: string;            // z.B. "Rev. 1 (App)"
  auditTeam?: string;
  leadAuditorName?: string | null;
  basis?: string;
  location?: string;
  reportingPeriod?: string;
  auditDate?: number;
  templateVersion?: number;
  summaryResult?: string;
  chapterSummaries?: { chapter: string; summary: string }[];
  answers: { chapter: string; chapterTitle: string; rating?: string }[];
  findings: { chapter?: string; classification: string; description: string; capaNumber?: string }[];
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export function buildAuditReportPdf(data: AuditReportData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();
  const stand = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > 277) { doc.addPage(); y = MARGIN; }
  }
  function heading(text: string) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(text, MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal").setFontSize(10);
  }
  function prose(text: string) {
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 2;
  }
  function metaRow(label: string, value: string) {
    ensureSpace(8);
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", CONTENT_WIDTH - 55);
    doc.text(lines, MARGIN + 55, y);
    y += Math.max(5, lines.length * 4.5) + 1.5;
  }

  // Kopf mit FB-Kennung
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(`${data.formNumber} Auditbericht`, MARGIN, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text(`FB ${data.formNumber} · ${data.revision} · Stand ${stand}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setTextColor(0);
  y += 10;

  metaRow("Titel", data.title);
  metaRow("Leitender Auditor", data.leadAuditorName ?? "—");
  metaRow("Auditteam", data.auditTeam ?? "—");
  metaRow("Basis des Audits", data.basis ?? "—");
  metaRow("Standort", data.location ?? "—");
  metaRow("Berichtszeitraum", data.reportingPeriod ?? "—");
  metaRow("Auditdatum", data.auditDate ? new Date(data.auditDate).toLocaleDateString("de-DE") : "—");
  metaRow("Checklisten-Version", data.templateVersion ? `v${data.templateVersion}` : "—");
  y += 4;

  // Bewertungsübersicht
  heading("Bewertungsübersicht");
  const counts: Record<string, number> = {};
  for (const a of data.answers) {
    if (a.rating) counts[a.rating] = (counts[a.rating] ?? 0) + 1;
  }
  const total = data.answers.length;
  const rated = Object.values(counts).reduce((s, n) => s + n, 0);
  prose(
    `${rated} von ${total} Prüfpunkten bewertet: ` +
    (Object.entries(counts)
      .map(([r, n]) => `${AUDIT_RATING_LABELS[r as AuditRating] ?? r}: ${n}`)
      .join(" · ") || "keine Bewertungen")
  );

  // Zusammenfassendes Ergebnis
  if (data.summaryResult) {
    heading("Zusammenfassendes Ergebnis");
    prose(data.summaryResult);
  }

  // Abschnitte je Norm-Kapitel
  for (const cs of data.chapterSummaries ?? []) {
    heading(cs.chapter);
    prose(cs.summary);
  }

  // Findings
  heading(`Feststellungen (${data.findings.length})`);
  if (data.findings.length === 0) {
    prose("Keine Feststellungen.");
  }
  for (const f of data.findings) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold").setFontSize(10);
    const label = FINDING_CLASSIFICATION_LABELS[f.classification as FindingClassification] ?? f.classification;
    doc.text(
      `${label}${f.chapter ? ` · Kap. ${f.chapter}` : ""}${f.capaNumber ? ` · ${f.capaNumber}` : ""}`,
      MARGIN, y
    );
    y += 5;
    doc.setFont("helvetica", "normal");
    prose(f.description);
  }

  // Unterschriften
  ensureSpace(30);
  y += 12;
  doc.line(MARGIN, y, MARGIN + 70, y);
  doc.line(PAGE_WIDTH - MARGIN - 70, y, PAGE_WIDTH - MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Datum, Unterschrift Auditor/-in", MARGIN, y);
  doc.text("Datum, Unterschrift Geschäftsführung", PAGE_WIDTH - MARGIN - 70, y);

  // Fußzeile mit Seitenzahlen
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100);
    doc.text(`FB ${data.formNumber} Auditbericht · ${data.revision}`, MARGIN, 290);
    doc.text(`Seite ${i} von ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  }
  return doc;
}

/** Browser-Download */
export function downloadAuditReport(data: AuditReportData, fileName: string): void {
  buildAuditReportPdf(data).save(fileName);
}

/** Blob für das Einfrieren in Convex-Storage */
export function auditReportBlob(data: AuditReportData): Blob {
  return buildAuditReportPdf(data).output("blob");
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add lib/export/audit-report-exporter.ts
git commit -m "feat(audit): Auditbericht-PDF mit FB-Kennung, Bewertungsübersicht, Findings"
```

---

### Task 12: UI — Audit-Detail (Checkliste, Findings, Bericht)

**Files:**
- Create: `app/(dashboard)/audits/[id]/page.tsx`

- [ ] **Step 1: Seite anlegen** — drei Bereiche: Kopf/Status, Checkliste (Zeilen-Dialog), Findings + Bericht:

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  AUDIT_STATUS_LABELS, AUDIT_RATING_LABELS, AUDIT_RATING_DESCRIPTIONS,
  FINDING_CLASSIFICATION_LABELS, AUDIT_RATINGS, FINDING_CLASSIFICATIONS,
  type AuditStatus, type AuditRating, type FindingClassification,
} from "@/lib/types/enums";
import { downloadAuditReport, auditReportBlob } from "@/lib/export/audit-report-exporter";
import { toast } from "sonner";

type Answer = {
  _id: Id<"auditChecklistAnswers">;
  chapter: string; chapterTitle: string; requirements: string;
  rating?: string; evidence?: string; sample?: string;
  interviewedWith?: string; comments?: string;
};
type Finding = {
  _id: Id<"auditFindings">;
  chapter?: string; classification: string; description: string;
  capaId?: Id<"capas">; status: string;
};

const RATING_COLOR: Record<string, string> = {
  KONFORM: "bg-green-100 text-green-800",
  ABWEICHUNG: "bg-red-100 text-red-800",
  FESTSTELLUNG: "bg-amber-100 text-amber-800",
  EMPFEHLUNG: "bg-blue-100 text-blue-800",
  NICHT_ANWENDBAR: "bg-gray-100 text-gray-600",
};

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const auditId = params.id as Id<"audits">;
  const { can } = usePermissions();

  const audit = useQuery(api.audits.getById, { id: auditId });
  const setStatus = useMutation(api.audits.setStatus);
  const updateAnswer = useMutation(api.audits.updateAnswer);
  const updateSummary = useMutation(api.audits.updateSummary);
  const generateUploadUrl = useMutation(api.audits.generateUploadUrl);
  const attachReport = useMutation(api.audits.attachReport);
  const createFinding = useMutation(api.auditFindings.create);
  const createCapaFromFinding = useMutation(api.capas.createFromFinding);

  const [editAnswer, setEditAnswer] = useState<Answer | null>(null);
  const [answerForm, setAnswerForm] = useState({
    rating: "" as string, evidence: "", sample: "", interviewedWith: "", comments: "",
  });
  const [findingFor, setFindingFor] = useState<Answer | null>(null);
  const [findingForm, setFindingForm] = useState({
    classification: "FESTSTELLUNG" as FindingClassification, description: "",
  });
  const [summary, setSummary] = useState<string | null>(null);

  if (audit === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (audit === null) return <div className="p-8">Audit nicht gefunden.</div>;

  const canManage = can("audits:manage");
  const canReport = can("audits:report");
  const editable = audit.status === "IN_PROGRESS";

  function openAnswer(a: Answer) {
    setAnswerForm({
      rating: a.rating ?? "", evidence: a.evidence ?? "", sample: a.sample ?? "",
      interviewedWith: a.interviewedWith ?? "", comments: a.comments ?? "",
    });
    setEditAnswer(a);
  }

  async function saveAnswer() {
    if (!editAnswer) return;
    try {
      await updateAnswer({
        id: editAnswer._id,
        rating: (answerForm.rating || undefined) as AuditRating | undefined,
        evidence: answerForm.evidence || undefined,
        sample: answerForm.sample || undefined,
        interviewedWith: answerForm.interviewedWith || undefined,
        comments: answerForm.comments || undefined,
      });
      setEditAnswer(null);
      toast.success("Prüfpunkt gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function saveFinding() {
    if (!findingFor || !findingForm.description.trim()) {
      toast.error("Beschreibung ist erforderlich");
      return;
    }
    try {
      await createFinding({
        auditId, answerId: findingFor._id,
        classification: findingForm.classification,
        description: findingForm.description,
      });
      setFindingFor(null);
      setFindingForm({ classification: "FESTSTELLUNG", description: "" });
      toast.success("Finding erfasst");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleCapa(finding: Finding) {
    try {
      await createCapaFromFinding({ findingId: finding._id, capaType: "CORRECTIVE" });
      toast.success("CAPA-Vorschlag angelegt — unter CAPA weiter bearbeiten");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  function reportData() {
    return {
      title: audit!.title,
      formNumber: "8.2.4",
      revision: "Rev. 1 (App)",
      auditTeam: audit!.auditTeam,
      leadAuditorName: audit!.leadAuditorName,
      basis: audit!.basis,
      location: audit!.location,
      reportingPeriod: audit!.reportingPeriod,
      auditDate: audit!.auditDate,
      templateVersion: audit!.templateVersion,
      summaryResult: audit!.summaryResult,
      chapterSummaries: audit!.chapterSummaries,
      answers: audit!.answers,
      findings: audit!.findings.map((f: Finding) => ({
        chapter: f.chapter, classification: f.classification, description: f.description,
      })),
    };
  }

  async function freezeReport() {
    try {
      const blob = auditReportBlob(reportData());
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      const { storageId } = await res.json();
      await attachReport({ id: auditId, reportFileId: storageId });
      toast.success("Bericht-PDF am Audit eingefroren");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Einfrieren");
    }
  }

  const transitions: Partial<Record<AuditStatus, { to: string; label: string }[]>> = {
    PLANNED: [{ to: "IN_PROGRESS", label: "Audit starten" }, { to: "CANCELLED", label: "Abbrechen" }],
    IN_PROGRESS: [{ to: "REPORT_DRAFT", label: "Zum Berichtsentwurf" }],
    REPORT_DRAFT: [
      { to: "CLOSED", label: "Audit abschließen" },
      { to: "IN_PROGRESS", label: "Zurück zur Durchführung" },
    ],
  };

  return (
    <div className="space-y-6">
      <PageHeader title={audit.title} description={`Audit ${audit.auditYear} · Checkliste v${audit.templateVersion ?? "—"}`}>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {AUDIT_STATUS_LABELS[audit.status as AuditStatus] ?? audit.status}
          </Badge>
          {canManage && (transitions[audit.status as AuditStatus] ?? []).map((t) => (
            <Button key={t.to} variant={t.to === "CANCELLED" ? "outline" : "default"} size="sm"
              onClick={async () => {
                try { await setStatus({ id: auditId, status: t.to }); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
              }}>
              {t.label}
            </Button>
          ))}
        </div>
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Kopfdaten</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Leitender Auditor: </span>{audit.leadAuditorName ?? "—"}</div>
          <div><span className="text-muted-foreground">Auditteam: </span>{audit.auditTeam ?? "—"}</div>
          <div><span className="text-muted-foreground">Standort: </span>{audit.location ?? "—"}</div>
          <div><span className="text-muted-foreground">Berichtszeitraum: </span>{audit.reportingPeriod ?? "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Basis: </span>{audit.basis ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Checkliste ({audit.answers.filter((a: Answer) => a.rating).length}/{audit.answers.length} bewertet)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {audit.answers.map((a: Answer) => (
            <button key={a._id} type="button"
              onClick={() => (editable && canManage ? openAnswer(a) : undefined)}
              className="flex w-full items-start gap-3 rounded-md border p-3 text-left hover:bg-muted/50 disabled:cursor-default"
              disabled={!editable || !canManage}>
              <span className="w-14 shrink-0 font-mono text-sm">{a.chapter}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{a.chapterTitle}</span>
                <span className="block text-xs text-muted-foreground line-clamp-2">{a.requirements}</span>
              </span>
              <Badge className={RATING_COLOR[a.rating ?? ""] ?? "bg-gray-50 text-gray-400"} variant="secondary">
                {a.rating ? AUDIT_RATING_LABELS[a.rating as AuditRating] : "offen"}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Findings ({audit.findings.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {audit.findings.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Keine Findings. Findings werden aus bewerteten Prüfpunkten heraus erfasst (Dialog → „Finding erfassen").
            </p>
          )}
          {audit.findings.map((f: Finding) => (
            <div key={f._id} className="flex items-start gap-3 rounded-md border p-3">
              <Badge className={RATING_COLOR[f.classification] ?? ""} variant="secondary">
                {FINDING_CLASSIFICATION_LABELS[f.classification as FindingClassification]}
              </Badge>
              <div className="flex-1 text-sm">
                {f.chapter && <span className="mr-2 font-mono text-xs">Kap. {f.chapter}</span>}
                {f.description}
              </div>
              {f.capaId ? (
                <Badge variant="outline">CAPA verknüpft</Badge>
              ) : (
                can("capa:create") && f.classification !== "EMPFEHLUNG" && (
                  <Button size="sm" variant="outline" onClick={() => handleCapa(f)}>CAPA anlegen</Button>
                )
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {(audit.status === "REPORT_DRAFT" || audit.status === "CLOSED") && (
        <Card>
          <CardHeader><CardTitle>Auditbericht</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="summary">Zusammenfassendes Ergebnis</Label>
              <Textarea id="summary" rows={6}
                value={summary ?? audit.summaryResult ?? ""}
                onChange={(e) => setSummary(e.target.value)}
                disabled={audit.status === "CLOSED" || !canReport} />
            </div>
            <div className="flex gap-2">
              {audit.status === "REPORT_DRAFT" && canReport && (
                <Button variant="outline"
                  onClick={async () => {
                    try {
                      await updateSummary({ id: auditId, summaryResult: summary ?? audit.summaryResult ?? "" });
                      toast.success("Berichtstext gespeichert");
                    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                  }}>
                  Text speichern
                </Button>
              )}
              <Button variant="outline" onClick={() => downloadAuditReport(reportData(), `FB_8_2_4_Auditbericht_${audit.auditYear}.pdf`)}>
                PDF herunterladen
              </Button>
              {audit.status === "REPORT_DRAFT" && canReport && (
                <Button onClick={freezeReport}>PDF einfrieren (Nachweis)</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prüfpunkt-Dialog */}
      <Dialog open={!!editAnswer} onOpenChange={(o) => !o && setEditAnswer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editAnswer?.chapter} — {editAnswer?.chapterTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{editAnswer?.requirements}</p>
          <div className="space-y-3">
            <div>
              <Label>Bewertung</Label>
              <Select value={answerForm.rating}
                onValueChange={(v) => setAnswerForm({ ...answerForm, rating: v })}>
                <SelectTrigger><SelectValue placeholder="Bewertung wählen" /></SelectTrigger>
                <SelectContent>
                  {AUDIT_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {AUDIT_RATING_LABELS[r]} — {AUDIT_RATING_DESCRIPTIONS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="evidence">Nachweis (PA/AA/FB/QMH inkl. Revisionsstand)</Label>
              <Textarea id="evidence" rows={2} value={answerForm.evidence}
                onChange={(e) => setAnswerForm({ ...answerForm, evidence: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sample">Stichprobe (konkrete Aufzeichnung)</Label>
              <Textarea id="sample" rows={2} value={answerForm.sample}
                onChange={(e) => setAnswerForm({ ...answerForm, sample: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="interview">Gespräch mit</Label>
              <Input id="interview" value={answerForm.interviewedWith}
                onChange={(e) => setAnswerForm({ ...answerForm, interviewedWith: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="comments">Bemerkungen</Label>
              <Textarea id="comments" rows={2} value={answerForm.comments}
                onChange={(e) => setAnswerForm({ ...answerForm, comments: e.target.value })} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline"
                disabled={!["ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG"].includes(answerForm.rating)}
                onClick={() => {
                  setFindingFor(editAnswer);
                  setFindingForm({
                    classification: answerForm.rating as FindingClassification,
                    description: answerForm.comments || "",
                  });
                }}>
                Finding erfassen
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditAnswer(null)}>Abbrechen</Button>
                <Button onClick={saveAnswer}>Speichern</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finding-Dialog */}
      <Dialog open={!!findingFor} onOpenChange={(o) => !o && setFindingFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finding erfassen — Kap. {findingFor?.chapter}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Klassifizierung</Label>
              <Select value={findingForm.classification}
                onValueChange={(v) => setFindingForm({ ...findingForm, classification: v as FindingClassification })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>{FINDING_CLASSIFICATION_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fdesc">Beschreibung</Label>
              <Textarea id="fdesc" rows={4} value={findingForm.description}
                onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFindingFor(null)}>Abbrechen</Button>
              <Button onClick={saveFinding}>Erfassen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Hinweis für den Implementierer: `chapterSummaries`-Editor (Abschnitt je Norm-Kapitel wie im echten Bericht) ist bewusst **nicht** in diesem Task — YAGNI, das Feld existiert im Schema und im PDF-Renderer; UI dafür kommt, wenn der erste echte Bericht es braucht. `updateSummary` deckt das Zusammenfassende Ergebnis ab.

- [ ] **Step 2: Typecheck + Lint + Commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

```bash
git add "app/(dashboard)/audits/[id]/page.tsx"
git commit -m "feat(audit): Audit-Detail mit Checklisten-Durchführung, Findings, Bericht"
```

---

### Task 13: UI — CAPA-Liste + Detail

**Files:**
- Modify: `app/(dashboard)/capa/page.tsx` (Platzhalter ersetzen)
- Create: `app/(dashboard)/capa/[id]/page.tsx`

- [ ] **Step 1: Liste ersetzen** — `app/(dashboard)/capa/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
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
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  CAPA_STATUS_LABELS, CAPA_TYPE_LABELS, CAPA_SOURCE_TYPE_LABELS, CAPA_STATUSES,
  type CapaStatus, type CapaType, type CapaSourceType,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CapaRow {
  _id: string;
  capaNumber: string;
  title: string;
  capaType: string;
  sourceType: string;
  status: string;
  dueAt?: number;
}

const CAPA_STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-red-100 text-red-800",
  ANALYSIS: "bg-amber-100 text-amber-800",
  MEASURES_DEFINED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  EFFECTIVENESS_CHECK: "bg-purple-100 text-purple-800",
  CLOSED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function CapaPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const capas = useQuery(api.capas.list,
    statusFilter === "ALL" ? {} : { status: statusFilter });
  const createCapa = useMutation(api.capas.create);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", responsible: "", effectivenessCriterion: "",
    capaType: "CORRECTIVE" as CapaType,
    sourceType: "MANUAL" as CapaSourceType,
  });

  async function handleCreate() {
    if (!form.title.trim()) { toast.error("Titel ist erforderlich"); return; }
    try {
      const id = await createCapa({
        title: form.title,
        description: form.description || undefined,
        responsible: form.responsible || undefined,
        effectivenessCriterion: form.effectivenessCriterion || undefined,
        capaType: form.capaType,
        sourceType: form.sourceType,
      });
      setOpen(false);
      router.push(`/capa/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<CapaRow>[] = [
    { key: "number", header: "Nummer", cell: (r) => <span className="font-mono">{r.capaNumber}</span> },
    { key: "title", header: "Titel", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "type", header: "Typ", cell: (r) => CAPA_TYPE_LABELS[r.capaType as CapaType] ?? r.capaType },
    { key: "source", header: "Quelle", cell: (r) => CAPA_SOURCE_TYPE_LABELS[r.sourceType as CapaSourceType] ?? r.sourceType },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge className={CAPA_STATUS_COLOR[r.status] ?? ""} variant="secondary">
          {CAPA_STATUS_LABELS[r.status as CapaStatus] ?? r.status}
        </Badge>
      ),
    },
    { key: "due", header: "Fällig", cell: (r) => (r.dueAt ? formatDate(r.dueAt) : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="CAPA — Korrektur- & Vorbeugemaßnahmen"
        description="ISO 13485 Kap. 8.5.2 / 8.5.3 — Nummernkreis CAPA-Jahr-Nr."
      >
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Status</SelectItem>
              {CAPA_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{CAPA_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {can("capa:create") && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> CAPA anlegen
            </Button>
          )}
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        data={(capas ?? []) as CapaRow[]}
        onRowClick={(r) => router.push(`/capa/${r._id}`)}
        emptyMessage="Keine CAPAs vorhanden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>CAPA anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ctitle">Titel</Label>
              <Input id="ctitle" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cdesc">Beschreibung</Label>
              <Textarea id="cdesc" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Typ</Label>
                <Select value={form.capaType}
                  onValueChange={(v) => setForm({ ...form, capaType: v as CapaType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAPA_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quelle</Label>
                <Select value={form.sourceType}
                  onValueChange={(v) => setForm({ ...form, sourceType: v as CapaSourceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAPA_SOURCE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="cresp">Verantwortlich (Rolle/Bereich)</Label>
              <Input id="cresp" value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                placeholder="z.B. BDL / IT" />
            </div>
            <div>
              <Label htmlFor="ccrit">Wirksamkeitskriterium (vorab definieren)</Label>
              <Textarea id="ccrit" rows={2} value={form.effectivenessCriterion}
                onChange={(e) => setForm({ ...form, effectivenessCriterion: e.target.value })}
                placeholder='z.B. "Q3/Q4-Auswertung ≥ 95 %"' />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate}>Anlegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Detailseite anlegen** — `app/(dashboard)/capa/[id]/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  CAPA_STATUS_LABELS, CAPA_TYPE_LABELS, CAPA_SOURCE_TYPE_LABELS,
  type CapaStatus, type CapaType, type CapaSourceType,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Measure = {
  _id: Id<"capaMeasures">;
  description: string; status: string; dueAt?: number; doneAt?: number;
};

// Übergänge gespiegelt zur capaStatus-State-Machine (convex/lib/stateMachine.ts)
const NEXT: Partial<Record<CapaStatus, { to: string; label: string }[]>> = {
  OPEN: [{ to: "ANALYSIS", label: "Ursachenanalyse starten" }, { to: "CANCELLED", label: "Abbrechen" }],
  ANALYSIS: [{ to: "MEASURES_DEFINED", label: "Maßnahmen definiert" }],
  MEASURES_DEFINED: [{ to: "IN_PROGRESS", label: "Umsetzung starten" }],
  IN_PROGRESS: [{ to: "EFFECTIVENESS_CHECK", label: "Zur Wirksamkeitsprüfung" }],
  EFFECTIVENESS_CHECK: [
    { to: "CLOSED", label: "Abschließen" },
    { to: "IN_PROGRESS", label: "Zurück in Umsetzung" },
  ],
};

export default function CapaDetailPage() {
  const params = useParams<{ id: string }>();
  const capaId = params.id as Id<"capas">;
  const { can } = usePermissions();

  const capa = useQuery(api.capas.getById, { id: capaId });
  const update = useMutation(api.capas.update);
  const setStatus = useMutation(api.capas.setStatus);
  const recordEffectiveness = useMutation(api.capas.recordEffectiveness);
  const addMeasure = useMutation(api.capas.addMeasure);
  const completeMeasure = useMutation(api.capas.completeMeasure);

  const [rootCause, setRootCause] = useState<string | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureDesc, setMeasureDesc] = useState("");
  const [effOpen, setEffOpen] = useState(false);
  const [effForm, setEffForm] = useState({ result: "EFFECTIVE" as "EFFECTIVE" | "INEFFECTIVE", note: "" });

  if (capa === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (capa === null) return <div className="p-8">CAPA nicht gefunden.</div>;

  const canManage = can("capa:manage");
  const closed = capa.status === "CLOSED" || capa.status === "CANCELLED";

  async function transition(to: string) {
    try {
      await setStatus({ id: capaId, status: to });
      toast.success("Status geändert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`${capa.capaNumber} — ${capa.title}`}
        description={`${CAPA_TYPE_LABELS[capa.capaType as CapaType]} · Quelle: ${CAPA_SOURCE_TYPE_LABELS[capa.sourceType as CapaSourceType]}`}>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{CAPA_STATUS_LABELS[capa.status as CapaStatus] ?? capa.status}</Badge>
          {canManage && (NEXT[capa.status as CapaStatus] ?? []).map((t) => (
            <Button key={t.to} size="sm"
              variant={t.to === "CANCELLED" ? "outline" : "default"}
              disabled={t.to === "CLOSED" && capa.effectivenessResult !== "EFFECTIVE"}
              onClick={() => transition(t.to)}>
              {t.label}
            </Button>
          ))}
        </div>
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Beschreibung & Ursachenanalyse</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{capa.description ?? "—"}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Verantwortlich (Rolle/Bereich): </span>
            {capa.responsible ?? capa.assigneeName ?? "—"}
            {capa.dueAt && <span className="text-muted-foreground"> · Termin: {formatDate(capa.dueAt)}</span>}
          </p>
          <div>
            <Label htmlFor="rootcause">Ursachenanalyse (8.5.2 b)</Label>
            <Textarea id="rootcause" rows={4}
              value={rootCause ?? capa.rootCauseAnalysis ?? ""}
              onChange={(e) => setRootCause(e.target.value)}
              disabled={closed || !canManage} />
            {!closed && canManage && (
              <Button className="mt-2" size="sm" variant="outline"
                onClick={async () => {
                  try {
                    await update({ id: capaId, rootCauseAnalysis: rootCause ?? capa.rootCauseAnalysis ?? "" });
                    toast.success("Ursachenanalyse gespeichert");
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                }}>
                Speichern
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Maßnahmen ({capa.measures.filter((m: Measure) => m.status === "DONE").length}/{capa.measures.length} erledigt)
          </CardTitle>
          {!closed && canManage && (
            <Button size="sm" onClick={() => setMeasureOpen(true)}>Maßnahme hinzufügen</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {capa.measures.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Maßnahmen definiert.</p>
          )}
          {capa.measures.map((m: Measure) => (
            <div key={m._id} className="flex items-center gap-3 rounded-md border p-3">
              <span className={`flex-1 text-sm ${m.status === "DONE" ? "text-muted-foreground line-through" : ""}`}>
                {m.description}
              </span>
              <span className="text-xs text-muted-foreground">
                {m.status === "DONE" && m.doneAt ? `erledigt ${formatDate(m.doneAt)}` : m.dueAt ? `fällig ${formatDate(m.dueAt)}` : ""}
              </span>
              {m.status === "OPEN" && canManage && !closed && (
                <Button size="sm" variant="outline"
                  onClick={async () => {
                    try { await completeMeasure({ id: m._id }); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                  }}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Erledigt
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Wirksamkeitsprüfung (8.5.2 e)</CardTitle>
          {capa.status === "EFFECTIVENESS_CHECK" && canManage && (
            <Button size="sm" onClick={() => setEffOpen(true)}>Prüfung dokumentieren</Button>
          )}
        </CardHeader>
        <CardContent className="text-sm">
          {capa.effectivenessCriterion && (
            <p className="mb-2">
              <span className="text-muted-foreground">Kriterium (vorab definiert): </span>
              {capa.effectivenessCriterion}
            </p>
          )}
          {capa.effectivenessResult ? (
            <div className="space-y-1">
              <Badge variant="secondary"
                className={capa.effectivenessResult === "EFFECTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {capa.effectivenessResult === "EFFECTIVE" ? "Wirksam" : "Nicht wirksam"}
              </Badge>
              <p className="whitespace-pre-wrap">{capa.effectivenessNote}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Noch nicht dokumentiert. Abschluss der CAPA ist erst nach dokumentiert wirksamer Prüfung möglich.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Maßnahmen-Dialog */}
      <Dialog open={measureOpen} onOpenChange={setMeasureOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Maßnahme hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="mdesc">Beschreibung</Label>
              <Textarea id="mdesc" rows={3} value={measureDesc}
                onChange={(e) => setMeasureDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMeasureOpen(false)}>Abbrechen</Button>
              <Button onClick={async () => {
                if (!measureDesc.trim()) { toast.error("Beschreibung ist erforderlich"); return; }
                try {
                  await addMeasure({ capaId, description: measureDesc });
                  setMeasureDesc(""); setMeasureOpen(false);
                } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
              }}>
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wirksamkeits-Dialog */}
      <Dialog open={effOpen} onOpenChange={setEffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wirksamkeitsprüfung dokumentieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ergebnis</Label>
              <Select value={effForm.result}
                onValueChange={(v) => setEffForm({ ...effForm, result: v as "EFFECTIVE" | "INEFFECTIVE" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFFECTIVE">Wirksam</SelectItem>
                  <SelectItem value="INEFFECTIVE">Nicht wirksam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="effnote">Begründung / Nachweis</Label>
              <Textarea id="effnote" rows={4} value={effForm.note}
                onChange={(e) => setEffForm({ ...effForm, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEffOpen(false)}>Abbrechen</Button>
              <Button onClick={async () => {
                if (!effForm.note.trim()) { toast.error("Begründung ist erforderlich"); return; }
                try {
                  await recordEffectiveness({
                    id: capaId,
                    effectivenessResult: effForm.result,
                    effectivenessNote: effForm.note,
                  });
                  setEffOpen(false);
                } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
              }}>
                Dokumentieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + Lint + Commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

```bash
git add "app/(dashboard)/capa/page.tsx" "app/(dashboard)/capa/[id]/page.tsx"
git commit -m "feat(capa): CAPA-Liste und Detail mit Maßnahmen und Wirksamkeitsprüfung"
```

---

### Task 14: Sidebar — Audits + CAPA aus „In Planung" befördern

**Files:**
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Einträge verschieben** — in `navSections`: die beiden Zeilen

```tsx
{ label: "Interne Audits", href: "/audits", icon: ClipboardCheck, featureFlag: "AUDITS", badge: "IN PLANUNG" },
{ label: "CAPA", href: "/capa", icon: AlertTriangle, featureFlag: "CAPA", badge: "IN PLANUNG" },
```

aus der Sektion `title: "In Planung"` **entfernen** und in die Qualitätsmanagement-Sektion (dieselbe, die „Dokumente"/„Schulungen" enthält) **ohne `badge`** einfügen:

```tsx
{ label: "Interne Audits", href: "/audits", icon: ClipboardCheck, featureFlag: "AUDITS" },
{ label: "CAPA", href: "/capa", icon: AlertTriangle, featureFlag: "CAPA" },
```

Die Feature-Flags `AUDITS`/`CAPA` bleiben als Rollout-Schalter (Aktivierung in Admin → Einstellungen).

- [ ] **Step 2: Typecheck + Lint + Commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

```bash
git add components/layout/sidebar.tsx
git commit -m "feat(audit/capa): Sidebar-Einträge aus In-Planung befördern"
```

---

### Task 15: End-Verifikation

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Build erfolgreich, keine Typ-/Lint-Fehler.

- [ ] **Step 2: Preview-Walkthrough** (Dev-Server + Browser; Feature-Flags `AUDITS` und `CAPA` in Admin → Einstellungen aktivieren)

1. Als QMB: `/audits` → „Audit anlegen" → Detail öffnet sich, Checkliste zeigt alle Seed-Prüfpunkte aus v5, Status „Geplant".
2. „Audit starten" → Prüfpunkt 4.1.1 öffnen → Bewertung „Feststellung" + Nachweis setzen → „Finding erfassen" → Finding erscheint in der Findings-Karte.
3. Beim Finding „CAPA anlegen" → `/capa`: neue CAPA mit Nummer `CAPA-2026-<n>` (nach Seed der 2026er-Liste muss `<n>` **hinter** der höchsten Bestandsnummer liegen), Quelle „Audit", Beschreibung enthält Finding-Text.
4. CAPA durchspielen: Ursachenanalyse → Maßnahme anlegen → erledigen → Wirksamkeitsprüfung „Wirksam" → Abschließen. Gegentest: Abschluss **vor** dokumentierter Prüfung muss mit Fehlermeldung scheitern.
5. Audit: „Zum Berichtsentwurf" → Zusammenfassung schreiben → „PDF herunterladen" (Kopf mit „FB 8.2.4 · Rev. 1 (App)", Bewertungsübersicht, Finding inkl. Klassifizierung, Unterschriftszeilen) → „PDF einfrieren" → „Audit abschließen" → Prüfpunkte sind nicht mehr editierbar.
6. Als `employee` einloggen: `/audits` und `/capa` dürfen nicht zugreifbar sein (Permission-Fehler/leer); als `auditor`: Audit anlegen/durchführen möglich, CAPA-Abschluss nicht.
7. Audit-Trail prüfen: Admin → Audit-Log zeigt CREATE/UPDATE/STATUS_CHANGE-Einträge für `audits`, `auditFindings`, `capas`.

- [ ] **Step 3: Abschluss-Commit**

```bash
git add -A
git commit -m "feat(audit/capa): Phase 1 QM-Jahreszyklus abgeschlossen"
```

---

## Selbst-Review (durchgeführt beim Schreiben)

- **Spec-Abdeckung:** Vorlagen-Versionierung ✓ (Task 5), Einfrieren je Audit ✓ (Task 6 `create`), Bewertungslegende des echten FB ✓ (Task 1), Finding→CAPA halbautomatisch ✓ (Task 8 `createFromFinding`, Task 12 Button), CAPA-Nummernkreis ✓ (Task 8 `nextCapaNumber`), Wirksamkeitsprüfung als Abschluss-Voraussetzung ✓ (Task 8 `setStatus`), PDF mit FB-Kennung + Einfrieren ✓ (Tasks 11/12), Seed v5 + CAPA-Liste ✓ (Task 9), RBAC ✓ (Task 3), Soft-Delete + Audit-Trail ✓ (durchgängig). **Nicht in Phase 1:** Auditplan-Jahresübersicht (Teil der Phase-7-Automatik), `chapterSummaries`-Editor (Schema+PDF vorhanden, UI bei Bedarf), Reklamationen (Phase 2).
- **Typ-Konsistenz:** `capas`/`capaMeasures`/`auditChecklistAnswers`-Feldnamen zwischen Schema (Task 2), Convex-Modulen (Tasks 5–8) und UI (Tasks 10–13) abgeglichen; `createFromFinding` setzt `sourceType: "AUDIT"` und verlinkt `finding.capaId` zurück.
- **Bekannte Anpassungspunkte für den Implementierer:** (a) exakte Spaltenreihenfolge der xlsx in Task 9 gegen die echte Datei verifizieren; (b) `PageHeader`-Children-API und Button-/Badge-Varianten ggf. an die tatsächlichen Komponenten-Props anpassen; (c) falls `internalMutation` in `capas.ts` bereits importiert ist, Doppel-Import vermeiden.

---

## Änderungshistorie

**2026-06-10 (Rev. 2) — nach vollständiger Dokumenten-Analyse** (alle 12 Quelldateien lokal in `PDF/` extrahiert):
1. `capas`-Schema + UI + Seed um `responsible` (Freitext-Rollen wie „BDL / IT" aus dem echten FB) und `effectivenessCriterion` (vorab definiertes „Wirksam: …"-Kriterium, wie in allen 11 echten CAPAs) erweitert.
2. `capaSourceType` um `QUALITY_OBJECTIVE` ergänzt — FB 5.4.1 Rev. 8 verlangt CAPA-Verknüpfung für jedes gelbe/rote Q-Ziel (CAPA-2026-01/-02/-03 stammen aus Zielen); erspart Schema-Migration in Phase 3.
3. Task 9 auf lokale Quellen (`PDF/`) umgestellt; CAPA-Seed jetzt vollständig spezifiziert (11 Einträge, Spalten-/Status-Mapping verifiziert, Nummernkreis-Warnung). Checklisten-xlsx wird von Kristof nachgeliefert — Vorbedingung.
4. Beschluss bestätigt: Auditplan-Jahresmatrix (5 Themen-Audits, SOLL/IST je Monat) bleibt in Phase 7; dort `area`/`plannedMonths`-Nachmigration auf `audits` einplanen.

**2026-06-10 (Rev. 3):** Checklisten-xlsx nachgeliefert (`PDF/8 2 4 Auditcheckliste_2026_v5.xlsx` — Leerzeichen statt Unterstriche). Dry-Run der Import-Logik gegen die echte Datei bestanden: 60 Prüfpunkte, Spaltenlayout bestätigt, Deckblatt-Blatt mit Kopfdaten vorhanden. Task 9 auf den tatsächlichen Pfad und die verifizierte Erwartung aktualisiert; PDF-Fallback (Variante B) obsolet.


---

## Übergabe — verbleibende Nutzer-Schritte (Stand 2026-06-10, Implementierung abgeschlossen)

Implementiert auf Branch `feature/qm-phase1-audit-capa` (Tasks 1–15, Build grün). Ohne Convex-Projektzugriff in der Implementierungs-Session konnten Schema-Push, Seeding und Browser-Walkthrough nicht ausgeführt werden — diese Schritte macht der Nutzer in einem interaktiven Terminal:

```bash
# 1. Schema + Funktionen deployen (regeneriert auch convex/_generated sauber)
npx convex dev --once

# 2. Checklisten-Vorlage v5 seeden (60 Prüfpunkte)
node scripts/import-audit-checklist.mjs "PDF/8 2 4 Auditcheckliste_2026_v5.xlsx"
node -e 'const d=require("./scripts/out/audit-checklist-v5.json");process.stdout.write(JSON.stringify(d.template))' > /tmp/seed-template.json
npx convex run auditTemplates:seedFromImport "$(cat /tmp/seed-template.json)"
# Erwartet: { skipped: false, items: 60 } — zweiter Lauf: { skipped: true }

# 3. CAPA-Liste 2026 seeden — VOR dem ersten produktiven CAPA-Anlegen (Nummernkreis!)
npx convex run capas:seedFromImport "$(cat scripts/out/capas-2026.json)"
# Erwartet: { inserted: 11, skipped: 0 } — nächste neue CAPA wird CAPA-2026-12

# 4. Feature-Flags AUDITS und CAPA in Admin → Einstellungen anlegen/aktivieren
#    (Default ist AUS — die Sidebar-Einträge erscheinen erst nach Aktivierung)
```

Danach den **Runtime-Verifikations-Walkthrough** aus dem Final-Review durchspielen (Audit-Kette als QMB, CAPA-Workflow inkl. Gegentests, Bericht-PDF inkl. Einfrieren, Rollen-Tests als employee/auditor, Audit-Trail-Prüfung).

**Dokumentierte Folgepunkte (bewusst nicht in Phase 1):**
- Vorlagen-Verwaltungs-UI (v6 anlegen/aktivieren) — bis dahin per `npx convex run auditTemplates:*`
- `audits.updateHeader`/`archive`, `auditFindings.resolve`, CAPA-Zuweisungs-Picker (`assigneeId`), `effectivenessDueAt` — Server-API existiert, UI folgt bei Bedarf
- Audit-Abbruch ab IN_PROGRESS und CAPA-Abbruch ab ANALYSIS serverseitig erlaubt, in der UI bewusst nicht angeboten
- Die extrahierten 2026er-Antworten (`answers` in audit-checklist-v5.json) sind ungenutzt — ein historischer Audit-Instanz-Seed wäre möglich, war aber nicht Seed-Scope
- `lib/validators/*` für Audit/CAPA derzeit ungenutzt (UI validiert manuell, Server hat eigene Guards)
