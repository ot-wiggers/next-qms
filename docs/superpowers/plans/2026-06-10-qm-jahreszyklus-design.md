# QM-Jahreszyklus: Design-Dokument

**Datum:** 2026-06-10
**Status:** Beschlossen (Grill-Session mit Kristof, alle Entscheidungen bestätigt)
**Nachfolger von:** Phase-4-Platzhalter aus `docs/plans/2026-02-23-qms-system-design.md`

---

## 1. Kontext & Ziel

Die zwölf realen QM-Dokumente der Wiggers GmbH & Co. KG (ISO 13485:2021 + MDR, Zertifizierung über MDC) sollen als strukturierte, aufeinander aufbauende und automatisierte Module in die App überführt werden. Quelle: lokal in `PDF/` (Kopie vom Zertifizierungs-Volume, Stand 2026-06-10; inkl. Original-xlsx der Checkliste — vollständig).

| Quelldokument | FB-Nr. | Ziel-Modul |
|---|---|---|
| 8_2_4_Auditcheckliste_2026_v5 (xlsx/pdf, 8 S.) | 8.2.4 | Audit-Checkliste (versionierte Vorlage) |
| FB_8_2_4_Auditbericht_2026_Rev1 | 8.2.4 | Auditbericht (generiert) |
| 8 2 4 Auditplan 2026 | 8.2.4 | Audit-Jahresplanung |
| 8 5 2 - 8 5 3 Korrektur Vorbeugemassnahmen 2026_Rev1 | 8.5.2/8.5.3 | CAPA-Modul |
| 5 3 0 Unsere Qualitätspolitik | 5.3 | Gelenktes Dokument (bestehendes Dokumenten-Modul) |
| 5 4 1 Qualitaetsziele 2026_Rev8 (14 Ziele, quartalsweise) | 5.4.1 | Q-Ziele/KPI-Modul |
| 5 6 0 Managementbewertung2025 | 5.6 | Managementbewertung (Auto-Entwurf) |
| 6 2 0 Schulungsbedarfsmatrix (xlsx) | 6.2 | Bedarfsmatrix im Trainings-Modul |
| 6 2 0 Schulungsbewertungsbogen | 6.2 | bereits abgedeckt durch `trainingFeedback` |
| 6 2 0 Schulungsplan 2026 | 6.2 | Trainings-Modul (Plan-Generierung) |
| 7 1 0 Risiken Massnahmen 2026 (docx, RS01–RS06) | 7.1 | Risikoregister |
| 7 1 PMS - Bericht 2026 | 7.1/MDR | PMS-Bericht (generiert) |

Die natürliche Datenkette, die "aufeinander aufbauend und automatisiert" konkret macht:

```
Auditplan ──> Audit (Checkliste ausfüllen) ──> Findings ──> Auditbericht (PDF)
                                                  │
Reklamationen ──────────────┐                     ▼
Schulungen (Wirksamkeit) ───┼──────────────────> CAPA ──> Wirksamkeitsprüfung
Risikoregister (Maßnahmen) ─┘                     │
                                                  ▼
Q-Ziele (KPIs, teils automatisch) ──────> Managementbewertung (Auto-Entwurf, PDF)
PMS-Bericht (aus Reklamations-/Produktdaten) ──────────────┘
```

## 2. Beschlossene Architektur-Entscheidungen

1. **Strukturierte Formulare** statt Dokumentvorlagen: jede Checkliste/jedes Formblatt bekommt eigene Convex-Tabellen; Berichte werden daraus als PDF generiert. (Tiptap-Dokumente nur für reine Prosa wie die Qualitätspolitik.)
2. **Auditcheckliste als versionierte Master-Vorlage**: Fragenkatalog lebt in der App (v5 → v6 …); jedes Audit friert beim Start eine Kopie der Fragen ein. Spätere Vorlagenänderungen verändern alte Audits nicht.
3. **Finding → CAPA halbautomatisch**: Bewertungslegende des echten Formblatts (Konform / Abweichung / Feststellung / Empfehlung / nicht anwendbar). Bei „Abweichung" schlägt die App per Klick eine vorausgefüllte CAPA vor; keine Zwangsautomatik.
4. **PDF-Layout**: einheitliches App-Layout mit FB-Kennung (FB-Nr., Revision, Stand, Freigabevermerk) über die bestehende jsPDF/docx-Infrastruktur (`lib/export/`) + `organizationSettings`-Branding. Alte Formblätter werden in der Dokumentenlenkung als „abgelöst durch App-Bericht" geführt.
5. **Q-Ziele hybrid**: App-Kennzahlen (Schulungserfüllungsquote, CAPA-Durchlaufzeit/-Abschlussquote, Audit-Termintreue, offene Reklamationen, Lesebestätigungsquote) werden live berechnet; externe Kennzahlen manuell mit Soll/Ist gepflegt. Reale Vorlage: 14 Ziele mit quartalsweiser Auswertung (FB 5.4.1 Rev. 8).
6. **Managementbewertung als Auto-Entwurf**: Knopfdruck erzeugt vorbefüllten Jahres-Entwurf mit allen Norm-Inputs (Audits, CAPA-Status, Schulungsstand, Q-Ziele, Reklamationen, offene Vorjahrespunkte); QMB ergänzt Bewertung/Beschlüsse; Beschlüsse können direkt Aufgaben/CAPAs erzeugen; Freigabe friert PDF ein.
7. **Schulungsbedarfsmatrix als Soll-Ist-Engine**: Pflichtschulungen je **Funktion** (9 Funktionen mit ●●●/●●-Einstufung und Frequenz, wie die reale Matrix Rev. 1) mit automatischem Abgleich, Schulungsplan-Entwurf fürs Folgejahr, Erfüllungsquote als KPI (Ampel GRÜN/GELB/ROT wie im Original).
8. **Reklamationen werden vollwertiges Modul** (Platzhalter-Tabelle existiert, inkl. Vigilanz-Flag): Datenquelle für PMS-Bericht und CAPA-Quelle Nr. 1.
9. **Risikoregister**: RPZ-Modell wie FB 7.1.0 (Auftretenswahrscheinlichkeit × Schweregrad × Folgen, Akzeptanzschwelle RPZ < 100; Werte vor/nach Maßnahme), Maßnahmen als verknüpfte Aufgaben/CAPAs, jährliche Neubewertung. Reale Vorlage: FB 7.1.0 Rev. 1, Risikoanalysen RS01–RS06.
10. **Voller Jahreszyklus**: Crons für Fälligkeiten (Audits laut Plan, CAPA-Wirksamkeit, Risiko-Neubewertung, Mgmt-Review/PMS) + Entwurfs-Generierung zum Jahreswechsel (Schulungsplan, Auditplan-Vorschlag, neue Q-Ziele-Periode). Nutzt bestehende `crons.ts`-/Notification-Infrastruktur.
11. **Seed-Import**: alle 2026er-Inhalte werden aus den Quelldateien strukturiert übernommen (Checklisten-Katalog v5, Q-Ziele Rev. 8, Auditplan 2026, Bedarfsmatrix, Risikoregister, CAPA-Liste). 2026 läuft nahtlos in der App weiter.
12. **Rollen**: bestehendes Modell reicht (`auditor`, `qmb`, `admin`, `department_lead`, `employee`); Auditoren-Unabhängigkeit (8.2.2) über Rollenzuordnung. Neue `PermissionAction`-Einträge je Modul.

## 3. Reale Formblatt-Strukturen (extrahiert am 2026-06-10)

### Auditcheckliste (8_2_4, v5 — „Klarstellung 04.2026", Revision 3, Stand 05.26)
- **Kopfdaten:** Leitender Auditor · Auditor/Fachexperte/Mitarbeiter des Bereichs · Basis des Audits (Normen + QMH-Rev. + mitgeltende Dokumente) · Standort · Berichtszeitraum · Auditdatum · Unterschriften (Auditor, Geschäftsführung)
- **Bewertungslegende (5-stufig):** Konform („Anforderung vollständig erfüllt") · Abweichung („Erhebliche Nichterfüllung") · Feststellung („Geringfügige Abweichung / Handlungsbedarf") · Empfehlung („Hinweis zur Verbesserung ohne Abweichung") · nicht anwendbar („Ausschluss laut QM-Handbuch Kap. 4.3")
- **Spalten je Prüfpunkt:** Kap. | Überschrift | Prüfpunkte/Anforderungen | Bewertung | Nachweis (PA/AA/FB/QMH inkl. Revisionsstand) | Stichprobe (konkrete Aufzeichnung) | Gespräch mit | Bemerkungen
- Gliederung nach ISO-13485-Kapiteln (4.1.1, 4.1.2, …), 8 Seiten.

### Auditbericht (FB_8_2_4, Rev. 1, Stand 05.2026)
- Kopfdaten wie Checkliste + „Mitgeltende Unterlagen" (verweist auf Checkliste, Mgmt-Bewertung, PMS-Bericht, Q-Ziele, Risiken, CAPA-Liste, Prüfgerätekartei — der Bericht ist der Knotenpunkt des Jahreszyklus)
- „Zusammenfassendes Ergebnis" (Prosa) + Abschnitt je Norm-Kapitel (Kapitel 4, 5, 6, 7, 8) mit Bewertung und Verweisen auf Findings/CAPAs.
- CAPA-Referenzformat in der Praxis: **`CAPA-2026-11`** → Nummernkreis `CAPA-{Jahr}-{laufende Nr.}`.

### CAPA-Liste (FB 8.5.2/8.5.3, Rev. 1, Stand 04.2026 — 2 Seiten, 11 Einträge)
- **Spalten:** Nr. | Durchgeführte Korrektur-/Vorbeugemaßnahme (Titel + Beschreibung) | Bewertung / zeitnahe Abarbeitung | Verantw. | Termin | Status
- **Status-Werte:** erledigt / in Arbeit / offen → Mapping CLOSED / IN_PROGRESS / OPEN
- **Wirksamkeitskriterium wird vorab definiert** („Wirksam: Q3/Q4-Auswertung ≥ 95 %") → eigenes Feld `effectivenessCriterion`
- **Verantw. sind Freitext-Rollen** („BDL / IT", „GF / BDL", „Einkauf / BDL") → Feld `responsible` zusätzlich zu `assigneeId`
- Nummernkreis bestätigt: Listen-Nr. N ↔ `CAPA-2026-N` (Nr. 11 = „CAPA-2026-11" im Auditbericht)

### Qualitätsziele (FB 5.4.1, Rev. 8, Stand 01.2026, gültig ab 12.01.2026)
- **Spalten je Ziel:** Nr | Bereich | Qualitätsziel | KPI-Definition/Messgröße | Datenquelle | Verantwortlich | Typ (min/max) | Zielwert Jahresende | Q1–Q4 jeweils SOLL/IST/% | Status Aktuell | CAPA-Nr. | Kommentar
- Quartalsweise Bewertung (31.03./30.06./30.09./31.12.); Jahresauswertung als Input in FB 5.6.0
- **Harte Regel:** „Jedes Ziel mit Status Gelb oder Rot wird über die Spalte CAPA-Nr. mit FB 8.5.2/8.5.3 verknüpft" → `capaSourceType` enthält ab Phase 1 `QUALITY_OBJECTIVE`
- Phasenmodell-Ziele mit Quartals-Meilensteinen (Q1=25 % … Q4=100 %); Datenquellen u.a. OTWin (externes Branchensystem), FB 6.2.0, FB 7.6.0, PMS-Bericht

### Auditplan (FB 8.2.4, Rev. 5 — Jahresmatrix, xlsx-basiert)
- **5 Themen-Audits 2026:** Reha/Rollstuhl · Sanitätshaus/Filiale · Orthopädietechnik · Büro · Überwachung-Zerti 13485 (extern/mdc), je mit betroffenen Bereichen, Auditor/en (AL/MA bzw. extern) und SOLL/IST-Markierung je Monat 1–12
- **Beschluss 2026-06-10:** bleibt in Phase 7; dort Felder `area` (Thema) + `plannedMonths` auf `audits` nachmigieren und die Matrix-Ansicht + PDF bauen

### Schulungsplan (FB 6.2.0, Formular L-11, Rev. 5, xlsx-basiert)
- Spalten: Person | Bedarf | Planung (Maßnahme) | Zeitraum | Nachweis/Bemerkung; Freigabe GF — einfache Struktur, Phase 4

### Schulungsbedarfsmatrix (FB 6.2.0 Anhang, Rev. 1, Stand 05.2026 — Status ENTWURF, Freigabe GF+BDL ausstehend)
- **Funktionsbasiert, nicht rollenbasiert:** 9 Funktionen (GF, Verwaltungsleiter/QMB, Sanitätshausleitung, OT-Meister, Rehatechniker, Teamleitung Abrechnung, Senior-Verkäufer, MPB, PRRC) × Schulungsthemen in Clustern A–E (QM/Regulatorik, Führung, IT/Datenschutz, Versorgung/Werkstatt, Reklamation/Vigilanz)
- **Legende:** ●●● Pflicht-tief / ●● Pflicht-Grundlagen / ● empfohlen / ○ bei Bedarf / — nicht relevant; je Thema Frequenz (z.B. „1× initial, Refresher alle 3 Jahre") und Quelle/Anbieter
- Enthält bereits **„Stand & Lücken"** (Soll-Ist je Funktion mit Erfüllungsgrad-Ampel: GRÜN 100 %, GELB ≥ 70 %, ROT < 70 %) und **„Nachfolge & Besetzung"** (Maßnahmenplan je Funktion) → Phase 4 bildet genau diese drei Blätter ab; Ist-Übergabe in FB 5.4.1 Ziel 3

### Risikomanagement (FB 7.1.0, docx)
- **Bewertungsmodell: RPZ = Auftretenswahrscheinlichkeit × Schweregrad × Folgen, RPZ < 100 = akzeptabel** (3 Faktoren — nicht 2!)
- Spalten: Risiko | Maßnahmen der Minimierung/Kontrolle | Verantw. | die 3 Faktoren | RPZ; Quellen: Fehlerauswertungen, Rückrufe, klinische Bewertungen, MA/GF-Erfahrung, Q-Ziele-Quartalsauswertungen

### PMS-Bericht (gem. MDR Art. 85, Rev. 1 — Produktgruppe: Sonderanfertigungen Klasse I)
- 8 feste Abschnitte: Ziel · Datenquellen/Methodik (OTWin-Reklamationen, interne Fehler, klinische Nachbeobachtung/MPG-Wiedervorlage, Q-Ziele/Mgmt-Bewertung) · Kennzahlen · Risikobewertung · CAPA · Bewertung des PMS-Systems · Schlussfolgerung · Empfehlungen → Vorlage für die Phase-6-Abschnittsstruktur

## 4. Datenmodell (Überblick über alle Phasen)

Alle Tabellen nutzen die bestehenden `auditFields` (createdAt/By, updatedAt/By, isArchived, archivedAt/By). Status-Wechsel ausschließlich über `validateTransition()` (convex/lib/stateMachine.ts), jede Mutation loggt via `logAuditEvent()`, Löschen nur als `archiveRecord()` (Soft-Delete).

**Phase 1 — Audit + CAPA** (ersetzt Platzhalter `audits`, `auditFindings`, `capaActions`):
- `auditChecklistTemplates` — versionierte Vorlage (formNumber, version, status DRAFT/ACTIVE/SUPERSEDED, basis)
- `auditChecklistTemplateItems` — Prüfpunkte (chapter, chapterTitle, requirements, sortOrder)
- `audits` — Audit-Instanz (Kopfdaten, Typ INTERNAL/EXTERNAL, Status PLANNED→IN_PROGRESS→REPORT_DRAFT→CLOSED/CANCELLED, eingefrorene templateVersion)
- `auditChecklistAnswers` — je Audit eingefrorene Prüfpunkt-Kopien + Bewertung/Nachweis/Stichprobe/Gespräch/Bemerkung
- `auditFindings` — klassifizierte Feststellungen (ABWEICHUNG/FESTSTELLUNG/EMPFEHLUNG) mit optionalem CAPA-Link
- `capas` — Nummernkreis CAPA-{Jahr}-{Nr.}, sourceType (AUDIT/COMPLAINT/TRAINING/RISK/QUALITY_OBJECTIVE/MGMT_REVIEW/MANUAL), Ursachenanalyse, `responsible` (Freitext-Rolle) + `assigneeId`, vorab definiertes `effectivenessCriterion`, Status-Workflow inkl. Wirksamkeitsprüfung
- `capaMeasures` — Einzelmaßnahmen mit Verantwortlichem + Termin

**Phase 2 — Reklamationen** (Entscheidungen 2026-06-10): Die App wird **manuelles QMS-Reklamationsregister** neben OTWin (operatives System, ~22 Fälle/Jahr; spätere Anbindung über Sybase SQL Anywhere gewünscht → Feld `otwinRef` als stabiler Abgleichschlüssel von Anfang an). `complaints` real ausbauen: Nummernkreis `REK-{Jahr}-{NN}` (analog CAPA), Eingang (`receivedAt`, `receivedVia`), Produkt-Bezug (`productId` aus MDR-Modul oder Freitext), Beschreibung/Fehlerkategorie, **Bewertung** (berechtigt/unberechtigt/Kulanz — Abschluss nur mit dokumentierter Bewertung), Status-Workflow EINGEGANGEN → IN_PRÜFUNG → IN_BEARBEITUNG → ABGESCHLOSSEN. **Vigilanz: Frist-Tracking + Meldefelder** — bei vigilanzrelevant berechnet die App die Meldefrist (Standard Eingang + 15 Tage gem. MDR Art. 87, überschreibbar für 2-/10-Tage-Fälle), zeigt Überfälligkeit prominent; Meldefelder (gemeldet am, Referenz, Meldeweg) machen den Q-Ziele-KPI „rechtzeitige Vorkommnis-Meldungen" ab Phase 3 berechenbar. CAPA-Quelle: `capas.createFromComplaint` analog `createFromFinding`. Permissions: alle Rollen erfassen (`complaints:create`), QMB/Abteilungsleitung bearbeiten (`complaints:manage`), QMB schließt (`complaints:close`). Lektion aus Phase 1: keine Zod-Validatoren auf Vorrat; Notification-Deep-Links (`complaints`-Case) sofort mitliefern.

**Phase 3 — Q-Ziele + Managementbewertung:** `qualityObjectivePeriods` (Jahr), `qualityObjectives` (Bereich, Messgröße/KPI-Definition, Datenquelle, Typ min/max, Zielwert Jahresende, Verantwortlicher, kpiKey für Auto-Berechnung oder manuell), `qualityObjectiveReadings` (quartalsweise SOLL/IST/% je Stichtag 31.03./30.06./30.09./31.12., Status-Ampel), `managementReviews` (Abschnitte nach 5.6-Inputs, je Abschnitt Auto-Daten-Snapshot + Bewertungs-Prosa, Beschlüsse → Tasks/CAPAs, Freigabe friert PDF ein). **Pflichtregel aus FB 5.4.1:** Ziel mit Status Gelb/Rot erzwingt CAPA-Verknüpfung (`sourceType: QUALITY_OBJECTIVE`, seit Phase 1 im Schema). Phasenmodell-Ziele (Q-Meilensteine 25/50/75/100 %) als eigener Zieltyp. KPI-Engine: `convex/kpis.ts` mit benannten Berechnungen (`trainingCompletionRate`, `capaCycleTimeDays`, `auditOnTimeRate`, `openComplaints`, `readConfirmationRate`).

**Phase 4 — Schulungserweiterung:** **funktionsbasiert** gemäß realer Bedarfsmatrix (nicht App-Rollen!): `jobFunctions` (die 9 Funktionen, Stelleninhaber, Besetzungsstatus), `trainingRequirements` (Funktion × Schulungsthema × Einstufung ●●●/●●/●/○ × Frequenz × Quelle/Anbieter, Cluster A–E), Soll-Ist-Abgleich-Query (nur Pflicht-Einstufungen ●●●/●●, Erfüllungsgrad-Ampel GRÜN/GELB/ROT wie im Original), Nachfolge-&-Besetzungs-Maßnahmen, Schulungsplan-Entwurfs-Generator. Ist-Übergabe an FB 5.4.1 Ziel 3 (Phase-3-Verknüpfung).

**Phase 5 — Risikoregister:** `risks` (Nummernkreis RS{NN}, Prozess/Bereich, **RPZ-Modell: Auftretenswahrscheinlichkeit × Schweregrad × Folgen, Akzeptanzschwelle RPZ < 100** — exakt wie FB 7.1.0; Werte vor/nach Maßnahme, Maßnahmen-Links auf Tasks/CAPAs, Revision je Risikoanalyse, nextReviewAt).

**Phase 6 — PMS-Bericht:** `pmsReports` (Berichtszeitraum, Auto-Snapshot aus Reklamationen/Produkten/Vigilanz, Prosa-Abschnitte, Freigabe + PDF).

**Phase 7 — Jahreszyklus-Automatik:** **Auditplan-Jahresmatrix** (Beschluss 2026-06-10: nicht in Phase 1): Felder `area`/`plannedMonths` auf `audits` nachmigieren, Matrix-Ansicht Thema × Monat mit SOLL/IST + PDF-Export, Seed der 5 Themen-Audits 2026. Erweiterung `crons.ts`: Audit-Fälligkeiten laut Auditplan, CAPA-Wirksamkeits-Fälligkeit, Risiko-Neubewertung, Mgmt-Review-/PMS-Fälligkeit, Jahreswechsel-Generatoren (Schulungsplan aus Bedarfsmatrix, Auditplan-Vorschlag aus Vorjahr, neue Q-Ziele-Periode). Neue Task-Typen + Notification-Typen.

## 5. Berichts-/PDF-Strategie

Ein gemeinsamer Berichts-Renderer `lib/export/report-exporter.ts` (jsPDF, analog `document-exporter.ts`):
- Kopf: Logo (organizationSettings), Titel, FB-Nr., Revision, „Stand MM.JJJJ"
- Fuß: Seitenzahl, Dateiname/Kennung, Freigabevermerk (Name + Datum)
- Abschnitts-API: `addMetaTable()`, `addSection(heading, prose)`, `addTable(cols, rows)` — verwendet von Auditbericht (Phase 1), Managementbewertung (Phase 3), PMS (Phase 6), Q-Ziele-Auswertung (Phase 3).
- Generierte PDFs werden als Convex-Storage-File am jeweiligen Datensatz eingefroren (Nachweis), zusätzlich Download.

## 6. Phasierung (beschlossen: entlang der Datenkette)

| Phase | Inhalt | Plan-Dokument |
|---|---|---|
| 1 | Audit-Kette (Vorlage → Audit → Findings → Bericht) + CAPA + Seed Checkliste v5 | `2026-06-10-phase1-audit-capa-plan.md` |
| 2 | Reklamationen (inkl. Vigilanz) + CAPA-Quelle | folgt |
| 3 | Q-Ziele/KPI-Engine + Managementbewertung | folgt |
| 4 | Schulungsbedarfsmatrix + Plan-Generierung | folgt |
| 5 | Risikoregister | folgt |
| 6 | PMS-Bericht | folgt |
| 7 | Jahreszyklus-Automatik (Crons, Jahreswechsel-Generatoren) | folgt |

Jede Phase liefert eigenständig lauffähige, im Preview verifizierte Software und ersetzt ihre Platzhalter (Sidebar-Eintrag verlässt „In Planung", Feature-Flag bleibt als Rollout-Schalter).

## 7. Verifikationsstrategie

Das Repo hat keine Test-Infrastruktur; bisherige Pläne verifizieren über `npx tsc --noEmit`, `npm run lint`, `npm run build` und manuelle Preview-Walkthroughs. Die Phasen-Pläne folgen dieser Konvention. Convex-Schema-Änderungen an Platzhalter-Tabellen sind unkritisch, solange die Tabellen leer sind (vor Migration prüfen: `npx convex run` Abfrage oder Dashboard).

---

## Änderungshistorie

**2026-06-10 (Rev. 2):** Alle 12 Quelldokumente lokal in `PDF/` extrahiert (zuvor SMB-Timeout). §3 vervollständigt (CAPA-Liste, Q-Ziele, Auditplan, Schulungsplan, Bedarfsmatrix, Risiken, PMS). Korrekturen: Risikomodell ist RPZ (3 Faktoren, Schwelle < 100) statt 2-Faktor-Matrix; Bedarfsmatrix ist funktionsbasiert (9 Funktionen) statt rollenbasiert; CAPA bekommt `responsible` + `effectivenessCriterion` + Quelle `QUALITY_OBJECTIVE` schon in Phase 1. Beschluss: Auditplan-Jahresmatrix bleibt in Phase 7. Checklisten-xlsx wird von Kristof in `PDF/` nachgeliefert (Vorbedingung Seed).
