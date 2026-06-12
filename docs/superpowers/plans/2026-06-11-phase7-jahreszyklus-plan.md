# Phase 7: Jahreszyklus-Automatik — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditplan-Jahresmatrix nach FB 8.2.4 (Thema × Monat, SOLL/IST, PDF-Export, Seed der 5 Themen-Audits 2026) plus Fälligkeits-Crons (Auditplan, CAPA-Wirksamkeit, Risiko-Neubewertung, Jahresberichte) und Jahreswechsel-Automatik — der Schlussstein des QM-Jahreszyklus.

**Architecture:** Drei Bausteine. (1) `audits` bekommt die optionalen Felder `area`/`plannedMonths`/`affectedAreas` nachmigriert (rein additiv — Bestands-Audits unberührt); die Matrix-Ansicht `/audits/plan` rendert SOLL aus `plannedMonths` und leitet IST EHRLICH aus echten `auditDate`-Werten ab (die IST-Kreuze des Original-PDFs werden NICHT geseedet — keine fabrizierten Datumswerte). (2) Neue interne Fälligkeits-Mutationen folgen exakt dem bestehenden Cron-Muster (`effectiveness.checkDue`, `tasks.checkOverdue`): Task + Notification mit Dedup über offene Tasks gleicher resourceType/resourceId. (3) Jahreswechsel = SEMI-automatisch (Hausphilosophie wie Finding→CAPA): Cron erzeugt Anfang Januar Erinnerungs-Tasks für QMB; der Auditplan-Vorschlag ist ein Ein-Klick-Generator (kopiert Themen-Audits des Vorjahres als PLANNED), Q-Ziele und Schulungsplan laufen über die bestehenden UIs (Phase 3 / Phase-4-Plan-Entwurf).

**Tech Stack:** Next.js App Router, Convex (cronJobs, internalMutation), shadcn/ui, sonner, jsPDF. Referenzen: `convex/crons.ts`, `convex/effectiveness.ts:314` (checkDue-Muster), `convex/tasks.ts` (checkOverdue + createNotification), `convex/lib/notificationHelpers.ts`, `convex/audits.ts` (create instanziiert Checklisten-Antworten aus aktiver Vorlage), `lib/export/pms-report-exporter.ts` (Exporter-Muster).

---

## Quellstruktur (PDF, positional extrahiert 2026-06-11)

`PDF/8 2 4 Auditplan 2026.pdf` (Original: xlsx, **Revision 5, Stand 01.2026, erstellt 05.01.26**) — Matrix Thema × Monat (1–12), je Thema eine SOLL- und eine IST-Zeile:

| Thema | Auditor/en | betroffene Bereiche | SOLL-Monat | IST-Monat (Original) |
|-------|-----------|---------------------|------------|----------------------|
| Reha / Rollstuhl | AL / MA | MA der Werkstatt und Außendienst | 4 | 4 |
| Sanitätshaus / Filiale | AL / MA | MA Verkauf und Außendienst | 4 | 4 |
| Orthopädietechnik | AL / MA | MA Werkstatt und Außendienst | 4 | 4 |
| Büro | AL / MA | MA Verwaltung | 4 | 4 |
| Überwachung-Zerti 13485 | extern / mdc | Unternehmen | 6 | 6 |

(Monatszuordnung über x-Koordinaten verifiziert: Spalte 4 = x≈582, Spalte 6 = x≈637; alle Kreuze ±1 px auf den Spaltenmitten.)

**IST-Konvention:** Das Original führt IST-Kreuze als manuelle Markierung. Die App leitet IST stattdessen aus echten Daten ab (`auditDate` gesetzt ⇒ IST-Kreuz im Monat des auditDate). Der Seed setzt daher NUR SOLL (`plannedMonths`) — auditDates zu erfinden wäre Datenfabrikation. Der Nutzer pflegt die tatsächlichen Audit-Termine nach (April-Audits + Zertifizierungsaudit), dann erscheinen die IST-Kreuze.

**Bewusst nicht in Phase 7:** Voll-automatische Jahres-Generatoren für Q-Ziele/Schulungsplan (semi-automatisch via Erinnerungs-Task + bestehende UIs; es gibt keine `qualityObjectivePeriods`-Tabelle — Q-Ziele sind year-basiert über die Phase-3-UI anlegbar); E-Mail-Versand für neue Notification-Typen (Digest-Crons greifen automatisch, da sie über tasks/notifications laufen — verifizieren, nicht erweitern); OTWin-Anbindung; Storage-Aufräumen verwaister PDFs (Notiz aus P6 — bleibt offen, unkritisch).

---

### Task 1: Enums, Task-/Notification-Typen, Schema

**Files:** `lib/types/enums.ts`, `convex/schema.ts`

- [ ] `convex/schema.ts` — `taskType`-Union (Zeile ~37) um vier Literale erweitern:

```ts
  v.literal("AUDIT_PLAN_DUE"),        // Phase 7: geplantes Audit nicht durchgeführt
  v.literal("CAPA_EFFECTIVENESS_DUE"),// Phase 7: Wirksamkeitsprüfung fällig
  v.literal("RISK_REVIEW_DUE"),       // Phase 7: Risiko-Neubewertung fällig
  v.literal("YEAR_CYCLE"),            // Phase 7: Jahreswechsel-Erinnerungen
```

- [ ] `convex/schema.ts` — `audits`-Tabelle um drei optionale Felder erweitern (nach `plannedFor`):

```ts
    area: v.optional(v.string()),                  // Auditplan-Thema (FB 8.2.4): "Reha / Rollstuhl"
    plannedMonths: v.optional(v.array(v.number())),// SOLL-Monate 1–12 laut Auditplan
    affectedAreas: v.optional(v.string()),         // "betroffene Bereiche" (FB 8.2.4)
```

- [ ] `lib/types/enums.ts` — NOTIFICATION_TYPES um `"AUDIT_PLAN_DUE", "CAPA_EFFECTIVENESS_DUE", "RISK_REVIEW_DUE", "ANNUAL_REPORT_DUE"` erweitern + NOTIFICATION_TYPE_LABELS: „Auditplan: Audit fällig" / „CAPA-Wirksamkeitsprüfung fällig" / „Risiko-Neubewertung fällig" / „Jahresbericht fällig". Prüfen, ob es TASK_TYPE_LABELS o.ä. gibt (grep "READ_DOCUMENT" in lib/ + app/) — wenn ja, die vier neuen Task-Typen dort mit deutschen Labels ergänzen (AUDIT_PLAN_DUE „Auditplan-Fälligkeit", CAPA_EFFECTIVENESS_DUE „CAPA-Wirksamkeit", RISK_REVIEW_DUE „Risiko-Neubewertung", YEAR_CYCLE „Jahreswechsel").
- [ ] Neuer Enums-Abschnitt Phase 7:

```ts
// ============================================================
// Auditplan-Jahresmatrix (FB 8.2.4) — Phase 7
// ============================================================
export const MONTH_LABELS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] as const;
```

- [ ] `npx tsc --noEmit` + `npx convex dev --once` → Commit `feat(cycle): Task-/Notification-Typen + Auditplan-Felder für Phase 7`

### Task 2: convex/audits.ts — Plan-Felder, Matrix-Query, Plan-Cron, Seed

**Files:** `convex/audits.ts`

VOR Implementierung lesen: bestehende create/update-Mutationen in audits.ts (Args-Stil, Audit-Logging), `convex/effectiveness.ts:314` checkDue (Task-Insert-Muster), `convex/lib/notificationHelpers.ts` (createNotification), `convex/tasks.ts` checkOverdue.

- [ ] **create + update erweitern**: optionale Args `area: v.optional(v.string())`, `plannedMonths: v.optional(v.array(v.number()))`, `affectedAreas: v.optional(v.string())`. Guard-Helfer: jeder Monat ganzzahlig 1–12, sonst `"Monate müssen ganze Zahlen von 1 bis 12 sein"`; Duplikate entfernen + aufsteigend sortieren. Text-Clearing in update via `trim() || undefined` (Hausmuster). Beim update zusätzlich `plannedMonths: []` ⇒ Feld entfernen (undefined).
- [ ] **`planMatrix`** (query, `audits:list`): args `{ year: v.number() }`. Alle nicht-archivierten Audits des Jahres MIT gesetztem `area` (= Themen-Audits), sortiert nach `_creationTime`. Rückgabe je Audit: `{ _id, area, auditTeam, affectedAreas, plannedMonths (default []), istMonth: auditDate ? new Date(auditDate).getUTCMonth()+1 : null, status, title }`. Zusätzlich `{ year, rows }`.
- [ ] **`checkPlanDue`** (internalMutation, für Cron): aktuelles Jahr/Monat (UTC). Für jedes nicht-archivierte Audit des aktuellen Jahres mit `plannedMonths.length > 0`, OHNE `auditDate`, Status `PLANNED` (exaktes Literal aus auditStatusEnum prüfen!): wenn `currentMonth > max(plannedMonths)` (Planmonat vollständig verstrichen) → Dedup-Check: existiert bereits ein nicht-archivierter Task mit `type: "AUDIT_PLAN_DUE"` und `resourceId === audit._id` und Status ≠ DONE/CANCELLED? Wenn nein: Task an QMB (Helfer `findQmbAssignee`: erster aktiver User mit Rolle qmb, Fallback admin; wenn keiner: skip mit Zähler) mit title `Auditplan: „${area}" ${year} nicht durchgeführt`, description mit SOLL-Monaten, dueDate now+14d, priority HIGH, resourceType "audits", resourceId; plus createNotification type "AUDIT_PLAN_DUE" an denselben User. Rückgabe `{ created: n, skipped: n }`.
- [ ] **`seedAuditPlan2026`** (internalMutation): idempotent — existiert bereits ein nicht-archiviertes Audit 2026 mit gesetztem `area` → `{ skipped: true }`. Legt die 5 Themen-Audits aus §Quellstruktur an: title = `${area} 2026`, auditYear 2026, auditType: für die 4 internen das INTERNE Literal, für „Überwachung-Zerti 13485" das externe/Zertifizierungs-Literal (auditType-Union in schema.ts lesen und das fachlich passende wählen — berichten!), status PLANNED, auditTeam = Auditor/en-Spalte, area/affectedAreas/plannedMonths laut Tabelle, KEINE auditDate. Checklisten-Instanziierung: exakt wie audits.create (aktive Vorlage + Antwort-Kopien) — den create-Codepfad als interne Helfer-Funktion extrahieren und von BEIDEN nutzen (DRY), ohne das Verhalten von create zu ändern. createdBy/updatedBy weggelassen (Seed-Muster). Rückgabe `{ audits: 5, answersPerAudit: n }`.
- [ ] **`seedPlanReset`** (internalMutation): löscht HART nur Audits mit `auditYear === 2026 && area !== undefined` SAMT ihren auditChecklistAnswers/auditFindings (by_audit-Index) + PERMANENT_DELETE-Marker. Bestands-Audits ohne area (z.B. „Intern 2026" des Nutzers) bleiben unberührt — im Kommentar dokumentieren.
- [ ] `npx tsc --noEmit` + `npx convex dev --once` → Commit `feat(cycle): Auditplan-Felder, Matrix-Query, Fälligkeits-Check und Seed in audits`

### Task 3: yearCycle.ts, CAPA-/Risiko-Crons, crons.ts

**Files:** Create `convex/yearCycle.ts`; Modify `convex/capas.ts`, `convex/risks.ts`, `convex/crons.ts`

Gemeinsames Muster für ALLE Checks (aus Task 2): Dedup über offene Tasks (type + resourceId), Task + Notification an `findQmbAssignee` (Helfer nach `convex/lib/` extrahieren: `convex/lib/assignees.ts` mit `export async function findQmbAssignee(ctx)` — erster aktiver qmb, Fallback erster aktiver admin, sonst null), deutsche Titel, Rückgabe-Zähler.

- [ ] **`convex/capas.ts` → `checkEffectivenessDue`** (internalMutation): nicht-archivierte CAPAs mit `effectivenessDueAt < now`, `effectivenessResult === undefined`, Status ∉ {CLOSED, CANCELLED} → Task type CAPA_EFFECTIVENESS_DUE an `assigneeId ?? findQmbAssignee`, title `Wirksamkeitsprüfung fällig: ${capaNumber} ${title}`, dueDate now+7d, priority HIGH, resourceType "capas"; Notification CAPA_EFFECTIVENESS_DUE. Dedup wie oben.
- [ ] **`convex/risks.ts` → `checkReviewDue`** (internalMutation): nicht-archivierte Risiken mit `nextReviewAt < now` → Task type RISK_REVIEW_DUE an QMB, title `Risiko-Neubewertung fällig: ${riskNumber} ${title}`, dueDate now+14d, priority MEDIUM, resourceType "risks"; Notification RISK_REVIEW_DUE. Dedup wie oben.
- [ ] **Create `convex/yearCycle.ts`** mit zwei internalMutations:
  - `checkAnnualReports`: (a) Managementbewertung — wenn aktueller Monat (UTC) ≥ 10 und keine nicht-archivierte managementReviews-Zeile mit `year === currentYear` existiert → YEAR_CYCLE-Task an QMB `Managementbewertung ${currentYear} anlegen` (dueDate 15.12. des Jahres, Dedup über title-gleichen offenen Task ODER besser resourceId = `mgmtreview-${year}` als synthetische resourceId — synthetischen String verwenden und dokumentieren). (b) PMS-Bericht — wenn aktueller Monat ≥ 1 und ≤ 3 und kein pmsReports-Eintrag mit `year === currentYear - 1` → Task `PMS-Bericht ${currentYear-1} erstellen` (dueDate 31.01., wenn schon vorbei: now+14d), resourceId `pmsreport-${currentYear-1}`. Beide mit Notification ANNUAL_REPORT_DUE.
  - `yearOpeningTasks`: läuft täglich, greift nur im Januar (UTC-Monat === 1, sonst sofort return). Drei YEAR_CYCLE-Tasks an QMB (Dedup über synthetische resourceIds `auditplan-${year}` / `qziele-${year}` / `schulungsplan-${year}`): „Auditplan ${year} erstellen (Vorschlag aus Vorjahr im Auditplan generierbar)" / „Qualitätsziele ${year} anlegen (FB 5.4.1)" / „Schulungsplan ${year} aus Bedarfsmatrix erzeugen (Plan-Entwurf in der Schulungsmatrix)". dueDate 31.01.
  - **`generateAuditPlan`** (mutation, Permission `audits:create`): args `{ year: v.number() }`. Guards: Jahr 2020–2100; es existiert noch KEIN nicht-archiviertes Audit des Zieljahres mit area (`"Für ${year} existieren bereits Themen-Audits"`); Vorjahr hat Themen-Audits (`"Keine Themen-Audits im Vorjahr gefunden"`). Kopiert je Vorjahres-Themen-Audit: area/affectedAreas/auditTeam/plannedMonths/auditType, title = area + " " + year, auditYear = year, status PLANNED, Checklisten-Instanziierung über den in Task 2 extrahierten Helfer (aktive Vorlage!). Audit-Log CREATE je Audit. Rückgabe `{ created: n }`.
- [ ] **`convex/crons.ts`** — vier neue Registrierungen (Stil der bestehenden, gestaffelte UTC-Zeiten):

```ts
crons.daily("check-audit-plan-due", { hourUTC: 3, minuteUTC: 0 }, internal.audits.checkPlanDue);
crons.daily("check-capa-effectiveness-due", { hourUTC: 3, minuteUTC: 15 }, internal.capas.checkEffectivenessDue);
crons.daily("check-risk-review-due", { hourUTC: 3, minuteUTC: 30 }, internal.risks.checkReviewDue);
crons.daily("check-year-cycle", { hourUTC: 3, minuteUTC: 45 }, internal.yearCycle.checkAnnualReports);
crons.daily("year-opening-tasks", { hourUTC: 4, minuteUTC: 0 }, internal.yearCycle.yearOpeningTasks);
```

- [ ] `npx tsc --noEmit` + `npx convex dev --once` (Crons werden registriert) → Commit `feat(cycle): Fälligkeits-Crons (Auditplan, CAPA-Wirksamkeit, Risiko-Review, Jahresberichte) + Jahreswechsel`

### Task 4: PDF-Exporter Auditplan

**Files:** Create `lib/export/audit-plan-exporter.ts`

REFERENZ: `lib/export/pms-report-exporter.ts` (Kopf/Fuß/Helfer). Querformat verwenden (`new jsPDF({ orientation: "landscape" })`) — die Matrix ist breit.

- [ ] Interface `AuditPlanData`: `{ year: number; rows: Array<{ area: string; auditTeam?: string; affectedAreas?: string; plannedMonths: number[]; istMonth: number | null }> }`.
- [ ] `buildAuditPlanPdf(data): jsPDF`: Kopf „8.2.4 Auditplan {year}" + FB-Kennung + „Rev. (App)" + Stand (aktueller Monat). Tabelle: Spalten Thema | Auditor/en | betroffene Bereiche | 1–12 (MONTH_LABELS_SHORT-Logik optional, Ziffern reichen wie im Original); je Thema ZWEI Zeilen SOLL/IST mit „x"-Kreuzen (SOLL aus plannedMonths, IST aus istMonth). Seitenumbruch-sicher (bei 5 Themen einseitig).
- [ ] `downloadAuditPlan(data, fileName)`.
- [ ] `npx tsc --noEmit` + eslint → Commit `feat(cycle): Auditplan-PDF-Exporter (Querformat, SOLL/IST-Matrix)`

### Task 5: UI — Auditplan-Seite, Dialog-Erweiterung, Sidebar

**Files:** Create `app/(dashboard)/audits/plan/page.tsx`; Modify `app/(dashboard)/audits/page.tsx`, `components/layout/sidebar.tsx`

VOR Implementierung lesen: convex/audits.ts (planMatrix/generateAuditPlan-Signaturen — generateAuditPlan liegt in convex/yearCycle.ts!), audits/page.tsx (Anlegen-Dialog), Hausidiom risks/page.tsx.

- [ ] **`/audits/plan`**: PageHeader „Auditplan" description „Jahresmatrix Thema × Monat mit SOLL/IST (ISO 13485 Kap. 8.2.4 — FB 8.2.4)". Jahr-Selector (Select, currentYear±2, default currentYear). Matrix-Tabelle (overflow-x): Kopf Thema | Auditor/en | betroffene Bereiche | 1…12; je Zeile (Thema) zwei Unterzeilen SOLL (x bei plannedMonths, muted) und IST (x bei istMonth, grün wenn istMonth ∈ plannedMonths, amber sonst — Abweichung sichtbar). Status-Badge je Thema (Geplant/In Durchführung/Abgeschlossen — Labels aus bestehenden AUDIT_STATUS_LABELS). Zeilen-Klick → `/audits/${id}` (Detail). Leerer Zustand: „Keine Themen-Audits für {year}." + (gated `audits:create`) Button „Plan {year} aus Vorjahr erzeugen" → yearCycle.generateAuditPlan + toast (auch bei vorhandenen Zeilen ausblenden). Aktionsleiste: „PDF exportieren" → downloadAuditPlan. Hinweiszeile: „IST wird aus dem tatsächlichen Auditdatum abgeleitet."
- [ ] **audits/page.tsx**: Header-Button „Auditplan" (variant outline, immer sichtbar) → router.push("/audits/plan"). Anlegen-Dialog um optionale Felder erweitern: „Auditplan-Thema (optional)" (Input, → area), „SOLL-Monate" (12 kleine Toggle-Buttons Jan–Dez → plannedMonths, nur sichtbar wenn area nicht leer), „Betroffene Bereiche" (Input → affectedAreas). Beim Submit nur mitsenden, wenn gesetzt.
- [ ] **sidebar.tsx**: QM-Sektion NACH „Interne Audits": `{ label: "Auditplan", href: "/audits/plan", icon: CalendarRange, permission: "audits:list", featureFlag: "AUDITS" }` (CalendarRange aus lucide-react; Kollision → Alternative berichten).
- [ ] Hooks vor Early-Returns; literal Umlaute; htmlFor/id; Doppelklick-Schutz auf Generator-Button.
- [ ] `npx tsc --noEmit` + eslint auf alle drei Dateien → Commit `feat(cycle): Auditplan-Matrix-Seite, Dialog-Felder, Sidebar`

### Task 6: Seed 2026 + UNABHÄNGIGER Daten-Review

- [ ] `npx convex run audits:seedAuditPlan2026 '{}'` → `{ audits: 5, ... }`. Verify `npx convex data audits --limit 20`: 5 neue Themen-Audits 2026 PLANNED mit area/plannedMonths, Bestands-Audits unberührt.
- [ ] **UNABHÄNGIGER Daten-Review (Pflicht):** zweiter Agent extrahiert das PDF selbst POSITIONAL (eigener Code, pdf-parse pagerender mit transform-Koordinaten) und verifiziert: 5 Themen wortgetreu, Auditor/en, betroffene Bereiche, SOLL-Monatszuordnung über x-Koordinaten (Spaltenraster x≈500+27.7·(m−1)), Revision 5/Stand 01.2026; gegen Live-DB: area/auditTeam/affectedAreas/plannedMonths; bestätigt, dass KEINE auditDates fabriziert wurden und das Nutzer-Audit „Intern 2026" unberührt ist. Korrekturen via seedPlanReset + Re-Seed.

### Task 7: Final-Integration-Review + Cron-Probelauf

- [ ] **Cron-Probelauf** (Teil des Reviews, via CLI — interne Mutationen sind direkt ausführbar): `npx convex run audits:checkPlanDue '{}'`, `npx convex run capas:checkEffectivenessDue '{}'`, `npx convex run risks:checkReviewDue '{}'`, `npx convex run yearCycle:checkAnnualReports '{}'`, `npx convex run yearCycle:yearOpeningTasks '{}'` — je zweimal: erster Lauf erzeugt erwartbare Tasks (z.B. AUDIT_PLAN_DUE für die April-Audits, da Juni > April und keine auditDates; Mgmt-Review-Check greift im Juni NICHT [Monat < 10]; yearOpening greift NICHT [Juni ≠ Januar]), zweiter Lauf MUSS `{ created: 0 }` liefern (Dedup!). Erzeugte Cron-Tasks dokumentieren — sie bleiben (echte fachliche Fälligkeiten!), im Übergabe-Abschnitt erklären.
- [ ] **Final-Review** (Subagent): Konsistenz Task-/Notification-Typen Schema↔Enums↔Verwendung, Dedup-Korrektheit aller fünf Checks, planMatrix/Exporter/UI-Feldnamen, DRY-Helfer (Checklisten-Instanziierung, findQmbAssignee), Regression Phasen 1–6 (audits.create-Verhalten unverändert für Alt-Aufrufer!), Deployed-Parität, tsc+build. Fixes umsetzen.

### Task 8: Runtime-Walkthrough (PFLICHT), Übergabe, Abschluss, Merge

- [ ] `purgeWalkthroughTestData` um Themen-Audits mit title-Kriterium erweitern? NICHT nötig — Walkthrough erzeugt Audits nur via generateAuditPlan für year 2099 → Kriterium ergänzen: audits mit `auditYear >= 2090` hart löschen (samt answers/findings). Commit mit Walkthrough-Fixes.
- [ ] Dev-Server-Tanz (bekannt): 3000 stoppen → preview 3002 → danach kanonisch wiederherstellen (next-qms:3000 ZUERST, webstudio:3001 danach).
- [ ] Testnutzer + Admin-Promotion (bekannt). Flag: AUDITS ist bereits aktiv (kein neues Flag).
- [ ] **Walkthrough:**
  1. Sidebar „Auditplan"; /audits/plan zeigt 5 Themen × 12 Monate, SOLL-x in Monat 4 (4 Zeilen) und 6 (Zerti), IST leer; Hinweiszeile sichtbar.
  2. Cross-Modul IST-Ableitung: ein Themen-Audit öffnen (Zeilen-Klick → Detail), Audit starten + auditDate setzen (über die Detail-Seite — prüfen wie auditDate dort gesetzt wird; ggf. via Dialog) → zurück zur Matrix: IST-x erscheint im Monat des Datums (grün bei Plantreue).
  3. PDF exportieren (kein Konsolen-Fehler).
  4. Generator-Gegentest: Jahr-Selector 2099 → „Plan 2099 aus Vorjahr erzeugen" schlägt fehl („Keine Themen-Audits im Vorjahr") — korrekt, da 2098 leer; Jahr 2027 → Generator erzeugt 5 Kopien aus 2026 → wieder löschen? NEIN: 2027-Generator-Lauf ist legitim, aber für sauberen Zustand: 2027 via Jahr-Selector prüfen und die 5 Audits 2027 anschließend über purge... NICHT abgedeckt (auditYear 2027 < 2090). Stattdessen: Generator-Test mit year 2099 NACH manueller Anlage eines 2098-Themen-Audits? Zu komplex — Alternative: Generator für 2027 ausführen, verifizieren (5 Zeilen, Checklisten instanziiert), danach die 5 Audits 2027 einzeln per bestehender Archiv-/Lösch-Funktion entfernen ODER purge-Kriterium auf `auditYear >= 2027 && area gesetzt && title-Suffix „2027"`… ENTSCHEIDUNG: purge-Kriterium in diesem Task = `auditYear >= 2090`; Generator-Test läuft mit 2099, davor wird per `audits.update`... — FINAL: Test-Pfad = ein Themen-Audit 2098 manuell über den erweiterten Anlegen-Dialog anlegen (Thema „Walkthrough-Test", Monat Mär), dann Generator 2099 → kopiert 1 Audit → beide via purge (auditYear ≥ 2090) entfernt. Deckt Dialog-Erweiterung UND Generator ab.
  5. Cron-Tasks aus Task 7 unter /tasks sichtbar (AUDIT_PLAN_DUE etc. mit deutschen Titeln); Notifications in der Glocke.
  6. Auditor-Gegentest: /audits/plan lesbar, kein Generator-Button; Regressions-Smoke audits/capa/risks/pms-reports/tasks fehlerfrei.
- [ ] Testdaten purgen; verifizieren (5 Themen-Audits 2026 + Nutzer-Audits bleiben; 2098/2099 weg; Cron-Tasks BLEIBEN absichtlich).
- [ ] Übergabe-Abschnitt in DIESEN Plan; **Design-Doc-Statustabelle** (docs/superpowers/plans/2026-06-10-qm-jahreszyklus-design.md §Phasen-Tabelle) auf „alle 7 Phasen fertig" aktualisieren; Merge auf master + Build + Branch löschen + Push; Memory-Update (Projekt KOMPLETT — alle 7 Phasen live; offene Folgepunkte sammeln).

---

## Self-Review (gegen Design-Doc §Phase 7)

- „Felder area/plannedMonths auf audits nachmigrieren" → Task 1 (additiv-optional, + affectedAreas für die Bereiche-Spalte des FB) ✅
- „Matrix-Ansicht Thema × Monat mit SOLL/IST" → Task 5 (/audits/plan, IST ehrlich aus auditDate) ✅
- „+ PDF-Export" → Task 4 (Querformat) ✅
- „Seed der 5 Themen-Audits 2026" → Task 2 (seedAuditPlan2026) + Task 6 (Ausführung + Daten-Review; IST-Kreuze bewusst nicht fabriziert — dokumentiert) ✅
- „crons.ts: Audit-Fälligkeiten laut Auditplan" → audits.checkPlanDue ✅ „CAPA-Wirksamkeits-Fälligkeit" → capas.checkEffectivenessDue ✅ „Risiko-Neubewertung" → risks.checkReviewDue ✅ „Mgmt-Review-/PMS-Fälligkeit" → yearCycle.checkAnnualReports ✅
- „Jahreswechsel-Generatoren (Schulungsplan aus Bedarfsmatrix, Auditplan-Vorschlag aus Vorjahr, neue Q-Ziele-Periode)" → yearOpeningTasks (semi-automatisch, Begründung in Architecture) + generateAuditPlan (echter Generator) + Verweis auf bestehenden Phase-4-Plan-Entwurf ✅
- „Neue Task-Typen + Notification-Typen" → Task 1 (4 + 4) ✅
- Typ-Konsistenz: Literale AUDIT_PLAN_DUE/CAPA_EFFECTIVENESS_DUE/RISK_REVIEW_DUE/YEAR_CYCLE identisch in Schema (T1), Checks (T2/T3), UI-Labels (T1); planMatrix-Felder (area/auditTeam/affectedAreas/plannedMonths/istMonth) identisch in Query (T2), Exporter (T4), UI (T5) ✅

---

## Übergabe — Stand 2026-06-12, Implementierung abgeschlossen (PROJEKT KOMPLETT)

Auditplan-Matrix, Crons und Generator sind LIVE. Seed: die 5 Themen-Audits 2026 aus FB 8.2.4 Rev. 5 (positional gegen-extrahiert, fehlerfrei) — SOLL-Monate 4/4/4/4/6, Checkliste v5 instanziiert, **bewusst ohne IST-Daten** (die IST-Kreuze des Originals wären fabrizierte Datumswerte; IST erscheint, sobald du das echte Auditdatum pflegst — neuer „Bearbeiten"-Dialog in der Audit-Detailseite).

**Runtime-Walkthrough (bestanden):** Matrix mit korrekten SOLL-Kreuzen; IST-Ableitung end-to-end (Auditdatum 15.05. → grünes IST-x Monat 5); Dialog-Erweiterung (Thema + Monats-Toggles); Generator Erfolgs- UND Fehlerpfad („Keine Themen-Audits im Vorjahr gefunden"); PDF-Export fehlerfrei; 4 Cron-Tasks „Auditplan-Fälligkeit" in /tasks sichtbar; Regressions-Smoke über alle Module. Cron-Probelauf via CLI: Lauf 1 created 4, Lauf 2 created 0 / skipped 4 (Dedup bewiesen); CAPA-/Risiko-/Jahres-Checks ehrlich 0 (keine Fälligkeiten gesetzt).

**Nutzer-Schritte:**
1. Die 4 offenen „Auditplan-Fälligkeit"-Tasks sind ECHTE Fälligkeiten (April-Audits ohne Auditdatum). Wenn die Audits durchgeführt wurden: Auditdatum in der Detailseite nachpflegen (April-Datum) → IST-Kreuz erscheint, Task kann erledigt werden.
2. CAPA-Wirksamkeits-Cron greift erst, wenn `Wirksamkeit fällig am` an CAPAs gesetzt ist; Risiko-Cron, wenn `Neubewertung am` an Risiken gesetzt ist — beides bewusst nicht geseedet (Original führt Textkriterien).
3. Jahreswechsel: Anfang Januar erscheinen automatisch 3 Erinnerungs-Tasks (Auditplan/Q-Ziele/Schulungsplan); der Auditplan-Vorschlag ist der Generator-Button in der leeren Jahresmatrix.

**Folgepunkte (Backlog, unkritisch):** Jahr-Selector der Matrix reicht ±2 Jahre; Exporter-Folgeseiten-Kopf bei >11 Themen; istMonth-UTC-Randfall an Monatsgrenzen; Storage-Aufräumen ersetzter Freeze-PDFs; NotificationItem `as any` (vorbestehend); OTWin-/Sybase-Anbindung (Wunsch aus Phase 2).
