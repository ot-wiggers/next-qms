import { jsPDF } from "jspdf";

export interface AuditPlanData {
  year: number;
  rows: Array<{
    area: string;
    auditTeam?: string;
    affectedAreas?: string;
    plannedMonths: number[];  // 1-12
    istMonth: number | null;  // abgeleitet aus auditDate
  }>;
  organizationName?: string;
}

// ── Landscape A4: 297 × 210 mm ───────────────────────────────────────────────
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;

// Spaltenbreiten (mm)
const COL_THEMA = 55;
const COL_AUDITOR = 30;
const COL_BEREICHE = 55;
const COL_LABEL = 14;   // "SOLL" / "IST"
const COL_MONTH = 10;   // je Monat × 12 = 120 mm
// Gesamtbreite: 55+30+55+14+120 = 274 mm → passt in 297-2×10=277 mm ✓

const ROW_HEADER = 8;   // Kopfzeile der Matrix
const ROW_PAIR = 6;     // eine SOLL-Zeile bzw. IST-Zeile je Theme

const GRAY_HEADER = 220;  // RGB-Grau für Kopfzeilen-Fill
const GRAY_GRID   = 160;  // Gitter-Linie

// X-Positionen der Spalten (links)
const X_THEMA    = MARGIN;
const X_AUDITOR  = X_THEMA   + COL_THEMA;
const X_BEREICHE = X_AUDITOR + COL_AUDITOR;
const X_LABEL    = X_BEREICHE + COL_BEREICHE;
const X_MONTHS   = X_LABEL   + COL_LABEL;

function xMonth(m: number): number {          // m: 1-12
  return X_MONTHS + (m - 1) * COL_MONTH;
}

export function buildAuditPlanPdf(data: AuditPlanData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  const stand = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  // ── Hilfsfunktionen ────────────────────────────────────────────────────────

  /** Neue Seite anlegen und danach die Matrix-Kopfzeile neu zeichnen. */
  function addPageWithHeader(): void {
    doc.addPage();
    drawMatrixHeader(MARGIN + 20); // 20 mm Platz für kleinen Seitentitel
  }

  /** Zeichnet die Tabellenüberschriftszeile ab y-Position. Gibt neues y zurück. */
  function drawMatrixHeader(y: number): number {
    // Gefüllter Hintergrund
    doc.setFillColor(GRAY_HEADER, GRAY_HEADER, GRAY_HEADER);
    doc.rect(X_THEMA, y, COL_THEMA + COL_AUDITOR + COL_BEREICHE + COL_LABEL + COL_MONTH * 12, ROW_HEADER, "F");

    // Beschriftungen
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(0);
    const labelY = y + ROW_HEADER / 2 + 2;

    doc.text("Thema / Auditbereich", X_THEMA + 1, labelY);
    doc.text("Auditor/en", X_AUDITOR + 1, labelY);
    doc.text("Betroffene Bereiche", X_BEREICHE + 1, labelY);
    doc.text("SOLL/IST", X_LABEL + 1, labelY);

    // Monats-Header 1..12
    for (let m = 1; m <= 12; m++) {
      doc.text(String(m), xMonth(m) + COL_MONTH / 2, labelY, { align: "center" });
    }

    doc.setFont("helvetica", "normal");

    // Gitter der Kopfzeile zeichnen
    drawRowBorder(y, ROW_HEADER);

    return y + ROW_HEADER;
  }

  /** Horizontale Linie + vertikale Spaltentrennlinien für eine Zeile. */
  function drawRowBorder(y: number, h: number): void {
    doc.setDrawColor(GRAY_GRID).setLineWidth(0.2);
    // Untere Linie
    doc.line(X_THEMA, y + h, X_MONTHS + COL_MONTH * 12, y + h);
    // Spalten-Trennlinien
    for (const x of [X_THEMA, X_AUDITOR, X_BEREICHE, X_LABEL, X_MONTHS + COL_MONTH * 12]) {
      doc.line(x, y, x, y + h);
    }
    // Monatstrennlinien
    for (let m = 1; m <= 12; m++) {
      doc.line(xMonth(m), y, xMonth(m), y + h);
    }
    doc.line(xMonth(12) + COL_MONTH, y, xMonth(12) + COL_MONTH, y + h);
  }

  /** Zeichnet ein "x" zentriert in der Monatsspalte. */
  function drawX(xLeft: number, yTop: number, h: number): void {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(0);
    doc.text("x", xLeft + COL_MONTH / 2, yTop + h / 2 + 2, { align: "center" });
    doc.setFont("helvetica", "normal");
  }

  // ── Dokument-Header (Seitentitel) ─────────────────────────────────────────
  let y = MARGIN;

  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0);
  doc.text(`8.2.4 Auditplan ${data.year}`, MARGIN, y + 5);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text(
    `FB 8.2.4 · Rev. (App) · Stand ${stand}`,
    PAGE_W - MARGIN,
    y + 5,
    { align: "right" },
  );
  doc.setTextColor(0);
  y += 10;

  if (data.organizationName) {
    doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(80);
    doc.text(data.organizationName, MARGIN, y + 4);
    doc.setFont("helvetica", "normal").setTextColor(0);
    y += 7;
  } else {
    y += 2;
  }

  // ── Matrix-Kopfzeile ──────────────────────────────────────────────────────
  // Obere Rahmenlinie der gesamten Tabelle
  doc.setDrawColor(GRAY_GRID).setLineWidth(0.2);
  doc.line(X_THEMA, y, X_MONTHS + COL_MONTH * 12, y);

  y = drawMatrixHeader(y);

  // ── Datenzeilen ───────────────────────────────────────────────────────────
  const FOOTER_RESERVE = 18; // Platz für Fußzeile + Hinweis

  for (const row of data.rows) {
    const pairHeight = ROW_PAIR * 2; // SOLL + IST

    // Seitenumbruch-Guard
    if (y + pairHeight + FOOTER_RESERVE > PAGE_H) {
      addPageWithHeader();
      // y wird im neuen drawMatrixHeader implizit gesetzt – wir müssen es zurücksetzen
      // addPageWithHeader ruft drawMatrixHeader(MARGIN + 20) auf und gibt kein y zurück;
      // daher berechnen wir y hier manuell:
      y = MARGIN + 20 + ROW_HEADER;
    }

    const ySoll = y;
    const yIst  = y + ROW_PAIR;

    // ── Thema (Zelltext nur auf SOLL-Zeile, Box umfasst beide Zeilen) ────────
    const themaLines = doc.splitTextToSize(row.area, COL_THEMA - 2);
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(0);
    doc.text(themaLines, X_THEMA + 1, ySoll + ROW_PAIR / 2 + 1.5);

    // ── Auditor/en ────────────────────────────────────────────────────────────
    const auditorLines = doc.splitTextToSize(row.auditTeam ?? "—", COL_AUDITOR - 2);
    doc.text(auditorLines, X_AUDITOR + 1, ySoll + ROW_PAIR / 2 + 1.5);

    // ── Betroffene Bereiche ───────────────────────────────────────────────────
    const bereicheLines = doc.splitTextToSize(row.affectedAreas ?? "—", COL_BEREICHE - 2);
    doc.text(bereicheLines, X_BEREICHE + 1, ySoll + ROW_PAIR / 2 + 1.5);

    // ── Label-Spalte: "SOLL" / "IST" ─────────────────────────────────────────
    doc.setFontSize(6).setTextColor(80);
    doc.text("SOLL", X_LABEL + COL_LABEL / 2, ySoll + ROW_PAIR / 2 + 1.5, { align: "center" });
    doc.text("IST",  X_LABEL + COL_LABEL / 2, yIst  + ROW_PAIR / 2 + 1.5, { align: "center" });
    doc.setTextColor(0);

    // ── SOLL-Kreuze ───────────────────────────────────────────────────────────
    for (const m of row.plannedMonths) {
      if (m >= 1 && m <= 12) drawX(xMonth(m), ySoll, ROW_PAIR);
    }

    // ── IST-Kreuz ─────────────────────────────────────────────────────────────
    if (row.istMonth !== null && row.istMonth >= 1 && row.istMonth <= 12) {
      drawX(xMonth(row.istMonth), yIst, ROW_PAIR);
    }

    // ── Gitter für beide Zeilen ───────────────────────────────────────────────
    // SOLL-Zeile
    drawRowBorder(ySoll, ROW_PAIR);
    // IST-Zeile
    drawRowBorder(yIst, ROW_PAIR);

    // Linke Außenkante der zusammengesetzten Zellen (Thema / Auditor / Bereiche)
    // wird durch drawRowBorder bereits mit den vertikalen Linien gedeckt,
    // aber der mittlere Teiler zwischen SOLL/IST soll in den ersten 3 Spalten
    // nicht erscheinen — daher die mittlere H-Linie dort übermalen (weiß).
    doc.setDrawColor(255).setLineWidth(0.2);
    for (const [xL, w] of [
      [X_THEMA,    COL_THEMA],
      [X_AUDITOR,  COL_AUDITOR],
      [X_BEREICHE, COL_BEREICHE],
    ] as [number, number][]) {
      doc.line(xL + 0.1, ySoll + ROW_PAIR, xL + w - 0.1, ySoll + ROW_PAIR);
    }
    doc.setDrawColor(GRAY_GRID);

    y += pairHeight;
  }

  // Untere Außenkante
  doc.setDrawColor(GRAY_GRID).setLineWidth(0.3);
  doc.line(X_THEMA, y, X_MONTHS + COL_MONTH * 12, y);

  // ── Hinweis unter der Tabelle ─────────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(100);
  doc.text(
    "IST abgeleitet aus dem tatsächlichen Auditdatum in der App.",
    MARGIN,
    y,
  );
  doc.setFont("helvetica", "normal").setTextColor(0);

  // ── Fußzeile (alle Seiten) ────────────────────────────────────────────────
  const exportDate = now.toLocaleDateString("de-DE");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setTextColor(100);
    doc.text(
      `FB 8.2.4 Auditplan · erstellt ${exportDate} (App)`,
      MARGIN,
      PAGE_H - 4,
    );
    doc.text(
      `Seite ${i} von ${pages}`,
      PAGE_W - MARGIN,
      PAGE_H - 4,
      { align: "right" },
    );
    doc.setTextColor(0);
  }

  return doc;
}

/** Browser-Download */
export function downloadAuditPlan(data: AuditPlanData, fileName: string): void {
  buildAuditPlanPdf(data).save(fileName);
}
