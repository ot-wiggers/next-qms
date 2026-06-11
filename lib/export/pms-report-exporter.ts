import { jsPDF } from "jspdf";

export interface PmsReportData {
  reportingPeriod: string;
  revision: number;
  standText?: string;          // z. B. "01.2026"
  productGroup: string;
  status: string;              // "DRAFT" | "APPROVED"
  approvedAt?: number;         // Unix-Timestamp (ms) – optional Freigabedatum
  organizationName?: string;   // entspricht companyNote im Mgmt-Review-Exporter
  sections: Array<{
    key: string;
    title: string;
    autoData?: string;
    text?: string;
  }>;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export function buildPmsReportPdf(data: PmsReportData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // ── Layout-Helfer (identisch mit mgmt-review-exporter.ts) ───────────────

  function ensureSpace(needed: number) {
    if (y + needed > 277) { doc.addPage(); y = MARGIN; }
  }

  function prose(text: string) {
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 2;
  }

  function metaRow(label: string, value: string) {
    ensureSpace(8);
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", CONTENT_WIDTH - 55);
    doc.text(lines, MARGIN + 55, y);
    y += Math.max(5, lines.length * 4.5) + 1.5;
  }

  // ── Kopf ────────────────────────────────────────────────────────────────
  const revLabel = `Rev. ${data.revision} (App)`;
  const standLabel = data.standText ? ` · Stand ${data.standText}` : "";
  const statusLabel = data.status === "DRAFT" ? " · Status: Entwurf" : "";

  // Titel (mehrzeilig falls nötig) – links, Bold 13
  doc.setFont("helvetica", "bold").setFontSize(13);
  const titleLines = doc.splitTextToSize(
    "Bericht zur Überwachung nach dem Inverkehrbringen (PMS-Bericht) gemäß MDR Art. 85",
    CONTENT_WIDTH - 55,
  );
  doc.text(titleLines, MARGIN, y);

  // Rechts: FB-Kennung + Revision + Stand + Status (Normal 8, grau)
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text(
    `FB 7 1 · ${revLabel}${standLabel}${statusLabel}`,
    PAGE_WIDTH - MARGIN,
    y,
    { align: "right" },
  );
  doc.setTextColor(0);

  y += titleLines.length * 6 + 2;

  // Berichtszeitraum + Produktgruppe direkt unter dem Titel (italic, grau)
  doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(80);
  doc.text(`Berichtszeitraum: ${data.reportingPeriod}  ·  Produktgruppe: ${data.productGroup}`, MARGIN, y);
  doc.setTextColor(0).setFont("helvetica", "normal");
  y += 8;

  // ── Allgemeine Angaben ───────────────────────────────────────────────────
  ensureSpace(10);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Allgemeine Angaben", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(10);
  metaRow("Berichtszeitraum", data.reportingPeriod);
  metaRow("Produktgruppe", data.productGroup);
  if (data.organizationName) {
    metaRow("Organisation", data.organizationName);
  }

  // ── Abschnitte ───────────────────────────────────────────────────────────
  for (let i = 0; i < data.sections.length; i++) {
    const section = data.sections[i];
    ensureSpace(20);

    // Titel wird unverändert übernommen – er enthält bereits die Nummerierung (z. B. "1. Ziel des PMS")
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(section.title, MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(10);

    if (section.autoData) {
      // Subtiler Block "Daten aus der App:" – kursiv, grau, kleinere Schrift
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(100);
      const autoLines = doc.splitTextToSize(
        `Daten aus der App: ${section.autoData}`,
        CONTENT_WIDTH,
      );
      for (const line of autoLines) {
        ensureSpace(6);
        doc.text(line, MARGIN, y);
        y += 4.5;
      }
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0);
      y += 1;
    }

    if (section.text) {
      prose(section.text);
    } else {
      prose("—");
    }
    y += 2;
  }

  // ── Unterschriften ───────────────────────────────────────────────────────
  ensureSpace(30);
  y += 12;
  doc.line(MARGIN, y, MARGIN + 70, y);
  doc.line(PAGE_WIDTH - MARGIN - 70, y, PAGE_WIDTH - MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Datum, Unterschrift QMB", MARGIN, y);
  doc.text("Datum, Unterschrift Geschäftsführung", PAGE_WIDTH - MARGIN - 70, y);

  // ── Fußzeile mit Seitenzahlen ────────────────────────────────────────────
  const approvedLabel = data.approvedAt
    ? `· Freigabe: ${new Date(data.approvedAt).toLocaleDateString("de-DE")}`
    : "";

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100);
    doc.text(`FB 7 1 PMS-Bericht · Rev. ${data.revision} (App) ${approvedLabel}`, MARGIN, 290);
    doc.text(`Seite ${i} von ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

/** Browser-Download */
export function downloadPmsReport(data: PmsReportData, fileName: string): void {
  buildPmsReportPdf(data).save(fileName);
}

/** Blob für das Einfrieren in Convex-Storage */
export function pmsReportBlob(data: PmsReportData): Blob {
  return buildPmsReportPdf(data).output("blob");
}
