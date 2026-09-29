# Liest die freigegebenen QM-Dokumente aus 2026/ (Kapitel, Prozesse,
# Arbeitsanweisungen, Formblätter) und erzeugt scripts/out/import2026/documents.json
# für convex/import2026:upsertDocuments.
#
# Code/Titel kommen aus dem Dateinamen (Hausnummerierung "7 4 3 AA Wareneingang"),
# Revision/Stand/Gültig-ab aus dem Kopf der ersten Seite (pdftotext).
# Deckblätter werden bewusst übersprungen (keine Lenkungsdokumente).
import json, re, subprocess, sys, unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "2026"
OUT = ROOT / "scripts/out/import2026"

FOLDERS = [
    ("1 Kapitel", "qm_handbook", "QMH"),
    ("2 Prozesse", "process_description", "PA"),
    ("3 Arbeitsanweisungen", "work_instruction", "AA"),
    ("4 Formblaetter Nachweise", "form_template", "FB"),
]

# Dateinamen sind ASCII-transkribiert; für Titel die Umlaute zurückholen.
UMLAUTS = [
    ("Qualitaet", "Qualität"), ("qualitaet", "qualität"), ("Pruef", "Prüf"), ("pruef", "prüf"),
    ("Rueck", "Rück"), ("rueck", "rück"), ("Massn", "Maßn"), ("massn", "maßn"),
    ("Einfuehrung", "Einführung"), ("Ueberwachung", "Überwachung"), ("Behoerden", "Behörden"),
    ("Abkuerzungen", "Abkürzungen"), ("Formblaetter", "Formblätter"), ("Praevention", "Prävention"),
    ("Personalgespraech", "Personalgespräch"), ("Reklamtion", "Reklamation"),
    ("Versorung", "Versorgung"), ("Instaltung", "Installation"),
]


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def fix_title(t: str) -> str:
    for a, b in UMLAUTS:
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip(" _-")


def first_page(path: Path) -> str:
    r = subprocess.run(["pdftotext", "-layout", "-l", "1", str(path), "-"],
                       capture_output=True, text=True)
    return r.stdout


def full_text(path: Path) -> str:
    r = subprocess.run(["pdftotext", str(path), "-"], capture_output=True, text=True)
    t = r.stdout.replace("­", "").replace("\f", "\n")
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def parse_date(s: str):
    """'05.2025' → 1. des Monats; '25.07.18' / '25.07.2018' → Tag. UTC-Mittag."""
    s = s.strip()
    for fmt in ("%d.%m.%Y", "%d.%m.%y", "%m.%Y", "%m/%Y", "%m.%y"):
        try:
            d = datetime.strptime(s, fmt).replace(hour=12, tzinfo=timezone.utc)
            return int(d.timestamp() * 1000)
        except ValueError:
            pass
    return None


def header_meta(text: str):
    head = "\n".join(text.splitlines()[:25])
    rev = re.search(r"Rev(?:ision|ion)?\.?\s*:?\s*(\d+)", head)  # "Revion" = Tippfehler im Original
    stand = re.search(r"Stand\s*:?\s*(\d{1,2}[./](?:\d{4}|\d{2})\b)", head)
    valid = re.search(r"G[üu]ltig\s*ab\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})", head)
    return (rev.group(1) if rev else None,
            stand.group(1) if stand else None,
            valid.group(1) if valid else None)


def code_and_title(stem: str, prefix: str, folder: str):
    stem = nfc(stem)
    if folder == "1 Kapitel":
        if stem.startswith("Inhalt"):
            # Liegt im Kapitel-Ordner, ist inhaltlich aber das Formblatt-Verzeichnis
            return "FB 0", "Inhaltsverzeichnis Formblätter / Nachweise"
        m = re.match(r"^(\d+(?: und \d+)?)\s+(.*)$", stem)
        num = m.group(1).replace(" und ", "+")
        return f"QMH {num}", f"Kapitel {m.group(1)} {fix_title(m.group(2))}"
    # Sonder-Präfixe: OT-01, RT-02, SA-01, VG-01, FO_B-01, FO_L-04, FO_W_…
    m = re.match(r"^(OT|RT|SA|VG)-(\d+)\s+AA\s+(.*)$", stem)
    if m:
        return f"AA {m.group(1)}-{m.group(2)}", fix_title(m.group(3))
    m = re.match(r"^FO_([A-Z])-(\d+)_?\s*(?:W_)?(.*)$", stem)
    if m:
        return f"FO {m.group(1)}-{m.group(2)}", fix_title(m.group(3).replace("_", " "))
    m = re.match(r"^FO_W_(.*)$", stem)
    if m:
        return "FO W", fix_title(m.group(1))
    # "8 5 2 - 8 5 3 Korrektur …"
    m = re.match(r"^(\d+) (\d+) (\d+) - (\d+) (\d+) (\d+)\s+(.*)$", stem)
    if m:
        g = m.groups()
        return f"{prefix} {g[0]}.{g[1]}.{g[2]}/{g[3]}.{g[4]}.{g[5]}", fix_title(g[6])
    # "7 5 3  7 5 4 Med Installation …"
    m = re.match(r"^(\d+) (\d+) (\d+)\s+(\d+) (\d+) (\d+)\s+(?:Med|AA)\s+(.*)$", stem)
    if m:
        g = m.groups()
        return f"{prefix} {g[0]}.{g[1]}.{g[2]}/{g[3]}.{g[4]}.{g[5]}", fix_title(g[6])
    # "7 4 3 AA Wareneingang" / "7 5 10 Med …" / "7 1 PMS - Bericht 2026"
    m = re.match(r"^(\d+(?: \d+){1,2})\s+(?:Med |AA )?(.*)$", stem)
    if m:
        return f"{prefix} {m.group(1).replace(' ', '.')}", fix_title(m.group(2))
    raise ValueError(f"Unbekanntes Namensschema: {stem}")


def main():
    docs, skipped = [], []
    for folder, doc_type, prefix in FOLDERS:
        for pdf in sorted((SRC / folder).glob("*.pdf")):
            stem = nfc(pdf.stem)
            if stem.startswith("0 Deckblatt"):
                skipped.append({"file": str(pdf.relative_to(ROOT)), "reason": "Deckblatt"})
                continue
            code, title = code_and_title(stem, prefix, folder)
            fp = first_page(pdf)
            rev, stand, valid = header_meta(fp)
            text = full_text(pdf)
            docs.append({
                "file": nfc(str(pdf.relative_to(ROOT))),
                # "Inhalt Kapitel.pdf" ist das Formblatt-Verzeichnis → Typ Formblatt
                "documentType": "form_template" if code.startswith("FB") else doc_type,
                "documentCode": code,
                "title": title,
                "version": rev or "?",
                "stand": stand,
                "validFrom": parse_date(valid) if valid else (parse_date(stand) if stand else None),
                "text": text,
                "hasText": len(text) > 40,
            })
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "documents.json").write_text(json.dumps(docs, ensure_ascii=False, indent=1))
    (OUT / "documents.skipped.json").write_text(json.dumps(skipped, ensure_ascii=False, indent=1))
    # Selbstcheck: Code+Titel eindeutig (Idempotenz-Schlüssel des Imports)
    keys = [(d["documentCode"], d["title"]) for d in docs]
    assert len(keys) == len(set(keys)), "Code+Titel nicht eindeutig"
    print(f"{len(docs)} Dokumente, {len(skipped)} übersprungen", file=sys.stderr)
    for d in docs:
        print(f'{d["documentCode"]:<22} {d["version"]:<10} {str(d["stand"]):<8} '
              f'{"" if d["hasText"] else "OHNE TEXT "}{d["title"][:60]}')


if __name__ == "__main__":
    main()
