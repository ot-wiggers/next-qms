# Phase 4: Schulungsbedarfsmatrix — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Funktionsbasierte Schulungsbedarfsmatrix (FB 6.2.0 Anhang Rev. 1) mit Soll-Ist-Erfüllungsgrad je Funktion, Nachfolge-&-Besetzungs-Verwaltung und Schulungsplan-Entwurfs-Generator — neu (kein Platzhalter).

**Architecture:** Muster Phasen 1–3 (master `7089934`). Funktions- statt rollenbasiert (die 9 realen Funktionen sind keine App-Rollen). Vier Tabellen: `jobFunctions` (inkl. Besetzungs-/Nachfolgefelder), `trainingTopics` (Cluster A–E, Frequenz, Anbieter), `trainingRequirements` (Funktion × Thema × Einstufung), `trainingFulfillments` (Ist je Funktion × Pflicht-Thema, manuell gepflegt wie im realen Blatt „Stand & Lücken" Spalte E). Erfüllungsgrad = erfüllte Pflicht-Themen (●●●/●●) ÷ Pflicht-Themen, Ampel GRÜN 100 % / GELB ≥ 70 % / ROT < 70 % (Legende des realen Blatts). Kein Status-Workflow → keine State-Machine. Plan-Entwurf ist eine **Query** (kein eigener Datenbestand, YAGNI): unerfüllte Pflicht-Themen → Vorschlagszeilen, aus denen per Klick Trainings im bestehenden Modul entstehen. Neuer KPI `trainingFulfillmentRate` in der KPI-Engine (Vorschlagsquelle für FB 5.4.1 Ziel 3). Convex-Zugriff live — Seed wird im Task ausgeführt.

**Quellstruktur (xlsx, extrahiert 2026-06-10):** `PDF/6 2 0 Schulungsbedarfsmatrix.xlsx`, 4 Blätter: Deckblatt (Zweck, Status ENTWURF — Freigabe GF+BDL ausstehend!) · „Schulungsbedarfsmatrix" (Cluster A QM&Regulatorik / B Führung&Personal / C IT&Datenschutz / D Versorgung&Werkstatt / E Reklamation&Vigilanz; Zeilen = Themen mit Frequenz + Quelle/Anbieter; Spalten = 9 Funktionen; Zellen ●●●=Pflicht-tief, ●●=Pflicht-Grundlagen, ●=empfohlen, ○=bei Bedarf, —=nicht relevant) · „Stand & Lücken" (je Funktion: Stelleninhaber, Besetzungsstatus, Anzahl Pflichtschulungen [automatisch gezählt], davon vorhanden [manuell], Erfüllungsgrad-Ampel) · „Nachfolge & Besetzung" (je Funktion: Besetzungsweg, Aktueller Stand, Nächste Schritte, Verantwortlich, Termin, Status). Die 9 Funktionen: Geschäftsführung, Verwaltungsleiter/QMB, Sanitätshausleitung, OT-Meister/Werkstatt, Rehatechniker, Teamleitung Abrechnung, Senior-Verkäufer Filiale, Medizinprodukteberater, Verantw. Person MDR (PRRC).

**Bewusst nicht in Phase 4:** Verknüpfung Ist-Stand ↔ einzelne `trainingParticipants`-Datensätze (das reale Blatt pflegt den Ist-Stand manuell aus der Befugnismatrix der konkreten Person — wir bilden genau das ab; personenscharfe Automatik wäre erfunden); Matrix-Freigabe-Workflow (Status ENTWURF wird als Hinweis angezeigt, Freigabe = Nutzer-Entscheidung außerhalb der App bzw. Phase 7); Notifications.

---

### Task 1: Enums, Permissions, RBAC, Flag, KPI-Key

**Files:** `lib/types/enums.ts`, `lib/types/domain.ts`, `convex/lib/permissions.ts`, `app/(dashboard)/admin/settings/page.tsx`

- [ ] Enums anfügen:

```ts
// ============================================================
// Schulungsbedarfsmatrix (ISO 13485 Kap. 6.2, FB 6.2.0 Anhang) — Phase 4
// ============================================================
// Einstufungs-Legende exakt nach FB 6.2.0 Anhang Rev. 1
export const REQUIREMENT_LEVELS = [
  "REQUIRED_DEEP",    // ●●● Pflicht – tiefer Fachbedarf
  "REQUIRED_BASIC",   // ●●  Pflicht – Grundlagen
  "RECOMMENDED",      // ●   Empfohlen
  "ON_DEMAND",        // ○   Bei Bedarf
] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];
export const REQUIREMENT_LEVEL_LABELS: Record<RequirementLevel, string> = {
  REQUIRED_DEEP: "Pflicht – tiefer Fachbedarf",
  REQUIRED_BASIC: "Pflicht – Grundlagen",
  RECOMMENDED: "Empfohlen",
  ON_DEMAND: "Bei Bedarf",
};
export const REQUIREMENT_LEVEL_SYMBOLS: Record<RequirementLevel, string> = {
  REQUIRED_DEEP: "●●●", REQUIRED_BASIC: "●●", RECOMMENDED: "●", ON_DEMAND: "○",
};
// Pflicht-Einstufungen für Soll-Zählung und Erfüllungsgrad
export const MANDATORY_LEVELS: readonly RequirementLevel[] = ["REQUIRED_DEEP", "REQUIRED_BASIC"];

// Besetzungsstatus exakt nach Blatt „Stand & Lücken"
export const STAFFING_STATUSES = [
  "FILLED",            // besetzt (grün)
  "INTERNAL_DEVELOP",  // intern fortbilden / informell — formal nachzuholen (gelb)
  "EXTERNAL_HIRE",     // extern neu zu besetzen (rot)
  "IN_CLARIFICATION",  // Klärungsbedarf, z.B. Doppelrolle (blau)
] as const;
export type StaffingStatus = (typeof STAFFING_STATUSES)[number];
export const STAFFING_STATUS_LABELS: Record<StaffingStatus, string> = {
  FILLED: "Besetzt",
  INTERNAL_DEVELOP: "Intern fortbilden",
  EXTERNAL_HIRE: "Extern zu besetzen",
  IN_CLARIFICATION: "In Klärung",
};

export const TOPIC_CLUSTERS = [
  { key: "A", title: "A. QM & Regulatorik" },
  { key: "B", title: "B. Führung & Personal" },
  { key: "C", title: "C. IT & Datenschutz" },
  { key: "D", title: "D. Versorgung & Werkstatt" },
  { key: "E", title: "E. Reklamation & Vigilanz" },
] as const;
```

- [ ] `KPI_KEYS` um `"trainingFulfillmentRate"` erweitern (+ Label `"Erfüllungsgrad Pflichtschulungen (%)"`, Kommentar `// Phase 4: erfüllte Pflicht-Themen ÷ Pflicht-Themen über alle Funktionen`).
- [ ] PermissionAction vor `| "admin:settings"`: `| "trainingMatrix:list" | "trainingMatrix:manage"`
- [ ] RBAC: qmb beide; department_lead `trainingMatrix:list`; auditor `trainingMatrix:list`; employee keine (enthält Personalplanungs-Daten).
- [ ] FLAG_LABELS: Key `TRAINING_MATRIX` („Schulungsmatrix", „Funktionsbasierte Schulungsbedarfe mit Soll-Ist (Kap. 6.2)").
- [ ] `npx tsc --noEmit` → Commit `feat(matrix): Enums, Permissions, RBAC, Flag, KPI-Key für Phase 4`

### Task 2: Schema

**Files:** `convex/schema.ts` (keine State-Machine nötig)

- [ ] Unions: `requirementLevel` (4 Literale), `staffingStatus` (4 Literale).
- [ ] Tabellen (neuer Abschnitt „PHASE 4 (QM-Jahreszyklus): Schulungsbedarfsmatrix (6.2)" nach `managementReviews`):

```ts
  jobFunctions: defineTable({
    name: v.string(),                       // "Verwaltungsleiter / QMB"
    holder: v.optional(v.string()),         // Stelleninhaber/-in (Freitext wie im Blatt)
    staffingStatus: staffingStatus,
    userId: v.optional(v.id("users")),      // optionale Verknüpfung zum App-Nutzer
    sortOrder: v.number(),
    notes: v.optional(v.string()),
    // Nachfolge & Besetzung (Blatt 4) — Felder je Funktion
    successionPath: v.optional(v.string()),     // Besetzungsweg
    successionState: v.optional(v.string()),    // Aktueller Stand
    successionNextSteps: v.optional(v.string()),// Konkrete nächste Schritte
    successionResponsible: v.optional(v.string()),
    successionDueText: v.optional(v.string()),  // "Q4 2026", Datum als Freitext wie im Blatt
    successionStatus: v.optional(v.string()),   // Freitext wie im Blatt
    ...auditFields,
  }).index("by_sortOrder", ["sortOrder"]),

  trainingTopics: defineTable({
    cluster: v.string(),                    // "A".."E" (TOPIC_CLUSTERS)
    title: v.string(),
    frequency: v.optional(v.string()),      // "1× initial, Refresher alle 3 Jahre"
    provider: v.optional(v.string()),       // Quelle/Anbieter
    sortOrder: v.number(),
    ...auditFields,
  }).index("by_cluster", ["cluster"]),

  trainingRequirements: defineTable({
    functionId: v.id("jobFunctions"),
    topicId: v.id("trainingTopics"),
    level: requirementLevel,                // kein Eintrag = "—" nicht relevant
    ...auditFields,
  })
    .index("by_function", ["functionId"])
    .index("by_topic", ["topicId"]),

  trainingFulfillments: defineTable({
    functionId: v.id("jobFunctions"),
    topicId: v.id("trainingTopics"),
    fulfilled: v.boolean(),
    validUntil: v.optional(v.number()),     // Wiederholungstermin, optional
    note: v.optional(v.string()),
    ...auditFields,
  }).index("by_function", ["functionId"]),
```

- [ ] `npx tsc --noEmit` + `npx convex dev --once` → Commit `feat(matrix): Schema für Funktionen, Themen, Anforderungen, Ist-Stand`

### Task 3: Convex trainingMatrix.ts + KPI-Erweiterung

**Files:** Create `convex/trainingMatrix.ts`; Modify `convex/kpis.ts`

Exports (Muster Phasen 1–3: requirePermission → Guards → typed Patches → logAuditEvent; deutsche Fehler):
- `overview` (trainingMatrix:list): alle Funktionen (by_sortOrder, non-archived) mit je: Pflicht-Soll (Anzahl Requirements mit Level in MANDATORY_LEVELS), Ist (Anzahl fulfilled=true Fulfillments zu Pflicht-Themen; abgelaufene `validUntil < now` zählen NICHT als erfüllt — Kommentar), Erfüllungsgrad % (Soll 0 → null), Ampel (100 GRÜN / ≥70 GELB / <70 ROT / null „—"), Besetzungsstatus.
- `matrix` (trainingMatrix:list): Themen (by_cluster sortiert nach cluster+sortOrder) × Funktionen mit Level-Map (`requirements` als Lookup functionId→level je Thema) — Rohdaten für die Grid-Ansicht.
- `functionDetail({functionId})` (trainingMatrix:list): Funktion + ihre Pflicht-/Empfohlen-Themen mit Fulfillment-Stand (joined).
- `setFulfillment({functionId, topicId, fulfilled, validUntil?, note?})` (manage): upsert in trainingFulfillments; Guard: Requirement mit Pflicht- ODER Empfohlen-Level muss existieren („Thema ist für diese Funktion nicht relevant"); UPDATE-Log.
- `updateFunction({id, holder?, staffingStatus?, userId?, notes?, succession*?})` (manage): per-field, klärbare Texte; Log.
- `createFunction`/`createTopic`/`setRequirement({functionId, topicId, level | null zum Entfernen — als v.optional(requirementLevel) + remove-Flag})` (manage): minimal für Pflege nach dem Seed; setRequirement upsert/delete (delete = hart, da Stammdaten-Zuordnung, Kommentar).
- `planDraft({year})` (trainingMatrix:list) **Query**: für jede Funktion alle unerfüllten Pflicht-Themen → Zeilen {functionId, functionName, holder, topicId, topicTitle, cluster, level, frequency, provider}; sortiert Cluster/Funktion. (Kein Schreiben — der Entwurf wird in der UI in Trainings überführt.)
- `seedFromImport` internalMutation: args {functions:[{name, holder?, staffingStatus, sortOrder, succession…?}], topics:[{cluster, title, frequency?, provider?, sortOrder}], requirements:[{functionIndex, topicIndex, level}]} — Indizes referenzieren die Arrays (Seed-Payload kennt keine Ids); idempotent: skip wenn bereits jobFunctions existieren („Matrix bereits geseedet — seedReset zuerst"); plus `seedReset` internalMutation (hart, Audit-Marker, wie qualityObjectives).
- KPI: in `convex/kpis.ts` `trainingFulfillmentRate` ergänzen: erfüllte Pflicht-Paare ÷ alle Pflicht-Paare × 100 gerundet; 100 wenn keine Pflicht-Paare (Kommentar); Promise.all erweitern.
- [ ] tsc + Push → Commit

### Task 4: Seed aus der xlsx

- [ ] `PDF/6 2 0 Schulungsbedarfsmatrix.xlsx` parsen (xlsx-Lib, Muster scripts/import-audit-checklist.mjs): Blatt „Schulungsbedarfsmatrix" → Themen (Cluster-Headerzeilen A.–E. erkennen) + 9 Funktions-Spalten mit Symbol-Mapping (●●●/●●/●/○ → Level, — /leer → kein Requirement); Blatt „Stand & Lücken" → holder/staffingStatus je Funktion (Mapping: „besetzt"→FILLED, „intern fortbilden"/„informell"→INTERNAL_DEVELOP, „extern zu besetzen"→EXTERNAL_HIRE, „in Klärung"→IN_CLARIFICATION); Blatt „Nachfolge & Besetzung" → succession-Felder. Kuratieren als `scripts/out/schulungsmatrix.json`, validieren (9 Funktionen, ~20 Themen, Requirements-Indizes in Range).
- [ ] Live seeden + Idempotenz-Re-Run + `npx convex data jobFunctions/trainingTopics/trainingRequirements` verifizieren (Stichproben: GF hat ●● bei ISO 13485; Rehatechniker ●●● bei EUP und Wartung; PRRC 12 Pflicht-Themen lt. Blatt — Zähl-Abgleich mit Spalte D des Originals!).
- [ ] **Unabhängiger Daten-Review** (Lektion aus Phase 3: Seed-Kuration immer gegenprüfen) — zweiter Agent verifiziert Symbol-Mapping und Zellzuordnung gegen die xlsx, Korrekturen via seedReset+Re-Seed.
- [ ] Commit (Skript; JSON bleibt gitignored)

### Task 5: UI Schulungsmatrix

**Files:** Create `app/(dashboard)/training-matrix/page.tsx`

Tabs (shadcn Tabs, wie Login-Seite sie nutzt): 
1. **„Soll-Ist"** (Default): Karte je Funktion: Name + Stelleninhaber + Besetzungsstatus-Badge (FILLED grün/INTERNAL_DEVELOP gelb/EXTERNAL_HIRE rot/IN_CLARIFICATION blau) + Erfüllungsgrad-Ampel + „X/Y Pflichtschulungen". Expand/Dialog „Details": Liste der Pflicht- und Empfohlen-Themen mit Erfüllt-Checkbox (gated manage; setFulfillment), validUntil-Datum optional, Notiz; Nachfolge-Abschnitt (succession-Felder als Formular, gated manage). ENTWURF-Hinweis-Banner oben: „Die Einstufungen der Matrix sind laut Formblatt Rev. 1 noch ENTWURF — Freigabe durch GF + BDL ausstehend."
2. **„Matrix"**: Tabelle Themen (Zeilen, gruppiert nach Cluster-Überschriften) × Funktionen (Spalten, abgekürzt) mit REQUIREMENT_LEVEL_SYMBOLS; Legende darunter; horizontal scrollbar (overflow-x-auto); Zell-Klick (manage) → Level-Zyklus oder Mini-Select (einfachste Variante wählen: Klick öffnet kleinen Dialog mit Level-Select + „nicht relevant" zum Entfernen → setRequirement).
3. **„Plan-Entwurf"**: planDraft-Zeilen als Tabelle (Funktion | Thema | Einstufung | Frequenz | Anbieter) + je Zeile Button „Training anlegen" (gated trainings:create — prüfe den exakten Permission-String im Bestand!) → ruft die BESTEHENDE trainings-create-Mutation auf (Signatur in convex/trainings.ts lesen; Titel = Thema, Beschreibung = `Aus Schulungsbedarfsmatrix: {Funktion}, Einstufung {Label}`) + Erfolgs-Toast mit Link /trainings.

- [ ] tsc/eslint → Commit

### Task 6: Sidebar, Build, Final-Review, Übergabe, Merge

- [ ] Sidebar QM-Sektion (nach „Schulungsanträge"): `{ label: "Schulungsmatrix", href: "/training-matrix", icon: Grid3x3 (o.ä. freies lucide-Icon), permission: "trainingMatrix:list", featureFlag: "TRAINING_MATRIX" }`
- [ ] `npm run build` → Routen prüfen
- [ ] Finaler Integrations-Review (Range, Regression auf Phasen 1–3 + bestehendes Trainings-Modul) → Fixes
- [ ] Übergabe-Abschnitt (Flag aktivieren; Walkthrough: 9 Funktionen mit Ist-Pflege, Matrix-Grid, Plan-Entwurf → Training anlegen; Gegentests: setFulfillment auf irrelevantem Thema scheitert, employee sieht den Eintrag nicht; Hinweis Matrix-ENTWURF-Status) → Merge nach master, Branch löschen, Push

---

## Selbst-Review
- Funktionsbasiert ✓ (eigene jobFunctions, nicht User-Rollen), Legende + Ampel exakt nach Original ✓, Ist-Pflege manuell wie Original (Spalte E) ✓, Nachfolge-Blatt als Felder ✓, Plan-Generator als Query + Übergabe ins bestehende Trainings-Modul ✓, KPI fürs Q-Ziel ✓, Seed mit unabhängigem Daten-Review (Phase-3-Lektion) ✓. Bewusst nicht: personenscharfe Automatik, Freigabe-Workflow, Notifications, eigene Plan-Tabelle.
- Konsistenz: REQUIRED_DEEP/REQUIRED_BASIC/… nur in enums + schema + Modul; keine Status-Workflows → keine State-Machine; `validUntil`-Ablauf zählt als unerfüllt (dokumentiert).

---

## Übergabe — Stand 2026-06-11, Implementierung abgeschlossen

Schema, Funktionen und Seed sind LIVE (9 Funktionen / 27 Themen in **7 Clustern A–G** — das reale Blatt hat zwei mehr als das Deckblatt nannte / 195 Einstufungen / 8 Nachfolge-Zeilen). Zwei unabhängige Daten-Reviews fingen: Cluster F+G, Soft-Hyphen-Zeichen in Namen, und 2 still verlorene Nachfolge-Zeilen (inkl. der audit-relevanten PRRC-Zeile „vor Audit Juli 2026") — alles korrigiert und re-geseedet; die Pflicht-Zählungen stimmen exakt mit Spalte D des Originals (12/19/18/20/17/16/12/9/12). Flag `TRAINING_MATRIX` ist bereits aktiv.

**Nutzer-Schritte:** Walkthrough gemäß Final-Review-Checkliste — 9 Karten mit Besetzungs-Badges, Ist-Pflege per Checkbox (Erfüllungsgrad startet bei 0 %, da das Original nur Zählwerte führt — die Per-Thema-Zuordnung ist deine Erstpflege), Matrix-Grid mit Level-Editor, Plan-Entwurf (135 Pflicht-Zeilen) → „Training anlegen" erzeugt Trainings im bestehenden Modul. Gegentests: irrelevantes Thema → Fehler; auditor kann nicht editieren; abgelaufenes „Gültig bis" senkt den Erfüllungsgrad und bringt die Zeile in den Plan-Entwurf zurück. **Achtung:** `trainingMatrix:seedReset` löscht auch manuell gepflegte Ist-Stände — nach Beginn der Pflege nicht mehr ausführen.

**Folgepunkte:** Fulfillment-Detail könnte später Wiederholungs-Automatik aus der Frequenz ableiten (Phase 7); Matrix-Freigabe-Workflow (ENTWURF-Status) bewusst außerhalb der App.
