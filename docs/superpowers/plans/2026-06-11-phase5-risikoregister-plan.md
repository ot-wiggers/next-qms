# Phase 5: Risikoregister (RPZ) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digitales Risikoregister nach FB 7.1.0 (ISO 13485 Kap. 7.1) mit RPZ-Modell (Auftretenswahrscheinlichkeit × Schweregrad × Folgen, Akzeptanzschwelle RPZ < 100), CAPA-Verknüpfungen, jährlicher Neubewertung (nextReviewAt) und Seed der 22 realen Risiken aus Rev. 1 (04.2026).

**Architecture:** Muster Phasen 1–4 (master `c94709a`). Eine Tabelle `risks` (Nummernkreis RS-{NN} global, kein Jahr — wie das Original ohne Jahresbezug), kein Status-Workflow → keine State-Machine (Akzeptanz ist ABGELEITET: rpz < 100). RPZ wird NIE gespeichert, immer berechnet (Single Source of Truth). „Werte vor Maßnahme" als optionale initial*-Felder (das Original führt nur Nach-Maßnahme-Werte; vor-Werte sind App-Mehrwert für künftige Neubewertungen). Maßnahmen-Links als `capaIds`-Array auf bestehende CAPAs (Phase-1-Modul). UI: eine Seite `/risks` mit Tabelle + Edit-Dialog (kein Detail-Route nötig — das Register IST eine Tabelle). Seed via docx-Extraktion mit harten Validierungs-Gates.

**Tech Stack:** Next.js App Router, Convex, shadcn/ui, sonner. Hauspatterns: `requirePermission` → deutsche Fehler-Guards → typisierte Patches → `logAuditEvent`; `archiveRecord` (convex/lib/softDelete.ts); Clearing via Server-`trim() || undefined`; idempotenter Seed + `seedReset`-internalMutation; Nummernkreis mit `padStart(2,"0")`.

---

## Quellstruktur (docx, extrahiert 2026-06-11 via textutil + document.xml)

`PDF/7 1 0 Risiken Massnahmen 2026.docx` (FB 7.1.0, Rev. 1, 04.2026):

**Kopftext:** „Risiken werden eingeschätzt durch Auswertungen von erkannten Fehlern, Rückrufen, klinischen Bewertungen, Erfahrungen der Mitarbeiter/-innen und der GF sowie aus den Quartalsauswertungen der Qualitätsziele (FB 5.4.1). Die Bewertung ergibt sich aus Auftretenswahrscheinlichkeit × Schweregrad × Folgen = RPZ. RPZ < 100 = akzeptabel."

**Die 22 Risiken** (Spalten: Risiko | Maßnahmen | Verantw. | A | S | F | RPZ — alle 22 RPZ-Produkte rechnerisch verifiziert):

| # | Risiko | Verantw. | A | S | F | RPZ | CAPA-Link (LIVE-Nummer!) |
|---|--------|----------|---|---|---|-----|--------------------------|
| 1 | Maschinen, Ausfall | GF | 2 | 2 | 1 | 4 | — |
| 2 | Kenntnisse Mitarbeiter/-innen | GF | 2 | 5 | 6 | 60 | — |
| 3 | Einkauf | GF | 3 | 2 | 1 | 6 | — |
| 4 | Entnahme Material | GF | 3 | 3 | 10 | 90 | — |
| 5 | Kennzeichnung Produkte | GF | 3 | 2 | 10 | 60 | — |
| 6 | Transport (innerbetrieblich) | GF / MA | 1 | 1 | 1 | 1 | — |
| 7 | Versand | GF / MA | 3 | 3 | 6 | 54 | — |
| 8 | Wareneingang / Verwechselung | GF / MA | 7 | 3 | 1 | 21 | — |
| 9 | Beschaffung falsche Spezifikation | GF | 5 | 2 | 2 | 20 | — |
| 10 | Labeling falsch | GF / MA | 2 | 3 | 6 | 36 | — |
| 11 | Verpackung / Falsch | GF / MA | 5 | 2 | 1 | 10 | — |
| 12 | Endprüfung / Falsch | GF / MA | 4 | 5 | 4 | 80 | — |
| 13 | Einlagern / Verwechselung | GF / MA | 2 | 3 | 6 | 36 | — |
| 14 | Werkstatt-Messmittel-Prüfungen nicht termingerecht | BDL / Werkstattleitung | 4 | 2 | 3 | 24 | CAPA-2026-08 |
| 15 | QSV mit ausgegliedertem Hygiene-/Reparatur-Dienstleister fehlt | Einkauf / BDL | 5 | 3 | 3 | 45 | CAPA-2026-11 (inhaltlich, keine Nummer im docx) |
| 16 | Verantwortungen / Befugnisse nicht formal ernannt | GF / BDL | 5 | 4 | 3 | 60 | CAPA-2026-03 |
| 17 | Schulungssystem nicht vollständig umgesetzt | BDL / Personalverantw. | 4 | 3 | 3 | 36 | CAPA-2026-06 |
| 18 | Mitarbeitergespräche nicht jährlich geführt | Filialleitung / GF | 5 | 2 | 1 | 10 | CAPA-2026-05 |
| 19 | Nachfolgeregelung unklar | GF | 3 | 4 | 3 | 36 | CAPA-2026-04 |
| 20 | Dokumentation unvollständig | BDL | 4 | 3 | 3 | 36 | CAPA-2026-10 |
| 21 | Unvollständige Erfassung aller Fehlerarten in PMS / OTWin | BDL / IT | 4 | 3 | 3 | 36 | CAPA-2026-02 |
| 22 | IT-Sicherheit / NIS-2 | IT / BDL | 4 | 4 | 3 | 48 | CAPA-2026-09 |

Maßnahmen-Texte (vollständig, für den Seed — Reihenfolge wie oben):
1. „Regelmäßige Wartung bei Arbeitsbeginn, Reinigung und externe Wartung bei Bedarf"
2. „Vergabe von Verantwortungen und Befugnissen, Aufsicht durch GF, Einweisung in die Prozesse"
3. „Bestimmung des Materials aufgrund der Datenblätter, Bestimmung von Verantwortungen, Festlegung von freigegebenen Lieferanten, systematischer Wareneingang"
4. „Kennzeichnung am Material, Ordnung im Lager"
5. „Hilfsmittelstammblatt bei dem Produkt, Kennzeichnung Material im Lager (Chargennummer), Einrichtung Sperrlager / -boxen"
6. „Geeignete Boxen"
7. „Eigenversendung, Auswahl Speditionen, geeignete Verpackungsart je Zielland"
8. „Schulung der Durchführenden, Erstellen und Freigabe von Anweisungen, Eurocom-Stichprobe 1–2× monatlich"
9. „Festlegung der Spezifikationen und Prüfung der Nachweise im Wareneingang"
10. „Prüfung visuell und mittels Vorlage, Prüfnachweise des Lieferanten, Schulung der Durchführenden"
11. „Stellung einer Vorlage, visuelle Prüfung, Schulung der Durchführenden"
12. „Bereitstellung von Vorgaben, Schulung der Durchführenden, Bereitstellung von Zeichnungen"
13. „Vergabe der Lagerplätze, Anweisungen erstellen, Schulung der Durchführenden"
14. „Neue KPI-Methodik in FB 7.6.0 Rev. 3 (KPI A pro-rata + KPI B Stichtag), Quartals-Reporting in FB 5.4.1 Ziele 10a/10b, Toleranz ± 30 Tage, CAPA-2026-07a/b"
15. „Mehrfache Anforderung dokumentiert (06/25, 04/26), schriftliche Eskalation per Einschreiben mit Frist, Plan B Ersatz-Lieferant in FB 7.4.1 vorbereitet"
16. „Phasenmodell „Schulung vor Ernennung" (CAPA-2026-02): Q1–Q3 Qualifizierung, Q4 Pilot, Q1/27 Ernennung; Aufsicht GF in der Übergangszeit"
17. „FB 6.2.0 Schulungsplan 2026 mit Zwischenmeilensteinen, CAPA-2026-05"
18. „Quartalsweise Verteilung über Filialen, Erinnerungssystem, CAPA-2026-04"
19. „Phasenkonzept Q1–Q4 2026 (Beraterauswahl → Konzept → Bewertung → Verabschiedung), CAPA-2026-03"
20. „Stichprobe 5 Vorgänge je Quartal, CAPA-2026-09; Maßnahme „Dokumentation verbessern" aus FB 5.6.0"
21. „OTWin-Konfiguration prüfen, Schulung im Rahmen der OTWin-Tagesschulung, CAPA-2026-01; externer Auditor-Hinweis 2025: „Integration der Fehlerbücher in PMS""
22. „Windows-11-Migration, KI-/Security-Sensibilisierung, NIS-2-Prüfung, CAPA-2026-08"

**⚠️ CAPA-Nummern-Verschiebung (verifiziert gegen Live-DB 2026-06-11):** Die CAPA-Referenzen IM docx-Maßnahmentext nutzen die FB-5.4.1-Nummerierung, die um **+1 verschoben** ist gegenüber der CAPA-Liste in der App (Live-CAPA-2026-01 = „Gleitschleifen", fehlt im FB 5.4.1). Mapping docx → live: 01→02 (PMS/OTWin), 02→03 (Verantwortlichkeiten), 03→04 (Nachfolge), 04→05 (MA-Gespräche), 05→06 (Schulungssystem), 07a/b→08 (Messmittel), 08→09 (Win11/IT), 09→10 (Dokumentation). Die `capaNumbers` im Seed-JSON tragen die LIVE-Nummern (Spalte oben). Die Maßnahmen-TEXTE bleiben wortgetreu (inkl. der alten Nummern — das ist das Original-Formblatt). Live-CAPA-2026-12/13 sind Nutzer-Testdaten — NIE verlinken.

**Rev.-1-Markierung:** „Blau hervorgehoben = neu in Rev. 1 (04.2026), aufgenommen aus den Quartalsauswertungen der Qualitätsziele 2025 / FB 5.4.1 Rev. 8 sowie den Maßnahmen aus FB 5.6.0 Managementbewertung 2025." Vermutlich Risiken 14–22, aber: das Extraktionsskript MUSS die Blau-Markierung aus dem XML lesen (w:color/w:highlight auf den Runs der Tabellenzellen), nicht raten.

**Bewertungskriterien (Legende, 3 Spalten-Tabellen im docx):**
- Auftretenswahrscheinlichkeit („Fehler kann vorkommen"): Unwahrscheinlich = 1 (< 10⁻⁶) · Fernliegend = 2–3 (< 10⁻⁵) · Gelegentlich = 4–6 (< 10⁻⁴) · Wahrscheinlich = 7–8 (< 10⁻³) · Häufig = 9–10 (≥ 10⁻³)
- Schweregrad/Bedeutung („Auswirkung auf den Patienten"): Vernachlässigbar = 1 (Unannehmlichkeiten o. zeitweilige Beschwerden) · Gering = 2–3 (Zeitweilige Schädigung o. Behinderung, erfordert kein sachkundiges Einschreiten) · Ernst = 4–6 (Führt zu Schädigung oder Behinderung, die ein Einschreiten erfordern) · Kritisch = 7–8 (Führt zu dauernder Behinderung oder lebensbedrohlicher Schädigung) · Katastrophal = 9–10 (Führt zum Ableben des Patienten)
- Folgen = „Wahrscheinlichkeit der Entdeckung des Fehlers (vor Auslieferung an die Anwender)": hoch = 1 · mäßig = 2–3 · gering = 4–6 · sehr gering = 7–8 · unwahrscheinlich = 9–10

**Bewusst nicht in Phase 5:** PDF-Export des Registers (kommt mit der Berichts-Strategie in Phase 7); Risiko-Neubewertungs-Historie als eigene Tabelle (YAGNI — `update` + Audit-Log genügt; initial*-Felder halten den Vor-Maßnahme-Stand); Cron für nextReviewAt-Erinnerungen (Phase 7 Jahreszyklus); Verknüpfung auf `tasks` (Design sagt „Tasks/CAPAs" — die realen Maßnahmen sind durchweg CAPAs oder Freitext; Task-Links nachrüstbar, wenn Bedarf entsteht).

---

### Task 1: Enums, Permissions, RBAC, Flag

**Files:** `lib/types/enums.ts`, `lib/types/domain.ts`, `convex/lib/permissions.ts`, `app/(dashboard)/admin/settings/page.tsx`

- [ ] Enums anfügen (neuer Abschnitt nach den Phase-4-Enums):

```ts
// ============================================================
// Risikoregister (ISO 13485 Kap. 7.1, FB 7.1.0) — Phase 5
// ============================================================
// RPZ = Auftretenswahrscheinlichkeit × Schweregrad × Folgen; < 100 = akzeptabel (FB 7.1.0 Rev. 1)
export const RPZ_ACCEPT_THRESHOLD = 100;

export type RiskLevelBand = { min: number; max: number; label: string; hint?: string };

// Bewertungskriterien exakt nach FB 7.1.0 (Legenden-Tabellen)
export const RISK_OCCURRENCE_BANDS: readonly RiskLevelBand[] = [
  { min: 1, max: 1, label: "Unwahrscheinlich", hint: "< 10⁻⁶" },
  { min: 2, max: 3, label: "Fernliegend", hint: "< 10⁻⁵" },
  { min: 4, max: 6, label: "Gelegentlich", hint: "< 10⁻⁴" },
  { min: 7, max: 8, label: "Wahrscheinlich", hint: "< 10⁻³" },
  { min: 9, max: 10, label: "Häufig", hint: "≥ 10⁻³" },
];

export const RISK_SEVERITY_BANDS: readonly RiskLevelBand[] = [
  { min: 1, max: 1, label: "Vernachlässigbar", hint: "Unannehmlichkeiten o. zeitweilige Beschwerden" },
  { min: 2, max: 3, label: "Gering", hint: "Zeitweilige Schädigung o. Behinderung, kein sachkundiges Einschreiten erforderlich" },
  { min: 4, max: 6, label: "Ernst", hint: "Führt zu Schädigung oder Behinderung, die ein Einschreiten erfordern" },
  { min: 7, max: 8, label: "Kritisch", hint: "Führt zu dauernder Behinderung oder lebensbedrohlicher Schädigung" },
  { min: 9, max: 10, label: "Katastrophal", hint: "Führt zum Ableben des Patienten" },
];

// Spalte „Folgen" = Wahrscheinlichkeit der ENTDECKUNG vor Auslieferung an die Anwender
export const RISK_CONSEQUENCE_BANDS: readonly RiskLevelBand[] = [
  { min: 1, max: 1, label: "hoch" },
  { min: 2, max: 3, label: "mäßig" },
  { min: 4, max: 6, label: "gering" },
  { min: 7, max: 8, label: "sehr gering" },
  { min: 9, max: 10, label: "unwahrscheinlich" },
];

export function riskBandLabel(bands: readonly RiskLevelBand[], value: number): string {
  return bands.find((b) => value >= b.min && value <= b.max)?.label ?? String(value);
}
```

- [ ] `lib/types/domain.ts`: PermissionAction um `| "risks:list" | "risks:manage"` erweitern (vor `| "admin:settings"`).
- [ ] `convex/lib/permissions.ts`: qmb beide; department_lead `risks:list`; auditor `risks:list`; employee keine (QM-Steuerungsdaten, wie trainingMatrix).
- [ ] `app/(dashboard)/admin/settings/page.tsx` FLAG_LABELS: Key `RISKS` → title „Risikoregister", description „Risiken mit RPZ-Bewertung und CAPA-Verknüpfung (Kap. 7.1)".
- [ ] `npx tsc --noEmit` (0 Fehler) → Commit `feat(risks): Enums, Permissions, RBAC, Flag für Phase 5`

### Task 2: Schema

**Files:** `convex/schema.ts`

- [ ] Neuer Abschnitt „PHASE 5 (QM-Jahreszyklus): Risikoregister (7.1)" nach den Phase-4-Tabellen:

```ts
  risks: defineTable({
    riskNumber: v.string(),               // "RS-01" — globaler Nummernkreis ohne Jahr (FB 7.1.0 führt kein Jahr)
    seq: v.number(),
    title: v.string(),                    // Spalte „Risiko"
    measures: v.optional(v.string()),     // „Maßnahmen der Minimierung / Kontrolle" (Freitext wie im FB)
    responsible: v.optional(v.string()),  // Freitext wie im FB ("GF / MA", "BDL / IT")
    // RPZ-Faktoren NACH Maßnahme (aktueller Stand) — RPZ wird NIE gespeichert, immer berechnet
    occurrenceProbability: v.number(),    // Auftretenswahrscheinlichkeit 1–10
    severity: v.number(),                 // Schweregrad 1–10
    consequences: v.number(),             // „Folgen" 1–10 (= Entdeckungswahrscheinlichkeit vor Auslieferung)
    // Optionale Faktoren VOR Maßnahme (App-Mehrwert; Original führt nur Nach-Werte)
    initialOccurrenceProbability: v.optional(v.number()),
    initialSeverity: v.optional(v.number()),
    initialConsequences: v.optional(v.number()),
    capaIds: v.optional(v.array(v.id("capas"))),  // Maßnahmen-Links auf CAPAs
    addedInRevision: v.optional(v.number()),      // 1 = blau markiert (neu in Rev. 1, 04.2026)
    sourceNote: v.optional(v.string()),           // Herkunft (z.B. "Q-Ziele-Quartalsauswertungen 2025")
    nextReviewAt: v.optional(v.number()),         // jährliche Neubewertung
    ...auditFields,
  })
    .index("by_number", ["riskNumber"])
    .index("by_seq", ["seq"]),
```

- [ ] Keine State-Machine (kein Status-Workflow — Akzeptanz ist abgeleitet: `rpz < RPZ_ACCEPT_THRESHOLD`).
- [ ] `npx tsc --noEmit` + `npx convex dev --once` (Schema-Push OK) → Commit `feat(risks): Schema risks-Tabelle mit RPZ-Faktoren und CAPA-Links`

### Task 3: Convex risks.ts

**Files:** Create `convex/risks.ts`

Hauspatterns aus `convex/trainingMatrix.ts` + `convex/capas.ts` übernehmen (requirePermission, deutsche Guards, logAuditEvent, archiveRecord, Clearing via trim||undefined). Exports:

- [ ] `list` (query, `risks:list`): alle nicht-archivierten Risiken sortiert nach seq, je Risiko berechnet: `rpz = occurrenceProbability * severity * consequences`, `acceptable = rpz < 100`, `initialRpz` (nur wenn ALLE drei initial*-Felder gesetzt), plus aufgelöste CAPA-Anzeige `capas: { _id, capaNumber, title, status }[]` (Lookup je capaId, archivierte CAPAs trotzdem anzeigen). Schwelle 100 als Konstante im Modul spiegeln (Kommentar: gespiegelt aus RPZ_ACCEPT_THRESHOLD in lib/types/enums.ts — Convex kann nicht aus lib/ importieren, Konsistenz-Kommentar an beide Stellen).
- [ ] `create` (mutation, `risks:manage`): args title (required, trim-Guard „Titel ist erforderlich"), measures?, responsible?, die 3 Faktoren (required), initial*-Faktoren?, capaIds?, sourceNote?, nextReviewAt?. Faktor-Guard für ALLE übergebenen Faktoren: ganzzahlig 1–10, sonst `"Faktoren müssen ganze Zahlen von 1 bis 10 sein"`. capaIds-Guard: jede Id muss existieren, sonst `"Verknüpfte CAPA nicht gefunden"`. Nummernkreis: `seq = max(seq)+1` über ALLE (auch archivierte!) Risiken, `riskNumber = \`RS-${String(seq).padStart(2, "0")}\``. logAuditEvent CREATE.
- [ ] `update` (mutation, `risks:manage`): id + alle Felder optional; Text-Clearing über `trim() || undefined` NUR wenn arg !== undefined (Muster trainingMatrix.updateFunction); Faktor- und capaIds-Guards wie create; initial*-Felder und nextReviewAt explizit löschbar (Konvention: UI sendet `null`? — NEIN, Hauskonvention: separate boolean-Flags vermeiden, stattdessen `clearInitial: v.optional(v.boolean())` und `clearNextReview: v.optional(v.boolean())` für explizites Entfernen). logAuditEvent UPDATE mit geänderten Feldern in metadata.
- [ ] `archive` (mutation, `risks:manage`): via `archiveRecord`, logAuditEvent.
- [ ] `seedFromImport` (internalMutation): args `{ risks: [...] }` mit je { title, measures, responsible, occurrenceProbability, severity, consequences, capaNumbers?: string[], addedInRevision?, sourceNote? }. Idempotent: wenn bereits nicht-archivierte risks existieren → `{ skipped: true }`. capaNumbers via by_number-Index auflösen; NICHT gefundene Nummer → Error (harter Abbruch, kein stilles Weglassen). seq/riskNumber in Array-Reihenfolge (1-basiert). Rückgabe `{ risks: N, capaLinks: M, skipped: false }`.
- [ ] `seedReset` (internalMutation): hard delete ALLER risks mit logAuditEvent PERMANENT_DELETE-Marker (Muster trainingMatrix.seedReset). Kommentar: nur für Seed-Korrekturen vor produktiver Pflege.
- [ ] `npx tsc --noEmit` + `npx convex dev --once` → Commit `feat(risks): Convex-Modul mit RPZ-Berechnung, CAPA-Links, Seed`

### Task 4: Seed-Import-Skript + Seed + UNABHÄNGIGER Daten-Review

**Files:** Create `scripts/import-risk-register.mjs`; Output (gitignored): `scripts/out/risikoregister.json`

- [ ] Skript analog `scripts/import-training-matrix.mjs` (createRequire gegen package.json). docx ist ZIP: `word/document.xml` lesen (z.B. via `unzipper`/`adm-zip` falls vorhanden — sonst `child_process` + `unzip -p`), Tabellenzeilen (`<w:tr>`) der Register-Tabelle parsen (Zellen `<w:tc>`, Text aus `<w:t>`-Runs konkatenieren, Soft-Hyphens U+00AD strippen — Lektion Phase 4).
- [ ] **Harte Gates (process.exit(1) bei Verstoß):**
  - exakt 22 Datenzeilen (Header ausgenommen)
  - je Zeile: RPZ-Spalte === occurrence × severity × consequences (alle 22 Produkte!)
  - alle Faktoren ganzzahlig 1–10
  - Blau-Markierung aus XML lesen (w:color val≠auto/000000 oder w:highlight auf Runs der Zeile) → `addedInRevision: 1`; Anzahl der markierten Zeilen ausgeben und gegen Erwartung prüfen (vermutlich 9: Zeilen 14–22 — wenn ABWEICHEND: ausgeben und NICHT raten, Ist-Stand übernehmen und im Report nennen)
- [ ] CAPA-Mapping (docx-Nummer → LIVE-Nummer, Tabelle oben in §Quellstruktur) als explizite Map im Skript; Risiko 15 (QSV) bekommt CAPA-2026-11 inhaltsbasiert. `capaNumbers` im JSON = LIVE-Nummern.
- [ ] `sourceNote` für addedInRevision-Zeilen: „Neu in Rev. 1 (04.2026) — aus Q-Ziele-Quartalsauswertungen 2025 / FB 5.6.0 Managementbewertung 2025".
- [ ] Ausführen: `node scripts/import-risk-register.mjs "PDF/7 1 0 Risiken Massnahmen 2026.docx"` → JSON; dann `npx convex run risks:seedFromImport "$(cat scripts/out/risikoregister.json)"` → erwartet `{ risks: 22, capaLinks: 9, skipped: false }` (Convex-CLI funktioniert direkt in Claude-Shells).
- [ ] Commit Skript: `feat(risks): docx-Import-Skript Risikoregister mit RPZ-Validierungs-Gates`
- [ ] **UNABHÄNGIGER Daten-Review (Pflicht — Lektion Phasen 3+4, hat beide Male echte Fehler gefangen):** zweiter Agent extrahiert das docx selbst (eigener Parser-Weg, z.B. textutil), verifiziert alle 22 Zeilen (Titel, Maßnahmen wortgetreu, Verantw., Faktoren, RPZ), die Blau-Markierungs-Zuordnung, das CAPA-Mapping INHALTLICH gegen die Live-CAPA-Titel (nicht nur Nummern!), und die Live-DB (22 risks, korrekte capaIds-Auflösung). Korrekturen via seedReset + Re-Seed.

### Task 5: UI /risks

**Files:** Create `app/(dashboard)/risks/page.tsx`

Hausidiom: nächster Verwandter ist `app/(dashboard)/quality-objectives/page.tsx` (Tabelle + Dialoge, keyed Drafts, literal Umlaute, htmlFor/id, Hooks vor Early-Returns). VOR Implementierung lesen: `convex/risks.ts` (exakte Signaturen), quality-objectives als Idiom-Referenz.

- [ ] PageHeader „Risikoregister" description „Risiken mit RPZ-Bewertung — Auftretenswahrscheinlichkeit × Schweregrad × Folgen (ISO 13485 Kap. 7.1 — FB 7.1.0)". Info-Banner (muted, kein amber — kein Entwurfsstatus): Kopftext-Satz des FB („Risiken werden eingeschätzt durch … FB 5.4.1.") + fett „RPZ < 100 = akzeptabel".
- [ ] **Tabelle** (overflow-x, sortiert nach seq): Nr | Risiko | Maßnahmen (max-w + line-clamp-2, title-Attribut voll) | Verantw. | A | S | F | RPZ-Badge (grün `rpz < 100`, rot `>= 100`; wenn initialRpz vorhanden: „{initialRpz} → {rpz}" mit Pfeil) | CAPAs (Badge je CAPA mit capaNumber, Klick → `/capa/${id}` via router.push, stopPropagation) | Neubewertung (Datum; ROT + „überfällig" wenn nextReviewAt < heute). Zeilen-Klick (gated manage) → Edit-Dialog. addedInRevision-Zeilen mit dezentem blauem Punkt + title „Neu in Rev. 1 (04.2026)".
- [ ] **Anlegen/Bearbeiten-Dialog** (ein Dialog, create vs. edit nach State; Button „+ Risiko anlegen" oben rechts, gated `can("risks:manage")`): Titel (Input), Maßnahmen (Textarea), Verantwortlich (Input), die 3 Faktoren als Select 1–10 — jede Option mit Band-Label: `{n} — {riskBandLabel(BANDS, n)}` (+ hint als Suffix wo vorhanden); live berechnete RPZ-Vorschau mit Ampelfarbe und Akzeptanz-Text („akzeptabel" / „NICHT akzeptabel — Maßnahmen erforderlich"); aufklappbarer Abschnitt „Werte vor Maßnahme (optional)" mit denselben 3 Selects (+ Option „—" = nicht gesetzt — alle drei oder keines, Guard im Submit mit toast.error); CAPA-Verknüpfung als Multi-Auswahl über `api.capas.list` (Checkbox-Liste im Scroll-Container, Anzeige `capaNumber — title`); Neubewertung am (date-Input, leer = entfernen via clearNextReview bei edit); Speichern mit in-flight-Guard + toast; Validierung Titel-trim.
- [ ] **Archivieren** im Edit-Dialog (Button variant destructive-outline, confirm via window.confirm „Risiko {riskNumber} wirklich archivieren?") → archive + toast + Dialog zu.
- [ ] **Legende** unter der Tabelle (Card „Bewertungskriterien (FB 7.1.0)"): 3 Spalten (Auftretenswahrscheinlichkeit „Fehler kann vorkommen" / Schweregrad „Auswirkung auf den Patienten" / Folgen „Entdeckung vor Auslieferung an die Anwender"), je Band `{label} = {min}[–{max}]` + hint klein darunter. Quelle: RISK_*_BANDS aus enums.
- [ ] Loading-States; Empty-State „Keine Risiken erfasst."; Hooks vor Early-Returns; literal Umlaute; htmlFor/id.
- [ ] `npx tsc --noEmit` + `npx eslint "app/(dashboard)/risks/page.tsx"` → Commit `feat(risks): Register-Seite mit RPZ-Tabelle, Edit-Dialog und Legende`

### Task 6: Sidebar, Build, Final-Review

**Files:** `components/layout/sidebar.tsx`

- [ ] Sidebar QM-Sektion nach „Reklamationen": `{ label: "Risikoregister", href: "/risks", icon: ShieldAlert, permission: "risks:list", featureFlag: "RISKS" }` (ShieldAlert aus lucide-react; bei Kollision Alternative wählen und berichten).
- [ ] `npx tsc --noEmit` + `npx eslint components/layout/sidebar.tsx` + `npm run build` (Route `/risks` in der Ausgabe) → Commit `feat(risks): Sidebar-Eintrag Risikoregister`
- [ ] **Final-Integration-Review** (Subagent): Enum/Schema/Modul/UI-Konsistenz end-to-end, RPZ-Berechnung an EINER Stelle pro Schicht, Plan-Coverage, Regression Phasen 1–4 (capas.list-Nutzung, KPI unberührt), Deployed-State-Parität (`npx convex function-spec`), tsc+build selbst ausführen. Fixes umsetzen.

### Task 7: Runtime-Walkthrough (PFLICHT), Übergabe, Merge

> Stehende Nutzer-Anweisung (2026-06-11): „Prüfe nach jeder Phase die Funktionen und die Zusammenhänge / logischen Verknüpfungen." Eigener Task, nicht in Task 6 versteckt.

- [ ] `convex/bootstrap.ts` → `purgeWalkthroughTestData` um risks erweitern: löscht risks mit `title.includes("(Test")` oder `title.includes("Runtime-Walkthrough")` (hard delete). Commit zusammen mit eventuellen Walkthrough-Fixes.
- [ ] Dev-Server-Vorbereitung: Port-3000-Server stoppen (`.next/dev/lock`-Konflikt!), Preview-Server `next-dev` (Port 3002) via preview_start. NACH Walkthrough: Preview stoppen, Port-3000-Server detached neu starten (`nohup npm run dev > /tmp/next-dev-3000.log 2>&1 & disown`).
- [ ] Testnutzer: registrieren (claude-test@wiggers-qms.local) → `npx convex run bootstrap:setUserRoleByEmail '{"email":"claude-test@wiggers-qms.local","role":"admin"}'`.
- [ ] Feature-Flag RISKS in /admin/settings aktivieren (Flag fehlt = Sidebar versteckt den Eintrag!) — bleibt aktiviert (gewollt, wie TRAINING_MATRIX).
- [ ] **Walkthrough-Checkliste:**
  1. Sidebar zeigt „Risikoregister"; /risks lädt mit 22 Zeilen in Original-Reihenfolge; RPZ-Stichproben: RS-04 Entnahme Material = 90 (grün), RS-12 Endprüfung = 80, RS-06 Transport = 1.
  2. CAPA-Badges: RS-21 (PMS/OTWin) zeigt CAPA-2026-02; Klick navigiert zur CAPA-Detailseite (Cross-Modul-Link!).
  3. Neues Risiko „Runtime-Walkthrough Testrisiko" anlegen mit Faktoren 5×5×5 → RPZ 125 ROT „NICHT akzeptabel"; Edit: Faktoren auf 2×2×2 → 8 grün; initial-Werte 5×5×5 setzen → Anzeige „125 → 8".
  4. CAPA verknüpfen (beliebige) + entfernen; nextReviewAt gestern setzen → „überfällig" rot.
  5. Archivieren → Zeile verschwindet; Gegentest: als auditor-Rolle (setUserRoleByEmail) → kein „+ Risiko anlegen", Zeilen-Klick ohne Dialog; Server-Gate via direktem Mutation-Versuch optional.
  6. Regressions-Smoke: /audits, /capa, /training-matrix, /quality-objectives je einmal öffnen — keine Fehler; Toasts erscheinen (Toaster-Regression!).
- [ ] Testdaten purgen: `npx convex run bootstrap:purgeWalkthroughTestData '{}'` → verifizieren: 22 risks übrig, kein Test-Nutzer.
- [ ] Übergabe-Abschnitt in DIESEN Plan anfügen (Stand, Nutzer-Schritte, Folgepunkte).
- [ ] Merge (stehende Anweisung „am Ende nur master"): auf master mergen, `npm run build` grün, Feature-Branch löschen, `git push origin master`. Memory `qm-jahreszyklus-projektstand` aktualisieren (Phase 5 ✅, Phase 6 als Nächstes).

---

## Self-Review (gegen Design-Doc §Phase 5)

- „Nummernkreis RS{NN}" → Task 2/3 (riskNumber RS-{NN}, seq) ✅
- „Prozess/Bereich" → der Risiko-Titel IST der Prozess (Original hat keine separate Spalte; bewusst keine Extra-Spalte, YAGNI) ✅
- „RPZ-Modell 3 Faktoren, Schwelle < 100" → Schema-Faktoren + berechnetes rpz + RPZ_ACCEPT_THRESHOLD ✅
- „Werte vor/nach Maßnahme" → initial*-Felder + „125 → 8"-Anzeige ✅
- „Maßnahmen-Links auf Tasks/CAPAs" → capaIds (Tasks bewusst nicht, dokumentiert in „Bewusst nicht") ✅
- „Revision je Risikoanalyse" → addedInRevision + sourceNote (Register-Revision; keine eigene Historien-Tabelle, dokumentiert) ✅
- „nextReviewAt / jährliche Neubewertung" → Feld + Überfällig-Marker; Cron in Phase 7 ✅
- Seed 22 Risiken mit Daten-Review ✅ (Task 4)
- Typ-Konsistenz: occurrenceProbability/severity/consequences durchgängig in Schema (T2), risks.ts (T3), Seed-JSON (T4), UI (T5) ✅
