# Audit-Umbau: Ein-Audit-Modell + 2026-Import + Vorjahres-Übernahme + Vorlagen-UI — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interne Audits finden ein Mal pro Jahr statt (ein Audit-Datensatz, alle Bereiche); das echte Audit 2026 (Checkliste xlsx + Bericht-PDF) wird importiert; künftige Audits zeigen die Vorjahres-Antworten mit Übernehmen-Klick; die Checklisten-Vorlage bekommt eine Pflege-UI.

**Architecture:** Das interne Jahres-Audit trägt die FB-8.2.4-Themen-Zeilen als neues Array-Feld `planThemes` (Thema, Auditor/en, betroffene Bereiche). Die `planMatrix`-Query fächert dieses eine Audit in Themen-Zeilen auf und behält die **bisherige Ausgabeform** bei — Auditplan-Seite und PDF-Exporter bleiben bis auf einen React-Key unverändert. Externe Audits (Zerti-Überwachung) bleiben eigene Datensätze mit `area` wie bisher. Der Generator erzeugt künftig EIN internes Audit + Kopien der externen Plan-Audits. Migration + 2026-Import laufen als interne Mutationen über `npx convex run` (Haus-Muster `seedFromImport`); das Bericht-PDF kommt per Base64 über eine internalAction in den Convex-Storage. Vorjahres-Übernahme: Anzeige aller 4 Antwortfelder + Bewertung des Vorgänger-Audits (Matching per Kapitelnummer), Einzel-Übernahme clientseitig über das bestehende `updateAnswer`, Massen-Übernahme nur für Nachweise serverseitig (füllt ausschließlich leere Felder).

**Tech Stack:** Next.js 15 (App Router), Convex (Queries/Mutations/internalAction, Storage), Tailwind v4 + shadcn/ui, jsPDF (Exporter unverändert), Python 3 + openpyxl (Einmal-Import-Skript).

**Verifikation:** Kein Test-Framework im Repo — Hauskonvention: `npx tsc --noEmit` + Convex-Push pro Task, Commit pro Task, am Ende verpflichtender Browser-Walkthrough (Memory „Runtime-Verifikation Pflicht"). Bei 404 auf Detailrouten: Dev-Server neu starten (Memory „Stale-Dev-Server 404").

**Beschluss-Referenz:** Grill-me-Interview 2026-06-12, Punkt 4 (Memory `qm-backlog-beschluesse-2026-06`): Ein Audit/Jahr; Matrix behält 5 Themen-Zeilen; externes Zerti-Audit eigenständig; 2026er-Themen-Audits archivieren (verifiziert: 0 erfasste Antworten); Import in „Intern 2026"; Übernahme = alle 4 Felder anzeigen + einzeln übernehmbar, Massenaktion NUR Nachweis, Bewertung nie kopieren, Matching per Kapitelnummer; Vorlagen-UI mit vorhandenem Versionsmodell.

**Verifizierte Fakten (2026-06-12):**
- Live-Daten 2026: „Intern 2026" (`js70rnp191yapnkdkq17tmrzf988dnz7`, INTERNAL, PLANNED, ohne `area`), 4 interne Themen-Audits PLANNED + „Reha / Rollstuhl 2026" IN_PROGRESS (alle 60 Antworten leer), 1 externes „Überwachung-Zerti 13485" (PLANNED, `plannedMonths [6]`).
- `PDF/8 2 4 Auditcheckliste_2026_v5.xlsx`, Blatt „Auditcheckliste": 63 ausgefüllte Prüfpunkte (Spalten: Kap., Überschrift, Prüfpunkte, Bewertung, Nachweis, Stichprobe, Gespräch mit, Bemerkungen); Bewertungen: 53× Konform, 4× Feststellung, 2× Empfehlung, 4× nicht anwendbar. Blatt „Deckblatt": Auditdatum „04.05. - 05.05.26", Team „Thomas Wiggers, Regina Wiggers", Standort, Berichtszeitraum 01.01.2025 – 31.12.2025.
- Die eingefrorene App-Checkliste hat nur 60 Punkte — in der xlsx zusätzlich: **7.5.5, 7.5.7, 7.5.9.2** → der Import muss fehlende Kapitel als neue Antworten einfügen und die Reihenfolge (sortOrder) an der xlsx ausrichten.
- `PDF/8 2 4 Auditbericht_2026_Rev1.pdf`: Zusammenfassung, 5 Kapitel-Abschnitte (Kap. 4–8), 8 Feststellungen/Empfehlungen mit CAPA-Verweisen. In der DB existieren CAPA-2026-01 … CAPA-2026-13 (Index `by_number`); „CAPA-2026-07a/07b" aus dem Bericht heißt in der App `CAPA-2026-07`.
- SOLL-Monate: FB 8.2.4 Rev. 5 plant intern April (`[4]`), extern Juni (`[6]`) — real fand das interne Audit im Mai statt → IST-Kreuz erscheint amber (Plan-Abweichung). Das ist gewollt ehrlich; SOLL ist nachträglich im Kopfdaten-Dialog änderbar.
- `checkPlanDue` (Cron) funktioniert ohne Änderung weiter: er nutzt `plannedMonths`/`auditDate`/`status` und fällt für das Label auf `audit.title` zurück, wenn `area` fehlt.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `convex/schema.ts` | Modify | `planThemes`-Feld am Audit |
| `convex/audits.ts` | Modify | planMatrix-Umbau, updatePlanThemes, previousAnswers, adoptAllEvidence, Migration + Import (internal), Report-PDF-Action |
| `convex/yearCycle.ts` | Modify | Generator: 1 internes Audit + externe Kopien; Task-Text |
| `convex/auditTemplates.ts` | Modify | removeItem; activate sortiert Kapitel |
| `app/(dashboard)/audits/page.tsx` | Modify | Dialog: Thema nur extern, SOLL-Monate immer |
| `app/(dashboard)/audits/[id]/page.tsx` | Modify | Themen-Card, SOLL-Monate im Kopfdaten-Dialog, Vorjahres-Übernahme |
| `app/(dashboard)/audits/plan/page.tsx` | Modify | nur React-Key (`rowKey`) |
| `app/(dashboard)/audits/templates/page.tsx` | Create | Vorlagen-Pflege-UI |
| `components/layout/sidebar.tsx` | Modify | Link „Checklisten-Vorlage" |
| `scripts/build-audit2026-import.py` | Create | xlsx + Berichtstexte → JSON-Payload (Einmal-Import) |

**Ausführungskontext:** Auf Branch arbeiten: `git checkout -b feature/audit-umbau` (vor Task 1). Convex-Push nach jedem Convex-Task: `npx convex dev --once`.

---

### Task 1: Schema — `planThemes` am Audit

**Files:**
- Modify: `convex/schema.ts:732-734` (audits-Tabelle, nach `affectedAreas`)

- [ ] **Step 1: Feld ergänzen**

In der `audits`-Tabelle direkt nach der Zeile `affectedAreas: v.optional(v.string()),` einfügen:

```ts
    // Ein-Audit-Modell (Umbau 2026-06): Das interne Jahres-Audit trägt die
    // FB-8.2.4-Themen-Zeilen selbst; externe Audits nutzen weiterhin `area`.
    planThemes: v.optional(v.array(v.object({
      area: v.string(),                       // "Reha / Rollstuhl"
      auditTeam: v.optional(v.string()),      // "AL / MA" (Spalte Auditor/en)
      affectedAreas: v.optional(v.string()),  // "MA der Werkstatt und Außendienst"
    }))),
```

- [ ] **Step 2: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler, Schema deployed

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(audit): planThemes-Feld — internes Jahres-Audit trägt die FB-8.2.4-Themen-Zeilen"
```

---

### Task 2: planMatrix-Umbau + `updatePlanThemes` + React-Key-Fix

**Files:**
- Modify: `convex/audits.ts:373-400` (planMatrix ersetzen; updatePlanThemes danach einfügen)
- Modify: `app/(dashboard)/audits/plan/page.tsx:134` (React-Key)

Die Ausgabeform bleibt kompatibel (`_id`, `area`, `auditTeam`, `affectedAreas`, `plannedMonths`, `istMonth`, `status`, `title`) — neu ist nur `rowKey`, weil mehrere Zeilen jetzt dieselbe Audit-`_id` teilen.

- [ ] **Step 1: `planMatrix` ersetzen** (Zeile 373–400 komplett):

```ts
/** Auditplan-Matrix (FB 8.2.4): Internes Jahres-Audit wird in seine
 *  planThemes-Zeilen aufgefächert (gemeinsame SOLL-Monate + IST aus auditDate);
 *  Audits mit `area` (externe / Altdaten) bleiben je eine Zeile. */
export const planMatrix = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const rows: Array<{
      _id: Id<"audits">;
      rowKey: string;
      area: string;
      auditTeam?: string;
      affectedAreas?: string;
      plannedMonths: number[];
      istMonth: number | null;
      status: Doc<"audits">["status"];
      title: string;
    }> = [];

    for (const a of audits.sort((x, y) => x._creationTime - y._creationTime)) {
      const istMonth = a.auditDate ? new Date(a.auditDate).getUTCMonth() + 1 : null;
      if (a.planThemes && a.planThemes.length > 0) {
        for (const t of a.planThemes) {
          rows.push({
            _id: a._id,
            rowKey: `${a._id}-${t.area}`,
            area: t.area,
            auditTeam: t.auditTeam ?? a.auditTeam,
            affectedAreas: t.affectedAreas,
            plannedMonths: a.plannedMonths ?? [],
            istMonth,
            status: a.status,
            title: a.title,
          });
        }
      } else if (a.area !== undefined) {
        rows.push({
          _id: a._id,
          rowKey: a._id,
          area: a.area,
          auditTeam: a.auditTeam,
          affectedAreas: a.affectedAreas,
          plannedMonths: a.plannedMonths ?? [],
          istMonth,
          status: a.status,
          title: a.title,
        });
      }
    }

    return { year: args.year, rows };
  },
});
```

- [ ] **Step 2: `updatePlanThemes` direkt nach `planMatrix` einfügen:**

```ts
/** Themen-Zeilen (FB 8.2.4) des internen Jahres-Audits pflegen — ersetzt das Array komplett */
export const updatePlanThemes = mutation({
  args: {
    id: v.id("audits"),
    planThemes: v.array(v.object({
      area: v.string(),
      auditTeam: v.optional(v.string()),
      affectedAreas: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status === "CLOSED" || audit.status === "CANCELLED") {
      throw new Error("Abgeschlossene Audits können nicht geändert werden");
    }
    const themes = args.planThemes
      .map((t) => ({
        area: t.area.trim(),
        auditTeam: t.auditTeam?.trim() || undefined,
        affectedAreas: t.affectedAreas?.trim() || undefined,
      }))
      .filter((t) => t.area !== "");
    await ctx.db.patch(args.id, {
      planThemes: themes.length > 0 ? themes : undefined,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: args.id,
      changes: { planThemes: themes.map((t) => t.area) },
    });
  },
});
```

- [ ] **Step 3: React-Key in der Plan-Seite** — `app/(dashboard)/audits/plan/page.tsx` Zeile 134 ändern von:

```tsx
                  <Fragment key={r._id}>
```

zu:

```tsx
                  <Fragment key={r.rowKey}>
```

- [ ] **Step 4: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add convex/audits.ts "app/(dashboard)/audits/plan/page.tsx"
git commit -m "feat(audit): planMatrix fächert internes Jahres-Audit in Themen-Zeilen auf + updatePlanThemes"
```

---

### Task 3: Generator — ein internes Audit pro Jahr

**Files:**
- Modify: `convex/yearCycle.ts:213-289` (generateAuditPlan ersetzen) und `:174-177` (Task-Text)

- [ ] **Step 1: `generateAuditPlan` ersetzen** (Zeile 213–289 komplett):

```ts
/**
 * Auditplan-Generator (Ein-Audit-Modell): erzeugt EIN internes Jahres-Audit
 * mit den Themen-Zeilen (planThemes) des Vorjahres-Audits sowie je eine Kopie
 * der externen Plan-Audits (area gesetzt). Vorschlag, kein Automatismus —
 * der Mensch löst aus und passt danach an.
 */
export const generateAuditPlan = mutation({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");

    if (!Number.isInteger(args.year) || args.year < 2020 || args.year > 2100) {
      throw new Error("Ungültiges Jahr");
    }

    // Schutz: Zieljahr darf noch keinen Auditplan haben
    const targetYearAudits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", args.year))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (targetYearAudits.some((a) => (a.planThemes && a.planThemes.length > 0) || a.area !== undefined)) {
      throw new Error(`Für ${args.year} existiert bereits ein Auditplan`);
    }

    // Quellen im Vorjahr: das interne Jahres-Audit (planThemes) + externe Plan-Audits (area)
    const previousYearAudits = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", args.year - 1))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const internalSource = previousYearAudits.find(
      (a) => a.auditType === "INTERNAL" && a.planThemes && a.planThemes.length > 0,
    );
    const externalSources = previousYearAudits.filter(
      (a) => a.auditType === "EXTERNAL" && a.area !== undefined,
    );
    if (!internalSource && externalSources.length === 0) {
      throw new Error("Kein Auditplan im Vorjahr gefunden");
    }

    // Aktive Checklisten-Vorlage — exakt wie audits.create
    const template = await ctx.db
      .query("auditChecklistTemplates")
      .withIndex("by_status", (q) => q.eq("status", "ACTIVE"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
    if (!template) {
      throw new Error("Keine aktive Checklisten-Vorlage vorhanden — zuerst Vorlage anlegen/aktivieren");
    }

    const now = Date.now();
    let created = 0;

    if (internalSource) {
      const auditId = await ctx.db.insert("audits", {
        title: `Internes Audit ${args.year}`,
        auditYear: args.year,
        auditType: "INTERNAL",
        status: "PLANNED",
        leadAuditorId: user._id,
        auditTeam: internalSource.auditTeam,
        basis: internalSource.basis ?? template.basis,
        location: internalSource.location,
        planThemes: internalSource.planThemes,
        plannedMonths: internalSource.plannedMonths,
        templateId: template._id,
        templateVersion: template.version,
        isArchived: false,
        createdAt: now, createdBy: user._id,
        updatedAt: now, updatedBy: user._id,
      });
      await instantiateChecklist(ctx, auditId, template, now, user._id);
      await logAuditEvent(ctx, {
        userId: user._id, action: "CREATE",
        entityType: "audits", entityId: auditId,
        metadata: { generatedFrom: args.year - 1, planThemes: internalSource.planThemes!.length },
      });
      created++;
    }

    for (const source of externalSources) {
      const auditId = await ctx.db.insert("audits", {
        title: `${source.area} ${args.year}`,
        auditYear: args.year,
        auditType: "EXTERNAL",
        status: "PLANNED",
        leadAuditorId: user._id,
        auditTeam: source.auditTeam,
        basis: source.basis ?? template.basis,
        area: source.area,
        affectedAreas: source.affectedAreas,
        plannedMonths: source.plannedMonths,
        templateId: template._id,
        templateVersion: template.version,
        isArchived: false,
        createdAt: now, createdBy: user._id,
        updatedAt: now, updatedBy: user._id,
      });
      await instantiateChecklist(ctx, auditId, template, now, user._id);
      await logAuditEvent(ctx, {
        userId: user._id, action: "CREATE",
        entityType: "audits", entityId: auditId,
        metadata: { generatedFrom: args.year - 1, area: source.area },
      });
      created++;
    }

    return { created };
  },
});
```

- [ ] **Step 2: Jahresauftakt-Task-Text anpassen** — Zeile 174–177, Beschreibung des Auditplan-Tasks ändern von:

```ts
        title: `Auditplan ${year} erstellen (Vorschlag aus Vorjahr im Auditplan generierbar)`,
        description: `Themen-Audits für ${year} planen — der Auditplan-Generator schlägt die Vorjahresthemen vor.`,
```

zu:

```ts
        title: `Auditplan ${year} erstellen (Vorschlag aus Vorjahr im Auditplan generierbar)`,
        description: `Internes Jahres-Audit und externe Audits für ${year} planen — der Generator übernimmt die Themen-Zeilen des Vorjahres.`,
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/yearCycle.ts
git commit -m "feat(audit): Generator erzeugt EIN internes Jahres-Audit + externe Kopien (Ein-Audit-Modell)"
```

---

### Task 4: Migration 2026 (internal mutation)

**Files:**
- Modify: `convex/audits.ts` (ans Dateiende, nach `seedPlanReset`)

Archiviert die generierten internen Themen-Audits 2026 (verifiziert: keine erfassten Antworten) und überträgt ihre Themen als `planThemes` auf das Ziel-Audit „Intern 2026". Das externe Zerti-Audit bleibt unberührt. Idempotent.

- [ ] **Step 1: Mutation anfügen**

```ts
// ============================================================
// migrateToSingleAudit2026 — Einmal-Migration (npx convex run):
// archiviert die internen Themen-Audits 2026 (area gesetzt, keine
// erfassten Antworten) und setzt ihre Themen als planThemes auf das
// Ziel-Audit ("Intern 2026"). Externe Audits bleiben unberührt.
// Idempotent: bereits archivierte Quellen / gesetzte planThemes → skip.
// ============================================================

export const migrateToSingleAudit2026 = internalMutation({
  args: { targetAuditId: v.id("audits") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetAuditId);
    if (!target) throw new Error("Ziel-Audit nicht gefunden");
    if (target.auditType !== "INTERNAL") throw new Error("Ziel-Audit muss INTERNAL sein");

    const audits2026 = await ctx.db
      .query("audits")
      .withIndex("by_year", (q) => q.eq("auditYear", 2026))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const internalThemeAudits = audits2026.filter(
      (a) => a.auditType === "INTERNAL" && a.area !== undefined && a._id !== args.targetAuditId,
    );

    const now = Date.now();
    const themes = internalThemeAudits
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((a) => ({
        area: a.area!,
        auditTeam: a.auditTeam,
        affectedAreas: a.affectedAreas,
      }));

    for (const a of internalThemeAudits) {
      await ctx.db.patch(a._id, { isArchived: true, archivedAt: now, updatedAt: now });
      await logAuditEvent(ctx, {
        action: "ARCHIVE", entityType: "audits", entityId: a._id,
        metadata: { migration: "single-audit-2026", area: a.area },
      });
    }

    if ((!target.planThemes || target.planThemes.length === 0) && themes.length > 0) {
      await ctx.db.patch(args.targetAuditId, {
        title: "Internes Audit 2026",
        planThemes: themes,
        plannedMonths: [4], // SOLL laut FB 8.2.4 Rev. 5 (April); IST kommt aus auditDate
        updatedAt: now,
      });
      await logAuditEvent(ctx, {
        action: "UPDATE", entityType: "audits", entityId: args.targetAuditId,
        metadata: { migration: "single-audit-2026", themes: themes.length },
      });
    }

    return { archived: internalThemeAudits.length, themes: themes.length };
  },
});
```

- [ ] **Step 2: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add convex/audits.ts
git commit -m "feat(audit): Einmal-Migration 2026 — Themen-Audits archivieren, planThemes auf Jahres-Audit übertragen"
```

---

### Task 5: Import-Backend (Checkliste, Findings, Bericht-PDF)

**Files:**
- Modify: `convex/audits.ts` (Imports oben + drei Funktionen ans Dateiende)

- [ ] **Step 1: Imports erweitern** — Zeile 2 und danach:

Zeile 2 ändern von:

```ts
import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
```

zu:

```ts
import { query, mutation, internalMutation, internalAction, MutationCtx } from "./_generated/server";
```

Nach Zeile 3 (`import { Doc, Id } ...`) einfügen:

```ts
import { internal } from "./_generated/api";
```

- [ ] **Step 2: Import-Mutation anfügen** (ans Dateiende):

```ts
// ============================================================
// importFilledChecklist — Einmal-Import (npx convex run) der real
// ausgefüllten Auditcheckliste + Berichtsdaten in ein bestehendes Audit.
// Antworten werden per Kapitelnummer gematcht; Kapitel, die in der
// eingefrorenen Checkliste fehlen (xlsx v5: 7.5.5, 7.5.7, 7.5.9.2),
// werden ergänzt. sortOrder = Payload-Reihenfolge (xlsx ist kanonisch).
// ============================================================

const auditRatingArg = v.union(
  v.literal("KONFORM"), v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"),
  v.literal("EMPFEHLUNG"), v.literal("NICHT_ANWENDBAR"),
);
const findingClassificationArg = v.union(
  v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"), v.literal("EMPFEHLUNG"),
);

export const importFilledChecklist = internalMutation({
  args: {
    auditId: v.id("audits"),
    header: v.object({
      auditTeam: v.optional(v.string()),
      basis: v.optional(v.string()),
      location: v.optional(v.string()),
      reportingPeriod: v.optional(v.string()),
      plannedFor: v.optional(v.string()),
      auditDate: v.optional(v.number()),
    }),
    summaryResult: v.optional(v.string()),
    chapterSummaries: v.optional(v.array(v.object({
      chapter: v.string(),
      summary: v.string(),
    }))),
    answers: v.array(v.object({
      chapter: v.string(),
      chapterTitle: v.string(),
      requirements: v.string(),
      rating: v.optional(auditRatingArg),
      evidence: v.optional(v.string()),
      sample: v.optional(v.string()),
      interviewedWith: v.optional(v.string()),
      comments: v.optional(v.string()),
    })),
    findings: v.array(v.object({
      chapter: v.string(),
      classification: findingClassificationArg,
      description: v.string(),
      capaNumber: v.optional(v.string()),
    })),
    close: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.auditId);
    if (!audit) throw new Error("Audit nicht gefunden");
    const now = Date.now();

    // Kopfdaten + Berichtstexte
    await ctx.db.patch(args.auditId, {
      ...args.header,
      summaryResult: args.summaryResult,
      chapterSummaries: args.chapterSummaries,
      updatedAt: now,
    });

    // Antworten: Match per Kapitelnummer; fehlende Kapitel ergänzen
    const existing = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", args.auditId))
      .collect();
    const byChapter = new Map(existing.map((a) => [a.chapter, a]));

    let patched = 0;
    let inserted = 0;
    for (let i = 0; i < args.answers.length; i++) {
      const a = args.answers[i];
      const fields = {
        chapterTitle: a.chapterTitle,
        requirements: a.requirements,
        sortOrder: i + 1,
        rating: a.rating,
        evidence: a.evidence,
        sample: a.sample,
        interviewedWith: a.interviewedWith,
        comments: a.comments,
        updatedAt: now,
      };
      const match = byChapter.get(a.chapter);
      if (match) {
        await ctx.db.patch(match._id, fields);
        patched++;
      } else {
        await ctx.db.insert("auditChecklistAnswers", {
          auditId: args.auditId,
          chapter: a.chapter,
          ...fields,
          isArchived: false,
          createdAt: now,
        });
        inserted++;
      }
    }

    // Findings: CAPA-Verknüpfung per capaNumber (Index by_number),
    // Antwort-Verknüpfung per Kapitelnummer
    const answersAfter = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", args.auditId))
      .collect();
    const answerByChapter = new Map(answersAfter.map((a) => [a.chapter, a]));

    let findingsCreated = 0;
    for (const f of args.findings) {
      let capaId: Id<"capas"> | undefined;
      if (f.capaNumber) {
        const capa = await ctx.db
          .query("capas")
          .withIndex("by_number", (q) => q.eq("capaNumber", f.capaNumber!))
          .first();
        capaId = capa?._id;
      }
      await ctx.db.insert("auditFindings", {
        auditId: args.auditId,
        answerId: answerByChapter.get(f.chapter)?._id,
        chapter: f.chapter,
        classification: f.classification,
        description: f.description,
        capaId,
        status: "OPEN",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      findingsCreated++;
    }

    if (args.close) {
      await ctx.db.patch(args.auditId, { status: "CLOSED", closedAt: now, updatedAt: now });
    }

    await logAuditEvent(ctx, {
      action: "UPDATE", entityType: "audits", entityId: args.auditId,
      metadata: {
        import: "auditcheckliste-2026",
        patched, inserted, findings: findingsCreated,
        closed: args.close === true,
      },
    });
    return { patched, inserted, findings: findingsCreated };
  },
});
```

- [ ] **Step 3: Bericht-PDF-Import (internalAction + internal mutation) anfügen:**

```ts
// ============================================================
// importReportPdf — Einmal-Import des Original-Bericht-PDFs (Base64)
// in den Convex-Storage. attachReportInternal umgeht den
// REPORT_DRAFT-Guard von attachReport (Import in CLOSED-Audit).
// ============================================================

export const attachReportInternal = internalMutation({
  args: { id: v.id("audits"), reportFileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    await ctx.db.patch(args.id, { reportFileId: args.reportFileId, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      action: "FILE_UPLOAD", entityType: "audits", entityId: args.id,
      metadata: { kind: "auditReport", import: true, reportFileId: args.reportFileId },
    });
  },
});

export const importReportPdf = internalAction({
  args: { auditId: v.id("audits"), base64: v.string() },
  handler: async (ctx, args) => {
    const bytes = Uint8Array.from(atob(args.base64), (c) => c.charCodeAt(0));
    const storageId = await ctx.storage.store(new Blob([bytes], { type: "application/pdf" }));
    await ctx.runMutation(internal.audits.attachReportInternal, {
      id: args.auditId,
      reportFileId: storageId,
    });
    return { storageId };
  },
});
```

- [ ] **Step 4: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add convex/audits.ts
git commit -m "feat(audit): Import-Backend — Checkliste/Findings/Berichtstexte + Bericht-PDF (Base64-Action)"
```

---

### Task 6: Import-Skript + Ausführung des 2026-Imports

**Files:**
- Create: `scripts/build-audit2026-import.py`

- [ ] **Step 1: Skript anlegen** — `scripts/build-audit2026-import.py`:

```python
#!/usr/bin/env python3
"""Einmal-Import: erzeugt die JSON-Payload für audits:importFilledChecklist
aus der ausgefüllten Auditcheckliste 2026 (xlsx) + den Texten des
Auditberichts (FB 8.2.4 Rev. 1, 05.2026). Aufruf:
    python3 scripts/build-audit2026-import.py <auditId>
Schreibt /tmp/audit2026-import.json
"""
import json
import sys

import openpyxl

XLSX = "PDF/8 2 4 Auditcheckliste_2026_v5.xlsx"
AUDIT_ID = sys.argv[1]

RATING = {
    "Konform": "KONFORM",
    "Abweichung": "ABWEICHUNG",
    "Feststellung": "FESTSTELLUNG",
    "Empfehlung": "EMPFEHLUNG",
    "nicht anwendbar": "NICHT_ANWENDBAR",
}

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Auditcheckliste"]
answers = []
for row in ws.iter_rows(min_row=2, values_only=True):
    kap, titel, pruef, bew, nachweis, stich, gespr, bem = row[:8]
    if kap is None or (pruef is None and bew is None):
        continue  # Kapitel-Überschriftszeilen (z. B. "4", "4.1") überspringen
    rating = RATING.get(str(bew).strip()) if bew else None
    if bew and rating is None:
        raise SystemExit(f"Unbekannte Bewertung {bew!r} in Kap. {kap}")
    entry = {
        "chapter": str(kap).strip(),
        "chapterTitle": str(titel or "").strip(),
        "requirements": str(pruef or "").strip(),
    }
    if rating:
        entry["rating"] = rating
    if nachweis:
        entry["evidence"] = str(nachweis).strip()
    if stich:
        entry["sample"] = str(stich).strip()
    if gespr:
        entry["interviewedWith"] = str(gespr).strip()
    if bem:
        entry["comments"] = str(bem).strip()
    answers.append(entry)

if len(answers) != 63:
    raise SystemExit(f"Erwartet 63 Antworten, gefunden {len(answers)}")

SUMMARY = (
    "Dieser Auditbericht fasst die Ergebnisse des internen Audits gemäß DIN EN "
    "ISO 13485:2021 und der Medizinprodukteverordnung (MDR) zusammen. Grundlage "
    "sind die Auditcheckliste 2026 v5, das QM-Handbuch Rev. 5 (05.2025) der "
    "Wiggers GmbH & Co. KG, der PMS-Bericht 2025 sowie die Auswertung des "
    "Vor-Audits 2025."
)

CHAPTER_SUMMARIES = [
    {
        "chapter": "Kapitel 4 – Qualitätsmanagementsystem",
        "summary": (
            "Das QM-System ist vollständig dokumentiert, risikobasiert aufgebaut und "
            "MDR-konform. Alle Prozesse sind beschrieben und wirksam umgesetzt. FB 4.2.4 "
            "Liste der Dokumente Produktakte (Rev. 10, 05.2025) ist vollständig; "
            "aktualisierte Revisionen FB 5.4.1 Rev. 8, FB 7.1.0 Rev. 1, FB 8.5.2 Rev. 1 "
            "und FB 7.6.0 Rev. 3 (alle 04.2026) sind eingepflegt. Feststellung in 4.1.5 — "
            "Ausgegliederte Prozesse: QSV mit Hygiene-/Reparatur-Dienstleister trotz "
            "dreifacher Anforderung nicht erhalten — Eskalation per Einschreiben in "
            "CAPA-2026-11 hinterlegt."
        ),
    },
    {
        "chapter": "Kapitel 5 – Verantwortung der Leitung",
        "summary": (
            "Die Leitung ist verantwortlich eingebunden. Qualitätspolitik, messbare Ziele, "
            "jährliche Managementbewertung (FB 5.6.0 Rev. 8, 01.26) und benannte "
            "Verantwortliche Person gemäß MDR Art. 15 sind etabliert. FB 5.4.1 "
            "Qualitätsziele wurde auf Rev. 8 (04.2026) angehoben — wesentliche "
            "Verbesserungen: quartalsweise statt jährlicher Auswertung, klare Trennung "
            "Wartung Pflegebetten/Lifter (OTWin) versus Werkstatt-Messmittel-Prüfung "
            "(FB 7.6.0 Rev. 3), Phasenmodelle für Verantwortungen/Befugnisse und "
            "Nachfolgeregelung. Feststellung in 5.5.1 — Verantwortungen formal noch nicht "
            "alle ernannt; bewusster Pfad „Schulung vor Ernennung“ als CAPA-2026-02 "
            "dokumentiert."
        ),
    },
    {
        "chapter": "Kapitel 6 – Management von Ressourcen",
        "summary": (
            "Ressourcen und Personal sind verfügbar. Schulungsplan 2026 (FB 6.2.0 Rev. 4) "
            "liegt vor. Wartungen der medizinischen Hilfsmittel (Pflegebetten, "
            "Patientenlifter) laufen termingerecht über OTWin mit etablierter "
            "Wiedervorlage- und Erinnerungslogik. Feststellung in 6.2 — "
            "Mitarbeitergespräche und Schulungssystem aus Qualitätszielen 2025 nicht "
            "vollständig erfüllt; CAPA-2026-04 und CAPA-2026-05 in FB 8.5.2 hinterlegt."
        ),
    },
    {
        "chapter": "Kapitel 7 – Produktrealisierung",
        "summary": (
            "Kundenanforderungen (FO_B-01 Patientendokumentation), Lieferanten (FB 7.4.1 "
            "Lieferantenbewertung 2026 mit 41 Lieferanten), Sonderanfertigungen "
            "(FO_B-09_W Konformitätserklärung) und Rückverfolgbarkeit sind geregelt und "
            "dokumentiert. Wareneingang gemäß AA 7.4.3 mit Eurocom-Stichprobe 1–2× "
            "monatlich. MDR-Konformität gegeben. Wesentliche Feststellung in 7.6 — "
            "Lenkung von Überwachungs- und Messmitteln: jährliche Stichtagsbewertung "
            "methodisch ungeeignet; FB 7.6.0 Rev. 3 (04.2026) mit neuer KPI-Methodik "
            "(KPI A pro-rata rolling 12 Monate ≥ 95 %; KPI B überfällige Prüfungen ≤ 5 %; "
            "Toleranz ± 30 Tage). CAPA-2026-07a/07b mit Wirksamkeitskriterium über zwei "
            "aufeinanderfolgende Quartale hinterlegt."
        ),
    },
    {
        "chapter": "Kapitel 8 – Messung, Analyse und Verbesserung",
        "summary": (
            "Reklamationen werden in OTWin systematisch erfasst (22 im Jahr 2025, keine "
            "sicherheitsrelevanten Ereignisse, MPG-Wiedervorlage 100 %). Audits gemäß "
            "FB 8.2.4 Auditplan 2026 (Rev. 4) durchgeführt — interne Audits Mai 2026, "
            "externes Überwachungsaudit ISO 13485 Juli 2026 (MDC). Externer Hinweis aus "
            "dem Vor-Audit 2025 („Integration der Fehlerbücher in PMS“) als CAPA-2026-01 "
            "hinterlegt. CAPA-Prozess wirksam: FB 8.5.2/8.5.3 Rev. 1 (04.2026) mit 11 "
            "Maßnahmen; FB 7.1.0 Rev. 1 mit 9 neuen Risikoeinträgen. MDR-Meldepflichten "
            "beachtet — keine schwerwiegenden Vorkommnisse, keine BfArM-Meldungen."
        ),
    },
]

FINDINGS = [
    {
        "chapter": "4.1.5", "classification": "FESTSTELLUNG",
        "description": (
            "QSV mit ausgegliedertem Hygiene-/Reparatur-Dienstleister trotz dreifacher "
            "Anforderung (Mail 11.06.25, Mail 20.04.26, Telefonat 29.04.26) nicht "
            "erhalten. Lieferant hat Bearbeitung mündlich zugesagt."
        ),
        "capaNumber": "CAPA-2026-11",
    },
    {
        "chapter": "5.5.1", "classification": "FESTSTELLUNG",
        "description": (
            "Verantwortungen und Befugnisse formal nicht alle ernannt. Bewusst gewählter "
            "Pfad „Schulung vor Ernennung“ über Phasenmodell."
        ),
        "capaNumber": "CAPA-2026-02",
    },
    {
        "chapter": "6.2", "classification": "FESTSTELLUNG",
        "description": (
            "Mitarbeitergespräche 2025 nur 60 % erreicht (Ziel 100 %). Schulungssystem "
            "50 % erreicht (Ziel 80 %). CAPA-2026-04 (MA-Gespräche) und CAPA-2026-05 "
            "(Schulungssystem)."
        ),
        "capaNumber": "CAPA-2026-04",
    },
    {
        "chapter": "7.6", "classification": "FESTSTELLUNG",
        "description": (
            "Bisherige jährliche Stichtagsbewertung der Werkstatt-Messmittel-Prüfung "
            "methodisch ungeeignet. FB 7.6.0 auf Rev. 3 (04.2026) angehoben mit neuer "
            "KPI-Methodik (KPI A pro-rata ≥ 95 %, KPI B Stichtag ≤ 5 %, Toleranz ± 30 "
            "Tage). Aktuelle Prüfdaten 2025/2026 nachgepflegt; eingezogene Geräte als "
            "„außer Dienst“ markiert. Wirksamkeitskriterium: beide KPIs über zwei "
            "aufeinanderfolgende Quartale."
        ),
        "capaNumber": "CAPA-2026-07",
    },
    {
        "chapter": "4.2.3", "classification": "EMPFEHLUNG",
        "description": (
            "Risikoanalysen RS01–RS06 und Klinische Bewertungen DGIHV seit 2021 "
            "unverändert. Im PMS-Bericht 2025 begründet („keine neuen Risiken“) — "
            "Begründung als Sichtungs-Eintrag in einem Sichtungsplan formal festhalten."
        ),
    },
    {
        "chapter": "5.5.3", "classification": "EMPFEHLUNG",
        "description": (
            "Maßnahme „Kommunikation verbessern“ aus FB 5.6.0 Managementbewertung 2025 "
            "läuft (GF, laufend). Bis externes Audit 07/2026 mit konkreten Beispielen "
            "(zusätzliche Teamsitzungen, neue Kommunikationswege) belegen."
        ),
    },
    {
        "chapter": "6.4.1", "classification": "EMPFEHLUNG",
        "description": (
            "[Verbesserungspotenzial] FB 6.4.0 Hygieneplan und Hautschutzplan im "
            "Inhaltsverzeichnis genannt, aber in FB 4.2.4 nicht eindeutig als FB-Eintrag "
            "aufgeführt. Listenkonsistenz im FB 4.2.4 herstellen."
        ),
    },
    {
        "chapter": "8.3.1", "classification": "EMPFEHLUNG",
        "description": (
            "[Verbesserungspotenzial] In FB 4.2.4 ist das FB als „Lenkung konformer "
            "Produkte“ gelistet — Tippfehler. Korrekt: „Lenkung nichtkonformer "
            "Produkte“. Bei nächster Revision korrigieren."
        ),
    },
]

payload = {
    "auditId": AUDIT_ID,
    "header": {
        "auditTeam": "Thomas Wiggers, Regina Wiggers",
        "basis": (
            "DIN EN ISO 13485:2021, MDR (EU) 2017/745, QM-Handbuch Rev. 5 (05.2025), "
            "Verfahrensanweisungen, Arbeitsanweisungen, Formblätter"
        ),
        "location": "Hauptsitz Bremer Heerstraße 80, 26135 Oldenburg + 3 Filialen",
        "reportingPeriod": "01.01.2025 – 31.12.2025",
        "plannedFor": "05/2026",
        # 04.05.2026 00:00 UTC → IST-Monat Mai in der Auditplan-Matrix
        "auditDate": 1777852800000,
    },
    "summaryResult": SUMMARY,
    "chapterSummaries": CHAPTER_SUMMARIES,
    "answers": answers,
    "findings": FINDINGS,
    "close": True,
}

with open("/tmp/audit2026-import.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False)
print(f"{len(answers)} Antworten, {len(FINDINGS)} Findings → /tmp/audit2026-import.json")
```

- [ ] **Step 2: Ziel-Audit-Id verifizieren**

Run: `npx convex data audits --limit 30 | grep "Intern"`
Expected: eine Zeile mit Titel `"Intern 2026"` und Id `js70rnp191yapnkdkq17tmrzf988dnz7` (falls abweichend: die tatsächliche Id in den Folge-Steps verwenden)

- [ ] **Step 3: Migration ausführen**

Run: `npx convex run audits:migrateToSingleAudit2026 '{"targetAuditId":"js70rnp191yapnkdkq17tmrzf988dnz7"}'`
Expected: `{ archived: 4, themes: 4 }` — die 4 internen Themen-Audits (Reha / Rollstuhl [IN_PROGRESS, aber 0 erfasste Antworten — verifiziert], Sanitätshaus / Filiale, Orthopädietechnik, Büro) werden archiviert und liefern die 4 Themen-Zeilen; das EXTERNE „Überwachung-Zerti 13485“ bleibt unberührt. Falls die Ausgabe abweicht: STOPP, Datenlage mit `npx convex data audits` prüfen, nicht weitermachen.

- [ ] **Step 4: Checklisten-Import ausführen**

```bash
python3 scripts/build-audit2026-import.py js70rnp191yapnkdkq17tmrzf988dnz7
npx convex run audits:importFilledChecklist "$(cat /tmp/audit2026-import.json)"
```

Expected: Skript meldet `63 Antworten, 8 Findings`; Mutation liefert `{ patched: 60, inserted: 3, findings: 8 }`

- [ ] **Step 5: Bericht-PDF importieren**

```bash
python3 - <<'EOF'
import base64, json
b64 = base64.b64encode(open("PDF/8 2 4 Auditbericht_2026_Rev1.pdf", "rb").read()).decode()
json.dump({"auditId": "js70rnp191yapnkdkq17tmrzf988dnz7", "base64": b64},
          open("/tmp/audit2026-report.json", "w"))
print(f"Base64: {len(b64)} Zeichen")
EOF
npx convex run audits:importReportPdf "$(cat /tmp/audit2026-report.json)"
```

Expected: `{ storageId: "..." }`

- [ ] **Step 6: Daten verifizieren**

```bash
npx convex data audits --limit 30 | grep -E "Internes Audit 2026|Überwachung"
npx convex data auditFindings --limit 20 | grep -c js70rnp191yapnkdkq17tmrzf988dnz7
```

Expected: „Internes Audit 2026" mit Status `CLOSED` und `auditDate` gesetzt; externes Zerti-Audit unverändert PLANNED; 8 Findings am Ziel-Audit

- [ ] **Step 7: Commit**

```bash
git add scripts/build-audit2026-import.py
git commit -m "feat(audit): Import-Skript Auditcheckliste/Bericht 2026 + Import ausgeführt (63 Antworten, 8 Findings, PDF)"
```

---

### Task 7: Create-Dialog — Thema nur extern, SOLL-Monate immer

**Files:**
- Modify: `app/(dashboard)/audits/page.tsx:92-114` (handleCreate) und `:212-247` (Dialog-Felder)

- [ ] **Step 1: Dialog-Felder umbauen** — den Block Zeile 212–247 (`Auditplan-Thema`-Input + bedingter Monats-/Bereiche-Block) ersetzen durch:

```tsx
            <div>
              <Label>Geplante Monate (SOLL)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {MONTH_LABELS_SHORT.map((label, i) => {
                  const month = i + 1;
                  const selected = form.plannedMonths.includes(month);
                  return (
                    <Button
                      key={month}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleMonth(month)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
            {form.auditType === "EXTERNAL" && (
              <>
                <div>
                  <Label htmlFor="audit-area">Auditplan-Thema (FB 8.2.4)</Label>
                  <Input id="audit-area" value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="z. B. Überwachung-Zerti 13485" />
                </div>
                <div>
                  <Label htmlFor="audit-affected">Betroffene Bereiche</Label>
                  <Input id="audit-affected" value={form.affectedAreas}
                    onChange={(e) => setForm({ ...form, affectedAreas: e.target.value })}
                    placeholder="z. B. Unternehmen" />
                </div>
              </>
            )}
```

- [ ] **Step 2: `handleCreate` anpassen** — Zeile 92–107: `const area = form.area.trim();` ersetzen durch `const area = form.auditType === "EXTERNAL" ? form.area.trim() : "";` und den `plannedMonths`-Parameter ändern von:

```tsx
        plannedMonths: area && form.plannedMonths.length > 0
          ? form.plannedMonths
          : undefined,
```

zu:

```tsx
        plannedMonths: form.plannedMonths.length > 0 ? form.plannedMonths : undefined,
```

(`area: area || undefined` und `affectedAreas` bleiben unverändert — bei internen Audits ist `area` jetzt immer leer.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/audits/page.tsx"
git commit -m "feat(audit): Anlege-Dialog — SOLL-Monate für alle Audits, Auditplan-Thema nur für externe"
```

---

### Task 8: Detail-Seite — Themen-Card + SOLL-Monate im Kopfdaten-Dialog

**Files:**
- Modify: `app/(dashboard)/audits/[id]/page.tsx`

- [ ] **Step 1: Imports + State ergänzen**

Im Enums-Import (Zeile 22–26) `MONTH_LABELS_SHORT,` ergänzen. Nach `const updateHeader = useMutation(api.audits.updateHeader);` (Zeile 68) einfügen:

```tsx
  const [plannedMonthsInput, setPlannedMonthsInput] = useState<number[]>([]);
  const updatePlanThemes = useMutation(api.audits.updatePlanThemes);
  const [themeDialog, setThemeDialog] = useState<{ open: boolean; index: number | null }>({
    open: false, index: null,
  });
  const [themeForm, setThemeForm] = useState({ area: "", auditTeam: "", affectedAreas: "" });
```

- [ ] **Step 2: Kopfdaten-Dialog-Öffnung erweitert** — im `onClick` des „Bearbeiten"-Buttons (Zeile 223–231) nach `setAuditDateInput(...)` ergänzen:

```tsx
              setPlannedMonthsInput(audit.plannedMonths ?? []);
```

- [ ] **Step 3: SOLL-Monate in den Kopfdaten-Dialog** — im Dialog (Zeile 346–382) zwischen dem Auditdatum-`<div>` und dem Button-`<div>` einfügen:

```tsx
            <div>
              <Label>Geplante Monate (SOLL — Auditplan)</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {MONTH_LABELS_SHORT.map((label, i) => {
                  const month = i + 1;
                  const selected = plannedMonthsInput.includes(month);
                  return (
                    <Button
                      key={month}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() =>
                        setPlannedMonthsInput((prev) =>
                          prev.includes(month)
                            ? prev.filter((m) => m !== month)
                            : [...prev, month].sort((a, b) => a - b),
                        )
                      }
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
```

und im Speichern-`onClick` (Zeile 364–378) den `updateHeader`-Aufruf ändern von:

```tsx
                  await updateHeader({ id: auditId, ...(ts !== undefined ? { auditDate: ts } : {}) });
```

zu:

```tsx
                  await updateHeader({
                    id: auditId,
                    ...(ts !== undefined ? { auditDate: ts } : {}),
                    plannedMonths: plannedMonthsInput,
                  });
```

- [ ] **Step 4: Themen-Card einfügen** — direkt nach der schließenden Kopfdaten-`</Card>` (Zeile 249) einfügen:

```tsx
      {audit.auditType === "INTERNAL" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Auditplan-Themen (FB 8.2.4)</CardTitle>
            {canManage && audit.status !== "CLOSED" && audit.status !== "CANCELLED" && (
              <Button variant="outline" size="sm" onClick={() => {
                setThemeForm({ area: "", auditTeam: "", affectedAreas: "" });
                setThemeDialog({ open: true, index: null });
              }}>
                Thema hinzufügen
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {(audit.planThemes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Themen-Zeilen — dieses Audit erscheint nicht in der Auditplan-Matrix.
              </p>
            ) : (
              (audit.planThemes as Array<{ area: string; auditTeam?: string; affectedAreas?: string }>).map((t, idx) => (
                <div key={`${t.area}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="font-medium">{t.area}</span>
                  <span className="text-muted-foreground">{t.auditTeam ?? "—"}</span>
                  <span className="flex-1 text-muted-foreground">{t.affectedAreas ?? "—"}</span>
                  {canManage && audit.status !== "CLOSED" && audit.status !== "CANCELLED" && (
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setThemeForm({
                          area: t.area,
                          auditTeam: t.auditTeam ?? "",
                          affectedAreas: t.affectedAreas ?? "",
                        });
                        setThemeDialog({ open: true, index: idx });
                      }}>
                        Bearbeiten
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          const next = (audit.planThemes as Array<{ area: string; auditTeam?: string; affectedAreas?: string }>)
                            .filter((_, i) => i !== idx);
                          try {
                            await updatePlanThemes({ id: auditId, planThemes: next });
                            toast.success("Thema entfernt");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Fehler");
                          }
                        }}>
                        Entfernen
                      </Button>
                    </span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 5: Themen-Dialog einfügen** — vor dem `{/* Prüfpunkt-Dialog */}` (Zeile 384) einfügen:

```tsx
      {/* Auditplan-Thema-Dialog */}
      <Dialog open={themeDialog.open} onOpenChange={(o) => !o && setThemeDialog({ open: false, index: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{themeDialog.index === null ? "Thema hinzufügen" : "Thema bearbeiten"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="theme-area">Thema / Auditbereich</Label>
              <Input id="theme-area" value={themeForm.area}
                onChange={(e) => setThemeForm({ ...themeForm, area: e.target.value })}
                placeholder="z. B. Reha / Rollstuhl" />
            </div>
            <div>
              <Label htmlFor="theme-team">Auditor/en</Label>
              <Input id="theme-team" value={themeForm.auditTeam}
                onChange={(e) => setThemeForm({ ...themeForm, auditTeam: e.target.value })}
                placeholder="z. B. AL / MA" />
            </div>
            <div>
              <Label htmlFor="theme-affected">Betroffene Bereiche</Label>
              <Input id="theme-affected" value={themeForm.affectedAreas}
                onChange={(e) => setThemeForm({ ...themeForm, affectedAreas: e.target.value })}
                placeholder="z. B. MA der Werkstatt und Außendienst" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setThemeDialog({ open: false, index: null })}>
                Abbrechen
              </Button>
              <Button onClick={async () => {
                if (!themeForm.area.trim()) {
                  toast.error("Thema ist erforderlich");
                  return;
                }
                const current = (audit.planThemes ?? []) as Array<{ area: string; auditTeam?: string; affectedAreas?: string }>;
                const entry = {
                  area: themeForm.area,
                  auditTeam: themeForm.auditTeam || undefined,
                  affectedAreas: themeForm.affectedAreas || undefined,
                };
                const next = themeDialog.index === null
                  ? [...current, entry]
                  : current.map((t, i) => (i === themeDialog.index ? entry : t));
                try {
                  await updatePlanThemes({ id: auditId, planThemes: next });
                  setThemeDialog({ open: false, index: null });
                  toast.success("Auditplan-Themen gespeichert");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Fehler");
                }
              }}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/audits/[id]/page.tsx"
git commit -m "feat(audit): Detailseite — Auditplan-Themen pflegbar, SOLL-Monate im Kopfdaten-Dialog"
```

---

### Task 9: Vorjahres-Übernahme — Backend

**Files:**
- Modify: `convex/audits.ts` (Helper + Query + Mutation, nach `updatePlanThemes` einfügen)

- [ ] **Step 1: Import erweitern** — `QueryCtx` zum Server-Import von `convex/audits.ts` (Zeile 2) hinzufügen, damit der Helper aus Query UND Mutation aufrufbar ist (DatabaseWriter erweitert DatabaseReader):

```ts
import { query, mutation, internalMutation, internalAction, MutationCtx, QueryCtx } from "./_generated/server";
```

- [ ] **Step 2: Helper + Query + Mutation anfügen:**

```ts
/** Vorgänger-Audit finden: jüngstes früheres internes Audit (CLOSED bevorzugt) */
async function findPreviousInternalAudit(
  ctx: { db: QueryCtx["db"] },
  audit: Doc<"audits">,
): Promise<Doc<"audits"> | null> {
  const all = await ctx.db
    .query("audits")
    .filter((q) => q.eq(q.field("isArchived"), false))
    .collect();
  const candidates = all
    .filter(
      (a) =>
        a.auditType === "INTERNAL" &&
        a.auditYear < audit.auditYear &&
        a.status !== "CANCELLED" &&
        a._id !== audit._id,
    )
    .sort(
      (a, b) =>
        b.auditYear - a.auditYear ||
        (b.status === "CLOSED" ? 1 : 0) - (a.status === "CLOSED" ? 1 : 0),
    );
  return candidates[0] ?? null;
}

/** Antworten des Vorgänger-Audits je Kapitelnummer — Anzeige + Einzel-Übernahme im UI */
export const previousAnswers = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audits:list");
    const audit = await ctx.db.get(args.id);
    if (!audit) return null;

    const source = await findPreviousInternalAudit(ctx, audit);
    if (!source) return null;

    const answers = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", source._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return {
      sourceId: source._id,
      sourceTitle: source.title,
      sourceYear: source.auditYear,
      answers: answers.map((a) => ({
        chapter: a.chapter,
        rating: a.rating,
        evidence: a.evidence,
        sample: a.sample,
        interviewedWith: a.interviewedWith,
        comments: a.comments,
      })),
    };
  },
});

/** Massen-Übernahme: NUR Nachweise, NUR leere Felder, NUR in Durchführung (Beschluss 2026-06-12) */
export const adoptAllEvidence = mutation({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const audit = await ctx.db.get(args.id);
    if (!audit) throw new Error("Audit nicht gefunden");
    if (audit.status !== "IN_PROGRESS") {
      throw new Error("Übernahme nur möglich, während das Audit in Durchführung ist");
    }

    const source = await findPreviousInternalAudit(ctx, audit);
    if (!source) throw new Error("Kein Vorgänger-Audit gefunden");

    const sourceAnswers = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", source._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const byChapter = new Map(sourceAnswers.map((a) => [a.chapter, a]));

    const targetAnswers = await ctx.db
      .query("auditChecklistAnswers")
      .withIndex("by_audit", (q) => q.eq("auditId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const now = Date.now();
    let adopted = 0;
    for (const t of targetAnswers) {
      if (t.evidence) continue; // vorhandene Nachweise nie überschreiben
      const prev = byChapter.get(t.chapter);
      if (!prev?.evidence) continue;
      await ctx.db.patch(t._id, { evidence: prev.evidence, updatedAt: now, updatedBy: user._id });
      adopted++;
    }

    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "audits", entityId: args.id,
      metadata: { adoptEvidenceFrom: source._id, sourceYear: source.auditYear, adopted },
    });
    return { adopted, sourceTitle: source.title };
  },
});
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/audits.ts
git commit -m "feat(audit): Vorjahres-Übernahme — previousAnswers-Query + adoptAllEvidence (nur leere Nachweise)"
```

---

### Task 10: Vorjahres-Übernahme — UI

**Files:**
- Modify: `app/(dashboard)/audits/[id]/page.tsx`

- [ ] **Step 1: Query + Mutation einbinden** — nach `const reportUrl = useQuery(...)` (Zeile 56) einfügen:

```tsx
  const previousAnswersData = useQuery(api.audits.previousAnswers, { id: auditId });
  const adoptAllEvidence = useMutation(api.audits.adoptAllEvidence);
```

und nach den State-Deklarationen (unter `const [summary, ...]`):

```tsx
  const prevByChapter = new Map(
    (previousAnswersData?.answers ?? []).map((a) => [a.chapter, a]),
  );
```

- [ ] **Step 2: Massen-Button in der Checklisten-Card** — den CardHeader der Checkliste (Zeile 252–256) ersetzen durch:

```tsx
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Checkliste ({audit.answers.filter((a: Answer) => a.rating).length}/{audit.answers.length} bewertet)
          </CardTitle>
          {editable && canManage && previousAnswersData && (
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const r = await adoptAllEvidence({ id: auditId });
                toast.success(`${r.adopted} Nachweise aus „${r.sourceTitle}“ übernommen`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler bei der Übernahme");
              }
            }}>
              Alle Nachweise aus Vorjahr übernehmen
            </Button>
          )}
        </CardHeader>
```

- [ ] **Step 3: Vorjahres-Block im Prüfpunkt-Dialog** — im Prüfpunkt-Dialog direkt nach `<p className="text-sm text-muted-foreground">{editAnswer?.requirements}</p>` (Zeile 390) einfügen:

```tsx
          {editAnswer && prevByChapter.has(editAnswer.chapter) && (() => {
            const p = prevByChapter.get(editAnswer.chapter)!;
            const fields = [
              ["evidence", "Nachweis"],
              ["sample", "Stichprobe"],
              ["interviewedWith", "Gespräch mit"],
              ["comments", "Bemerkungen"],
            ] as const;
            return (
              <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-xs">
                <p className="font-medium">
                  Vorjahr: {previousAnswersData!.sourceTitle}
                  {p.rating && (
                    <Badge className={`ml-2 ${RATING_COLOR[p.rating] ?? ""}`} variant="secondary">
                      {AUDIT_RATING_LABELS[p.rating as AuditRating]}
                    </Badge>
                  )}
                  <span className="ml-1 font-normal text-muted-foreground">(Bewertung nur Anzeige)</span>
                </p>
                {fields.map(([key, label]) =>
                  p[key] ? (
                    <div key={key} className="flex items-start gap-2">
                      <span className="w-24 shrink-0 text-muted-foreground">{label}:</span>
                      <span className="flex-1 whitespace-pre-line">{p[key]}</span>
                      <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2"
                        onClick={() => setAnswerForm((f) => ({ ...f, [key]: p[key]! }))}>
                        Übernehmen
                      </Button>
                    </div>
                  ) : null,
                )}
              </div>
            );
          })()}
```

(Die Einzel-Übernahme schreibt nur ins Formular — gespeichert wird wie bisher über „Speichern" → `updateAnswer`. Die Bewertung wird bewusst nie übernommen.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/audits/[id]/page.tsx"
git commit -m "feat(audit): Vorjahres-Antworten im Prüfpunkt-Dialog mit Einzel-Übernahme + Massen-Button für Nachweise"
```

---

### Task 11: Vorlagen-Backend — `removeItem` + Kapitel-Sortierung bei Aktivierung

**Files:**
- Modify: `convex/auditTemplates.ts` (removeItem nach updateItem; activate erweitern)

- [ ] **Step 1: `removeItem` nach `updateItem` (Zeile 175) einfügen:**

```ts
/** Prüfpunkt aus einer DRAFT-Vorlage entfernen (Hard-Delete — reine Entwurfsdaten) */
export const removeItem = mutation({
  args: { id: v.id("auditChecklistTemplateItems") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "audits:manage");
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Prüfpunkt nicht gefunden");
    const template = await ctx.db.get(item.templateId);
    if (!template || template.status !== "DRAFT") {
      throw new Error("Nur Entwurfs-Vorlagen können bearbeitet werden");
    }
    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      userId: user._id, action: "PERMANENT_DELETE",
      entityType: "auditChecklistTemplateItems", entityId: args.id,
      metadata: { chapter: item.chapter, templateVersion: template.version },
    });
  },
});
```

- [ ] **Step 2: `activate` erweitern** — im Handler von `activate` (Zeile 180–201) nach den Guards (`if (template.isArchived) ...`, Zeile 185) und vor `const now = Date.now();` einfügen:

```ts
    // Prüfpunkte kapitelweise sortieren (numerisch: 4.1.2 < 4.1.10) und
    // sortOrder neu vergeben — nachträglich ergänzte Punkte landen sonst am Ende
    const items = await ctx.db
      .query("auditChecklistTemplateItems")
      .withIndex("by_template", (q) => q.eq("templateId", args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    if (items.length === 0) {
      throw new Error("Vorlage enthält keine Prüfpunkte — Aktivierung nicht möglich");
    }
```

und nach `const now = Date.now();`:

```ts
    const sorted = [...items].sort((a, b) =>
      a.chapter.localeCompare(b.chapter, "de", { numeric: true }),
    );
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].sortOrder !== i + 1) {
        await ctx.db.patch(sorted[i]._id, { sortOrder: i + 1, updatedAt: now });
      }
    }
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/auditTemplates.ts
git commit -m "feat(audit): Vorlagen — removeItem (nur Entwurf) + Kapitel-Sortierung bei Aktivierung"
```

---

### Task 12: Vorlagen-Pflege-Seite + Sidebar-Link

**Files:**
- Create: `app/(dashboard)/audits/templates/page.tsx`
- Modify: `components/layout/sidebar.tsx` (Gruppe „Audits & Maßnahmen" + Icon-Import)

- [ ] **Step 1: Seite anlegen** — `app/(dashboard)/audits/templates/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { toast } from "sonner";

type TemplateItem = {
  _id: Id<"auditChecklistTemplateItems">;
  chapter: string;
  chapterTitle: string;
  requirements: string;
  sortOrder: number;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-green-100 text-green-800",
  SUPERSEDED: "bg-gray-100 text-gray-800",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  ACTIVE: "Aktiv",
  SUPERSEDED: "Abgelöst",
};

export default function AuditTemplatesPage() {
  const { can } = usePermissions();
  const canManage = can("audits:manage");

  const templates = useQuery(api.auditTemplates.list, {});
  const [selectedId, setSelectedId] = useState<string>("");
  // Standard-Auswahl: Entwurf falls vorhanden, sonst aktive Version
  const effectiveId = (selectedId ||
    templates?.find((t) => t.status === "DRAFT")?._id ||
    templates?.find((t) => t.status === "ACTIVE")?._id ||
    "") as string;
  const detail = useQuery(
    api.auditTemplates.getById,
    effectiveId ? { id: effectiveId as Id<"auditChecklistTemplates"> } : "skip",
  );

  const createDraft = useMutation(api.auditTemplates.createDraft);
  const addItem = useMutation(api.auditTemplates.addItem);
  const updateItem = useMutation(api.auditTemplates.updateItem);
  const removeItem = useMutation(api.auditTemplates.removeItem);
  const activate = useMutation(api.auditTemplates.activate);

  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: TemplateItem | null }>({
    open: false, item: null,
  });
  const [itemForm, setItemForm] = useState({ chapter: "", chapterTitle: "", requirements: "" });
  const [deleteTarget, setDeleteTarget] = useState<TemplateItem | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDraft = detail?.status === "DRAFT";

  async function handleCreateDraft() {
    if (saving) return;
    if (!draftName.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      const id = await createDraft({
        name: draftName.trim(),
        formNumber: "8.2.4",
        copyFromActive: true,
      });
      setSelectedId(id as string);
      setDraftDialogOpen(false);
      toast.success("Entwurf angelegt (Kopie der aktiven Vorlage)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveItem() {
    if (saving) return;
    if (!itemForm.chapter.trim() || !itemForm.chapterTitle.trim() || !itemForm.requirements.trim()) {
      toast.error("Kapitel, Überschrift und Prüfpunkte sind erforderlich");
      return;
    }
    setSaving(true);
    try {
      if (itemDialog.item) {
        await updateItem({
          id: itemDialog.item._id,
          chapter: itemForm.chapter.trim(),
          chapterTitle: itemForm.chapterTitle.trim(),
          requirements: itemForm.requirements.trim(),
        });
        toast.success("Prüfpunkt gespeichert");
      } else {
        await addItem({
          templateId: effectiveId as Id<"auditChecklistTemplates">,
          chapter: itemForm.chapter.trim(),
          chapterTitle: itemForm.chapterTitle.trim(),
          requirements: itemForm.requirements.trim(),
        });
        toast.success("Prüfpunkt hinzugefügt");
      }
      setItemDialog({ open: false, item: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklisten-Vorlage"
        description="Versionierte Audit-Checklisten-Vorlage (FB 8.2.4) — Entwurf bearbeiten, dann aktivieren. Bestehende Audits bleiben eingefroren."
        actions={
          <>
            {templates && templates.length > 0 && (
              <Select value={effectiveId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      v{t.version} — {t.name} ({STATUS_LABEL[t.status] ?? t.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canManage && !templates?.some((t) => t.status === "DRAFT") && (
              <Button onClick={() => {
                setDraftName(`Auditcheckliste ${new Date().getFullYear() + 1}`);
                setDraftDialogOpen(true);
              }}>
                Neue Version (Entwurf)
              </Button>
            )}
            {canManage && isDraft && (
              <Button onClick={() => setActivateOpen(true)}>Entwurf aktivieren</Button>
            )}
          </>
        }
      />

      {detail === undefined && effectiveId ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : !detail ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Vorlage vorhanden.
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              v{detail.version} — {detail.name}
              <Badge className={`ml-2 ${STATUS_BADGE[detail.status] ?? ""}`} variant="secondary">
                {STATUS_LABEL[detail.status] ?? detail.status}
              </Badge>
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {detail.items.length} Prüfpunkte
              </span>
            </CardTitle>
            {canManage && isDraft && (
              <Button size="sm" onClick={() => {
                setItemForm({ chapter: "", chapterTitle: "", requirements: "" });
                setItemDialog({ open: true, item: null });
              }}>
                Prüfpunkt hinzufügen
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!isDraft && (
              <p className="mb-3 text-sm text-muted-foreground">
                Nur Entwürfe sind bearbeitbar — für Änderungen „Neue Version (Entwurf)“ anlegen.
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Kap.</TableHead>
                  <TableHead className="w-64">Überschrift</TableHead>
                  <TableHead>Prüfpunkte / Anforderungen</TableHead>
                  {canManage && isDraft && <TableHead className="text-right">Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail.items as TemplateItem[]).map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-mono">{item.chapter}</TableCell>
                    <TableCell className="font-medium whitespace-normal">{item.chapterTitle}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      <span className="line-clamp-2">{item.requirements}</span>
                    </TableCell>
                    {canManage && isDraft && (
                      <TableCell className="space-x-1 text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => {
                          setItemForm({
                            chapter: item.chapter,
                            chapterTitle: item.chapterTitle,
                            requirements: item.requirements,
                          });
                          setItemDialog({ open: true, item });
                        }}>
                          Bearbeiten
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}>
                          Löschen
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Entwurf-anlegen-Dialog */}
      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Neue Vorlagen-Version (Entwurf)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="draft-name">Name</Label>
              <Input id="draft-name" value={draftName}
                onChange={(e) => setDraftName(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Die Prüfpunkte der aktiven Vorlage werden in den Entwurf kopiert.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraftDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreateDraft} disabled={saving}>Anlegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prüfpunkt-Dialog (anlegen/bearbeiten) */}
      <Dialog open={itemDialog.open} onOpenChange={(o) => !o && setItemDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{itemDialog.item ? "Prüfpunkt bearbeiten" : "Prüfpunkt hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="item-chapter">Kapitel</Label>
                <Input id="item-chapter" value={itemForm.chapter}
                  onChange={(e) => setItemForm({ ...itemForm, chapter: e.target.value })}
                  placeholder="z. B. 7.5.5" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="item-title">Überschrift</Label>
                <Input id="item-title" value={itemForm.chapterTitle}
                  onChange={(e) => setItemForm({ ...itemForm, chapterTitle: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="item-req">Prüfpunkte / Anforderungen</Label>
              <Textarea id="item-req" rows={4} value={itemForm.requirements}
                onChange={(e) => setItemForm({ ...itemForm, requirements: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setItemDialog({ open: false, item: null })}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveItem} disabled={saving}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfpunkt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Kap. {deleteTarget?.chapter} — „{deleteTarget?.chapterTitle}“ wird aus dem Entwurf
              entfernt. Bereits angelegte Audits sind nicht betroffen (eingefrorene Checklisten).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteTarget) return;
              try {
                await removeItem({ id: deleteTarget._id });
                toast.success("Prüfpunkt gelöscht");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler");
              } finally {
                setDeleteTarget(null);
              }
            }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aktivieren-Bestätigung */}
      <AlertDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entwurf aktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              v{detail?.version} wird die aktive Vorlage; die bisherige aktive Version wird
              abgelöst. Neue Audits frieren ab sofort diese Checkliste ein — bestehende Audits
              bleiben unverändert. Die Prüfpunkte werden dabei kapitelweise sortiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await activate({ id: effectiveId as Id<"auditChecklistTemplates"> });
                toast.success("Vorlage aktiviert");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler");
              } finally {
                setActivateOpen(false);
              }
            }}>
              Aktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar-Link** — in `components/layout/sidebar.tsx`:

Im lucide-Import `ListChecks,` ergänzen. In der Gruppe „Audits & Maßnahmen" nach dem Auditplan-Eintrag einfügen:

```tsx
      { label: "Checklisten-Vorlage", href: "/audits/templates", icon: ListChecks, permission: "audits:manage", featureFlag: "AUDITS" },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/audits/templates/page.tsx" components/layout/sidebar.tsx
git commit -m "feat(audit): Vorlagen-Pflege-Seite (Entwurf anlegen/bearbeiten/aktivieren) + Sidebar-Link"
```

---

### Task 13: Runtime-Verifikation (Pflicht)

**Files:** keine Code-Änderungen (nur Fixes aus dem Walkthrough)

Login-Muster: `claude-test@…`-Nutzer über die Registrieren-Maske anlegen, dann `npx convex run bootstrap:setUserRoleByEmail '{"email":"<testmail>","role":"qmb"}'`; am Ende `npx convex run bootstrap:purgeWalkthroughTestData` (entfernt claude-test-Nutzer und „Runtime-Walkthrough"-Testdaten inkl. Test-Audits mit `auditYear >= 2090`).

- [ ] **Step 1: Dev-Server frisch starten** (alten Prozess beenden — Stale-Server-Memory)

Run: `pkill -f "next dev"; rm -f .next/dev/lock` dann Server starten (Preview oder `npm run dev`)

- [ ] **Step 2: Auditplan + Import prüfen**

1. `/audits/plan` (Jahr 2026): Matrix zeigt **5 Zeilen** — 4 interne Themen (Reha / Rollstuhl, Sanitätshaus / Filiale, Orthopädietechnik, Büro) mit SOLL April + IST Mai (amber x), Status CLOSED, plus „Überwachung-Zerti 13485" (SOLL Juni, kein IST). PDF-Export erzeugt dieselben 5 Zeilen.
2. Klick auf eine interne Themen-Zeile → öffnet „Internes Audit 2026".
3. `/audits`: Liste zeigt „Internes Audit 2026" (CLOSED, Auditdatum 04.05.2026) und das externe Audit; die archivierten Themen-Audits sind verschwunden.
4. Detailseite „Internes Audit 2026": 63 Prüfpunkte (63/63 bewertet), Stichprobe bei 4.1.1 beginnt mit „QMH Kap. 4.1.1…"; Kapitel 7.5.5/7.5.7/7.5.9.2 vorhanden und korrekt einsortiert; 8 Findings (4 Feststellungen mit „CAPA verknüpft"-Badge, 4 Empfehlungen); Auditbericht-Card zeigt Zusammenfassung; „Eingefrorenes PDF (Nachweis)" öffnet den Original-Bericht.
5. Themen-Card: 4 Themen sichtbar, aber NICHT bearbeitbar (Audit CLOSED).

- [ ] **Step 3: Generator 2027 + Vorjahres-Übernahme prüfen**

6. `/audits/plan` → Jahr 2027 → „Plan 2027 aus Vorjahr erzeugen" → Toast „2 … erzeugt"; Matrix 2027 zeigt 5 Zeilen (4 interne Themen aus dem einen neuen Audit + externes Audit), alles PLANNED ohne IST.
7. „Internes Audit 2027" öffnen → Themen-Card editierbar (Thema hinzufügen/bearbeiten/entfernen testen, danach Zustand wiederherstellen); Kopfdaten-Dialog: SOLL-Monate umschaltbar.
8. Audit starten (IN_PROGRESS) → Prüfpunkt 4.1.1 öffnen → Vorjahres-Block zeigt Nachweis/Stichprobe/Gespräch mit/Bemerkungen aus „Internes Audit 2026" + Bewertungs-Badge (nur Anzeige); „Übernehmen" bei Nachweis füllt das Formular; Speichern.
9. „Alle Nachweise aus Vorjahr übernehmen" → Toast mit Anzahl (~59, da 4.1.1 schon gefüllt); stichprobenartig 2 Punkte prüfen; erneuter Klick → 0 übernommen (keine Überschreibung).
10. Aufräumen: „Internes Audit 2027" + externes 2027-Audit über die UI archivieren (oder per `audits:archive`), damit der echte Generator-Lauf im Januar 2027 frei ist. `/audits/plan` 2027 ist danach wieder leer.

- [ ] **Step 4: Vorlagen-UI + Anlege-Dialog prüfen**

11. Sidebar zeigt „Checklisten-Vorlage" (Gruppe Audits & Maßnahmen) → Seite zeigt aktive Vorlage v5 mit 60 Punkten, nicht editierbar.
12. „Neue Version (Entwurf)" → v6 als Kopie; Prüfpunkt 7.5.5 „Besondere Anforderungen Sterilprodukte (Test Walkthrough)" hinzufügen; einen Punkt bearbeiten; den Test-Punkt wieder löschen; Entwurf NICHT aktivieren (oder: aktivieren und prüfen, dass „Internes Audit 2026" unverändert 63 Punkte v5 zeigt — dann ist v6 aktiv, was ok ist, solange die Punkte der v5 entsprechen).
13. `/audits` → „Audit anlegen": SOLL-Monate ohne Thema wählbar; Typ EXTERN zeigt zusätzlich Thema + betroffene Bereiche. Test-Audit „Runtime-Walkthrough 2099" (Jahr 2099) anlegen und prüfen, danach wird es vom Purge entfernt.

- [ ] **Step 5: Aufräumen + Befunde fixen + Commit**

```bash
npx convex run bootstrap:purgeWalkthroughTestData
git add -A
git commit -m "fix(audit): Findings aus Runtime-Walkthrough Audit-Umbau"
```

(Letzter Commit entfällt, wenn der Walkthrough sauber durchläuft.)

---

## Bewusst NICHT in diesem Plan

- **Managementbewertung** (erweiterte Gliederung + 2025-Import) → eigener Plan (Beschluss-Punkt 5)
- **Wareneingang / Prüfmittel / Berichtsarchiv** → eigene Pläne (Punkte 6–8)
- **Hartes Limit „nur ein internes Audit pro Jahr"** beim manuellen Anlegen — der Generator erzeugt genau eines; manuelles Anlegen bleibt frei (z. B. für außerplanmäßige Audits). YAGNI.
- **Audit-Report-Exporter-Anpassungen** — der bestehende Berichts-Generator funktioniert unverändert mit dem importierten Audit.
- **Löschen des `area`-Felds bei internen Audits** — bleibt als Altlast-Kompatibilität im Schema (archivierte 2026er-Audits tragen es noch).
