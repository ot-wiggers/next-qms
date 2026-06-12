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
