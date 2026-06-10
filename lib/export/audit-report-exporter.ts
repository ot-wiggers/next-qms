import { jsPDF } from "jspdf";
import {
  AUDIT_RATING_LABELS, FINDING_CLASSIFICATION_LABELS,
  type AuditRating, type FindingClassification,
} from "@/lib/types/enums";

export interface AuditReportData {
  title: string;
  formNumber: string;          // "8.2.4"
  revision: string;            // z.B. "Rev. 1 (App)"
  auditTeam?: string;
  leadAuditorName?: string | null;
  basis?: string;
  location?: string;
  reportingPeriod?: string;
  auditDate?: number;
  templateVersion?: number;
  summaryResult?: string;
  chapterSummaries?: { chapter: string; summary: string }[];
  answers: { chapter: string; chapterTitle: string; rating?: string }[];
  findings: { chapter?: string; classification: string; description: string; capaNumber?: string }[];
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export function buildAuditReportPdf(data: AuditReportData): jsPDF {
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

  // Kopf mit FB-Kennung
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(`${data.formNumber} Auditbericht`, MARGIN, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text(`FB ${data.formNumber} · ${data.revision} · Stand ${stand}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setTextColor(0);
  y += 10;

  metaRow("Titel", data.title);
  metaRow("Leitender Auditor", data.leadAuditorName ?? "—");
  metaRow("Auditteam", data.auditTeam ?? "—");
  metaRow("Basis des Audits", data.basis ?? "—");
  metaRow("Standort", data.location ?? "—");
  metaRow("Berichtszeitraum", data.reportingPeriod ?? "—");
  metaRow("Auditdatum", data.auditDate ? new Date(data.auditDate).toLocaleDateString("de-DE") : "—");
  metaRow("Checklisten-Version", data.templateVersion ? `v${data.templateVersion}` : "—");
  y += 4;

  // Bewertungsübersicht
  heading("Bewertungsübersicht");
  const counts: Record<string, number> = {};
  for (const a of data.answers) {
    if (a.rating) counts[a.rating] = (counts[a.rating] ?? 0) + 1;
  }
  const total = data.answers.length;
  const rated = Object.values(counts).reduce((s, n) => s + n, 0);
  prose(
    `${rated} von ${total} Prüfpunkten bewertet: ` +
    (Object.entries(counts)
      .map(([r, n]) => `${AUDIT_RATING_LABELS[r as AuditRating] ?? r}: ${n}`)
      .join(" · ") || "keine Bewertungen")
  );

  // Zusammenfassendes Ergebnis
  if (data.summaryResult) {
    heading("Zusammenfassendes Ergebnis");
    prose(data.summaryResult);
  }

  // Abschnitte je Norm-Kapitel
  for (const cs of data.chapterSummaries ?? []) {
    heading(cs.chapter);
    prose(cs.summary);
  }

  // Findings
  heading(`Feststellungen (${data.findings.length})`);
  if (data.findings.length === 0) {
    prose("Keine Feststellungen.");
  }
  for (const f of data.findings) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold").setFontSize(10);
    const label = FINDING_CLASSIFICATION_LABELS[f.classification as FindingClassification] ?? f.classification;
    doc.text(
      `${label}${f.chapter ? ` · Kap. ${f.chapter}` : ""}${f.capaNumber ? ` · ${f.capaNumber}` : ""}`,
      MARGIN, y
    );
    y += 5;
    doc.setFont("helvetica", "normal");
    prose(f.description);
  }

  // Unterschriften
  ensureSpace(30);
  y += 12;
  doc.line(MARGIN, y, MARGIN + 70, y);
  doc.line(PAGE_WIDTH - MARGIN - 70, y, PAGE_WIDTH - MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Datum, Unterschrift Auditor/-in", MARGIN, y);
  doc.text("Datum, Unterschrift Geschäftsführung", PAGE_WIDTH - MARGIN - 70, y);

  // Fußzeile mit Seitenzahlen
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100);
    doc.text(`FB ${data.formNumber} Auditbericht · ${data.revision}`, MARGIN, 290);
    doc.text(`Seite ${i} von ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  }
  return doc;
}

/** Browser-Download */
export function downloadAuditReport(data: AuditReportData, fileName: string): void {
  buildAuditReportPdf(data).save(fileName);
}

/** Blob für das Einfrieren in Convex-Storage */
export function auditReportBlob(data: AuditReportData): Blob {
  return buildAuditReportPdf(data).output("blob");
}
