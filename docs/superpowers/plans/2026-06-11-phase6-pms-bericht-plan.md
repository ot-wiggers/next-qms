# Phase 6: PMS-Bericht (MDR Art. 85) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digitaler PMS-Bericht nach MDR Art. 85 (FB-Kennung „7 1") mit den 8 festen Abschnitten des realen Berichts, Auto-Daten-Snapshot aus Reklamationen/Risiken/CAPAs, Freigabe-Workflow mit eingefrorenem PDF, und Seed des realen 2025-Berichts (Rev. 1, Stand 01.2026).

**Architecture:** `pmsReports` ist der kleine Bruder von `managementReviews` — GLEICHE Muster überall: sections-Array {key, autoData?, text?}, Status DRAFT→APPROVED via `validateTransition`, `buildAutoData`-Helfer (ehrlich: nur Abschnitte mit echten App-Daten bekommen autoData, NICHTS erfinden), `invalidateFrozenReport` bei Inhaltsänderung, approve-Gate „Erst PDF einfrieren, dann freigeben", jsPDF-Exporter im App-Layout mit FB-Kennung. Ein Bericht pro Berichtsjahr (year = Ende des Berichtszeitraums-Jahres, z. B. 2025 für „01.01.2025 – 31.12.2025"). Neu ggü. Mgmt-Review: Auto-Daten ziehen jetzt auch aus dem Phase-5-Risikoregister.

**Tech Stack:** Next.js App Router, Convex, shadcn/ui, sonner, jsPDF. Referenz-Implementierung für ALLES: `convex/managementReviews.ts`, `lib/export/mgmt-review-exporter.ts`, `app/(dashboard)/management-review/page.tsx` + `[id]/page.tsx`.

---

## Quellstruktur (PDF, vollständig extrahiert 2026-06-11 — der Bericht ist EINE Seite)

`PDF/7 1 PMS - Bericht 2026.pdf` (Original: „7 1 PMS - Bericht 2026.docx", Revision 1, Stand 01.2026):

- **Titel:** „Bericht zur Überwachung nach dem Inverkehrbringen (PMS-Bericht) gemäß MDR Art. 85"
- **Berichtszeitraum:** 01.01.2025 – 31.12.2025
- **Produktgruppe:** „Sonderanfertigungen der Klasse I (Orthesen, Einlagen, Prothesen, Maßschuhe etc.)"

**Die 8 Abschnitte mit Original-Wortlaut (Ground Truth für Seed + Daten-Review):**

1. **Ziel des PMS:** „Sicherstellung der Sicherheit, Leistungsfähigkeit und frühzeitigen Erkennung von Risiken."
2. **Datenquellen und Methodik:** „– Reklamationen (OTWin)\n– Interne Fehler (Kunden-, Lieferanten-, interne Fehler - OTWin)\n– Klinische Nachbeobachtung (MPG-Wiedervorlage)\n– Qualitätsziele und Managementbewertung"
3. **Kennzahlen und Auswertung:** „– Reklamationen: 22/Jahr, keine sicherheitsrelevanten Ereignisse\n– MPG-Wiedervorlage: 100 % erfüllt\nKeine systematischen Fehler oder Trends festgestellt"
4. **Risikobewertung:** „Keine neuen Risiken identifiziert\nKeine Anpassung der Risikoanalyse erforderlich"
5. **CAPA:** „– Weiterentwicklung Schulungssystem\n– Verbesserung Dokumentation\n– Optimierung Prozesse"
6. **Bewertung des PMS-Systems:** „Das PMS-System ist geeignet, angemessen und wirksam.\nDie Anforderungen der MDR werden erfüllt."
7. **Schlussfolgerung:** „Keine schwerwiegenden Vorkommnisse\nProdukte weiterhin sicher und leistungsfähig"
8. **Empfehlungen:** „– Dokumentation verbessern\n– Schulungssystem ausbauen\n– Prozesse optimieren"

**Bewusst nicht in Phase 6:** OTWin-Anbindung für „Interne Fehler"/MPG-Wiedervorlage (kommt ggf. später via Sybase — Kennzahlen-Abschnitt bleibt manuell ergänzbar, autoData liefert nur die App-Reklamationszahlen); PMS-Plan (eigenes Dokument, nicht beauftragt); Fälligkeits-Cron für den Jahresbericht (Phase 7); Verknüpfung Abschnitt 5 auf konkrete capaIds (Original ist Freitext — Auto-Snapshot listet die echten CAPAs, Prosa bleibt Freitext, YAGNI).

---

### Task 1: Enums, Permissions, RBAC, Flag

**Files:** `lib/types/enums.ts`, `lib/types/domain.ts`, `convex/lib/permissions.ts`, `app/(dashboard)/admin/settings/page.tsx`

- [ ] Enums anfügen (nach dem Phase-5-Abschnitt):

```ts
// ============================================================
// PMS-Bericht (MDR Art. 85, FB „7 1") — Phase 6
// ============================================================
// Die 8 festen Abschnitte des realen Berichts (Rev. 1, Stand 01.2026)
export const PMS_SECTIONS = [
  { key: "goal", title: "1. Ziel des PMS" },
  { key: "dataSources", title: "2. Datenquellen und Methodik" },
  { key: "metrics", title: "3. Kennzahlen und Auswertung" },
  { key: "riskAssessment", title: "4. Risikobewertung" },
  { key: "capa", title: "5. CAPA" },
  { key: "pmsSystemAssessment", title: "6. Bewertung des PMS-Systems" },
  { key: "conclusion", title: "7. Schlussfolgerung" },
  { key: "recommendations", title: "8. Empfehlungen" },
] as const;
export type PmsSectionKey = (typeof PMS_SECTIONS)[number]["key"];

export const PMS_DEFAULT_PRODUCT_GROUP =
  "Sonderanfertigungen der Klasse I (Orthesen, Einlagen, Prothesen, Maßschuhe etc.)";

// Vorlagen-Texte für neue Entwürfe (aus dem realen Bericht; editierbar)
export const PMS_TEMPLATE_TEXTS: Partial<Record<PmsSectionKey, string>> = {
  goal: "Sicherstellung der Sicherheit, Leistungsfähigkeit und frühzeitigen Erkennung von Risiken.",
  dataSources:
    "– Reklamationen (OTWin)\n– Interne Fehler (Kunden-, Lieferanten-, interne Fehler - OTWin)\n– Klinische Nachbeobachtung (MPG-Wiedervorlage)\n– Qualitätsziele und Managementbewertung",
};
```

- [ ] `lib/types/domain.ts`: PermissionAction um `| "pmsReports:list" | "pmsReports:manage" | "pmsReports:approve"` erweitern (vor `| "admin:settings"`, Stil wie mgmtReview-Trio in Zeile 37).
- [ ] `convex/lib/permissions.ts`: qmb alle drei; department_lead `pmsReports:list`; auditor `pmsReports:list`; employee keine (Muster mgmtReview, Zeilen 23/43/73).
- [ ] FLAG_LABELS in admin/settings: `PMS_REPORTS: { title: "PMS-Bericht", description: "Bericht zur Überwachung nach dem Inverkehrbringen gemäß MDR Art. 85 (Kap. 7.1)" }`.
- [ ] `npx tsc --noEmit` → Commit `feat(pms): Enums, Permissions, RBAC, Flag für Phase 6`

### Task 2: Schema + State-Machine

**Files:** `convex/schema.ts`, `convex/lib/stateMachines.ts`

- [ ] `convex/lib/stateMachines.ts`: Eintrag `pmsReportStatus` exakt nach dem Muster von `mgmtReviewStatus` (DRAFT → APPROVED, keine weiteren Übergänge). VOR Implementierung das bestehende mgmtReviewStatus-Muster lesen und kopieren.
- [ ] `convex/schema.ts`: Union `const pmsReportStatus = v.union(v.literal("DRAFT"), v.literal("APPROVED"));` neben mgmtReviewStatus (Zeile ~101). Tabelle in neuem Abschnitt „PHASE 6 (QM-Jahreszyklus): PMS-Bericht (7.1 / MDR Art. 85)" nach `risks`:

```ts
  pmsReports: defineTable({
    year: v.number(),                      // Berichtsjahr (Ende des Zeitraums): 2025 für "01.01.2025 – 31.12.2025"
    reportingPeriod: v.string(),           // "01.01.2025 – 31.12.2025"
    revision: v.number(),                  // Revision des Berichts (real: 1)
    standText: v.optional(v.string()),     // "01.2026" — Stand-Angabe wie im Original-Kopf
    productGroup: v.string(),              // "Sonderanfertigungen der Klasse I (…)"
    status: pmsReportStatus,
    sections: v.array(v.object({
      key: v.string(),                     // PmsSectionKey (goal|dataSources|metrics|riskAssessment|capa|pmsSystemAssessment|conclusion|recommendations)
      autoData: v.optional(v.string()),    // Daten-Snapshot aus der App (metrics/riskAssessment/capa)
      text: v.optional(v.string()),        // Prosa des Abschnitts
    })),
    reportFileId: v.optional(v.id("_storage")),  // eingefrorenes Nachweis-PDF
    approvedAt: v.optional(v.number()),
    ...auditFields,
  }).index("by_year", ["year"]),
```

- [ ] `npx tsc --noEmit` + `npx convex dev --once` → Commit `feat(pms): Schema pmsReports + State-Machine`

### Task 3: Convex pmsReports.ts

**Files:** Create `convex/pmsReports.ts`

REFERENZ: `convex/managementReviews.ts` ist die Blaupause — Struktur, Guards, Audit-Logging, invalidateFrozenReport, approve-Gate 1:1 übernehmen und auf PMS verschlanken. Permission-Strings: `pmsReports:list` / `pmsReports:manage` / `pmsReports:approve`.

- [ ] **`buildAutoData`** (interner Helfer, analog managementReviews): Jahresgrenzen `Date.UTC(year,0,1)`–`Date.UTC(year+1,0,1)`. Ehrlichkeits-Prinzip: nur 3 Abschnitte bekommen autoData, Rest undefined.
  - `metrics`: Reklamationen des Jahres (complaints, `receivedAt` im Zeitraum): Gesamt, davon vigilanzrelevant (`isVigilanceRelevant`), davon gemeldet (`vigilanceReportedAt` gesetzt), offene am Jahresende (`status !== "CLOSED"` — exakte Status-Literale aus dem Schema prüfen!), häufigste Fehlerarten (Top 3 `failureCategory` mit Zählung). Hinweiszeile wenn 0 Reklamationen im Zeitraum: „Keine Reklamationen im Berichtszeitraum in der App erfasst." (für 2025 erwartet — App-Daten beginnen 2026).
  - `riskAssessment`: aus `risks` (nicht-archiviert): Anzahl gesamt, Anzahl RPZ ≥ 100 (= nicht akzeptabel), höchste RPZ mit Risiko-Titel, Anzahl `addedInRevision`-markiert („neu aufgenommen"). RPZ berechnen (occurrenceProbability × severity × consequences), Schwelle 100 als gespiegelte Konstante (Kommentar wie convex/risks.ts:15).
  - `capa`: CAPAs des Jahres (`year`-Feld): Gesamt, abgeschlossen, offen, davon Wirksamkeit bestätigt (`effectivenessResult === "EFFECTIVE"`).
- [ ] **`list`** (query, `pmsReports:list`): alle nicht-archiviert, sortiert year absteigend.
- [ ] **`getById`** (query, `pmsReports:list`): mit Guard „PMS-Bericht nicht gefunden".
- [ ] **`createDraft`** (mutation, `pmsReports:manage`): args `{ year: v.number() }`. Guards: Jahr 2020–2100; pro Jahr nur EIN nicht-archivierter Bericht („Für dieses Jahr existiert bereits ein PMS-Bericht"). Anlage: reportingPeriod `01.01.{year} – 31.12.{year}`, revision 1, standText undefined, productGroup = PMS_DEFAULT_PRODUCT_GROUP (Wert im Convex-Modul als Konstante spiegeln — Convex kann nicht aus lib/ importieren, Spiegel-Kommentar), status DRAFT, sections = alle 8 Keys in PMS_SECTIONS-Reihenfolge (Keys im Modul als string-Array spiegeln) mit autoData aus buildAutoData und text aus gespiegelten Template-Texten (goal + dataSources). logAuditEvent CREATE. Return id.
- [ ] **`refreshAutoData`** (mutation, `pmsReports:manage`): nur DRAFT („Freigegebene Berichte können nicht aktualisiert werden"); buildAutoData neu, autoData je Abschnitt ersetzen (text unangetastet), invalidateFrozenReport-Muster (Inhaltsänderung → reportFileId entfernen, im Return `reportInvalidated` melden wie managementReviews.refreshAutoData). logAuditEvent UPDATE.
- [ ] **`updateSection`** (mutation, `pmsReports:manage`): args id, key (Guard: muss in den 8 Keys sein), text optional. Nur DRAFT. Clearing via `trim() || undefined`. invalidateFrozenReport. logAuditEvent UPDATE mit section-Key.
- [ ] **`updateGeneral`** (mutation, `pmsReports:manage`): reportingPeriod?, revision?, standText?, productGroup? — nur DRAFT, Trim-Guards (reportingPeriod/productGroup nicht leerbar: „… ist erforderlich"), revision ganzzahlig ≥ 1. invalidateFrozenReport. logAuditEvent.
- [ ] **`generateUploadUrl`** (mutation, `pmsReports:manage`): `ctx.storage.generateUploadUrl()` (Muster managementReviews.generateUploadUrl inkl. Guards).
- [ ] **`attachReport`** (mutation, `pmsReports:manage`): args id, storageId — nur DRAFT, setzt reportFileId. logAuditEvent (Muster attachReport in managementReviews inkl. eventueller Alt-Datei-Löschung — Muster exakt übernehmen).
- [ ] **`approve`** (mutation, `pmsReports:approve`): `validateTransition("pmsReportStatus", status, "APPROVED")`; Gate `if (!reportFileId) throw new Error("Erst PDF einfrieren, dann freigeben")`; setzt status + approvedAt. logAuditEvent STATUS_CHANGE (Action-String aus managementReviews.approve übernehmen).
- [ ] **`getReportUrl`** (query, `pmsReports:list`): storage-URL des eingefrorenen PDFs (Muster getReportUrl).
- [ ] **`seedFromImport`** (internalMutation): args `{ year, reportingPeriod, revision, standText, productGroup, status (string-Literal-Union DRAFT/APPROVED), approvedAt optional, sections: array of { key, text optional } }`. Idempotent (existiert nicht-archivierter Bericht des Jahres → skipped). autoData beim Seed via buildAutoData generieren (zeigt ehrlich die App-Datenlage). Validierung: alle Keys gültig, bei status APPROVED muss approvedAt gesetzt sein (reportFileId bleibt leer — Original-PDF liegt extern vor, Kommentar). Return { created: true/skipped }.
- [ ] **`seedReset`** (internalMutation): hard delete aller pmsReports + PERMANENT_DELETE-Marker (Muster risks.seedReset).
- [ ] `npx tsc --noEmit` + `npx convex dev --once` → Commit `feat(pms): Convex-Modul mit Auto-Snapshot, Freeze- und Freigabe-Workflow`

### Task 4: PDF-Exporter

**Files:** Create `lib/export/pms-report-exporter.ts`

REFERENZ: `lib/export/mgmt-review-exporter.ts` — Layout-Helfer, Seitenumbruch-Logik, Kopf/Fuß exakt übernehmen.

- [ ] Interface `PmsReportData`: { reportingPeriod, revision, standText?, productGroup, status, approvedAt?, sections: { key, title, autoData?, text? }[], organizationName? — an mgmt-review-Exporter-Interface angleichen (vorher lesen, gleiche Optionalitäts-Konventionen) }.
- [ ] `buildPmsReportPdf(data): jsPDF`: Kopf mit Titel „Bericht zur Überwachung nach dem Inverkehrbringen (PMS-Bericht) gemäß MDR Art. 85", FB-Kennung „7 1", `Revision {revision}`, `Stand {standText}` (wenn gesetzt), Berichtszeitraum, Produktgruppe. Je Abschnitt: nummerierte Überschrift (title aus PMS_SECTIONS), dann autoData (als „Daten aus der App:"-Block, dezent) und text (Prosa). Fuß: Seitenzahl + Freigabevermerk (approvedAt formatiert) wie im mgmt-review-Exporter.
- [ ] `downloadPmsReport(data, fileName)` + `pmsReportBlob(data)` (für Freeze-Upload) — Muster Zeilen 184/189 des Referenz-Exporters.
- [ ] `npx tsc --noEmit` + `npx eslint lib/export/pms-report-exporter.ts` → Commit `feat(pms): PDF-Exporter im App-Layout mit FB-Kennung 7 1`

### Task 5: UI (Liste + Detail)

**Files:** Create `app/(dashboard)/pms-reports/page.tsx`, `app/(dashboard)/pms-reports/[id]/page.tsx`

REFERENZ: `app/(dashboard)/management-review/page.tsx` (Liste + Anlegen-Dialog) und `[id]/page.tsx` (Abschnitts-Editor, Auto-Daten-Refresh, PDF-Erzeugen/Einfrieren via generateUploadUrl→fetch PUT→attachReport, Freigabe-Gate, Download) — Interaktionsmuster 1:1 übernehmen. VOR Implementierung beide Referenz-Seiten UND convex/pmsReports.ts lesen.

- [ ] **Liste:** PageHeader „PMS-Berichte" description „Überwachung nach dem Inverkehrbringen gemäß MDR Art. 85 (FB 7 1)". Tabelle: Jahr | Berichtszeitraum | Produktgruppe (truncate) | Revision | Status-Badge (DRAFT „Entwurf" amber / APPROVED „Freigegeben" grün) | Freigegeben am. Zeilen-Klick → `/pms-reports/{id}`. Button „+ Bericht anlegen" (gated `pmsReports:manage`) → Mini-Dialog mit Jahr-Input (default: aktuelles Jahr − 1, da PMS rückblickend) → createDraft → router.push zur Detailseite. Empty-State.
- [ ] **Detail:** Kopf-Card mit year/reportingPeriod/revision/standText/productGroup (editierbar via updateGeneral nur im DRAFT, Muster Mgmt-Review-Kopfdaten) + Status-Badge. Je Abschnitt (8, in PMS_SECTIONS-Reihenfolge) eine Card: Titel; autoData (falls vorhanden) als muted vorformatierter Block (`whitespace-pre-wrap`) mit Label „Daten aus der App"; Textarea für text (disabled wenn APPROVED oder !manage) mit Speichern-Button je Abschnitt (keyed Draft, Muster Mgmt-Review updateSection). Aktionsleiste: „Auto-Daten aktualisieren" (DRAFT, manage; toast inkl. Hinweis wenn dadurch das eingefrorene PDF ungültig wurde), „PDF herunterladen" (immer; baut PDF client-seitig aus aktuellem Stand via buildPmsReportPdf), „PDF einfrieren" (DRAFT, manage: pmsReportBlob → generateUploadUrl → PUT → attachReport → toast), „Freigeben" (gated `pmsReports:approve`, nur DRAFT; disabled + Hinweis solange kein reportFileId; confirm; approve → toast), „Eingefrorenes PDF öffnen" (wenn reportFileId, via getReportUrl). APPROVED ohne reportFileId (Seed-Fall 2025): Hinweis-Box „Der Original-Bericht liegt als externes Dokument vor (Formblatt 7 1)" statt Öffnen-Button.
- [ ] Hooks vor Early-Returns; Loading/Empty-States; literal Umlaute; htmlFor/id; Doppelklick-Schutz auf Einfrieren/Freigeben.
- [ ] `npx tsc --noEmit` + `npx eslint "app/(dashboard)/pms-reports/page.tsx" "app/(dashboard)/pms-reports/[id]/page.tsx"` → Commit `feat(pms): Listen- und Detailseite mit Abschnitts-Editor, Freeze und Freigabe`

### Task 6: Seed 2025-Bericht + UNABHÄNGIGER Daten-Review

Kein Extraktionsskript nötig (der Bericht ist eine Seite; Ground Truth steht oben in §Quellstruktur).

- [ ] Seed-JSON inline (Heredoc) mit exakt den 8 Original-Texten aus §Quellstruktur, year 2025, reportingPeriod „01.01.2025 – 31.12.2025", revision 1, standText „01.2026", productGroup wie oben, status APPROVED, approvedAt = `Date.UTC(2026,0,31)` (Stand 01.2026 → Ende Januar als plausibler Freigabezeitpunkt, im sourceNote… KEIN sourceNote-Feld — stattdessen Kommentar im Übergabe-Abschnitt).
- [ ] `npx convex run pmsReports:seedFromImport "$(cat …)"` → { created: true }. Verify `npx convex data pmsReports --limit 5`.
- [ ] **UNABHÄNGIGER Daten-Review (Pflicht):** zweiter Agent extrahiert das PDF selbst (pdf-parse) und vergleicht ALLE 8 Abschnittstexte wortgetreu (Aufzählungszeichen-Konvention dokumentieren: PDF nutzt „o "-Bullets, Seed nutzt „– " — bewusste Normalisierung, Texte selbst müssen wortgleich sein), Kopfdaten (Zeitraum, Revision, Stand, Produktgruppe), Status/approvedAt-Plausibilität, autoData-Ehrlichkeit (2025 hat keine App-Reklamationen → metrics-autoData muss das EHRLICH sagen, nicht „22/Jahr" erfinden — die 22/Jahr stehen nur im TEXT des Originals). Korrekturen via seedReset + Re-Seed.

### Task 7: Sidebar, Build, Final-Review

**Files:** `components/layout/sidebar.tsx`

- [ ] Sidebar QM-Sektion NACH „Managementbewertung": `{ label: "PMS-Bericht", href: "/pms-reports", icon: FileSearch, permission: "pmsReports:list", featureFlag: "PMS_REPORTS" }` (FileSearch aus lucide-react; bei Kollision Alternative + Bericht).
- [ ] `npx tsc --noEmit` + eslint sidebar + `npm run build` (Routen `/pms-reports` + `/pms-reports/[id]`) → Commit `feat(pms): Sidebar-Eintrag PMS-Bericht`
- [ ] **Final-Integration-Review** (Subagent): Konsistenz Section-Keys enums↔Modul↔UI↔Exporter, Status-Maschine, Freeze/Invalidate-Pfade vollständig (JEDE Inhaltsänderung invalidiert: updateSection, updateGeneral, refreshAutoData), Regression Phasen 1–5, Deployed-Parität, tsc+build selbst ausführen. Fixes umsetzen.

### Task 8: Runtime-Walkthrough (PFLICHT), Übergabe, Merge

> Stehende Nutzer-Anweisung: nach jeder Phase Funktionen + logische Verknüpfungen im echten Browser prüfen.

- [ ] `purgeWalkthroughTestData` in convex/bootstrap.ts um pmsReports erweitern (Titel-Kriterium gibt es nicht — Kriterium: year ≥ 2090 ODER reportingPeriod enthält „Test"; Walkthrough nutzt year 2099).
- [ ] Dev-Server-Tanz: Port-3000-Server stoppen → preview_start (3002) → NACH Walkthrough Preview stoppen, beide Server in kanonischer Zuordnung neu starten (next-qms:3000, webstudio:3001 — Reihenfolge beachten, webstudio läuft evtl. und schnappt sich freie Ports).
- [ ] Testnutzer registrieren + `bootstrap:setUserRoleByEmail` → admin. Flag `PMS_REPORTS` in /admin/settings aktivieren (bleibt an).
- [ ] **Walkthrough:**
  1. Sidebar „PMS-Bericht"; Liste zeigt den 2025-Bericht (Freigegeben, grün); Detail: 8 Abschnitte mit Original-Texten, Hinweis-Box statt Öffnen-Button (kein eingefrorenes PDF), Abschnitte NICHT editierbar (APPROVED).
  2. Neuen Bericht year 2099 anlegen → Detail: autoData ehrlich (metrics: „Keine Reklamationen…", riskAssessment: 22 Risiken / 0 ≥ 100 / Max RS-04 90), Template-Texte in goal/dataSources.
  3. Abschnitt 6 Text editieren + speichern → Toast; „PDF herunterladen" erzeugt PDF; „PDF einfrieren" → Erfolg; DANACH Abschnitt erneut ändern → Hinweis PDF ungültig geworden (invalidate!); erneut einfrieren; „Freigeben" → Status grün, Abschnitte read-only; „Eingefrorenes PDF öffnen" liefert URL.
  4. Gegentest: „Freigeben" vor Einfrieren ist disabled/Fehler; auditor sieht Liste aber keine Buttons; Cross-Modul: riskAssessment-autoData nennt echte RS-Daten (Phase-5-Verknüpfung), capa-autoData echte CAPA-Zahlen.
  5. Regressions-Smoke: /risks, /management-review, /complaints, /quality-objectives öffnen — fehlerfrei, Toasts ok.
- [ ] Testdaten purgen (2099-Bericht + Testnutzer) → verify: nur 2025-Bericht übrig.
- [ ] Übergabe-Abschnitt in DIESEN Plan; Merge auf master + Build + Branch löschen + Push; Memory-Update (Phase 6 ✅, Phase 7 next).

---

## Self-Review (gegen Design-Doc §Phase 6)

- „pmsReports (Berichtszeitraum, …)" → Task 2 Schema ✅
- „Auto-Snapshot aus Reklamationen/Produkten/Vigilanz" → buildAutoData metrics (Reklamationen inkl. Vigilanz-Zahlen + Fehlerarten); „Produkten" → Produktgruppe ist Kopffeld, produktscharfe Auswertung wäre erfunden (Original aggregiert nur die Produktgruppe) — dokumentierte bewusste Auslegung ✅
- „Prosa-Abschnitte" → sections[].text, 8 feste Abschnitte exakt wie Original ✅
- „Freigabe + PDF" → Exporter (Task 4) + Freeze/approve-Gate (Task 3) + UI (Task 5) ✅
- Risiko-Verknüpfung als Phase-5-Mehrwert (riskAssessment-autoData) ✅
- Seed des realen 2025-Berichts mit Daten-Review ✅ (Task 6)
- Typ-Konsistenz: PmsSectionKey-Strings identisch in enums (T1), Schema-Kommentar (T2), Modul-Spiegel (T3), Exporter-Titel-Lookup (T4), UI (T5), Seed (T6) ✅
