# PQ-Versorgungsbereiche (Zertifikate + GKV-Kriterienkatalog) → zu markierende HMV-Knoten.
# Verdichtung: sind alle Kinder eines Knotens abgedeckt, wird der Elternknoten markiert.
#   python3 scripts/pq-versorgungsspektrum.py  → scripts/out/import2026/spektrum.json
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "scripts/out/import2026"
LEVELS = {1: "produktgruppe", 2: "anwendungsort", 3: "untergruppe", 4: "produktart"}

tree = json.loads((OUT / "hmv_tree4.json").read_text())
pq = json.loads((OUT / "pq_vb.json").read_text())
node = {t["xSteller"]: t for t in tree}
children = {}
for t in tree:
    parent = t["xSteller"].rsplit(".", 1)[0] if t["level"] > 1 else None
    if parent: children.setdefault(parent, []).append(t["xSteller"])

covered = set()
for vbs in pq["certs"].values():
    for vb in vbs.split():
        covered |= set(pq["vb"][vb]["positions"] or [vb[:2]])

def full(x):  # Knoten vollständig abgedeckt?
    if x in covered: return True
    kids = children.get(x, [])
    return bool(kids) and all(full(k) for k in kids)

marks = []
def walk(x):
    if full(x):
        marks.append(x); return
    for k in children.get(x, []): walk(k)

pgs = sorted({p[:2] for p in covered})
for pg in pgs:
    walk(pg)
    if pg not in marks: marks.append(pg)  # Produktgruppe immer markieren (Anzeigename der Gruppe)
items = [{"hmvNummer": x, "hmvLevel": LEVELS[node[x]["level"]], "displayName": node[x]["displayValue"],
          "rehadatId": node[x]["id"]} for x in sorted(set(marks))
         if x in node and "Nicht besetzt" not in node[x]["displayValue"]]  # HMV-Platzhalter
missing = sorted(set(marks) - set(node))
(OUT / "spektrum.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
from collections import Counter
print(len(items), "Markierungen", Counter(i["hmvLevel"] for i in items), "nicht im HMV-Baum:", missing)
