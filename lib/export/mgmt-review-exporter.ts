import { jsPDF } from "jspdf";
import { MGMT_REVIEW_SECTIONS } from "@/lib/types/enums";

export interface MgmtReviewData {
  year: number;
  reportingPeriod: string;
  participants?: string;
  companyNote?: string;
  sections: { key: string; autoData?: string; assessment?: string }[];
  overallAssessment?: string;
  measures: {
    description: string;
    responsible?: string;
    dueText?: string;
    effectivenessCheck?: string;
    capaNumber?: string;
  }[];
  improvements?: string;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export function buildMgmtReviewPdf(data: MgmtReviewData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const now = new Date();
  const stand = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > 277) { doc.addPage(); y = MARGIN; }
  }

  function heading(text: string) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(text, MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal").setFontSize(10);
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

  // ── Kopf ────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("Managementbewertung", MARGIN, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text(`FB 5.6.0 · Rev. 1 (App) · Stand ${stand}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setTextColor(0);
  y += 8;

  doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(80);
  doc.text("gemäß DIN EN ISO 13485 & MDR", MARGIN, y);
  doc.setTextColor(0).setFont("helvetica", "normal");
  y += 8;

  // ── 1. Allgemeine Angaben ────────────────────────────────────
  heading("1. Allgemeine Angaben");
  metaRow("Berichtszeitraum", data.reportingPeriod);
  metaRow("Teilnehmer", data.participants ?? "—");
  metaRow("Unternehmen", data.companyNote ?? "—");

  // ── 2. Eingaben ──────────────────────────────────────────────
  heading("2. Eingaben");

  for (const section of MGMT_REVIEW_SECTIONS) {
    const sectionData = data.sections.find((s) => s.key === section.key);
    ensureSpace(20);

    // Sub-heading
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(section.title, MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(10);

    if (sectionData?.autoData) {
      // Italic gray prefix + auto data
      doc.setFont("helvetica", "italic").setTextColor(100);
      const autoLines = doc.splitTextToSize(`Daten: ${sectionData.autoData}`, CONTENT_WIDTH);
      for (const line of autoLines) {
        ensureSpace(6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      doc.setFont("helvetica", "normal").setTextColor(0);
      y += 1;
    }

    // Assessment
    const assessmentText = sectionData?.assessment
      ? `Bewertung: ${sectionData.assessment}`
      : "Bewertung: —";
    prose(assessmentText);
    y += 2;
  }

  // ── 3. Gesamtbewertung ───────────────────────────────────────
  heading("3. Gesamtbewertung");
  prose(data.overallAssessment ?? "—");

  // ── 4. Maßnahmen ─────────────────────────────────────────────
  heading("4. Maßnahmen");
  if (data.measures.length === 0) {
    prose("Keine Maßnahmen erfasst.");
  }
  for (const measure of data.measures) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold").setFontSize(10);
    const descLines = doc.splitTextToSize(measure.description, CONTENT_WIDTH);
    for (const line of descLines) {
      ensureSpace(6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    doc.setFont("helvetica", "normal").setFontSize(9);
    // Build sub-line with only present fields
    const subParts: string[] = [];
    if (measure.responsible) subParts.push(`Verantwortlich: ${measure.responsible}`);
    if (measure.dueText) subParts.push(`Termin: ${measure.dueText}`);
    if (measure.effectivenessCheck) subParts.push(`Wirksamkeit: ${measure.effectivenessCheck}`);
    if (measure.capaNumber) subParts.push(`CAPA: ${measure.capaNumber}`);
    if (subParts.length > 0) {
      const subLine = subParts.join(" · ");
      const subLines = doc.splitTextToSize(subLine, CONTENT_WIDTH);
      doc.setTextColor(100);
      for (const line of subLines) {
        ensureSpace(5);
        doc.text(line, MARGIN, y);
        y += 4.5;
      }
      doc.setTextColor(0);
    }
    doc.setFontSize(10);
    y += 3;
  }

  // ── 5. Verbesserungen ────────────────────────────────────────
  heading("5. Verbesserungen");
  prose(data.improvements ?? "—");

  // ── Unterschriften ───────────────────────────────────────────
  ensureSpace(30);
  y += 12;
  doc.line(MARGIN, y, MARGIN + 70, y);
  doc.line(PAGE_WIDTH - MARGIN - 70, y, PAGE_WIDTH - MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Datum, Unterschrift QMB", MARGIN, y);
  doc.text("Datum, Unterschrift Geschäftsführung", PAGE_WIDTH - MARGIN - 70, y);

  // ── Fußzeile mit Seitenzahlen ────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100);
    doc.text("FB 5.6.0 Managementbewertung · Rev. 1 (App)", MARGIN, 290);
    doc.text(`Seite ${i} von ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

/** Browser-Download */
export function downloadMgmtReview(data: MgmtReviewData, fileName: string): void {
  buildMgmtReviewPdf(data).save(fileName);
}

/** Blob für das Einfrieren in Convex-Storage */
export function mgmtReviewBlob(data: MgmtReviewData): Blob {
  return buildMgmtReviewPdf(data).output("blob");
}
