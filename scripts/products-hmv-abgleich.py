# Abgleich der importierten Produkte (KE-Datenbank) mit dem GKV-Hilfsmittelverzeichnis
# und den PQ-Versorgungsbereichen der Filialen.
#   python3 scripts/products-hmv-abgleich.py <hmv_produkte.json> <hmv_tree4.json> <pq_vb.json>
# Liest Produkte/Hersteller aus der Convex-Deployment von .env.local (npx convex data),
# schreibt scripts/out/import2026/hmv-abgleich.json (für Convex) + 2026/_ABGLEICH_Produkte-HMV-PQ.md
import difflib, json, re, subprocess, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts/out/import2026"

# Hersteller laut KE-Datenbank → Suchschlüssel im HMV-Herstellernamen
MFR_KEYS = {"otto bock": ["otto bock", "ottobock"], "pro active": ["pro activ"], "drive medical": ["drive medical"],
            "sunrise medical": ["sunrise medical"], "medi": ["medi gmbh"], "adl": ["adl "], "etac": ["etac"]}


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def convex_rows(table):
    r = subprocess.run(["npx", "convex", "data", table, "--limit", "2000", "--format", "jsonLines"],
                       cwd=ROOT, capture_output=True, text=True, check=True)
    return [json.loads(l) for l in r.stdout.splitlines() if l.strip().startswith("{")]


def main(hmv_path, tree_path, pq_path):
    hmv = [p for p in json.loads(Path(hmv_path).read_text()) if not p.get("istHerausgenommen")]
    tree = json.loads(Path(tree_path).read_text())
    pq = json.loads(Path(pq_path).read_text())
    names = {t["xSteller"]: t["displayValue"] for t in tree}

    products = [p for p in convex_rows("products") if not p.get("isArchived")]
    mfrs = {m["_id"]: m["name"] for m in convex_rows("manufacturers")}

    by_mfr = defaultdict(list)
    for h in hmv:
        by_mfr[norm(h["herstellerName"])].append(h)

    def candidates(mfr):
        keys = MFR_KEYS.get(norm(mfr), [norm(mfr)])
        return [h for hn, hs in by_mfr.items() for h in hs if any(hn.startswith(k.strip()) or f" {k.strip()}" in f" {hn}" for k in keys)]

    # PQ-Abdeckung: Position (Präfix) → Versorgungsbereiche/Filialen
    covered = defaultdict(set)
    for loc, vbs in pq["certs"].items():
        for vb in vbs.split():
            info = pq["vb"][vb]
            for pos in (info["positions"] or [vb[:2]]):
                covered[pos].add(f"{vb}@{loc}")

    def pq_for(ten):
        hits = set()
        for pos, where in covered.items():
            if ten.startswith(pos): hits |= where
        return sorted(hits)

    results = []
    for p in products:
        mfr = mfrs.get(p.get("manufacturerId"), "")
        name = norm(p["name"])
        best, score = [], 0.0
        for h in candidates(mfr):
            hn = norm(h["name"])
            # Modellkürzel/Zahlen („XC“, „900“, „5G“) nur als ganzes Wort; Namen auch ohne Leerzeichen
            def hit(t):
                exact = any(ch.isdigit() for ch in t) or len(t) < 3
                return re.search(rf"\b{re.escape(t)}\b" if exact else rf"\b{re.escape(t)}", hn)
            toks = name.split()
            contain = bool(toks) and (all(hit(t) for t in toks) or re.search(re.escape(name.replace(" ", "")) + r"(?![0-9])", hn.replace(" ", "")))
            s = 1.0 if contain and hn.replace(" ", "").startswith(toks[0]) else 0.9 if contain else \
                difflib.SequenceMatcher(None, name, hn[:len(name) + 10]).ratio()
            if s > score + 1e-9: best, score = [h], s
            elif abs(s - score) < 1e-9: best.append(h)
        tens = Counter(h["zehnSteller"] for h in best)
        row = {"productId": p["_id"], "manufacturer": mfr, "name": p["name"],
               "existingGroup": p.get("productGroup"), "score": round(score, 2)}
        if score >= 0.9 and tens:
            ten = tens.most_common(1)[0][0]
            seven = ten[:10] if len(ten) > 10 else ten
            row.update({"hmvNummer": ten, "hmvName": best[0]["name"], "alternatives": sorted(tens)[:6],
                        "untergruppe": ten[:8], "untergruppeName": names.get(ten[:8], ""),
                        "pq": pq_for(ten)})
        elif best:
            row["suggestion"] = {"hmvNummer": best[0]["zehnSteller"], "hmvName": best[0]["name"]}
        results.append(row)

    matched = [r for r in results if r.get("hmvNummer")]
    outside = [r for r in matched if not r["pq"]]
    vb_used = {w.split("@")[0] for r in matched for w in r["pq"]}
    vb_all = sorted(pq["vb"])
    (OUT / "hmv-abgleich.json").write_text(json.dumps({"results": results}, ensure_ascii=False, indent=1))

    L = ["# Abgleich Produkte ↔ Hilfsmittelverzeichnis ↔ PQ-Versorgungsbereiche", "",
         f"Stand {subprocess.run(['date', '+%d.%m.%Y'], capture_output=True, text=True).stdout.strip()}. "
         f"Quelle HMV: GKV-Spitzenverband (hilfsmittel-api, {len(hmv)} aktive Produkte). "
         "Versorgungsbereiche laut PQ-Zertifikaten der 4 Filialen, zugeordnet über den GKV-Kriterienkatalog (28.04.2025).", "",
         f"- Produkte: **{len(results)}**, eindeutig im HMV gefunden: **{len(matched)}**, "
         f"nur Vorschlag: {sum(1 for r in results if r.get('suggestion'))}, "
         f"nicht gefunden: {sum(1 for r in results if not r.get('hmvNummer') and not r.get('suggestion'))}",
         f"- **Außerhalb der PQ-Versorgungsbereiche: {len(outside)}**",
         f"- Versorgungsbereiche ohne gelistetes Produkt: {len(set(vb_all) - vb_used)} von {len(vb_all)}", "",
         "## Produkte außerhalb der PQ-Versorgungsbereiche", "",
         "| Hersteller | Produkt | HMV | Untergruppe |", "|---|---|---|---|"]
    L += [f"| {r['manufacturer']} | {r['name']} | {r['hmvNummer']} | {r['untergruppeName']} |" for r in outside]
    L += ["", "## Nicht eindeutig zuordenbar (bitte prüfen)", "", "| Hersteller | Produkt | Vorschlag HMV | Treffer |", "|---|---|---|---|"]
    for r in results:
        if not r.get("hmvNummer"):
            s = r.get("suggestion") or {}
            L.append(f"| {r['manufacturer']} | {r['name']} | {s.get('hmvNummer', '—')} | {s.get('hmvName', 'kein Treffer')} ({r['score']}) |")
    L += ["", "## Versorgungsbereiche ohne gelistetes Produkt", "",
          "Nur Produkte mit Konformitätserklärung sind erfasst; ein leerer Bereich heißt nicht, dass dort nicht versorgt wird.", "",
          ", ".join(sorted(set(vb_all) - vb_used)), "", "## Zugeordnete Produkte", "",
          "| Hersteller | Produkt | HMV-Nr. | HMV-Bezeichnung | PQ-Bereich@Filiale |", "|---|---|---|---|---|"]
    L += [f"| {r['manufacturer']} | {r['name']} | {r['hmvNummer']} | {r['hmvName']} | {', '.join(r['pq']) or '⚠️ keiner'} |"
          for r in sorted(matched, key=lambda r: r["hmvNummer"])]
    (ROOT / "2026/_ABGLEICH_Produkte-HMV-PQ.md").write_text("\n".join(L) + "\n")
    print(f"{len(matched)}/{len(results)} zugeordnet, {len(outside)} außerhalb PQ", file=sys.stderr)


if __name__ == "__main__":
    main(*sys.argv[1:4])
