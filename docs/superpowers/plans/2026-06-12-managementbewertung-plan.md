# Managementbewertung: ISO-Gliederung + eigene Punkte + 2025-Import — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die feste Gliederung der Managementbewertung wird ISO-13485-§5.6.2-vollständig (2.4-Titel erweitert, neu 2.9 Regulatorische Anforderungen, neu 2.10 Folgemaßnahmen auto-befüllt aus Vorjahres-Maßnahmen), eigene Punkte ab 2.11 bekommen CRUD mit Vorjahresübernahme, und die echte Managementbewertung 2025 wird aus dem PDF importiert.

**Architecture:** Die 10 festen Abschnitte bleiben im zentralen Enum `MGMT_REVIEW_SECTIONS`; eigene Punkte werden als Section-Einträge mit `custom: true` + gespeichertem `title` im `sections`-Array abgelegt (Keys `custom-<timestamp>`). Detailseite, `reportData()`/Freeze und PDF-Exporter stellen von Enum-Iteration auf `review.sections`-Iteration um (Titel-Auflösung: fest → Enum, custom → `2.<lfd. Nr.> <title>`). `buildAutoData` bekommt den Key `followup` (Maßnahmenliste der Vorjahres-Bewertung); ein gemeinsamer Helper `rebuildSections` sorgt in `refreshAutoData` und einer internen Migration dafür, dass fehlende feste Abschnitte in Enum-Reihenfolge ergänzt werden (eigene Punkte bleiben dahinter). Der 2025-Import läuft als interne Mutation + internalAction für das Original-PDF (Base64 → Storage), exakt nach dem Audit-Import-Muster.

**Tech Stack:** Next.js 15 (App Router), Convex (Mutations/internalAction, Storage, OCC read-modify-write), Tailwind v4 + shadcn/ui, jsPDF.

**Verifikation:** Kein Test-Framework im Repo — Hauskonvention: `npx tsc --noEmit` + `npx convex dev --once` pro Convex-Task, Commit pro Task, am Ende Browser-Walkthrough (Memory „Runtime-Verifikation Pflicht").

**Beschluss-Referenz:** Grill-me-Interview 2026-06-12, Punkt 5 (Memory `qm-backlog-beschluesse-2026-06`): Auditor monierte fehlende §5.6.2-Eingaben. Beschlossen: 2.4 um „Überwachung und Messung von Prozessen und Produkten" erweitern; NEU 2.9 Regulatorische Anforderungen; NEU 2.10 Folgemaßnahmen (auto aus Vorjahres-Maßnahmen); eigene Punkte ab 2.11 mit CRUD im Entwurf + automatischer Vorjahresübernahme; die 8 ISO-Pflichtpunkte (jetzt 10) bleiben fix und nicht löschbar; 2025er-Bewertung aus `PDF/5 6 0 Managementbewertung2025.pdf` einmalig importieren (inkl. der 4 Maßnahmen, Status freigegeben, Original-PDF als Nachweis).

**Verifizierte Fakten (2026-06-12):**
- In der DB existiert bereits ein 2026er-**Entwurf** (`qh72agy9fdysrfc98bcx9a3jpd88gafb`, 8 Abschnitte, 0 Maßnahmen) — die Migration muss ihm 2.9/2.10 nachrüsten; KEINE 2025er-Bewertung vorhanden (Import-Guard frei).
- `MGMT_REVIEW_SECTIONS` wird nur an 4 Stellen konsumiert: `lib/types/enums.ts` (Definition), `convex/managementReviews.ts`, `app/(dashboard)/management-review/[id]/page.tsx`, `lib/export/mgmt-review-exporter.ts`. Die Listen-Seite ist NICHT betroffen.
- `updateSection` matcht per `findIndex(s => s.key === args.key)` — funktioniert für Custom-Keys unverändert.
- Alle Content-Mutations rufen `invalidateFrozenReport` auf (eingefrorenes PDF wird bei Änderungen entwertet) — die neuen Custom-CRUD-Mutationen müssen das auch tun.
- Inhalte der 2025er-Bewertung (aus dem PDF, Rev. 8, gelesen 2026-06-12): 8 Abschnitts-Texte, Gesamtbewertung, 4 Maßnahmen (Schulungssystem/QM/Q4 2026/Audit · Kommunikation/GF/laufend/Feedback · Dokumentation/QM/Q3 2026/Stichproben · IT-Sicherheit/IT u. QM/Q3 2026/Überprüfung), Verbesserungen — vollständig im Import-Payload in Task 6.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `lib/types/enums.ts` | Modify | MGMT_REVIEW_SECTIONS: 2.4-Titel + 2.9 + 2.10 |
| `convex/schema.ts` | Modify | Section-Item: `title`/`custom` optional |
| `convex/managementReviews.ts` | Modify | buildAutoData (followup), rebuildSections, createDraft (Carryover), refreshAutoData, Migration, Custom-CRUD, Import + PDF-Action |
| `lib/export/mgmt-review-exporter.ts` | Modify | Abschnitte dynamisch aus Daten (title im Interface) |
| `app/(dashboard)/management-review/[id]/page.tsx` | Modify | review.sections iterieren, Custom-CRUD-UI, reportData/freeze |

**Ausführungskontext:** Auf Branch arbeiten: `git checkout -b feature/managementbewertung` (vor Task 1). Convex-Push nach jedem Convex-Task: `npx convex dev --once`.

---

### Task 1: Enum — Abschnitte erweitern

**Files:**
- Modify: `lib/types/enums.ts` (MGMT_REVIEW_SECTIONS, ~Zeile 530)

- [ ] **Step 1: Enum ersetzen** — den Block `export const MGMT_REVIEW_SECTIONS = [...]` ersetzen durch:

```ts
// Feste Abschnitte gemäß ISO 13485 §5.6.2 (FB 5.6.0; 2.9/2.10 ergänzt nach
// Auditor-Hinweis 2026: regulatorische Anforderungen + Folgemaßnahmen fehlten)
export const MGMT_REVIEW_SECTIONS = [
  { key: "audits", title: "2.1 Audits" },
  { key: "complaints", title: "2.2 Kundenfeedback / Reklamationen" },
  { key: "pms", title: "2.3 PMS" },
  { key: "processes", title: "2.4 Prozesse — Überwachung und Messung von Prozessen und Produkten" },
  { key: "capa", title: "2.5 CAPA" },
  { key: "changes", title: "2.6 Änderungen" },
  { key: "resources", title: "2.7 Ressourcen" },
  { key: "risks", title: "2.8 Risiken & Chancen" },
  { key: "regulatory", title: "2.9 Regulatorische Anforderungen" },
  { key: "followup", title: "2.10 Folgemaßnahmen aus vorangegangenen Managementbewertungen" },
] as const;
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` wird hier voraussichtlich FEHLSCHLAGEN, weil `buildAutoData` in `convex/managementReviews.ts` ein `Record<SectionKey, …>` ohne die neuen Keys zurückgibt. Das ist erwartet und wird in Task 3 behoben. Übergangsweise für diesen Commit in `convex/managementReviews.ts` im `return`-Objekt von `buildAutoData` (Zeile 189–198) zwei Zeilen ergänzen:

```ts
    regulatory: undefined,
    followup: undefined,
```

Dann: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add lib/types/enums.ts convex/managementReviews.ts
git commit -m "feat(mgmt-review): Abschnitte 2.9 Regulatorische Anforderungen + 2.10 Folgemaßnahmen, 2.4-Titel erweitert (ISO 13485 §5.6.2)"
```

---

### Task 2: Schema — Section-Item um `title`/`custom` erweitern

**Files:**
- Modify: `convex/schema.ts` (managementReviews.sections, ~Zeile 891)

- [ ] **Step 1: Objekt erweitern** — in der `managementReviews`-Tabelle das `sections`-Array-Objekt ändern von:

```ts
    sections: v.array(v.object({
      key: v.string(),                     // audits|complaints|pms|processes|capa|changes|resources|risks
      autoData: v.optional(v.string()),    // Daten-Snapshot (beim Anlegen generiert, einfrierbar)
      assessment: v.optional(v.string()),  // Prosa "Bewertung: …"
    })),
```

zu:

```ts
    sections: v.array(v.object({
      key: v.string(),                     // feste Keys (MGMT_REVIEW_SECTIONS) oder "custom-<ts>"
      title: v.optional(v.string()),       // nur eigene Punkte — feste Titel kommen aus dem Enum
      custom: v.optional(v.boolean()),     // true = eigener Punkt (CRUD im Entwurf, ab 2.11)
      autoData: v.optional(v.string()),    // Daten-Snapshot (beim Anlegen generiert, einfrierbar)
      assessment: v.optional(v.string()),  // Prosa "Bewertung: …"
    })),
```

- [ ] **Step 2: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(mgmt-review): Schema — Section-Items mit title/custom für eigene Punkte"
```

---

### Task 3: Convex — followup-AutoData, rebuildSections, createDraft-Carryover, Migration

**Files:**
- Modify: `convex/managementReviews.ts` (buildAutoData ~Zeile 27–199; createDraft ~Zeile 261; refreshAutoData ~Zeile 328; Import oben; neue internalMutation)

- [ ] **Step 1: Import erweitern** — Zeile 2 ändern von:

```ts
import { query, mutation } from "./_generated/server";
```

zu:

```ts
import { query, mutation, internalMutation } from "./_generated/server";
```

- [ ] **Step 2: `buildAutoData` um followup ergänzen** — am Anfang des Handlers (nach `const now = Date.now();`, Zeile 34) einfügen:

```ts
  // 2.10 Folgemaßnahmen: Maßnahmenliste der Vorjahres-Bewertung
  const prevReview = await ctx.db
    .query("managementReviews")
    .withIndex("by_year", (q) => q.eq("year", year - 1))
    .filter((q) => q.eq(q.field("isArchived"), false))
    .first();
```

und vor dem `return`-Block (Zeile ~189) einfügen:

```ts
  // ── 2.10 Folgemaßnahmen aus vorangegangenen Managementbewertungen ──
  let followupAutoData: string | undefined;
  if (prevReview && prevReview.measures.length > 0) {
    const lines = prevReview.measures.map((m) => {
      const meta = [m.responsible, m.dueText].filter(Boolean).join(", ");
      return `• ${m.description}${meta ? ` (${meta})` : ""}`;
    });
    followupAutoData = `Maßnahmen aus der Managementbewertung ${year - 1}:\n${lines.join("\n")}`;
  } else if (prevReview) {
    followupAutoData = `Managementbewertung ${year - 1} ohne erfasste Maßnahmen`;
  } else {
    followupAutoData = `Keine Managementbewertung ${year - 1} in der App erfasst`;
  }
```

Im `return`-Objekt die beiden Übergangszeilen aus Task 1 ersetzen durch:

```ts
    regulatory: undefined,   // rein manueller Abschnitt — nichts erfinden
    followup: followupAutoData,
```

- [ ] **Step 3: Helper `rebuildSections` nach `invalidateFrozenReport` (Zeile ~215) einfügen:**

```ts
// ============================================================
// rebuildSections — feste Abschnitte in Enum-Reihenfolge (fehlende werden
// ergänzt, autoData aufgefrischt, assessments bleiben), eigene Punkte
// unverändert dahinter. Genutzt von refreshAutoData + Migration.
// ============================================================

type ReviewSection = Doc<"managementReviews">["sections"][number];

function rebuildSections(
  sections: ReviewSection[],
  autoDataByKey: Record<SectionKey, string | undefined>
): ReviewSection[] {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const fixed: ReviewSection[] = SECTION_KEYS.map((key) => {
    const existing = byKey.get(key);
    return {
      key,
      title: undefined,
      custom: undefined,
      autoData: autoDataByKey[key] ?? existing?.autoData,
      assessment: existing?.assessment,
    };
  });
  const customs = sections.filter((s) => s.custom === true);
  return [...fixed, ...customs];
}
```

- [ ] **Step 4: `refreshAutoData` auf den Helper umstellen** — im Handler den Block

```ts
    // Read-modify-write — unter Convex OCC (optimistic concurrency control) korrekt:
    // Convex transaktioniert read+write atomar, Konflikte werden automatisch zurückgerollt.
    const updatedSections = review.sections.map((s) => ({
      ...s,
      // autoData wird neu gesetzt; assessment bleibt erhalten
      autoData: autoDataByKey[s.key as SectionKey] ?? s.autoData,
    }));
```

ersetzen durch:

```ts
    // Read-modify-write — unter Convex OCC (optimistic concurrency control) korrekt:
    // Convex transaktioniert read+write atomar, Konflikte werden automatisch zurückgerollt.
    // rebuildSections ergänzt dabei auch neue feste Abschnitte (2.9/2.10) in Bestandsentwürfen.
    const updatedSections = rebuildSections(review.sections, autoDataByKey);
```

- [ ] **Step 5: `createDraft` — 10 Abschnitte + Custom-Carryover** — im Handler den Block

```ts
    // Sections-Array nach FB-Reihenfolge (2.1–2.8)
    const sections = SECTION_KEYS.map((key) => ({
      key,
      autoData: autoDataByKey[key],
      assessment: undefined as string | undefined,
    }));
```

ersetzen durch:

```ts
    // Sections-Array nach FB-Reihenfolge (2.1–2.10) + eigene Punkte des
    // Vorjahres (leer übernommen — Beschluss 2026-06-12: Vorjahresübernahme)
    const prevReview = await ctx.db
      .query("managementReviews")
      .withIndex("by_year", (q) => q.eq("year", args.year - 1))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    const carriedCustoms = (prevReview?.sections ?? [])
      .filter((s) => s.custom === true)
      .map((s) => ({
        key: s.key,
        title: s.title,
        custom: true as const,
        autoData: undefined as string | undefined,
        assessment: undefined as string | undefined,
      }));
    const sections = [
      ...SECTION_KEYS.map((key) => ({
        key,
        title: undefined as string | undefined,
        custom: undefined as boolean | undefined,
        autoData: autoDataByKey[key],
        assessment: undefined as string | undefined,
      })),
      ...carriedCustoms,
    ];
```

- [ ] **Step 6: Interne Migration ans Dateiende anfügen:**

```ts
// ============================================================
// migrateSectionsToV2 — Einmal-Migration (npx convex run): rüstet
// Bestands-ENTWÜRFEN die neuen festen Abschnitte 2.9/2.10 nach
// (inkl. frischem autoData). Freigegebene Bewertungen bleiben
// unangetastet (eingefrorener Nachweis). Idempotent.
// ============================================================

export const migrateSectionsToV2 = internalMutation({
  args: {},
  handler: async (ctx) => {
    const reviews = await ctx.db
      .query("managementReviews")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    let migrated = 0;
    for (const review of reviews) {
      if (review.status !== "DRAFT") continue;
      const existingKeys = new Set(review.sections.map((s) => s.key));
      const missing = SECTION_KEYS.filter((k) => !existingKeys.has(k));
      if (missing.length === 0) continue;

      const autoDataByKey = await buildAutoData(ctx, review.year);
      const patch: Partial<Doc<"managementReviews">> = {
        sections: rebuildSections(review.sections, autoDataByKey),
        updatedAt: Date.now(),
      };
      invalidateFrozenReport(review, patch);
      await ctx.db.patch(review._id, patch);

      await logAuditEvent(ctx, {
        action: "UPDATE",
        entityType: "managementReviews",
        entityId: review._id,
        metadata: { migration: "sections-v2", added: missing },
      });
      migrated++;
    }
    return { migrated };
  },
});
```

- [ ] **Step 7: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 8: Commit**

```bash
git add convex/managementReviews.ts
git commit -m "feat(mgmt-review): followup-AutoData aus Vorjahres-Maßnahmen, rebuildSections, Custom-Carryover, Migration"
```

---

### Task 4: Convex — Custom-Section-CRUD

**Files:**
- Modify: `convex/managementReviews.ts` (nach `updateSection` einfügen)

Eigene Punkte: nur im ENTWURF anleg-/umbenenn-/löschbar; feste Abschnitte sind nicht löschbar (Guard über `custom`-Flag). Bewertungstexte eigener Punkte laufen über das bestehende `updateSection` (matcht per Key). Alle drei Mutationen entwerten das eingefrorene PDF.

- [ ] **Step 1: Drei Mutationen nach `updateSection` einfügen:**

```ts
// ============================================================
// 5b. addCustomSection / renameCustomSection / removeCustomSection
// Eigene Eingabe-Punkte (ab 2.11) — nur DRAFT, feste Punkte unantastbar
// ============================================================

export const addCustomSection = mutation({
  args: {
    id: v.id("managementReviews"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Eigene Punkte können nur im Entwurf ergänzt werden");
    }
    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");

    const newSection = {
      key: `custom-${Date.now()}`,
      title,
      custom: true,
      autoData: undefined as string | undefined,
      assessment: undefined as string | undefined,
    };

    const patch: Partial<Doc<"managementReviews">> = {
      sections: [...review.sections, newSection],
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patch);
    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { addedCustomSection: title },
    });
    return newSection.key;
  },
});

export const renameCustomSection = mutation({
  args: {
    id: v.id("managementReviews"),
    key: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Eigene Punkte können nur im Entwurf geändert werden");
    }
    const title = args.title.trim();
    if (!title) throw new Error("Titel ist erforderlich");

    const section = review.sections.find((s) => s.key === args.key);
    if (!section) throw new Error(`Unbekannter Abschnitt: ${args.key}`);
    if (section.custom !== true) {
      throw new Error("Feste Abschnitte können nicht umbenannt werden");
    }

    const patch: Partial<Doc<"managementReviews">> = {
      sections: review.sections.map((s) =>
        s.key === args.key ? { ...s, title } : s
      ),
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patch);
    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { renamedCustomSection: args.key, title },
    });
  },
});

export const removeCustomSection = mutation({
  args: {
    id: v.id("managementReviews"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "mgmtReview:manage");

    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    if (review.status !== "DRAFT") {
      throw new Error("Eigene Punkte können nur im Entwurf entfernt werden");
    }

    const section = review.sections.find((s) => s.key === args.key);
    if (!section) throw new Error(`Unbekannter Abschnitt: ${args.key}`);
    if (section.custom !== true) {
      throw new Error("Feste Abschnitte (ISO 13485 §5.6.2) können nicht entfernt werden");
    }

    const patch: Partial<Doc<"managementReviews">> = {
      sections: review.sections.filter((s) => s.key !== args.key),
      updatedAt: Date.now(),
      updatedBy: user._id,
    };
    invalidateFrozenReport(review, patch);
    await ctx.db.patch(args.id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "managementReviews",
      entityId: args.id,
      changes: { removedCustomSection: section.title ?? args.key },
    });
  },
});
```

- [ ] **Step 2: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add convex/managementReviews.ts
git commit -m "feat(mgmt-review): eigene Eingabe-Punkte — anlegen/umbenennen/entfernen (nur Entwurf, feste Punkte geschützt)"
```

---

### Task 5: Convex — Import-Backend für die 2025er-Bewertung

**Files:**
- Modify: `convex/managementReviews.ts` (Imports + zwei Funktionen ans Dateiende)

- [ ] **Step 1: Imports erweitern** — Zeile 2 (nach Task 3 bereits mit internalMutation) ändern zu:

```ts
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
```

und nach Zeile 3 einfügen:

```ts
import { internal } from "./_generated/api";
```

- [ ] **Step 2: Import-Mutation + PDF-Action ans Dateiende anfügen:**

```ts
// ============================================================
// importReview2025 — Einmal-Import (npx convex run) der realen
// Managementbewertung 2025 aus FB 5.6.0 Rev. 8. Legt den Datensatz
// als DRAFT an; finalizeImport (über importReportPdf) hängt das
// Original-PDF an und setzt APPROVED. Guard: Jahr darf nicht belegt sein.
// ============================================================

export const importReview2025 = internalMutation({
  args: {
    year: v.number(),
    reportingPeriod: v.string(),
    participants: v.optional(v.string()),
    companyNote: v.optional(v.string()),
    sections: v.array(v.object({
      key: v.string(),
      assessment: v.optional(v.string()),
    })),
    overallAssessment: v.optional(v.string()),
    measures: v.array(v.object({
      description: v.string(),
      responsible: v.optional(v.string()),
      dueText: v.optional(v.string()),
      effectivenessCheck: v.optional(v.string()),
    })),
    improvements: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("managementReviews")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (existing) {
      return { skipped: true, reason: `Bewertung ${args.year} existiert bereits`, reviewId: existing._id };
    }

    // Assessments aus der Payload auf die festen Abschnitte mappen;
    // autoData bleibt leer — für 2025 gibt es keine App-Daten (ehrlich).
    const byKey = new Map(args.sections.map((s) => [s.key, s.assessment]));
    const sections = SECTION_KEYS.map((key) => ({
      key,
      title: undefined as string | undefined,
      custom: undefined as boolean | undefined,
      autoData: undefined as string | undefined,
      assessment: byKey.get(key) ?? undefined,
    }));

    const now = Date.now();
    const id = await ctx.db.insert("managementReviews", {
      year: args.year,
      reportingPeriod: args.reportingPeriod,
      participants: args.participants,
      companyNote: args.companyNote,
      status: "DRAFT",
      sections,
      overallAssessment: args.overallAssessment,
      measures: args.measures,
      improvements: args.improvements,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "managementReviews",
      entityId: id,
      metadata: { import: "fb-5-6-0-rev8", year: args.year, measures: args.measures.length },
    });
    return { skipped: false, reviewId: id };
  },
});

export const finalizeImport = internalMutation({
  args: { id: v.id("managementReviews"), reportFileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const review = await ctx.db.get(args.id);
    if (!review) throw new Error("Managementbewertung nicht gefunden");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      reportFileId: args.reportFileId,
      status: "APPROVED",
      approvedAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      action: "STATUS_CHANGE",
      entityType: "managementReviews",
      entityId: args.id,
      previousStatus: "DRAFT",
      newStatus: "APPROVED",
      metadata: { import: true, reportFileId: args.reportFileId },
    });
  },
});

export const importReportPdf = internalAction({
  args: { reviewId: v.id("managementReviews"), base64: v.string() },
  handler: async (ctx, args) => {
    const bytes = Uint8Array.from(atob(args.base64), (c) => c.charCodeAt(0));
    const storageId = await ctx.storage.store(new Blob([bytes], { type: "application/pdf" }));
    await ctx.runMutation(internal.managementReviews.finalizeImport, {
      id: args.reviewId,
      reportFileId: storageId,
    });
    return { storageId };
  },
});
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/managementReviews.ts
git commit -m "feat(mgmt-review): Import-Backend für 2025-Bewertung (Daten + Original-PDF + Freigabe)"
```

---

### Task 6: Import + Migration ausführen

**Files:** keine Code-Dateien (Einmal-Daten-Task; Payload inline)

- [ ] **Step 1: Payload schreiben**

```bash
cat > /tmp/mgmt2025-import.json <<'EOF'
{
  "year": 2025,
  "reportingPeriod": "01.01.2025 – 31.12.2025",
  "participants": "Geschäftsführung, Qualitätsmanagement",
  "companyNote": "Sanitätshaus mit ca. 30 Mitarbeitenden an 4 Standorten",
  "sections": [
    { "key": "audits", "assessment": "Interne Audits durchgeführt. Externer Hinweis zur Integration der Fehlerbücher in PMS. Bewertung: QM-System entspricht Anforderungen." },
    { "key": "complaints", "assessment": "Ca. 20 Reklamationen, keine sicherheitsrelevanten Ereignisse. Keine systematischen Auffälligkeiten. Bewertung: stabil auf niedrigem Niveau." },
    { "key": "pms", "assessment": "Auswertung über OTWin (Reklamationen, interne und Lieferanten-Fehler, Wartung, Nachbeobachtung). Regelmäßige Wiedervorlagen (Prothesen, Einlagen). Keine neuen Risiken, keine Rückrufe. Bewertung: wirksam und MDR-konform." },
    { "key": "processes", "assessment": "Stabile Prozesse, kontinuierliche Anpassung durch Digitalisierung. Bewertung: beherrscht, Optimierungspotenzial vorhanden." },
    { "key": "capa", "assessment": "Maßnahmen: Schulungen, Digitalisierung, Personalentwicklung. Bewertung: geeignet, Weiterentwicklung notwendig." },
    { "key": "changes", "assessment": "IT-Erneuerung (Windows 11), geplante KI-/Security-Sensibilisierung. NIS-2 geprüft: keine Betroffenheit. Bewertung: angemessen umgesetzt." },
    { "key": "resources", "assessment": "Personal knapp, Schulungen regelmäßig aber ausbaufähig. Bewertung: ausreichend, kritisch beobachten." },
    { "key": "risks", "assessment": "Keine neuen Risiken. Chancen: Digitalisierung, Schulungssystem." }
  ],
  "overallAssessment": "QM-System ist geeignet, angemessen und wirksam. Anforderungen ISO 13485 & MDR erfüllt.",
  "measures": [
    { "description": "Schulungssystem verbessern", "responsible": "QM", "dueText": "Q4 2026", "effectivenessCheck": "Audit" },
    { "description": "Kommunikation verbessern", "responsible": "GF", "dueText": "laufend", "effectivenessCheck": "Feedback" },
    { "description": "Dokumentation verbessern", "responsible": "QM", "dueText": "Q3 2026", "effectivenessCheck": "Stichproben" },
    { "description": "IT-Sicherheit stärken", "responsible": "IT/QM", "dueText": "Q3 2026", "effectivenessCheck": "Überprüfung" }
  ],
  "improvements": "Schulungssystem ausbauen\nKommunikation verbessern\nDokumentation erhöhen"
}
EOF
```

(Abschnitte 2.9/2.10 bleiben für 2025 bewusst leer — das Rev.-8-Dokument enthielt sie nicht; der Importer legt sie als leere feste Abschnitte an.)

- [ ] **Step 2: Daten-Import ausführen**

Run: `npx convex run managementReviews:importReview2025 "$(cat /tmp/mgmt2025-import.json)"`
Expected: `{ skipped: false, reviewId: "..." }` — die reviewId für Step 3 notieren. Bei `skipped: true`: STOPP, Datenlage mit `npx convex data managementReviews` prüfen.

- [ ] **Step 3: Original-PDF anhängen + freigeben** — `<REVIEW_ID>` durch die reviewId aus Step 2 ersetzen:

```bash
python3 -c "
import base64, json
b64 = base64.b64encode(open('PDF/5 6 0 Managementbewertung2025.pdf', 'rb').read()).decode()
json.dump({'reviewId': '<REVIEW_ID>', 'base64': b64}, open('/tmp/mgmt2025-report.json', 'w'))
print('ok', len(b64))
"
npx convex run managementReviews:importReportPdf "$(cat /tmp/mgmt2025-report.json)"
```

Expected: `{ storageId: "..." }`

- [ ] **Step 4: Migration des 2026er-Entwurfs**

Run: `npx convex run managementReviews:migrateSectionsToV2`
Expected: `{ migrated: 1 }` — der bestehende 2026er-Entwurf (`qh72agy9fdysrfc98bcx9a3jpd88gafb`) bekommt 2.9 (leer) und 2.10 mit autoData „Maßnahmen aus der Managementbewertung 2025: • Schulungssystem verbessern (QM, Q4 2026) …" (4 Zeilen). Bei `{ migrated: 0 }`: prüfen, ob die Abschnitte schon vorhanden sind (Idempotenz) — sonst STOPP.

- [ ] **Step 5: Daten verifizieren**

```bash
npx convex data managementReviews --limit 5
```

Expected: 2 Datensätze — 2025 `APPROVED` mit 4 measures + reportFileId, 2026 `DRAFT` mit 10 Abschnitten (darunter `regulatory`, `followup` mit autoData)

- [ ] **Step 6: Commit** (nur Doku-Spur — die Payload lebt in diesem Plan)

```bash
git commit --allow-empty -m "chore(mgmt-review): Einmal-Import Managementbewertung 2025 + Migration 2026 ausgeführt (4 Maßnahmen, Original-PDF, APPROVED)"
```

---

### Task 7: PDF-Exporter — Abschnitte dynamisch

**Files:**
- Modify: `lib/export/mgmt-review-exporter.ts`

- [ ] **Step 1: Interface + Schleife umstellen**

Zeile 2 (`import { MGMT_REVIEW_SECTIONS } ...`) ersatzlos streichen.

Im Interface `MgmtReviewData` die `sections`-Zeile ändern von:

```ts
  sections: { key: string; autoData?: string; assessment?: string }[];
```

zu:

```ts
  // title wird vom Aufrufer aufgelöst (fest → Enum, eigene Punkte → "2.<n> <Titel>")
  sections: { key: string; title: string; autoData?: string; assessment?: string }[];
```

Die Abschnitts-Schleife (Zeile 85–114) ändern von:

```ts
  for (const section of MGMT_REVIEW_SECTIONS) {
    const sectionData = data.sections.find((s) => s.key === section.key);
    ensureSpace(20);

    // Sub-heading
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(section.title, MARGIN, y);
```

zu:

```ts
  for (const sectionData of data.sections) {
    ensureSpace(20);

    // Sub-heading
    doc.setFont("helvetica", "bold").setFontSize(11);
    const titleLines = doc.splitTextToSize(sectionData.title, CONTENT_WIDTH);
    doc.text(titleLines, MARGIN, y);
    y += 6 * titleLines.length;
    doc.setFont("helvetica", "normal").setFontSize(10);
```

**Achtung:** Im alten Code folgen nach `doc.text(section.title, MARGIN, y);` die Zeilen `y += 6;` und `doc.setFont("helvetica", "normal").setFontSize(10);` — diese beiden Zeilen sind im neuen Block oben bereits enthalten (mehrzeilige Titel wegen des langen 2.4-/2.10-Titels) und müssen mit ersetzt werden. Die Verweise auf `sectionData?.autoData` / `sectionData?.assessment` im Schleifenrumpf werden zu `sectionData.autoData` / `sectionData.assessment` (kein Optional-Chaining mehr nötig, das Objekt kommt direkt aus dem Array).

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` wird FEHLER in `app/(dashboard)/management-review/[id]/page.tsx` zeigen (sections ohne `title`). Das behebt Task 8 — für einen grünen Zwischenstand Task 7+8 in EINEM Commit zusammenfassen, falls der Implementierer beide Tasks nacheinander bearbeitet, ansonsten hier committen mit bekanntem Folgetask:

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: Fehler NUR in `app/(dashboard)/management-review/[id]/page.tsx` (fehlendes `title`)

- [ ] **Step 3: Commit** (zusammen mit Task 8 — siehe dort; KEIN eigener Commit hier)

---

### Task 8: Detail-Seite — dynamische Abschnitte + Custom-CRUD-UI

**Files:**
- Modify: `app/(dashboard)/management-review/[id]/page.tsx`

- [ ] **Step 1: Section-Typ + Titel-Auflösung** — nach dem `EnrichedMeasure`-Typ (Zeile 37) einfügen:

```tsx
type ReviewSection = {
  key: string;
  title?: string;
  custom?: boolean;
  autoData?: string;
  assessment?: string;
};

/** Titel auflösen: feste Abschnitte aus dem Enum, eigene Punkte nummeriert ab 2.11 */
function sectionTitle(section: ReviewSection, index: number): string {
  if (section.custom) return `2.${index + 1} ${section.title ?? ""}`;
  return MGMT_REVIEW_SECTIONS.find((m) => m.key === section.key)?.title ?? section.key;
}
```

- [ ] **Step 2: Mutations + State für Custom-CRUD** — nach `const createCapa = useMutation(api.capas.create);` (Zeile 65) einfügen:

```tsx
  const addCustomSection = useMutation(api.managementReviews.addCustomSection);
  const renameCustomSection = useMutation(api.managementReviews.renameCustomSection);
  const removeCustomSection = useMutation(api.managementReviews.removeCustomSection);
```

und bei den Dialog-States (nach `creatingCapaIndex`, Zeile 124):

```tsx
  // Eigener-Punkt-Dialog (anlegen/umbenennen)
  const [customDialog, setCustomDialog] = useState<{ open: boolean; key: string | null }>({
    open: false, key: null,
  });
  const [customTitle, setCustomTitle] = useState("");
```

- [ ] **Step 3: `reportData()` umstellen** — den `sections:`-Block (Zeile 148–156) ersetzen durch:

```tsx
      sections: (review!.sections as ReviewSection[]).map((serverSection, idx) => {
        const draft = getSectionDraft(serverSection.key);
        return {
          key: serverSection.key,
          title: sectionTitle(serverSection, idx),
          autoData: serverSection.autoData,
          assessment: draft !== null ? (draft || undefined) : serverSection.assessment,
        };
      }),
```

- [ ] **Step 4: `freezeReport()` umstellen** — den `sections:`-Block (Zeile 175–178) ersetzen durch:

```tsx
        sections: (review!.sections as ReviewSection[]).map((sec, idx) => ({
          key: sec.key,
          title: sectionTitle(sec, idx),
          autoData: sec.autoData,
          assessment: sec.assessment,
        })),
```

- [ ] **Step 5: Abschnitts-Rendering umstellen** — den Block ab `{MGMT_REVIEW_SECTIONS.map((section) => {` bis zur schließenden `})}`(Zeile 437–481) ersetzen durch:

```tsx
      {(review.sections as ReviewSection[]).map((serverSection, idx) => {
        const draftValue = getSectionDraft(serverSection.key);
        const assessmentValue = draftValue !== null ? draftValue : (serverSection.assessment ?? "");

        return (
          <Card key={serverSection.key}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{sectionTitle(serverSection, idx)}</CardTitle>
              {serverSection.custom && isDraft && canManage && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setCustomTitle(serverSection.title ?? "");
                    setCustomDialog({ open: true, key: serverSection.key });
                  }}>
                    Umbenennen
                  </Button>
                  <Button size="sm" variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      try {
                        await removeCustomSection({ id: reviewId, key: serverSection.key });
                        toast.success("Eigener Punkt entfernt");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Fehler");
                      }
                    }}>
                    Entfernen
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Auto data block */}
              {serverSection.autoData ? (
                <pre className="rounded bg-muted p-3 text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                  {serverSection.autoData}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Keine automatischen Daten (manueller Abschnitt)
                </p>
              )}
              {/* Assessment textarea */}
              <div>
                <Label htmlFor={`section-${serverSection.key}`}>Bewertung</Label>
                <Textarea
                  id={`section-${serverSection.key}`}
                  rows={4}
                  value={assessmentValue}
                  disabled={!isDraft || !canManage}
                  onChange={(e) => setSectionDraft(serverSection.key, e.target.value)}
                />
              </div>
              {isDraft && canManage && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => saveSectionAssessment(serverSection.key)}
                    disabled={draftValue === null}
                  >
                    Speichern
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Eigenen Punkt ergänzen (ab 2.11) */}
      {isDraft && canManage && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => {
            setCustomTitle("");
            setCustomDialog({ open: true, key: null });
          }}>
            Eigenen Punkt hinzufügen
          </Button>
        </div>
      )}
```

- [ ] **Step 6: Custom-Dialog einfügen** — vor dem `{/* Add Measure Dialog */}` (Zeile ~631) einfügen:

```tsx
      {/* Eigener-Punkt-Dialog (anlegen/umbenennen) */}
      <Dialog open={customDialog.open} onOpenChange={(o) => !o && setCustomDialog({ open: false, key: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {customDialog.key === null ? "Eigenen Punkt hinzufügen" : "Eigenen Punkt umbenennen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="custom-title">Titel</Label>
              <Input
                id="custom-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="z. B. Lieferantenbewertung"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Eigene Punkte werden hinter den festen Eingaben nummeriert (2.11, 2.12 …)
                und beim Anlegen der nächsten Jahresbewertung automatisch übernommen.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCustomDialog({ open: false, key: null })}>
                Abbrechen
              </Button>
              <Button onClick={async () => {
                if (!customTitle.trim()) {
                  toast.error("Titel ist erforderlich");
                  return;
                }
                try {
                  if (customDialog.key === null) {
                    await addCustomSection({ id: reviewId, title: customTitle });
                    toast.success("Eigener Punkt hinzugefügt");
                  } else {
                    await renameCustomSection({ id: reviewId, key: customDialog.key, title: customTitle });
                    toast.success("Punkt umbenannt");
                  }
                  setCustomDialog({ open: false, key: null });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Fehler");
                }
              }}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler (inkl. der Exporter-Umstellung aus Task 7)

- [ ] **Step 8: Commit (Tasks 7+8 gemeinsam — typkonsistenter Stand)**

```bash
git add lib/export/mgmt-review-exporter.ts "app/(dashboard)/management-review/[id]/page.tsx"
git commit -m "feat(mgmt-review): Abschnitte dynamisch aus review.sections (UI + PDF), eigene Punkte mit CRUD ab 2.11"
```

---

### Task 9: Runtime-Verifikation (Pflicht)

**Files:** keine Code-Änderungen (nur Fixes aus dem Walkthrough)

- [ ] **Step 1: Dev-Server frisch starten** (alten Prozess beenden — Stale-Server-Memory)

- [ ] **Step 2: Import + Migration prüfen**

1. `/management-review`: Liste zeigt 2025 (Freigegeben) und 2026 (Entwurf).
2. Bewertung 2025 öffnen: alle Felder read-only; 8 Abschnitte mit den importierten Texten + 2.9/2.10 leer; Gesamtbewertung, 4 Maßnahmen, Verbesserungen gefüllt; „Eingefrorenes PDF (Nachweis)" öffnet das Original (Rev. 8 mit Wiggers-Logo).
3. Bewertung 2026 (Entwurf) öffnen: 10 Abschnitte; 2.4 trägt den erweiterten Titel; 2.9 „Keine automatischen Daten"; 2.10 zeigt die 4 Maßnahmen aus 2025 als autoData-Block.

- [ ] **Step 3: Custom-CRUD + PDF prüfen** (im 2026er-Entwurf)

4. „Eigenen Punkt hinzufügen" → „Lieferantenbewertung (Test)" → erscheint als „2.11 Lieferantenbewertung (Test)" mit Bewertungs-Textarea; Text eintragen + speichern.
5. Umbenennen → Titel ändert sich; „PDF herunterladen" → Abschnitt 2.11 erscheint im PDF mit Titel + Bewertung; 2.10-autoData ebenfalls im PDF.
6. Feste Abschnitte haben KEINE Umbenennen/Entfernen-Buttons.
7. Test-Punkt entfernen → weg; „Daten aktualisieren" → 2.10-autoData bleibt/aktualisiert, keine Fehler.
8. Konsole ohne Fehler.

- [ ] **Step 4: Befunde fixen + Commit**

```bash
git add -A
git commit -m "fix(mgmt-review): Findings aus Runtime-Walkthrough"
```

(Entfällt, wenn der Walkthrough sauber durchläuft.)

---

## Bewusst NICHT in diesem Plan

- **Wareneingang / Prüfmittel / Berichtsarchiv** → eigene Pläne (Beschluss-Punkte 6–8)
- **Globale Gliederungs-Vorlage** (Umbenennen der festen Punkte) — im Interview explizit abgelehnt (ISO-Konformitätsrisiko)
- **autoData für 2.9 Regulatorische Anforderungen** — bewusst manuell (die App kennt keine Regulierungs-Datenquelle; nichts erfinden)
- **Nachrüsten von 2.9/2.10 in freigegebene Bewertungen** — freigegebene Nachweise bleiben unangetastet (auch die importierte 2025er)
