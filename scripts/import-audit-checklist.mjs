// Liest die Auditcheckliste-xlsx und erzeugt scripts/out/audit-checklist-v5.json
// Spalten lt. FB 8.2.4: Kap. | Überschrift | Prüfpunkte | Bewertung | Nachweis | Stichprobe | Gespräch mit | Bemerkungen
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const SRC = process.argv[2];
if (!SRC) {
  console.error("Usage: node scripts/import-audit-checklist.mjs <pfad-zur-xlsx>");
  process.exit(1);
}

const wb = XLSX.readFile(SRC);
const items = [];
const answers = [];
const chapterRe = /^\d+(\.\d+)*$/;

for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  for (const row of rows) {
    const [chapter, chapterTitle, requirements, rating, evidence, sample, interviewedWith, comments] =
      row.map((c) => String(c).trim());
    // Nur echte Prüfpunkt-Zeilen: numerisches Kapitel + Prüfpunkte-Text
    if (!chapterRe.test(chapter) || !requirements) continue;
    items.push({ chapter, chapterTitle, requirements });
    answers.push({ chapter, chapterTitle, requirements, rating, evidence, sample, interviewedWith, comments });
  }
}

const RATING_MAP = {
  "Konform": "KONFORM",
  "Abweichung": "ABWEICHUNG",
  "Feststellung": "FESTSTELLUNG",
  "Empfehlung": "EMPFEHLUNG",
  "nicht anwendbar": "NICHT_ANWENDBAR",
};
for (const a of answers) {
  a.rating = RATING_MAP[a.rating] ?? undefined;
}

mkdirSync("scripts/out", { recursive: true });
writeFileSync(
  "scripts/out/audit-checklist-v5.json",
  JSON.stringify(
    {
      template: {
        name: "Auditcheckliste 2026",
        formNumber: "8.2.4",
        version: 5,
        basis:
          "DIN EN ISO 13485:2021, MDR (EU) 2017/745, QM-Handbuch Rev. 5 (05.2025), VA, AA, FB gem. FB 4.2.4",
        items,
      },
      answers,
    },
    null,
    2
  )
);
console.log(`OK: ${items.length} Prüfpunkte extrahiert -> scripts/out/audit-checklist-v5.json`);
