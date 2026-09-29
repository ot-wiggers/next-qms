# Einmal-Import der Jahresablage 2026/ in Convex (Dev-Deployment aus .env.local).
#   python3 scripts/import-2026.py documents|devices|audit|conformity|incoming|all
# Voraussetzungen: scripts/build-2026-documents.py gelaufen; für "incoming" die
# transkribierten Checklisten unter scripts/out/import2026/wareneingang_*.json.
# Alle Convex-Mutationen (convex/import2026.ts) sind idempotent.
import json, subprocess, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts/out/import2026"


def ts(y, m, d):
    return int(datetime(y, m, d, 12, tzinfo=timezone.utc).timestamp() * 1000)


def iso(s):
    return ts(*map(int, s.split("-"))) if s else None


def convex_run(fn, args):
    r = subprocess.run(["npx", "convex", "run", f"import2026:{fn}", json.dumps(args, ensure_ascii=False)],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"{fn} fehlgeschlagen:\n{r.stderr[-3000:]}")
    return json.loads(r.stdout) if r.stdout.strip() else None


def upload(paths):
    """Lädt Dateien in den Convex-Storage, liefert storageIds in gleicher Reihenfolge."""
    if not paths:
        return []
    urls = convex_run("generateUploadUrls", {"count": len(paths)})
    ids = []
    for url, p in zip(urls, paths):
        ctype = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(
            p.suffix.lower(), "application/octet-stream")
        req = urllib.request.Request(url, data=p.read_bytes(), method="POST",
                                     headers={"Content-Type": ctype})
        with urllib.request.urlopen(req) as resp:
            ids.append(json.load(resp)["storageId"])
    return ids


# ---------------------------------------------------------------- Dokumente
def import_documents():
    docs = json.loads((OUT / "documents.json").read_text())
    batch_size = 8  # CLI-Argumentlänge begrenzt
    total = {"created": 0, "updated": 0}
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i + batch_size]
        paths = [ROOT / d["file"] for d in batch]
        ids = upload(paths)
        payload = [{
            "documentType": d["documentType"],
            "documentCode": d["documentCode"],
            "title": d["title"],
            "version": d["version"],
            **({"validFrom": d["validFrom"]} if d["validFrom"] else {}),
            "text": d["text"][:60000],
            # Handbuch + AA sind Fließtext; Prozesse (Flussdiagramme) und Formblätter (Tabellen) nicht
            "withRichContent": d["documentType"] in ("qm_handbook", "work_instruction"),
            "file": {"fileId": fid, "fileName": p.name, "fileSize": p.stat().st_size},
        } for d, p, fid in zip(batch, paths, ids)]
        r = convex_run("upsertDocuments", {"docs": payload})
        total["created"] += r["created"]; total["updated"] += r["updated"]
        print(f"  Dokumente {i + len(batch)}/{len(docs)}", file=sys.stderr)
    print("Dokumente:", total)


# ---------------------------------------------------------------- Prüfmittel
PRUEF = ROOT / "2026/6 Zertifikate/Prüfungen"
CALIPER = "Messschieber"
DEVICES = [  # FB 7.6.0 Prüfgerätekartei Rev. 3, Stand 06.2025
    *[{"inventoryNumber": k, "name": f"{CALIPER} {size}", "responsible": "Benutzer / LT / QB",
       "calibrationIntervalMonths": 12,
       "notes": "Genauigkeit ±0,5 mm; laufende Sichtprüfung auf Beschädigung/Verunreinigung; "
                "bei Fehler interne Prüfung / ggf. Reparatur (FB 7.6.0).",
       "calibration": {"date": ts(2025, 6, 23), "nextDueDate": ts(2026, 6, 23),
                       "performedBy": "intern (Sichtprüfung)"}}
      for k, size in [("2006-02", "15 cm"), ("2006-03", "15 cm"), ("2006-06", "25 cm"), ("2007-08", "15 cm")]],
    {"inventoryNumber": "1004010391", "name": "Universelles Prüfsystem UNIMET 300ST",
     "manufacturer": "Bender", "serialNumber": "1004010391", "calibrationIntervalMonths": 36,
     "notes": "Kalibrierintervall durch Werkservice; bei Fehler Kalibrierung / interne Prüfung / ggf. "
              "Reparatur. Keine interne Kennzeichnung in FB 7.6.0 — Seriennummer als Prüfmittel-Nr.",
     "calibration": {"date": ts(2025, 5, 14), "nextDueDate": ts(2028, 5, 14),
                     "performedBy": "Bender GmbH & Co. KG (Kalibrierschein T-PPG/KS 0486/25)",
                     "cert": PRUEF / "Bender/05.28_Bender_Zertifikate - 1004010391.pdf"}},
    {"inventoryNumber": "OT-2022-01", "name": "Drehmomentschlüssel 4–20 Nm",
     "manufacturer": "Holex", "serialNumber": "79117810576", "location": "Werkstatt OT",
     "responsible": "Benutzer / LT / QB", "calibrationIntervalMonths": 24,
     "notes": "Genauigkeit ±3 %; Intervall auf 24 Monate erhöht (geringe Nutzung, bisher ohne Auffälligkeiten).",
     "calibration": {"date": ts(2025, 6, 11), "nextDueDate": ts(2027, 6, 11),
                     "performedBy": "Hoffmann Group / Trescal GmbH (Kalibrierschein 7542052122)",
                     "notes": "Gesamtergebnis: Einsatzfähig",
                     "cert": PRUEF / "Hoffmann/OT-2022-01 2025-06-11.pdf"}},
    {"inventoryNumber": "RT-2022-01", "name": "Drehmomentschlüssel 40–200 Nm",
     "manufacturer": "Garant", "serialNumber": "SN22-1418072", "location": "Reha/Rollstuhl-Werkstatt GSS",
     "responsible": "Benutzer / LT / QB", "calibrationIntervalMonths": 24,
     "notes": "Genauigkeit ±3 %; Intervall auf 24 Monate erhöht (geringe Nutzung, bisher ohne Auffälligkeiten).",
     "calibration": {"date": ts(2025, 6, 10), "nextDueDate": ts(2027, 6, 10),
                     "performedBy": "Hoffmann Group / Trescal GmbH (Kalibrierschein 7542052121)",
                     "notes": "Gesamtergebnis: Einsatzfähig",
                     "cert": PRUEF / "Hoffmann/RT_2022-01 2025-06-10.pdf"}},
]


def import_devices():
    devices = json.loads(json.dumps(DEVICES, default=str))
    certs = [Path(d["calibration"]["cert"]) for d in devices if "cert" in d["calibration"]]
    ids = iter(upload(certs))
    for d in devices:
        if d["calibration"].pop("cert", None):
            d["calibration"]["certFileId"] = next(ids)
    print("Prüfmittel:", convex_run("upsertDevices", {"devices": devices}))


# ---------------------------------------------------------------- Überwachungsaudit
def import_audit():
    audit_id = subprocess.run(
        ["npx", "convex", "data", "audits", "--format", "jsonLines"], cwd=ROOT,
        capture_output=True, text=True).stdout.splitlines()
    ext = [json.loads(l) for l in audit_id if l.strip()]
    ext = [a for a in ext if a["auditType"] == "EXTERNAL" and a["auditYear"] == 2026 and not a["isArchived"]]
    assert len(ext) == 1, f"Erwartet genau ein externes Audit 2026, gefunden {len(ext)}"
    deviations = [
        {"key": "Abw. 1/2", "chapter": "4.2.5",
         "description": "DIN EN ISO 13485 Kap. 4.2.5, VO (EU) 2017/745 Anh. XIII: Die im Bereich der "
                        "Großorthopädie eingesetzte Patientendokumentation (letzte Seite = Erklärung zu "
                        "Produkten für besondere Zwecke an den Kunden) enthielt im Kopf nicht die Angabe "
                        "des Verordners; die Erklärung war damit nicht vollständig. Das aufbewahrte "
                        "Exemplar war nicht betroffen.",
         "capaTitle": "Verordnerfeld in Patientendokumentation (FO B-01) ergänzen",
         "rootCause": "Fehlendes Verordnerfeld im Kopf der Patientendokumentation.",
         "measures": [{"description": "Korrektur: Verordner dem Formular hinzufügen", "dueAt": ts(2026, 6, 30)},
                      {"description": "Korrekturmaßnahme: Verordner dem Formular hinzufügen (Formular-Revision)",
                       "dueAt": ts(2026, 6, 30)}],
         "dueAt": ts(2026, 6, 30)},
        {"key": "Abw. 2/2", "chapter": "7.5.4",
         "description": "DIN EN ISO 13485 Kap. 7.5.4: Die Instandhaltung war anhand der Dokumentation "
                        "nachvollziehbar, der auf dem Prüfprotokoll für Pflegebetten vorgesehene Abgleich "
                        "des Nutzergewichts wurde in den Stichproben durch den Prüfer jedoch nicht "
                        "bestätigt (Beispiele: Vorgänge 223809, 22357, 22 836 — Nummern lt. Scan, teils unsicher).",
         "capaTitle": "Nutzergewicht-Abgleich im Prüfprotokoll Pflegebetten sicherstellen",
         "rootCause": "Fehlende Angaben des Benutzergewichts.",
         "measures": [{"description": "Korrektur: Mitarbeiter schulen und auf Fehler hinweisen",
                       "dueAt": ts(2026, 6, 30)},
                      {"description": "Korrekturmaßnahme: Mitarbeiter schulen und Stichproben der Angaben durchführen",
                       "dueAt": ts(2026, 9, 30)}],
         "dueAt": ts(2026, 9, 30)},
    ]
    print("Überwachungsaudit:", convex_run("recordSurveillanceAudit2026",
          {"auditId": ext[0]["_id"], "auditDate": ts(2026, 6, 5), "deviations": deviations}))


# ---------------------------------------------------------------- Konformitätserklärungen
KE_DIR = ROOT / "2026/5 Technische Dokumentation/Datenbank Koformitätserklärung"


def ja(v):
    return {"ja": True, "nein": False}.get(str(v).strip().lower()) if v is not None else None


def import_conformity():
    rows = []
    for xlsx in sorted(KE_DIR.glob("*.xlsx")):
        source = "BH-Datenbank" if xlsx.name.startswith("BH") else "Datenbank allgemein"
        ws = openpyxl.load_workbook(xlsx, data_only=True)["Datenbank"]
        for r in ws.iter_rows(min_row=3, values_only=True):
            _, mfr, group, name, _, decommissioned, ce, ga, ke, basis, ablage, issued, valid, remark = r[:14]
            if not (mfr and name and str(name).strip()):
                continue
            notes = [f"Quelle: {source}"]
            if remark: notes.append(str(remark).strip())
            if decommissioned: notes.append(f"Stilllegung: {decommissioned}")
            row = {"manufacturer": str(mfr).strip(), "name": str(name).strip(),
                   "notes": " | ".join(notes)}
            if group is not None: row["productGroup"] = str(group).strip()
            for key, val in (("ceMarkPresent", ja(ce)), ("instructionsPresent", ja(ga))):
                if val is not None: row[key] = val
            if basis in ("MDR", "MDD", "Richtlinie"):
                row["regulatoryBasis"] = "MDR" if basis == "MDR" else "DIRECTIVE"
            if isinstance(issued, datetime) and isinstance(valid, datetime):
                doc = {"issuedAt": ts(issued.year, issued.month, issued.day),
                       "validUntil": ts(valid.year, valid.month, valid.day)}
                if ablage and str(ablage).startswith("http"): doc["externalUrl"] = str(ablage).strip()
                elif ablage: doc["fileName"] = str(ablage).strip()
                row["doc"] = doc
            rows.append(row)
    print(f"  {len(rows)} Zeilen gelesen", file=sys.stderr)
    for i in range(0, len(rows), 40):
        print("Konformität:", convex_run("importConformity", {"rows": rows[i:i + 40]}))


# ---------------------------------------------------------------- Wareneingang
LOC = {"BH": "BHS", "OD": "OFD", "GSS": "GSS", "WS": "HPT"}
AREAS = {a.split(" - ")[0]: a for a in [
    "02 - Adaptionshilfen", "04 - Bade- und Duschhilfen", "05 - Bandagen", "08 - Einlagen",
    "10 - Gehhilfen", "11 - Hilfsmittel gegen Dekubitus", "17 - Kompressionstherapie",
    "18 - Kranken- / Behindertenfahrzeuge", "19 - Krankenpflegeartikel", "20 - Lagerungshilfen",
    "21 - Messgeräte", "22 - Mobilitätshilfen", "23 - Orthesen / Schienen", "24 - Beinprothesen",
    "26 - Sitzhilfen", "28 - Stehhilfen", "31 - Schuhe", "32 - Therapeutische Bewegungsgeräte",
    "33 - Toilettenhilfen", "38 - Armprothesen"]}


def b(v):
    return {"JA": True, "NEIN": False}.get(v)


def s(v, yes="vorhanden (lt. Papier-Checkliste)"):
    return {"JA": yes, "NEIN": "nicht vorhanden (lt. Papier-Checkliste)"}.get(v)


def clean(d):
    return {k: v for k, v in d.items() if v is not None}


def map_check(c):
    p1, p2, lab = c["duties"], c.get("page2") or {}, c.get("labeling") or {}
    area_code = str(c.get("productAreaCode") or "").zfill(2)
    area = AREAS.get(area_code)
    notes = [f"Import 2026 aus Papier-Checkliste: {c['sourceFile']}"]
    if not area:
        notes.append(f"Produktbereich lt. Bogen: {c.get('productAreaCode') or 'leer'} (nicht in Liste)")
    if c.get("remarks"): notes.append(f"Bemerkung: {c['remarks']}")
    for k, lbl in (("restlaufzeit", "Restlaufzeit ausreichend"), ("verwendungsfrist", "Verwendungsfrist angegeben"),
                   ("lagerungsHinweise", "Lagerungs-/Handhabungshinweise"), ("einmalgebrauch", "Einmalgebrauch-Hinweis"),
                   ("produktAngaben", "Angaben zum Packungsinhalt")):
        val = p2.get(k) if k in p2 else lab.get(k)
        if val: notes.append(f"{lbl}: {val.replace('_', ' ').lower()}")
    if c.get("result") is None:
        notes.append("Ergebnis auf dem Bogen NICHT angekreuzt — als 'erfüllt' übernommen, bitte prüfen")
    if c.get("uncertain"):
        notes.append("Unsichere Lesungen: " + "; ".join(c["uncertain"]))
    ref = b(p2.get("refLotSn"))
    return {
        "locationCode": LOC[c["filiale"]],
        "sourceKey": c["sourceFile"],
        "checkDate": iso(c.get("checkDate") or c.get("deliveryDate")),
        **({"inspectorName": c["signature"]} if c.get("signature") else {}),
        "manufacturer": c.get("manufacturer") or "unleserlich",
        "productArea": area or "Sonstiges",
        **({"deliveryDate": iso(c["deliveryDate"])} if c.get("deliveryDate") else {}),
        "duties": clean({k: b(p1.get(k)) for k in ("isMedizinprodukt", "hasCeKennzeichnung", "hasHerstellerInfos",
                         "hasEuKonformitaet", "hasUdi", "hasLagerungBedingungen", "entsprichtMdr", "keineGefahr")}),
        "labeling": clean({"produktName": s(lab.get("produktName")), "ceKennzeichnung": b(lab.get("ceKennzeichnung")),
                           "herstellerName": s(lab.get("hersteller")),
                           "haendlerName": s(lab.get("haendlerImporteurBevollmaechtigter"),
                                             "Händler/Importeur/Bevollmächtigter angegeben (lt. Papier-Checkliste)")}),
        "identification": clean({"hasRef": ref, "hasLot": ref, "hasSn": ref,
                                 "hasUdiTraeger": b(p2.get("udiTraeger")),
                                 "herstelldatum": s(p2.get("herstelldatum"), "angegeben (lt. Papier-Checkliste)")}),
        "storage": clean({"warnhinweise": s(p2.get("warnhinweise")),
                          "patientHinweise": s(p2.get("mehrfachanwendung")),
                          "aufbereitungszyklen": {"NICHT_RELEVANT": "nicht relevant"}.get(p2.get("aufbereitung"))
                                                 or s(p2.get("aufbereitung"))}),
        "custom": clean({"isSonderanfertigung": b(p2.get("sonderanfertigung")),
                         "mdKennzeichnung": b(p2.get("mdHinweis")),
                         "nurKlinischePruefung": b(p2.get("nurKlinischePruefung")),
                         "sichereEntsorgung": s(p2.get("entsorgung"))}),
        "result": c.get("result") or "PASSED",
        "remarks": "\n".join(notes),
        "files": [c["sourceFile"], *c.get("extraFiles", [])],
    }


def import_incoming():
    checks = json.loads((OUT / "wareneingang_od_gss.json").read_text())
    checks += json.loads((OUT / "wareneingang_bh_ws.json").read_text())["checks"]
    mapped = [map_check(c) for c in checks]
    for i in range(0, len(mapped), 6):
        batch = mapped[i:i + 6]
        for m in batch:
            m["attachmentFileIds"] = upload([ROOT / f for f in m.pop("files")])
        print("Wareneingang:", convex_run("importIncomingGoods", {"checks": batch}))


if __name__ == "__main__":
    steps = {"documents": import_documents, "devices": import_devices, "audit": import_audit,
             "conformity": import_conformity, "incoming": import_incoming}
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "all":
        for f in steps.values(): f()
    elif arg in steps:
        steps[arg]()
    else:
        sys.exit(__doc__ or "Aufruf: import-2026.py documents|devices|audit|conformity|incoming|all")
