# Phase 3: Qualitätsziele + Managementbewertung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualitätsziele (FB 5.4.1) als quartalsweises KPI-Modul mit Ampel und CAPA-Pflichtverknüpfung + Managementbewertung (FB 5.6.0) als Auto-Entwurf-Jahresbericht mit Freigabe-PDF — beides neu (keine Platzhalter).

**Architecture:** Muster aus Phase 1/2 (master `dbee101`). Neu: KPI-Engine (`convex/kpis.ts`) berechnet App-Kennzahlen aus Audits/CAPAs/Reklamationen/Trainings; Q-Ziele-Readings (SOLL/IST/% je Quartal) mit Ampel ≥100 % GRÜN / ≥70 % GELB / <70 % ROT (Konvention der realen Bedarfsmatrix); Managementbewertung zieht beim Anlegen einen Daten-Snapshot je 5.6-Eingabe und friert bei Freigabe ein PDF ein. **Convex-Zugriff funktioniert seit 2026-06-11** — Seeds werden direkt im Task ausgeführt.

**Quellstrukturen (extrahiert):** FB 5.4.1 Rev. 8 — Spalten Nr|Bereich|Qualitätsziel|KPI-Definition|Datenquelle|Verantwortlich|Typ(min/max)|Zielwert|je Quartal SOLL/IST/%|Status|CAPA-Nr|Kommentar; 14 Ziele; Regel „Gelb/Rot → CAPA-Nr. Pflicht"; Prozent-Logik max-Typ: SOLL/IST (Ziel 1: SOLL 6, IST 5 → 120 %), min-Typ: IST/SOLL. FB 5.6.0 Rev. 8 — 1. Allgemeine Angaben (Berichtszeitraum/Teilnehmer/Unternehmen) · 2. Eingaben 2.1 Audits, 2.2 Kundenfeedback/Reklamationen, 2.3 PMS, 2.4 Prozesse, 2.5 CAPA, 2.6 Änderungen, 2.7 Ressourcen, 2.8 Risiken & Chancen (je Prosa + „Bewertung:") · 3. Gesamtbewertung · 4. Maßnahmen (Maßnahme|Verantwortlich|Termin|Wirksamkeit) · 5. Verbesserungen.

**Bewusste Abweichung vom Design-Doc:** keine eigene `qualityObjectivePeriods`-Tabelle (YAGNI) — `year` liegt direkt auf den Zielen; Perioden-Metadaten (Rev./Freigabe des Formblatts) kommen bei Bedarf mit Phase 7.

**Wichtig (Beschluss-Konsequenz):** Auto-KPIs sind ein **Vorschlag** („IST aus App übernehmen"-Button), nie Zwang — die realen 2026er-IST-Werte stammen aus OTWin und das App-Register füllt sich erst; manuelle Eingabe bleibt immer möglich. Gelb/Rot→CAPA ist **soft enforced**: Reading wird gespeichert, Ziel trägt sichtbare Warnung „CAPA erforderlich" bis `capaId` gesetzt ist (Hard-Block würde das Erfassen der Realität verhindern).

---

### Task 1: Enums, Permissions, RBAC, Flags

**Files:** `lib/types/enums.ts`, `lib/types/domain.ts`, `convex/lib/permissions.ts`, `app/(dashboard)/admin/settings/page.tsx` (FLAG_LABELS)

- [ ] Enums anfügen:

```ts
// ============================================================
// Qualitätsziele (ISO 13485 Kap. 5.4.1) — Phase 3
// ============================================================
export const OBJECTIVE_TARGET_TYPES = ["MIN", "MAX"] as const;
export type ObjectiveTargetType = (typeof OBJECTIVE_TARGET_TYPES)[number];
export const OBJECTIVE_TARGET_TYPE_LABELS: Record<ObjectiveTargetType, string> = {
  MIN: "min (mindestens erreichen)",
  MAX: "max (höchstens erreichen)",
};

// Ampel-Konvention wie reale Bedarfsmatrix: ≥100 % GRÜN, ≥70 % GELB, <70 % ROT
export const OBJECTIVE_STATUSES = ["GREEN", "YELLOW", "RED"] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];
export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  GREEN: "Grün", YELLOW: "Gelb", RED: "Rot",
};

// Registrierte Auto-KPIs (convex/kpis.ts) — Schlüssel für qualityObjectives.kpiKey
export const KPI_KEYS = [
  "complaintsYearCount",      // Anzahl Reklamationen im Jahr (App-Register)
  "vigilanceOnTimeRate",      // % fristgerechte Vigilanz-Meldungen (100 wenn keine Fälle)
  "capaClosedInYearCount",    // im Jahr abgeschlossene CAPAs
  "capaOpenOverdueCount",     // offene CAPAs mit überschrittenem Termin
  "auditsClosedInYearCount",  // abgeschlossene Audits im Jahr
  "auditOpenFindingsCount",   // offene Audit-Findings
] as const;
export type KpiKey = (typeof KPI_KEYS)[number];
export const KPI_KEY_LABELS: Record<KpiKey, string> = {
  complaintsYearCount: "Reklamationen im Jahr (App-Register)",
  vigilanceOnTimeRate: "Fristgerechte Vigilanz-Meldungen (%)",
  capaClosedInYearCount: "Abgeschlossene CAPAs im Jahr",
  capaOpenOverdueCount: "Überfällige offene CAPAs",
  auditsClosedInYearCount: "Abgeschlossene Audits im Jahr",
  auditOpenFindingsCount: "Offene Audit-Findings",
};

// ============================================================
// Managementbewertung (ISO 13485 Kap. 5.6) — Phase 3
// ============================================================
export const MGMT_REVIEW_STATUSES = ["DRAFT", "APPROVED"] as const;
export type MgmtReviewStatus = (typeof MGMT_REVIEW_STATUSES)[number];
export const MGMT_REVIEW_STATUS_LABELS: Record<MgmtReviewStatus, string> = {
  DRAFT: "Entwurf", APPROVED: "Freigegeben",
};

// Abschnitte exakt nach FB 5.6.0 Rev. 8 (2.1–2.8)
export const MGMT_REVIEW_SECTIONS = [
  { key: "audits", title: "2.1 Audits" },
  { key: "complaints", title: "2.2 Kundenfeedback / Reklamationen" },
  { key: "pms", title: "2.3 PMS" },
  { key: "processes", title: "2.4 Prozesse" },
  { key: "capa", title: "2.5 CAPA" },
  { key: "changes", title: "2.6 Änderungen" },
  { key: "resources", title: "2.7 Ressourcen" },
  { key: "risks", title: "2.8 Risiken & Chancen" },
] as const;
```

- [ ] PermissionAction vor `| "admin:settings"`: `| "qualityObjectives:list" | "qualityObjectives:manage" | "mgmtReview:list" | "mgmtReview:manage" | "mgmtReview:approve"`
- [ ] RBAC: qmb alle 5; department_lead `qualityObjectives:list`, `mgmtReview:list`; auditor dito (nur list); employee keine (Führungs-KPIs).
- [ ] FLAG_LABELS (admin/settings): Keys `QUALITY_OBJECTIVES` („Qualitätsziele") und `MGMT_REVIEW` („Managementbewertung") ergänzen.
- [ ] `npx tsc --noEmit` → Commit `feat(qziele/mgmtreview): Enums, Permissions, RBAC, Flags`

### Task 2: Schema + State-Machine

**Files:** `convex/schema.ts`, `convex/lib/stateMachine.ts`

- [ ] Unions: `objectiveTargetType` (MIN/MAX), `objectiveStatusEnum` (GREEN/YELLOW/RED), `mgmtReviewStatus` (DRAFT/APPROVED).
- [ ] Tabellen (nach `complaints`, neuer Abschnitt „PHASE 3"):

```ts
  qualityObjectives: defineTable({
    year: v.number(),
    seq: v.number(),                       // Nr. im Formblatt
    area: v.string(),                      // Bereich
    title: v.string(),                     // Qualitätsziel
    kpiDefinition: v.optional(v.string()), // KPI-Definition / Messgröße
    dataSource: v.optional(v.string()),    // OTWin, FB 6.2.0 …
    responsible: v.optional(v.string()),   // Freitext-Rolle wie im FB
    targetType: objectiveTargetType,
    targetValue: v.number(),               // Zielwert Jahresende
    unit: v.optional(v.string()),          // %, Anzahl …
    isPhaseModel: v.boolean(),             // Phasenmodell (Q-Meilensteine 25/50/75/100)
    kpiKey: v.optional(v.string()),        // Auto-KPI aus KPI_KEYS (Vorschlag, kein Zwang)
    capaId: v.optional(v.id("capas")),     // Pflicht bei Gelb/Rot (soft enforced)
    comment: v.optional(v.string()),
    ...auditFields,
  }).index("by_year", ["year"]),

  qualityObjectiveReadings: defineTable({
    objectiveId: v.id("qualityObjectives"),
    quarter: v.number(),                   // 1–4
    targetValue: v.number(),               // SOLL des Quartals
    actualValue: v.optional(v.number()),   // IST (leer = noch nicht erfasst)
    percent: v.optional(v.number()),       // berechnet bei Erfassung
    status: v.optional(objectiveStatusEnum), // Ampel, berechnet bei Erfassung
    note: v.optional(v.string()),
    ...auditFields,
  }).index("by_objective", ["objectiveId"]),

  managementReviews: defineTable({
    year: v.number(),
    reportingPeriod: v.string(),           // "01.01.2026 – 31.12.2026"
    participants: v.optional(v.string()),
    companyNote: v.optional(v.string()),   // "Sanitätshaus mit ca. 30 MA an 4 Standorten"
    status: mgmtReviewStatus,
    sections: v.array(v.object({
      key: v.string(),                     // audits|complaints|pms|processes|capa|changes|resources|risks
      autoData: v.optional(v.string()),    // Daten-Snapshot (beim Anlegen generiert, einfrierbar)
      assessment: v.optional(v.string()),  // Prosa "Bewertung: …"
    })),
    overallAssessment: v.optional(v.string()), // 3. Gesamtbewertung
    measures: v.array(v.object({
      description: v.string(),
      responsible: v.optional(v.string()),
      dueText: v.optional(v.string()),       // "Q4 2026", "laufend"
      effectivenessCheck: v.optional(v.string()), // "Audit", "Stichproben"
      capaId: v.optional(v.id("capas")),
    })),
    improvements: v.optional(v.string()),  // 5. Verbesserungen
    reportFileId: v.optional(v.id("_storage")),
    approvedAt: v.optional(v.number()),
    ...auditFields,
  }).index("by_year", ["year"]),
```

- [ ] State-Machine: `mgmtReviewStatus: { DRAFT: ["APPROVED"], APPROVED: [] }`.
- [ ] tsc + `npx convex dev --once` → Commit `feat(qziele/mgmtreview): Schema + State-Machine`

### Task 3: KPI-Engine

**File:** `convex/kpis.ts`

- [ ] Query `compute({ year })` (Permission `qualityObjectives:list`), gibt `Record<KpiKey, number | null>` zurück:
  - `complaintsYearCount`: complaints non-archived mit `receivedAt` im Jahr (UTC-Jahresgrenzen, kommentiert)
  - `vigilanceOnTimeRate`: unter vigilanzrelevanten Reklamationen des Jahres der Anteil mit `vigilanceReportedAt <= vigilanceDeadline` in %; **100 wenn keine Fälle** (FB-Regel „KPI auch wenn IST = 0")
  - `capaClosedInYearCount`: capas `status CLOSED` mit `closedAt` im Jahr
  - `capaOpenOverdueCount`: capas nicht CLOSED/CANCELLED, `dueAt < Date.now()`
  - `auditsClosedInYearCount`: audits CLOSED mit `closedAt` im Jahr
  - `auditOpenFindingsCount`: auditFindings `status OPEN`, non-archived
- [ ] Alle Berechnungen non-archived-gefiltert, Volltabellen-`collect()` ok bei dieser Größenordnung (Kommentar).
- [ ] tsc + Push → Commit `feat(kpi): KPI-Engine für Q-Ziele und Managementbewertung`

### Task 4: Convex qualityObjectives.ts

**File:** `convex/qualityObjectives.ts` — Muster capas/complaints. Exports:

- `listByYear({year})` (list-Permission): Ziele + ihre Readings (by_objective) + `currentStatus` (Ampel des letzten erfassten Quartals) + `needsCapa` (currentStatus GELB/ROT && !capaId) + capaNumber-Join.
- `create` (manage): Felder wie Schema; `seq` = max+1 im Jahr; trim-Guards.
- `update` (manage): per-field Partial<Doc>, klärbare Textfelder; capaId setzbar.
- `setQuarterTargets` (manage): legt/aktualisiert die 4 Readings-SOLL-Werte eines Ziels (upsert je Quartal, IST unangetastet).
- `recordReading` (manage): args {objectiveId, quarter, actualValue, note?}; berechnet percent + Ampel:

```ts
function computePercentAndStatus(targetType: "MIN" | "MAX", soll: number, ist: number) {
  // Prozent-Logik exakt wie FB 5.4.1: min-Typ IST/SOLL, max-Typ SOLL/IST (Ziel 1: SOLL 6, IST 5 → 120 %)
  let percent: number;
  if (targetType === "MIN") {
    percent = soll === 0 ? 100 : Math.round((ist / soll) * 100);
  } else {
    percent = ist === 0 ? 999 : Math.round((soll / ist) * 100); // IST 0 bei max-Ziel = bestmöglich
  }
  const status = percent >= 100 ? "GREEN" : percent >= 70 ? "YELLOW" : "RED";
  return { percent, status };
}
```

  Audit-Log mit changes {quarter, actualValue, percent, status}; Rückgabe enthält `needsCapa` (status ≠ GREEN && Ziel ohne capaId) für den UI-Hinweis.
- `archive` (manage).
- `seedFromImport` internalMutation (idempotent über year+seq): args {year, items:[{seq, area, title, kpiDefinition?, dataSource?, responsible?, targetType, targetValue, unit?, isPhaseModel, comment?, capaNumber? (→ capaId via by_number-Lookup), quarters:[{quarter, targetValue, actualValue?}]}]}; legt Ziel + Readings an, berechnet percent/status für erfasste IST-Werte mit derselben Funktion; Audit-Log-Marker.
- [ ] tsc + Push + Deep-Link-Fall NICHT nötig (keine Notifications in Phase 3) → Commit

### Task 5: Convex managementReviews.ts

**File:** `convex/managementReviews.ts`. Exports:

- `list` (mgmtReview:list), `getById` (inkl. measures-capaNumber-Joins).
- `createDraft({year, reportingPeriod, participants?, companyNote?})` (manage): **ein Entwurf pro Jahr** (Guard); generiert `sections` mit `autoData`-Snapshot je Abschnitt aus echten Daten:
  - audits: Anzahl Audits im Jahr (CLOSED/gesamt), Findings nach Klassifizierung
  - complaints: Anzahl, davon vigilanzrelevant, fristgerecht-Quote (KPI-Engine-Logik wiederverwenden — Hilfsfunktion teilen oder duplizieren mit Kommentar)
  - pms: Verweis-Platzhalter („PMS-Bericht: siehe FB 7 1 — Modul folgt in Phase 6") + Reklamations-Kennzahlen
  - capa: offen/in Umsetzung/abgeschlossen im Jahr, überfällige
  - changes/resources/processes/risks: autoData leer (rein manuelle Abschnitte — ehrlich bleiben, nichts erfinden)
  - Q-Ziele-Jahresstand als Zusatzzeile im capa- ODER eigenem Kopfbereich: Anzahl GRÜN/GELB/ROT
- `updateSection({id, key, assessment})`, `updateGeneral({id, overallAssessment?, improvements?, participants?, companyNote?})` (manage, nur DRAFT).
- `addMeasure/updateMeasure/removeMeasure` (manage, nur DRAFT; measures als Array-Patch).
- `refreshAutoData({id})` (manage, nur DRAFT): Snapshot neu generieren.
- `generateUploadUrl`/`attachReport` (approve-Permission, nur DRAFT — wie audits).
- `approve({id})` (mgmtReview:approve): validateTransition DRAFT→APPROVED; Guard: reportFileId muss gesetzt sein („Erst PDF einfrieren, dann freigeben"); setzt approvedAt; STATUS_CHANGE-Log.
- [ ] tsc + Push → Commit

### Task 6: Seed Q-Ziele 2026

- [ ] Die 14 Ziele aus `PDF/5 4 1 Qualitaetsziele 2026_Rev8.pdf` extrahieren (pdf-parse) und als `scripts/out/qziele-2026.json` kuratieren — Spaltenzuordnung sorgfältig reviewen (PDF-Textfluss verschmilzt Spalten!); CAPA-Nr.-Spalte als `capaNumber` („CAPA-2026-01" …) für den Join; Q1/Q2-IST wo vorhanden; Phasenmodell-Ziele (Nr. 3, 4) mit isPhaseModel true und Meilenstein-SOLL 25/50/75/100.
- [ ] `npx convex run qualityObjectives:seedFromImport "$(cat scripts/out/qziele-2026.json)"` → erwartet 14 inserted; Re-Run → skipped (idempotent). Mit `npx convex data qualityObjectives --limit 5` stichprobenartig verifizieren (Ziel 1: max 25, Ziel mit CAPA-2026-02-Verknüpfung hat capaId).
- [ ] Commit (Skript falls nötig; JSON bleibt gitignored)

### Task 7: UI Qualitätsziele

**Files:** Create `app/(dashboard)/quality-objectives/page.tsx`

- Jahr-Selector (Default aktuelles Jahr), Tabelle: Nr | Bereich | Ziel (+ Tooltip/Subzeile KPI-Definition) | Typ+Zielwert | Q1–Q4 (je „IST/SOLL · %" + Ampel-Punkt) | Status aktuell (Ampel-Badge GRÜN/GELB/ROT) | CAPA (Nummer-Link oder „CAPA erforderlich!"-Badge wenn needsCapa) 
- Dialog „Ziel anlegen" (manage) + „IST erfassen" je Ziel+Quartal: Zahlenfeld, Notiz, und wenn `kpiKey` gesetzt: Anzeige „App-Wert: X" (aus `api.kpis.compute`) + Button „übernehmen" — niemals Auto-Übernahme
- Bei needsCapa: Button „CAPA anlegen" → `api.capas.create({title: \`Q-Ziel {seq}: {title}\`, sourceType: "QUALITY_OBJECTIVE", sourceId: objectiveId, capaType: "CORRECTIVE"})`, danach `update({capaId})` — oder als eine UI-Funktion nacheinander; Erfolgs-Toast
- Muster: capa/page.tsx-Idiom, PageHeader actions, htmlFor/id
- [ ] tsc/eslint → Commit

### Task 8: UI Managementbewertung + PDF

**Files:** Create `app/(dashboard)/management-review/page.tsx` (Liste nach Jahr + „Entwurf anlegen") und `app/(dashboard)/management-review/[id]/page.tsx`; Create `lib/export/mgmt-review-exporter.ts`

- Detail: Kopf (Berichtszeitraum/Teilnehmer/Unternehmen editierbar im DRAFT), 8 Abschnitts-Karten (autoData grau + „Aktualisieren"-Button, Bewertungs-Textarea mit keyed-draft), Gesamtbewertung, Maßnahmen-Tabelle (add/edit/remove; je Maßnahme optional „als CAPA anlegen" → capas.create sourceType MGMT_REVIEW + capaId am Measure speichern), Verbesserungen
- PDF-Exporter analog audit-report-exporter (FB-Kennung „5.6.0", Abschnitte 1–5 wie das reale Formblatt, Maßnahmen-Tabelle, Unterschriftszeilen GF/QMB) + Buttons „PDF herunterladen"/„PDF einfrieren" (nur DRAFT) — Freigabe-Button danach (Guard serverseitig: erst Einfrieren, dann approve); APPROVED = alles read-only + Link aufs eingefrorene PDF (getReportUrl-Muster)
- [ ] tsc/eslint → Commit

### Task 9: Sidebar, Build, Final-Review, Übergabe

- [ ] Sidebar QM-Sektion: `{ label: "Qualitätsziele", href: "/quality-objectives", icon: <passend, z.B. Target>, permission: "qualityObjectives:list", featureFlag: "QUALITY_OBJECTIVES" }` + `{ label: "Managementbewertung", href: "/management-review", icon: <z.B. ClipboardList>, permission: "mgmtReview:list", featureFlag: "MGMT_REVIEW" }` (Icons aus lucide importieren)
- [ ] `npm run build` (Routen vorhanden) — api.d.ts wird durch `npx convex dev --once` je Task ohnehin regeneriert (Convex-Zugriff vorhanden!)
- [ ] Finaler Integrations-Review über die Phase-3-Range, Fixes anwenden
- [ ] Übergabe-Abschnitt: Flags QUALITY_OBJECTIVES + MGMT_REVIEW in Admin aktivieren; Walkthrough: 14 geseedete Ziele prüfen (Ziel 1 max 25, Q1 120 %), IST erfassen mit App-Vorschlag, Gelb-Fall → „CAPA erforderlich"-Badge → CAPA anlegen; Mgmt-Review-Entwurf 2026 → Snapshot zeigt echte Audit/CAPA/Reklamations-Zahlen → Bewertungen schreiben → PDF einfrieren → freigeben (Gegentest: Freigabe ohne PDF scheitert; Bearbeitung nach Freigabe scheitert)

---

## Selbst-Review (beim Schreiben)
- Abdeckung: 14-Ziele-Raster ✓ (Schema seq/area/Typ/Quartals-Readings), Prozent-Logik aus realem FB verifiziert ✓ (max: SOLL/IST), Ampel-Konvention dokumentiert ✓, Gelb/Rot→CAPA soft-enforced + UI-Pfad ✓, Phasenmodell als Flag + Meilenstein-SOLL ✓, Mgmt-Review exakt nach FB-Gliederung 1–5 ✓, Auto-Snapshot nur wo echte Daten existieren (changes/resources/processes/risks bewusst leer) ✓, Freigabe-Gate „erst PDF, dann approve" ✓, Seed mit capaNumber-Join ✓.
- Typ-Konsistenz: GREEN/YELLOW/RED + DRAFT/APPROVED in enums/schema/Modulen identisch; KPI_KEYS einzige Registry.
- Bewusst nicht: Notifications (kein Bedarf), eigene Perioden-Tabelle (YAGNI), PMS-Snapshot-Daten (Phase 6), Quartals-Erinnerungen (Phase 7).
