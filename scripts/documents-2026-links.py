# Bereinigt die importierten Lenkungsdokumente (Titel/Kategorie) und leitet
# Dokumentverknüpfungen ab → scripts/out/import2026/doc-cleanup.json für
# convex/import2026:applyDocumentCleanup.
#   implements: PA → Handbuch-Kapitel, AA/FB/FO → Prozess (gleiche Nummer) bzw. Kapitel
#   references: ausdrückliche Nennung im Text („FB 7.6.0“, „PA Korrekturmaßnahmen“,
#               „Prüfgerätekartei“ …) — jeweils mit Fundstelle als Nachweis
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts/out/import2026"

# Titel laut Dokumentkopf (Schlüssel: Code + Titel aus dem Dateinamen)
TITLES = {
    ("QMH 1+2", "Kapitel 1 und 2 Einleitung Anwendungsbereich"): "Kapitel 1 und 2 – Einleitung und Anwendungsbereich",
    ("QMH 3", "Kapitel 3 Begriffe Abkürzungen"): "Kapitel 3 – Begriffe und Abkürzungen",
    ("QMH 4", "Kapitel 4 Qualitätsmanagementsystem"): "Kapitel 4 – Qualitätsmanagementsystem",
    ("QMH 5", "Kapitel 5 Verantwortung der Leitung"): "Kapitel 5 – Verantwortung der Leitung",
    ("QMH 6", "Kapitel 6 Management v Ressourcen"): "Kapitel 6 – Management von Ressourcen",
    ("QMH 7", "Kapitel 7 Produkt Dienstleistungsrealisierung"): "Kapitel 7 – Produkt- und Dienstleistungsrealisierung",
    ("QMH 8", "Kapitel 8 Messung Analyse Verbesserung"): "Kapitel 8 – Messung, Analyse und Verbesserung",
    ("PA 4.1.6", "Validierung Software"): "Validierung von Software",
    ("PA 6.1.0", "Planung Produktionsmittel"): "Planung von Produktionsmitteln",
    ("PA 6.3.0", "Externe Wartungen"): "Externe Wartungen",
    ("PA 7.4.1", "Auswahl Lieferanten"): "Auswahl von Lieferanten",
    ("PA 7.4.1", "Beschaffung Prüfmittel"): "Beschaffung von Prüfmitteln",
    ("PA 7.5.3/7.5.4", "Installation Instandhaltung"): "Installation und Reparatur",
    ("PA 7.5.8", "Identifizierung"): "Identifikation",
    ("PA 7.6.0", "Überwachung Messmittel"): "Überwachung von Messmitteln",
    ("PA 8.3.1", "Rückruf Meldung Behörden"): "Rückruf und Meldung an Behörden",
    ("PA 8.3.3", "Empfehlungen Maßn nach Auslieferung"): "Empfehlungen und Maßnahmen nach Auslieferung",
    ("PA 8.5.1", "Planung Verbesserung"): "Planung von Verbesserungen",
    ("AA 7.4.1", "Auswahl Lieferanten"): "Auswahl von Lieferanten",
    ("AA 7.5.1", "Nachbeobachtung"): "Klinische Nachbeobachtung und Vigilanz",
    ("AA 7.5.1", "Risikomanagement"): "Risikomanagement für Sonderanfertigungen",
    ("AA RT-01", "Abgabe, Wiedereinsatz und Installation von Rehamitteln"): "Abgabe, Wiedereinsatz und Instandhaltung von Rehamitteln",
    ("AA OT-01", "Herstellung, Anpassung und Abgabe von Produkten der OT"): "Herstellung, Anpassung und Abgabe von Produkten der OT",
    ("FB 4.2.4", "Liste der Dokumente Produktakte 05.2026"): "Liste der Dokumente (Produktakte) 05.2026",
    ("FB 5.2.0", "Schweigepflicht_DSGVO_Vertraulichkeitserklärungen für Mitarbeiter"): "Schweigepflicht / DSGVO – Vertraulichkeitserklärungen für Mitarbeiter",
    ("FB 5.4.1", "Qualitaetsziele 2026_Rev8"): "Qualitätsziele 2026",
    ("FB 5.4.1", "Qualitätsziele 2026_Rev8"): "Qualitätsziele 2026",
    ("FB 5.5.2", "Benennungsschreiben BdL"): "Benennungsschreiben Beauftragter der Leitung",
    ("FB 5.5.3", "Liste Kommunikationswege"): "Liste der Kommunikationswege",
    ("FB 5.6.0", "Managementbewertung2025"): "Managementbewertung 2025",
    ("FB 7.1", "PMS - Bericht 2026"): "PMS-Bericht 2026 (Berichtszeitraum 2025)",
    ("FB 7.4.1", "Checkliste Lieferanten"): "Checkliste Lieferantenauswahl",
    ("FB 7.5.1", "Einlagen Chargenprotokoll"): "Chargenprotokoll Einlagen (Sonderanfertigung)",
    ("FB 7.5.1", "Stützmieder Chargenprotokoll"): "Chargenprotokoll Stützmieder und Leibbinden",
    ("FB 8.2.4", "Auditbericht_2026_Rev1"): "Auditbericht 2026",
    ("FB 8.2.4", "Auditcheckliste_2026_v5"): "Auditcheckliste 2026 (v5)",
    ("FB 8.3.1", "Lenkung nichtkonformer Produkte"): "Lenkung fehlerhafter Produkte",
    ("FB 8.3.4", "Nacharbeit Nachbesserungen"): "Nacharbeit / Nachbesserungen",
    ("FB 8.5.2/8.5.3", "Korrektur Vorbeugemaßnahmen 2026_Rev1"): "Korrektur- und Vorbeugemaßnahmen 2026",
    ("FO B-09", "Konformitätserklärung"): "Konformitätserklärung Sonderanfertigung",
}

# Welches Handbuch-Kapitel/welcher Prozessbereich gehört zu Sondercodes
SPECIAL_SECTION = {"AA OT-01": "7.5.1", "AA OT-02": "7.5.4", "AA RT-01": "7.5.4", "AA RT-02": "7.5.1",
                   "AA RT-03": "7.5.1", "AA SA-01": "7.5.1", "AA SA-02": "7.5.1", "AA VG-01": "4.2.5",
                   "FO B-01": "7.5.1", "FO B-09": "7.5.1", "FO L-04": "6.2.0", "FO W": "7.5.1", "FB 7.1": "8.2.1",
                   "FB 0": "4.2.4"}


def section(code):
    if code in SPECIAL_SECTION: return SPECIAL_SECTION[code]
    m = re.search(r"(\d+(?:\.\d+){1,2})", code)
    return m.group(1) if m else None


def chapter(code):
    if code.startswith("QMH"): return None
    s = section(code)
    return s.split(".")[0] if s else None


def category(code):
    s = section(code) or code.split()[-1]
    if s.startswith("5.3"): return "quality_policy"
    if s.startswith("5"): return "responsibility"
    if s.startswith("6"): return "resource"
    return "process"


def norm(s):
    s = unicodedata.normalize("NFC", s).lower().replace("ß", "ss")
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue")): s = s.replace(a, b)
    s = s.replace("­", "")
    s = re.sub(r"-\s*\n\s*", "", s)                     # Silbentrennung am Zeilenende
    return re.sub(r"[^a-z0-9.]+", " ", s).strip()


def words(s):
    return {w for w in norm(s).split() if len(w) > 3}


GENERIC = {"datenanalyse", "verbesserungen", "qualitaetsziele", "managementbewertung", "wareneingang",
           "schulungen", "einstellung", "beschaffung", "versand", "einlagern", "anlieferung", "dienstleistung",
           "nacharbeit", "identifikation", "weiterbildung", "rueckmeldungen", "kundenzufriedenheit",
           "datenschutz", "organigramm", "qualitaetspolitik", "rueckverfolgung", "hygieneplan"}


def main():
    docs = json.loads((OUT / "documents.json").read_text())
    for d in docs:
        d["newTitle"] = TITLES.get((d["documentCode"], d["title"]), d["title"])
        d["key"] = (d["documentCode"], d["newTitle"])
    qmh = {d["documentCode"].split()[1]: d for d in docs if d["documentCode"].startswith("QMH")}
    qmh_for = lambda ch: qmh.get(ch) or (qmh.get("1+2") if ch in ("1", "2") else None)
    pas = [d for d in docs if d["documentType"] == "process_description"]

    links = {}
    def add(src, dst, typ, evidence):
        if src is dst: return
        k = (src["key"], dst["key"])
        if k in links and links[k]["type"] == "implements": return
        links[k] = {"source": list(src["key"]), "target": list(dst["key"]), "type": typ, "evidence": evidence}

    # 1) Hierarchie
    for d in docs:
        code = d["documentCode"]
        if code.startswith("QMH"): continue
        ch = chapter(code); sec = section(code)
        if d["documentType"] == "process_description":
            if qmh_for(ch): add(d, qmh_for(ch), "implements", f"Prozess zu Handbuch-Kapitel {ch}")
            continue
        same = [p for p in pas if section(p["documentCode"]) == sec]
        if len(same) > 1:  # mehrere Prozesse gleicher Nummer → beste Titel-Überschneidung
            scored = sorted(same, key=lambda p: -len(words(p["newTitle"]) & words(d["newTitle"])))
            same = [scored[0]] if words(scored[0]["newTitle"]) & words(d["newTitle"]) else []
        if same:
            add(d, same[0], "implements", f"gehört zu Prozess {same[0]['documentCode']}")
        elif qmh_for(ch):
            add(d, qmh_for(ch), "implements", f"gehört zu Handbuch-Kapitel {ch}")

    # 2) Ausdrückliche Verweise im Text
    by_code = {}
    for d in docs: by_code.setdefault(norm(d["documentCode"]).replace(" ", ""), []).append(d)
    prefix = r"(?:pa|aa|fb|fo|va|formblatt|arbeitsanweisung|prozessanweisung|prozess|siehe|gem(?:aess)?|lt)"
    TYPE_BY_PREFIX = {"pa": "process_description", "prozess": "process_description",
                      "prozessanweisung": "work_instruction", "aa": "work_instruction",
                      "arbeitsanweisung": "work_instruction", "fb": "form_template",
                      "formblatt": "form_template", "fo": "form_template"}
    for d in docs:
        # Glossar und Formblatt-Verzeichnis nennen fast alles → nur Hierarchie
        if d["documentCode"] in ("QMH 3", "FB 0"): continue
        text = norm(d["text"])
        own = norm(d["newTitle"])
        # a) Codes wie "FB 7.6.0" / "AA 7.4.3" — nur wenn eindeutig
        for m in re.finditer(r"\b(fb|aa|pa)\s?(\d{1,2}\.\d{1,2}\.\d{1,2})\b", text):
            cands = by_code.get(m.group(1) + m.group(2), [])
            if len(cands) == 1 and cands[0] is not d and cands[0]["documentCode"] != d["documentCode"]:
                add(d, cands[0], "references", f"„{m.group(0).upper()}“ im Text")
        # b) Titel anderer Dokumente
        for e in docs:
            if e is d or e["documentCode"].startswith("QMH") or e["documentCode"] == "FB 0": continue
            t = norm(re.sub(r"\s*\(.*?\)|\s+\d{4}$|\s+\d{2}\.\d{4}$", "", e["newTitle"]))
            if len(t) < 8 or t == own: continue
            generic = t in GENERIC or len(t.split()) == 1 and len(t) < 12
            pat = (prefix + r"\s{1,3}" if generic else r"(?:" + prefix + r"\s{1,3})?") + re.escape(t) + r"\b"
            for m in re.finditer(pat, text):
                pre = m.group(0).split()[0]
                want = TYPE_BY_PREFIX.get(pre)
                # Präfix bestimmt den Dokumenttyp („PA Wareneingang“ ≠ AA Wareneingang)
                if want and e["documentType"] != want: continue
                if e["documentCode"] == d["documentCode"] and e["documentType"] == d["documentType"]: break
                add(d, e, "references", f"„{m.group(0)}“ im Text")
                break

    doc_rows = [{"documentCode": d["documentCode"], "oldTitle": d["title"], "title": d["newTitle"],
                 "category": category(d["documentCode"])} for d in docs]
    out = {"docs": doc_rows, "links": list(links.values())}
    (OUT / "doc-cleanup.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    from collections import Counter
    print(f"Titel geändert: {sum(r['title'] != r['oldTitle'] for r in doc_rows)}, "
          f"Verknüpfungen: {Counter(l['type'] for l in links.values())}", file=sys.stderr)
    linked = {tuple(l["source"]) for l in links.values()} | {tuple(l["target"]) for l in links.values()}
    print("ohne Verknüpfung:", [d["documentCode"] + " " + d["newTitle"] for d in docs if d["key"] not in linked],
          file=sys.stderr)


if __name__ == "__main__":
    main()
