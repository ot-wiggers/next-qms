// Liest die Schulungsbedarfsmatrix.xlsx und erzeugt scripts/out/schulungsmatrix.json
// Sheets: "Schulungsbedarfsmatrix" (Matrix), "Stand & Lücken" (Stelleninhaber/Status),
//         "Nachfolge & Besetzung" (Succession-Felder)
//
// Symbole: ●●● → REQUIRED_DEEP, ●● → REQUIRED_BASIC, ● → RECOMMENDED,
//           ○ → ON_DEMAND, — / leer → kein Eintrag
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const SRC =
  process.argv[2] ??
  new URL("../PDF/6%202%200%20Schulungsbedarfsmatrix.xlsx", import.meta.url).pathname.replace(/%20/g, " ");

const wb = XLSX.readFile(SRC);

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Wandelt Rohzelle in RequirementLevel-String oder null */
function cellToLevel(raw) {
  const s = String(raw ?? "").trim();
  if (s === "●●●") return "REQUIRED_DEEP";  // ●●●
  if (s === "●●") return "REQUIRED_BASIC";       // ●●
  if (s === "●") return "RECOMMENDED";                // ●
  if (s === "○") return "ON_DEMAND";                  // ○
  return null; // — oder leer
}

/** Extrahiert Cluster-Buchstabe aus Zeile wie "A. QM & Regulatorik" */
function parseCluster(raw) {
  const m = String(raw ?? "").trim().match(/^([A-G])\./);
  return m ? m[1] : null;
}

/**
 * Fuzzy-Match: sucht in einer Map (normalisierter Name → Wert) nach key.
 * Strategie: exakt → startsWith → includes
 */
function fuzzyFind(map, search) {
  const norm = (s) => s.toLowerCase().replace(/[­​ \s\/\-\.]/g, "");
  const key = norm(search);
  // Exakt
  for (const [k, v] of map) {
    if (norm(k) === key) return v;
  }
  // StartsWith
  for (const [k, v] of map) {
    if (norm(k).startsWith(key) || key.startsWith(norm(k))) return v;
  }
  // Includes
  for (const [k, v] of map) {
    if (norm(k).includes(key) || key.includes(norm(k))) return v;
  }
  return undefined;
}

// ── 1. Hauptblatt: Schulungsbedarfsmatrix ────────────────────────────────────

const matrixSheet = wb.Sheets["Schulungsbedarfsmatrix"];
const matrixRows = XLSX.utils.sheet_to_json(matrixSheet, {
  header: 1,
  defval: "",
});

// Header-Zeile (Zeile 0): Funktionsnamen ab Spalte 4
const funcHeaderNames = matrixRows[0].slice(4, 13).map((s) => String(s).trim());

const functions = []; // { name, sortOrder }
for (let i = 0; i < funcHeaderNames.length; i++) {
  functions.push({ name: funcHeaderNames[i], sortOrder: i + 1 });
}

// Themen + Requirements extrahieren (Zeilen 1–34)
const topics = [];
const requirements = [];

let currentCluster = "";
let topicSortCounters = {}; // cluster → counter

for (let rowIdx = 1; rowIdx < matrixRows.length; rowIdx++) {
  const row = matrixRows[rowIdx];
  const col0 = String(row[0] ?? "").trim();
  const col1 = String(row[1] ?? "").trim();
  const col2 = String(row[2] ?? "").trim();
  const col3 = String(row[3] ?? "").trim();

  // Cluster-Zeile: col0 nicht leer, col1 leer
  if (col0 && !col1) {
    const cluster = parseCluster(col0);
    if (cluster) {
      currentCluster = cluster;
      if (!topicSortCounters[cluster]) topicSortCounters[cluster] = 0;
    }
    continue;
  }

  // Themen-Zeile: col1 nicht leer
  if (col1 && currentCluster) {
    topicSortCounters[currentCluster] = (topicSortCounters[currentCluster] ?? 0) + 1;
    const topicIndex = topics.length;
    topics.push({
      cluster: currentCluster,
      title: col1,
      frequency: col2 || undefined,
      provider: col3 || undefined,
      sortOrder: topicSortCounters[currentCluster],
    });

    // Requirements je Funktion (cols 4–12)
    for (let j = 0; j < 9; j++) {
      const level = cellToLevel(row[4 + j]);
      if (level) {
        requirements.push({
          functionIndex: j,
          topicIndex,
          level,
        });
      }
    }
  }
}

// ── 2. Stand & Lücken: Stelleninhaber + Besetzungsstatus ────────────────────

const standSheet = wb.Sheets["Stand & Lücken"];
const standRows = XLSX.utils.sheet_to_json(standSheet, {
  header: 1,
  defval: "",
});

// Funktionszeilen beginnen ab Zeile 4 (Row 3 = Header)
// Spalten: Funktion | Stelleninhaber | Besetzungsstatus | Anzahl Pflichtschulungen | …
const staffingMap = new Map(); // Funktionsname → { holder, staffingStatus }

for (let i = 4; i <= 12; i++) {
  const row = standRows[i];
  if (!row) continue;
  const name = String(row[0] ?? "").trim();
  const holder = String(row[1] ?? "").trim();
  const statusText = String(row[2] ?? "").trim().toLowerCase();

  if (!name) continue;

  let staffingStatus;
  if (statusText === "besetzt") {
    staffingStatus = "FILLED";
  } else if (statusText.includes("intern")) {
    staffingStatus = "INTERNAL_DEVELOP";
  } else if (statusText.includes("extern")) {
    staffingStatus = "EXTERNAL_HIRE";
  } else if (statusText.includes("klärung") || statusText.includes("klarung")) {
    staffingStatus = "IN_CLARIFICATION";
  } else if (statusText.includes("informell")) {
    staffingStatus = "INTERNAL_DEVELOP";
  } else {
    staffingStatus = "IN_CLARIFICATION";
  }

  staffingMap.set(name, {
    holder: holder || undefined,
    staffingStatus,
    rawStatus: String(row[2] ?? "").trim(),
  });
}

// ── 3. Nachfolge & Besetzung: Succession-Felder ─────────────────────────────

const nachfolgeSheet = wb.Sheets["Nachfolge & Besetzung"];
const nachfolgeRows = XLSX.utils.sheet_to_json(nachfolgeSheet, {
  header: 1,
  defval: "",
});

// Zeilen ab Row 4 (Row 3 = Header)
// Spalten: Funktion | Besetzungsweg | Aktueller Stand | Konkrete nächste Schritte | Verantwortlich | Termin | Status
const successionMap = new Map();

for (let i = 4; i < nachfolgeRows.length; i++) {
  const row = nachfolgeRows[i];
  if (!row) continue;
  const name = String(row[0] ?? "").trim();
  if (!name) continue;

  successionMap.set(name, {
    successionPath: String(row[1] ?? "").trim() || undefined,
    successionState: String(row[2] ?? "").trim() || undefined,
    successionNextSteps: String(row[3] ?? "").trim() || undefined,
    successionResponsible: String(row[4] ?? "").trim() || undefined,
    successionDueText: String(row[5] ?? "").trim() || undefined,
    successionStatus: String(row[6] ?? "").trim() || undefined,
  });
}

// ── 4. Zusammenführen: functions anreichern ──────────────────────────────────

const enrichedFunctions = functions.map((fn) => {
  const staffing = fuzzyFind(staffingMap, fn.name);
  const succession = fuzzyFind(successionMap, fn.name);

  const obj = {
    name: fn.name,
    sortOrder: fn.sortOrder,
    staffingStatus: staffing?.staffingStatus ?? "IN_CLARIFICATION",
  };

  if (staffing?.holder) obj.holder = staffing.holder;
  if (succession?.successionPath) obj.successionPath = succession.successionPath;
  if (succession?.successionState) obj.successionState = succession.successionState;
  if (succession?.successionNextSteps) obj.successionNextSteps = succession.successionNextSteps;
  if (succession?.successionResponsible) obj.successionResponsible = succession.successionResponsible;
  if (succession?.successionDueText) obj.successionDueText = succession.successionDueText;
  if (succession?.successionStatus) obj.successionStatus = succession.successionStatus;

  return obj;
});

// ── 5. Validierung ────────────────────────────────────────────────────────────

if (enrichedFunctions.length !== 9) {
  console.error(`FEHLER: Erwartet 9 Funktionen, gefunden ${enrichedFunctions.length}`);
  process.exit(1);
}

const validLevels = new Set(["REQUIRED_DEEP", "REQUIRED_BASIC", "RECOMMENDED", "ON_DEMAND"]);
for (const req of requirements) {
  if (req.functionIndex < 0 || req.functionIndex >= 9) {
    console.error(`FEHLER: Ungültiger functionIndex ${req.functionIndex}`);
    process.exit(1);
  }
  if (req.topicIndex < 0 || req.topicIndex >= topics.length) {
    console.error(`FEHLER: Ungültiger topicIndex ${req.topicIndex}`);
    process.exit(1);
  }
  if (!validLevels.has(req.level)) {
    console.error(`FEHLER: Ungültiges Level "${req.level}"`);
    process.exit(1);
  }
}

// ── 6. JSON schreiben ─────────────────────────────────────────────────────────

mkdirSync("scripts/out", { recursive: true });
const outPath = "scripts/out/schulungsmatrix.json";
writeFileSync(outPath, JSON.stringify({ functions: enrichedFunctions, topics, requirements }, null, 2));

// ── 7. Zusammenfassung ────────────────────────────────────────────────────────

// Topics per cluster
const topicsByCluster = {};
for (const t of topics) {
  topicsByCluster[t.cluster] = (topicsByCluster[t.cluster] ?? 0) + 1;
}

// Mandatory counts per function
const expected = [12, 19, 18, 20, 17, 16, 12, 9, 12];
const mandatoryCounts = new Array(9).fill(0);
for (const req of requirements) {
  if (req.level === "REQUIRED_DEEP" || req.level === "REQUIRED_BASIC") {
    mandatoryCounts[req.functionIndex]++;
  }
}

console.log(`\nOK: ${topics.length} Schulungsthemen, ${requirements.length} Anforderungen, 9 Funktionen`);
console.log(`\nThemen je Cluster:`);
for (const [cluster, count] of Object.entries(topicsByCluster).sort()) {
  console.log(`  Cluster ${cluster}: ${count} Themen`);
}

console.log(`\nPflicht-Schulungen je Funktion (●●● + ●●):`);
let allMatch = true;
for (let j = 0; j < 9; j++) {
  const match = mandatoryCounts[j] === expected[j];
  if (!match) allMatch = false;
  const status = match ? "✓" : `✗ (erwartet ${expected[j]})`;
  console.log(`  ${enrichedFunctions[j].name}: ${mandatoryCounts[j]} ${status}`);
}

console.log(`\nBesetzungsstatus je Funktion:`);
for (const fn of enrichedFunctions) {
  console.log(`  ${fn.name}: ${fn.staffingStatus}${fn.holder ? ` (${fn.holder})` : ""}`);
}

if (!allMatch) {
  console.error("\nFEHLER: Pflicht-Schulungen-Zählungen stimmen nicht mit Erwartungswerten überein!");
  process.exit(1);
}

console.log(`\nAlle Zählungen korrekt. Output: ${outPath}`);
