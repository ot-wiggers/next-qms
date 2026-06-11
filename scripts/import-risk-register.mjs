// Liest "PDF/7 1 0 Risiken Massnahmen 2026.docx" (FB 7.1.0 Rev. 1) und erzeugt
// scripts/out/risikoregister.json — exakt im Args-Format von risks:seedFromImport
// ({ risks: [...] }, KEIN meta-Feld). Meta-Infos gehen nach stdout und
// zusätzlich nach scripts/out/risikoregister.meta.json (gitignored).
//
// docx = ZIP; geparst wird word/document.xml. Die Register-Tabelle ist die,
// deren Header-Zeile "RPZ" enthält (die Legenden-Tabellen dahinter nicht).
// Zell-Text: <w:t>-Inhalte innerhalb eines Absatzes OHNE Trenner konkateniert
// (Runs splitten mitten im Wort!), Absätze mit Leerzeichen verbunden,
// Whitespace normalisiert, Soft-Hyphens (U+00AD) entfernt.
//
// Harte Gates (process.exit(1)):
//   1. Exakt 22 Datenzeilen.
//   2. Jede Zeile: RPZ-Zelle === A × S × F.
//   3. Alle Faktoren ganzzahlig 1..10.
//   4. Titel dürfen nicht MATERIELL von der Erwartungsliste abweichen.
// Blau-Erkennung ("Neu in Rev. 1"): w:color ≠ auto/000000 oder w:highlight in
// den Runs der Zeile. Erwartung: Zeilen 14–22. Abweichende Menge wird prominent
// gemeldet und ÜBERNOMMEN (kein Abbruch); NULL markierte Zeilen → lauter
// Warnhinweis + Fallback auf 14–22 (meta.blueDetection = "fallback").
import { createRequire } from "module";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
const require = createRequire(new URL("../package.json", import.meta.url));
const JSZip = require("jszip");

const SRC =
  process.argv[2] ??
  new URL("../PDF/7%201%200%20Risiken%20Massnahmen%202026.docx", import.meta.url)
    .pathname.replace(/%20/g, " ");

// ── CAPA-Zuordnung ───────────────────────────────────────────────────────────
// Die FB-5.4.1-Nummerierung IM DOCX ist gegenüber der live geseedeten
// CAPA-Liste um +1 VERSCHOBEN: Live-CAPA-2026-01 ("Gleitschleifen") fehlt im
// Formblatt 7.1.0, daher meint z. B. "CAPA-2026-01" im Maßnahmentext von
// Risiko 21 live die CAPA-2026-02, "CAPA-2026-08" bei Risiko 22 live die
// CAPA-2026-09 usw. Risiko 15 (QSV Hygiene-/Reparatur-Dienstleister) ist
// INHALTSBASIERT der CAPA-2026-11 zugeordnet. Der Maßnahmen-TEXT bleibt
// wortgetreu erhalten (inkl. alter Nummern — es ist das Original-Formblatt);
// nur die Verknüpfung (capaNumbers) verwendet die korrigierten Live-Nummern.
const CAPA_MAP = {
  14: ["CAPA-2026-08"],
  15: ["CAPA-2026-11"],
  16: ["CAPA-2026-03"],
  17: ["CAPA-2026-06"],
  18: ["CAPA-2026-05"],
  19: ["CAPA-2026-04"],
  20: ["CAPA-2026-10"],
  21: ["CAPA-2026-02"],
  22: ["CAPA-2026-09"],
};

const REV1_SOURCE_NOTE =
  "Neu in Rev. 1 (04.2026) — aus Q-Ziele-Quartalsauswertungen 2025 / FB 5.6.0 Managementbewertung 2025";

// Erwartete Titel (Ground Truth aus zwei unabhängigen Extraktionen)
const EXPECTED_TITLES = [
  "Maschinen, Ausfall",
  "Kenntnisse Mitarbeiter/-innen",
  "Einkauf",
  "Entnahme Material",
  "Kennzeichnung Produkte",
  "Transport (innerbetrieblich)",
  "Versand",
  "Wareneingang / Verwechselung",
  "Beschaffung falsche Spezifikation",
  "Labeling falsch",
  "Verpackung / Falsch",
  "Endprüfung / Falsch",
  "Einlagern / Verwechselung",
  "Werkstatt-Messmittel-Prüfungen nicht termingerecht",
  "QSV mit ausgegliedertem Hygiene-/Reparatur-Dienstleister fehlt",
  "Verantwortungen / Befugnisse nicht formal ernannt",
  "Schulungssystem nicht vollständig umgesetzt",
  "Mitarbeitergespräche nicht jährlich geführt",
  "Nachfolgeregelung unklar",
  "Dokumentation unvollständig",
  "Unvollständige Erfassung aller Fehlerarten in PMS / OTWin",
  "IT-Sicherheit / NIS-2",
];

// Erwartete Faktoren (A, S, F, RPZ) je Zeile 1..22 — Ground Truth
const EXPECTED_FACTORS = [
  [2, 2, 1, 4], [2, 5, 6, 60], [3, 2, 1, 6], [3, 3, 10, 90], [3, 2, 10, 60],
  [1, 1, 1, 1], [3, 3, 6, 54], [7, 3, 1, 21], [5, 2, 2, 20], [2, 3, 6, 36],
  [5, 2, 1, 10], [4, 5, 4, 80], [2, 3, 6, 36], [4, 2, 3, 24], [5, 3, 3, 45],
  [5, 4, 3, 60], [4, 3, 3, 36], [5, 2, 1, 10], [3, 4, 3, 36], [4, 3, 3, 36],
  [4, 3, 3, 36], [4, 4, 3, 48],
];

const EXPECTED_BLUE_ROWS = [14, 15, 16, 17, 18, 19, 20, 21, 22];

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Bereinigt einen Zell-String: entfernt Soft-Hyphens (U+00AD), normalisiert
 * Whitespace und trimmt. Alle Texte aus der docx laufen durch diese Funktion.
 */
function sanitize(raw) {
  return String(raw ?? "")
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** XML-Entities dekodieren (document.xml enthält &amp; &lt; … &#x2026;) */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Text eines Absatzes: w:t-Runs OHNE Trenner; w:br/w:tab → Leerzeichen */
function paraText(p) {
  let t = "";
  const parts = p.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|<w:br\/>|<w:tab\/>/g) || [];
  for (const part of parts) {
    if (part === "<w:br/>" || part === "<w:tab/>") {
      t += " ";
      continue;
    }
    t += decodeEntities(part.replace(/<[^>]+>/g, ""));
  }
  return t;
}

/** Text einer Tabellenzelle: Absätze mit Leerzeichen verbinden, sanitizen */
function cellText(tc) {
  const ps = tc.match(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g) || [];
  return sanitize(ps.map(paraText).filter((s) => s.trim()).join(" "));
}

/** Normalisierung für den materiellen Titel-Vergleich (Gate 4) */
function normTitle(s) {
  return sanitize(s)
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, "");
}

/** Blau-/Hervorhebungs-Erkennung in den Runs einer Tabellenzeile */
function rowIsMarked(tr) {
  const colors = tr.match(/<w:color w:val="([^"]+)"/g) || [];
  for (const c of colors) {
    const val = c.match(/"([^"]+)"/)[1].toLowerCase();
    if (val !== "auto" && val !== "000000") return true;
  }
  return /<w:highlight w:val="/.test(tr);
}

// ── 1. docx einlesen, Register-Tabelle finden ────────────────────────────────

const zip = await JSZip.loadAsync(readFileSync(SRC));
const docEntry = zip.file("word/document.xml");
if (!docEntry) {
  console.error("FEHLER: word/document.xml nicht im docx gefunden");
  process.exit(1);
}
const xml = await docEntry.async("string");

const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
let registerTable = null;
for (const tbl of tables) {
  const firstRow = (tbl.match(/<w:tr(?: [^>]*)?>[\s\S]*?<\/w:tr>/) || [null])[0];
  if (!firstRow) continue;
  const headerCells = (firstRow.match(/<w:tc(?: [^>]*)?>[\s\S]*?<\/w:tc>/g) || []).map(cellText);
  if (headerCells.some((c) => c.includes("RPZ"))) {
    registerTable = tbl;
    break;
  }
}
if (!registerTable) {
  console.error('FEHLER: Keine Tabelle mit "RPZ" im Header gefunden');
  process.exit(1);
}

// ── 2. Zeilen parsen ─────────────────────────────────────────────────────────

const trs = registerTable.match(/<w:tr(?: [^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
const dataTrs = trs.slice(1); // Zeile 0 = Header

// Gate 1: exakt 22 Datenzeilen
if (dataTrs.length !== 22) {
  console.error(`FEHLER (Gate 1): Erwartet 22 Datenzeilen, gefunden ${dataTrs.length}`);
  process.exit(1);
}

const rows = [];
const markedRows = []; // 1-basierte Indizes

for (let i = 0; i < dataTrs.length; i++) {
  const rowNo = i + 1;
  const tr = dataTrs[i];
  const tcs = tr.match(/<w:tc(?: [^>]*)?>[\s\S]*?<\/w:tc>/g) || [];
  if (tcs.length !== 7) {
    console.error(`FEHLER: Zeile ${rowNo} hat ${tcs.length} Zellen statt 7`);
    process.exit(1);
  }
  const [title, measures, responsible, aRaw, sRaw, fRaw, rpzRaw] = tcs.map(cellText);

  const a = Number(aRaw);
  const s = Number(sRaw);
  const f = Number(fRaw);
  const rpz = Number(rpzRaw);

  // Gate 3: alle Faktoren ganzzahlig 1..10
  for (const [label, val] of [["A", a], ["S", s], ["F", f]]) {
    if (!Number.isInteger(val) || val < 1 || val > 10) {
      console.error(
        `FEHLER (Gate 3): Zeile ${rowNo} "${title}": Faktor ${label}=${JSON.stringify(val)} nicht ganzzahlig 1..10`
      );
      process.exit(1);
    }
  }

  // Gate 2: RPZ-Zelle === A × S × F
  if (!Number.isInteger(rpz) || rpz !== a * s * f) {
    console.error(
      `FEHLER (Gate 2): Zeile ${rowNo} "${title}": RPZ-Zelle=${rpzRaw} ≠ A×S×F=${a}×${s}×${f}=${a * s * f}`
    );
    process.exit(1);
  }

  // Gate 4: Titel-Abgleich gegen Ground Truth (materielle Abweichung → Abbruch)
  if (normTitle(title) !== normTitle(EXPECTED_TITLES[i])) {
    console.error(`FEHLER (Gate 4): Zeile ${rowNo}: Titel weicht MATERIELL ab:`);
    console.error(`  docx:     "${title}"`);
    console.error(`  erwartet: "${EXPECTED_TITLES[i]}"`);
    process.exit(1);
  }

  // Zusatz-Abgleich gegen erwartete Faktoren (Ground Truth)
  const [eA, eS, eF, eR] = EXPECTED_FACTORS[i];
  if (a !== eA || s !== eS || f !== eF || rpz !== eR) {
    console.error(
      `FEHLER: Zeile ${rowNo} "${title}": Faktoren (${a},${s},${f},${rpz}) ≠ erwartet (${eA},${eS},${eF},${eR})`
    );
    process.exit(1);
  }

  if (rowIsMarked(tr)) markedRows.push(rowNo);

  rows.push({ title, measures, responsible, a, s, f });
}

console.log(`Gates 1–4 bestanden: 22 Zeilen, alle RPZ = A×S×F, Faktoren 1..10, Titel ok ✓`);

// ── 3. Blau-Erkennung auswerten ──────────────────────────────────────────────

let blueDetection = "xml";
let blueRows = markedRows;

console.log(`Blau markierte Zeilen (XML): [${markedRows.join(", ")}]`);

if (markedRows.length === 0) {
  console.warn("");
  console.warn("⚠️  WARNUNG: KEINE Zeile per XML als blau/markiert erkannt!");
  console.warn(`⚠️  Fallback auf Erwartung: Zeilen ${EXPECTED_BLUE_ROWS.join(", ")}`);
  console.warn("");
  blueDetection = "fallback";
  blueRows = EXPECTED_BLUE_ROWS;
} else if (
  markedRows.length !== EXPECTED_BLUE_ROWS.length ||
  !markedRows.every((r, idx) => r === EXPECTED_BLUE_ROWS[idx])
) {
  console.warn("");
  console.warn("══════════════════════════════════════════════════════════════");
  console.warn(`ABWEICHUNG Blau-Markierung: TATSÄCHLICH [${markedRows.join(", ")}]`);
  console.warn(`                            erwartet    [${EXPECTED_BLUE_ROWS.join(", ")}]`);
  console.warn("→ Die TATSÄCHLICHE Menge wird verwendet (kein Abbruch).");
  console.warn("══════════════════════════════════════════════════════════════");
  console.warn("");
} else {
  console.log(`Blau-Markierung entspricht Erwartung (Zeilen 14–22) ✓`);
}

// ── 4. Risiken zusammenbauen (Args-Format von risks:seedFromImport) ─────────

const blueSet = new Set(blueRows);
const risks = rows.map((row, i) => {
  const rowNo = i + 1;
  const obj = {
    title: row.title,
    measures: row.measures || undefined,
    responsible: row.responsible || undefined,
    occurrenceProbability: row.a,
    severity: row.s,
    consequences: row.f,
  };
  if (CAPA_MAP[rowNo]) obj.capaNumbers = CAPA_MAP[rowNo];
  if (blueSet.has(rowNo)) {
    obj.addedInRevision = 1;
    obj.sourceNote = REV1_SOURCE_NOTE;
  }
  return obj;
});

// ── 5. Schreiben + Meta auf stdout ───────────────────────────────────────────

const meta = {
  source: SRC,
  extractedAt: statSync(SRC).mtime.toISOString(),
  blueDetection,
  blueRows,
  capaLinkedRows: Object.keys(CAPA_MAP).map(Number),
};

mkdirSync("scripts/out", { recursive: true });
const outPath = "scripts/out/risikoregister.json";
// NUR { risks } — exakt das Args-Objekt für `npx convex run risks:seedFromImport`
writeFileSync(outPath, JSON.stringify({ risks }, null, 2));
// Meta separat (gitignored) — darf NICHT an die Mutation übergeben werden
writeFileSync("scripts/out/risikoregister.meta.json", JSON.stringify(meta, null, 2));

console.log(`\nMeta (nur stdout + risikoregister.meta.json, NICHT im Seed-JSON):`);
console.log(JSON.stringify(meta, null, 2));

const capaCount = risks.filter((r) => r.capaNumbers).length;
const rev1Count = risks.filter((r) => r.addedInRevision === 1).length;
console.log(
  `\nOK: ${risks.length} Risiken, ${capaCount} mit CAPA-Verknüpfung, ${rev1Count} als "Neu in Rev. 1" markiert`
);
console.log(`Output: ${outPath}`);
