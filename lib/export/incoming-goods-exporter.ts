import { jsPDF } from "jspdf";
import {
  MDR_DUTY_QUESTIONS, STORAGE_FLAGS, INCOMING_RESULT_LABELS,
} from "@/lib/types/enums";

/** Datenform = Rückgabe von api.incomingGoods.getById */
export interface IncomingGoodsCheckData {
  locationName: string;
  checkDate: number;
  inspectorName?: string;
  manufacturer: string;
  productArea: string;
  deliveryDate?: number;
  duties: Record<string, boolean | undefined>;
  labeling: {
    produktName?: string; ceKennzeichnung?: boolean; herstellerName?: string;
    haendlerName?: string; importeursName?: string; bevollmaechtigten?: string;
  };
  identification: {
    hasRef?: boolean; ref?: string; hasLot?: boolean; lot?: string;
    hasSn?: boolean; sn?: string; hasUdiTraeger?: boolean; udiTraeger?: string;
    haltbarkeitsdatum?: string; herstelldatum?: string;
  };
  storage: Record<string, boolean | string | undefined>;
  custom: {
    isSonderanfertigung?: boolean; mdKennzeichnung?: boolean;
    nurKlinischePruefung?: boolean; sichereEntsorgung?: string;
  };
  result: "PASSED" | "FAILED";
  failureReason?: string;
  remarks?: string;
  signatureUrl?: string | null;
  attachments: Array<{ url: string | null }>;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

function yesNo(v: boolean | undefined): string {
  return v === true ? "Ja" : v === false ? "Nein" : "—";
}

function formatDe(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleDateString("de-DE") : "—";
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildIncomingGoodsPdf(data: IncomingGoodsCheckData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
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
  function row(label: string, value: string) {
    ensureSpace(8);
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", CONTENT_WIDTH - 70);
    doc.text(lines, MARGIN + 70, y);
    y += Math.max(5, lines.length * 4.5) + 1.5;
  }

  // Kopf
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("Wareneingangsprüfung", MARGIN, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text("MDR Art. 14 · AA 7.4.3 (App)", PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setTextColor(0);
  y += 10;

  heading("1. Stammdaten");
  row("Filiale", data.locationName);
  row("Prüfdatum", formatDe(data.checkDate));
  row("Prüfer/in", data.inspectorName ?? "—");
  row("Hersteller", data.manufacturer);
  row("Produktbereich", data.productArea);
  row("Lieferdatum", formatDe(data.deliveryDate));

  heading("2. Prüfpflichten nach Art. 14 MDR");
  for (const q of MDR_DUTY_QUESTIONS) {
    ensureSpace(10);
    const lines = doc.splitTextToSize(q.question, CONTENT_WIDTH - 14);
    doc.setFontSize(9);
    doc.text(lines, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.text(yesNo(data.duties[q.key]), PAGE_WIDTH - MARGIN, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += lines.length * 4.5 + 2;
  }
  doc.setFontSize(10);

  heading("3. Kennzeichnung (Anhang I 23.2 MDR)");
  row("CE-Kennzeichnung", yesNo(data.labeling.ceKennzeichnung));
  row("Name / Handelsname", data.labeling.produktName ?? "—");
  row("Hersteller", data.labeling.herstellerName ?? "—");
  row("Händler", data.labeling.haendlerName ?? "—");
  row("Importeur", data.labeling.importeursName ?? "—");
  row("Bevollmächtigter", data.labeling.bevollmaechtigten ?? "—");

  heading("4. Produktidentifikation");
  row("REF", `${yesNo(data.identification.hasRef)}  ${data.identification.ref ?? ""}`.trim());
  row("LOT", `${yesNo(data.identification.hasLot)}  ${data.identification.lot ?? ""}`.trim());
  row("SN", `${yesNo(data.identification.hasSn)}  ${data.identification.sn ?? ""}`.trim());
  row("UDI-Träger", `${yesNo(data.identification.hasUdiTraeger)}  ${data.identification.udiTraeger ?? ""}`.trim());
  row("Haltbarkeitsdatum", data.identification.haltbarkeitsdatum ?? "—");
  row("Herstelldatum", data.identification.herstelldatum ?? "—");

  heading("5. Lagerung / Handhabung");
  for (const f of STORAGE_FLAGS) {
    row(f.label, yesNo(data.storage[f.key] as boolean | undefined));
  }
  row("Warnhinweise", (data.storage.warnhinweise as string) ?? "—");
  row("Gebrauchshinweise", (data.storage.gebrauchshinweise as string) ?? "—");
  row("Hinweise für Patienten", (data.storage.patientHinweise as string) ?? "—");
  row("Aufbereitungszyklen", (data.storage.aufbereitungszyklen as string) ?? "—");
  row("Beschränkung Wiederverwendung", (data.storage.beschraenkungZyklen as string) ?? "—");

  heading("6. Sonderanfertigung");
  row("Sonderanfertigung", yesNo(data.custom.isSonderanfertigung));
  row("Kennzeichnung „MD“", yesNo(data.custom.mdKennzeichnung));
  row("Nur klinische Prüfung", yesNo(data.custom.nurKlinischePruefung));
  row("Sichere Entsorgung", data.custom.sichereEntsorgung ?? "—");

  heading("7. Stichproben-Kontrolle");
  row("Ergebnis", INCOMING_RESULT_LABELS[data.result]);
  if (data.failureReason) row("Begründung", data.failureReason);
  if (data.remarks) row("Bemerkungen", data.remarks);
  row("Anhänge", `${data.attachments.length}`);

  // Unterschrift
  if (data.signatureUrl) {
    const dataUrl = await loadImageDataUrl(data.signatureUrl);
    if (dataUrl) {
      ensureSpace(40);
      doc.setFont("helvetica", "bold").setFontSize(9);
      doc.text("Unterschrift Prüfer/in", MARGIN, y);
      y += 3;
      doc.addImage(dataUrl, "PNG", MARGIN, y, 66, 27);
      y += 30;
      doc.setFont("helvetica", "normal");
    }
  }

  // Fußzeile
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100);
    doc.text("Wareneingangsprüfung MDR Art. 14 · erstellt mit QMS (App)", MARGIN, 290);
    doc.text(`Seite ${i} von ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

/** Browser-Download (async wegen Unterschrift-Nachladen) */
export async function downloadIncomingGoodsPdf(
  data: IncomingGoodsCheckData,
  fileName: string,
): Promise<void> {
  const doc = await buildIncomingGoodsPdf(data);
  doc.save(fileName);
}
