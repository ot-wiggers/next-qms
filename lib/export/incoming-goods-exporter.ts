import { jsPDF } from "jspdf";
import { MDR_DUTY_QUESTIONS } from "@/lib/types/enums";

// ============================================================
// Wareneingangsprüfung-PDF im Original-Layout der Eurocom-Checkliste
// (portiert aus wareneingang-app/src/utils/pdfGenerator.ts):
// blauer Kopfbanner mit Checkliste-Kreis, blaue Abschnittsbalken,
// Checkbox-Tabelle, Symbol-Icons, REF/LOT/SN/UDI-Kacheln, Eurocom-Footer.
// Icons liegen unter public/icons/wareneingang/ und werden zur Laufzeit
// per Canvas von SVG nach PNG gewandelt (Browser-only, wie das Original).
// ============================================================

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

// Eurocom-Farben (Original)
const COLORS = {
  primary: "#005CA9",
  text: "#333333",
  mediumGray: "#CCCCCC",
  white: "#FFFFFF",
  border: "#E0E0E0",
};

const ICON_BASE = "/icons/wareneingang";

/** SVG laden und via Canvas nach PNG-DataURL wandeln (Original-Mechanik) */
async function loadSvgAsImage(svgPath: string): Promise<string | null> {
  try {
    const response = await fetch(svgPath);
    if (!response.ok) return null;
    const svgText = await response.text();

    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const timeout = setTimeout(() => resolve(null), 5000);
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          canvas.width = 200;
          canvas.height = 200;
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, 200, 200);
          }
          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

/** Icon einfügen — Fallback: blaues Quadrat (Original-Mechanik) */
function addIcon(doc: jsPDF, iconData: string | null, x: number, y: number, size = 6): void {
  if (!iconData || !iconData.startsWith("data:image")) {
    doc.setFillColor(0, 95, 169);
    doc.rect(x, y - 3, size, size, "F");
    doc.setLineWidth(0.3);
    doc.setDrawColor(255, 255, 255);
    doc.rect(x + 0.5, y - 2.5, size - 1, size - 1);
    return;
  }
  try {
    doc.addImage(iconData, "PNG", x, y - 3, size, size);
  } catch {
    doc.setFillColor(0, 95, 169);
    doc.rect(x, y - 3, size, size, "F");
  }
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Konnte Bildabmessungen nicht ermitteln"));
    img.src = dataUrl;
  });
}

function formatDe(ts: number | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

async function loadUrlAsDataUrl(url: string): Promise<{ dataUrl: string; type: string; size: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    return { dataUrl, type: blob.type, size: blob.size };
  } catch {
    return null;
  }
}

function addWrappedText(
  doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5,
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string, index: number) => {
    doc.text(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

export async function buildIncomingGoodsPdf(data: IncomingGoodsCheckData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Icons laden
  const icons = {
    ce: await loadSvgAsImage(`${ICON_BASE}/ce.svg`),
    hersteller: await loadSvgAsImage(`${ICON_BASE}/hersteller.svg`),
    haendler: await loadSvgAsImage(`${ICON_BASE}/haendler.svg`),
    importeur: await loadSvgAsImage(`${ICON_BASE}/importeur.svg`),
    bevollmaechtigten: await loadSvgAsImage(`${ICON_BASE}/bevollmaechtigten.svg`),
    mhd: await loadSvgAsImage(`${ICON_BASE}/mhd.svg`),
    herstelldatum: await loadSvgAsImage(`${ICON_BASE}/herstelldatum.svg`),
    trockenLagern: await loadSvgAsImage(`${ICON_BASE}/trocken-lagern.svg`),
    sonnenlicht: await loadSvgAsImage(`${ICON_BASE}/vor-sonnenlicht-schuetzen.svg`),
    zerbrechlich: await loadSvgAsImage(`${ICON_BASE}/zerbrechlich.svg`),
    temperatur: await loadSvgAsImage(`${ICON_BASE}/temperaturbegrenzung.svg`),
    luftfeuchte: await loadSvgAsImage(`${ICON_BASE}/luftfeuchte.svg`),
    warnhinweis: await loadSvgAsImage(`${ICON_BASE}/warnhinweis.svg`),
    entsorgung: await loadSvgAsImage(`${ICON_BASE}/entsorgung.svg`),
    einmalgebrauch: await loadSvgAsImage(`${ICON_BASE}/einmalgebrauch.svg`),
    mehrfachanwendung: await loadSvgAsImage(`${ICON_BASE}/mehrfachanwendung.svg`),
  };

  // ========== HEADER (blauer Banner mit Checkliste-Kreis + eurocom) ==========
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 60, "F");

  doc.setFillColor(COLORS.white);
  doc.circle(40, 30, 25, "F");

  // Punktmuster im Kreis
  doc.setFillColor(230, 230, 230);
  for (let i = 0; i < 15; i++) {
    for (let j = 0; j < 15; j++) {
      const x = 20 + i * 2.5;
      const y = 10 + j * 2.5;
      const distance = Math.sqrt(Math.pow(x - 40, 2) + Math.pow(y - 30, 2));
      if (distance < 23) {
        doc.circle(x, y, 0.3, "F");
      }
    }
  }

  doc.setFillColor(COLORS.primary);
  doc.rect(20, 15, 50, 12, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Checkliste", 25, 23);

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Wareneingang", 25, 32);

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("eurocom", pageWidth - margin - 45, 25);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("• WIR • ENTWICKELN • GESUNDHEIT •", pageWidth - margin - 45, 30);

  // ========== STAMMDATEN ==========
  yPos = 65;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.primary);
  doc.text("Hersteller", margin, yPos);
  doc.text("Produktbereich", margin + 70, yPos);
  doc.text("Lieferdatum", margin + 140, yPos);

  yPos += 1;
  doc.setLineWidth(0.5);
  doc.setDrawColor(COLORS.primary);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  doc.text(data.manufacturer || "", margin, yPos);
  doc.text(data.productArea || "", margin + 70, yPos);
  doc.text(formatDe(data.deliveryDate), margin + 140, yPos);

  // Zweite Zeile: Filiale + Prüfer + Prüfdatum (QMS-Ergänzung im gleichen Stil)
  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.primary);
  doc.setFontSize(9);
  doc.text("Filiale:", margin, yPos);
  doc.text("Prüfer/in:", margin + 70, yPos);
  doc.text("Prüfdatum:", margin + 140, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  doc.text(data.locationName || "", margin + 14, yPos);
  doc.text(data.inspectorName || "—", margin + 88, yPos);
  doc.text(formatDe(data.checkDate), margin + 161, yPos);

  // ========== ALLGEMEINE PRÜFPFLICHTEN ==========
  yPos += 8;
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Allgemeine Prüfpflichten des Händlers nach Art. 14 MDR", margin + 2, yPos + 5.5);

  yPos += 12;
  doc.setFontSize(9);
  doc.setTextColor(COLORS.text);
  doc.setFont("helvetica", "normal");

  // Tabellen-Header
  doc.setFillColor(240, 240, 245);
  doc.rect(margin, yPos, contentWidth - 40, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Anforderung", margin + 2, yPos + 4);
  doc.text("Ja", margin + contentWidth - 38, yPos + 4);
  doc.text("Nein", margin + contentWidth - 25, yPos + 4);
  doc.text("Bemerkung", margin + contentWidth - 10, yPos + 4);

  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (const q of MDR_DUTY_QUESTIONS) {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
    }
    const value = data.duties[q.key];

    const gray = yPos % 10 < 5 ? 255 : 250;
    doc.setFillColor(gray, gray, gray);
    doc.rect(margin, yPos, contentWidth - 40, 7, "F");

    const lines = doc.splitTextToSize(q.question, contentWidth - 50);
    const lineHeight = 3.5;
    const cellHeight = Math.max(7, lines.length * lineHeight + 2);
    lines.forEach((line: string, index: number) => {
      doc.text(line, margin + 2, yPos + 4 + index * lineHeight);
    });

    // Checkbox Ja
    doc.setDrawColor(COLORS.mediumGray);
    doc.rect(margin + contentWidth - 37, yPos + 1.5, 4, 4);
    if (value === true) {
      doc.setFillColor(COLORS.primary);
      doc.rect(margin + contentWidth - 36, yPos + 2.5, 2, 2, "F");
    }
    // Checkbox Nein
    doc.rect(margin + contentWidth - 24, yPos + 1.5, 4, 4);
    if (value === false) {
      doc.setFillColor(COLORS.primary);
      doc.rect(margin + contentWidth - 23, yPos + 2.5, 2, 2, "F");
    }

    yPos += cellHeight;
  }

  // ========== KENNZEICHNUNG ==========
  yPos += 5;
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = margin;
  }
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("KENNZEICHNUNG (Anhang I 23.2 MDR)", margin + 2, yPos + 5.5);

  yPos += 14;
  doc.setTextColor(COLORS.text);
  doc.setFontSize(9);

  doc.setFont("helvetica", "bold");
  doc.text("Produktname:", margin + 8, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.labeling.produktName || "Nicht angegeben", margin + 40, yPos);
  yPos += 8;

  const ceValue =
    data.labeling.ceKennzeichnung === true ? "Ja"
    : data.labeling.ceKennzeichnung === false ? "Nein"
    : "Nicht angegeben";
  const kennzeichnungItems = [
    { iconData: icons.ce, label: "CE-Kennzeichnung:", value: ceValue },
    { iconData: icons.hersteller, label: "Hersteller:", value: data.labeling.herstellerName || "Nicht angegeben" },
    { iconData: icons.haendler, label: "Händler:", value: data.labeling.haendlerName || "Nicht angegeben" },
    { iconData: icons.importeur, label: "Importeur:", value: data.labeling.importeursName || "Nicht angegeben" },
    { iconData: icons.bevollmaechtigten, label: "Bevollmächtigter:", value: data.labeling.bevollmaechtigten || "Nicht angegeben" },
  ];
  for (const item of kennzeichnungItems) {
    if (yPos > pageHeight - 25) {
      doc.addPage();
      yPos = margin;
    }
    addIcon(doc, item.iconData, margin, yPos, 6);
    doc.setTextColor(COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(item.label, margin + 8, yPos);
    doc.setFont("helvetica", "normal");
    const wrappedValue = doc.splitTextToSize(item.value, contentWidth - 50);
    doc.text(wrappedValue[0], margin + 40, yPos);
    yPos += 7;
  }

  // ========== PRODUKTIDENTIFIKATION ==========
  yPos += 5;
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = margin;
  }
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PRODUKTIDENTIFIKATION", margin + 2, yPos + 5.5);

  yPos += 12;
  doc.setTextColor(COLORS.text);
  doc.setFontSize(9);

  const identItems = [
    { label: "REF", hasValue: data.identification.hasRef === true, value: data.identification.ref },
    { label: "LOT", hasValue: data.identification.hasLot === true, value: data.identification.lot },
    { label: "SN", hasValue: data.identification.hasSn === true, value: data.identification.sn },
    { label: "UDI", hasValue: data.identification.hasUdiTraeger === true, value: data.identification.udiTraeger },
  ];
  const boxWidth = (contentWidth - 6) / 4;
  identItems.forEach((item, index) => {
    const xPos = margin + index * (boxWidth + 2);

    doc.setFillColor(item.hasValue ? 245 : 250, 250, item.hasValue ? 255 : 250);
    doc.rect(xPos, yPos, boxWidth, 14, "F");
    doc.setDrawColor(item.hasValue ? COLORS.primary : COLORS.border);
    doc.setLineWidth(item.hasValue ? 0.5 : 0.3);
    doc.rect(xPos, yPos, boxWidth, 14);

    doc.setFillColor(COLORS.primary);
    doc.rect(xPos, yPos, boxWidth, 5, "F");
    doc.setTextColor(COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(item.label, xPos + boxWidth / 2, yPos + 3.5, { align: "center" });

    doc.setTextColor(COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const displayValue = item.hasValue ? item.value || "Nicht angegeben" : "Nicht vorhanden";
    const wrappedVal = doc.splitTextToSize(displayValue, boxWidth - 4);
    doc.text(wrappedVal[0], xPos + 2, yPos + 9);
  });

  yPos += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  addIcon(doc, icons.mhd, margin, yPos, 6);
  doc.text("Haltbarkeitsdatum (MHD):", margin + 8, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.identification.haltbarkeitsdatum || "Nicht angegeben", margin + 60, yPos);

  yPos += 7;
  doc.setFont("helvetica", "bold");
  addIcon(doc, icons.herstelldatum, margin, yPos, 6);
  doc.text("Herstelldatum:", margin + 8, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.identification.herstelldatum || "Nicht angegeben", margin + 60, yPos);

  // ========== SEITE 2 ==========
  doc.addPage();
  yPos = margin;

  // ========== LAGERUNGS-/HANDHABUNGSBEDINGUNGEN ==========
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("LAGERUNGS-/HANDHABUNGSBEDINGUNGEN", margin + 2, yPos + 5.5);

  yPos += 14;
  doc.setTextColor(COLORS.text);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Hinweis auf besondere Lagerungs- und Handhabungsbedingungen:", margin, yPos);
  yPos += 8;

  const lagerungItems = [
    { label: "Trocken lagern", value: data.storage.trockenLagern === true, iconData: icons.trockenLagern },
    { label: "Vor Sonnenlicht schützen", value: data.storage.sonnenlichtSchutz === true, iconData: icons.sonnenlicht },
    { label: "Zerbrechlich", value: data.storage.zerbrechlich === true, iconData: icons.zerbrechlich },
    { label: "Temperaturbegrenzung", value: data.storage.temperaturbegrenzung === true, iconData: icons.temperatur },
    { label: "Luftfeuchte", value: data.storage.luftfeuchte === true, iconData: icons.luftfeuchte },
  ];
  lagerungItems.forEach((item, index) => {
    if (index > 0 && index % 2 === 0) yPos += 10;
    const xPos = margin + (index % 2) * 90;
    addIcon(doc, item.iconData, xPos, yPos, 6);
    doc.setTextColor(COLORS.text);
    doc.setFont("helvetica", item.value ? "bold" : "normal");
    doc.setFontSize(8);
    doc.text(`${item.label}: ${item.value ? "Ja" : "Nein"}`, xPos + 8, yPos);
  });

  yPos += 15;

  const warnhinweise = data.storage.warnhinweise as string | undefined;
  if (warnhinweise) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    addIcon(doc, icons.warnhinweis, margin, yPos, 6);
    doc.text("Warnhinweise:", margin + 8, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 5;
    yPos = addWrappedText(doc, warnhinweise, margin + 2, yPos, contentWidth - 4);
    yPos += 3;
  }
  const gebrauchshinweise = data.storage.gebrauchshinweise as string | undefined;
  if (gebrauchshinweise) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Gebrauchshinweise:", margin, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 5;
    yPos = addWrappedText(doc, gebrauchshinweise, margin + 2, yPos, contentWidth - 4);
    yPos += 3;
  }
  const patientHinweise = data.storage.patientHinweise as string | undefined;
  if (patientHinweise) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Patientenhinweise:", margin, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 5;
    yPos = addWrappedText(doc, patientHinweise, margin + 2, yPos, contentWidth - 4);
    yPos += 3;
  }

  // ========== GEBRAUCHSANWEISUNGEN ==========
  yPos += 8;
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = margin;
  }
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("GEBRAUCHSANWEISUNGEN", margin + 2, yPos + 5.5);

  yPos += 14;
  doc.setTextColor(COLORS.text);
  doc.setFontSize(9);

  doc.setFont("helvetica", "bold");
  addIcon(doc, icons.einmalgebrauch, margin, yPos, 6);
  doc.text("Produkte für den einmaligen Gebrauch:", margin + 8, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;
  doc.text("Entsprechender Hinweis vorhanden", margin + 10, yPos);
  yPos += 8;

  doc.setFont("helvetica", "bold");
  addIcon(doc, icons.mehrfachanwendung, margin, yPos, 6);
  doc.text("Ein Patient, mehrfache Anwendung:", margin + 8, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;

  const aufbereitungszyklen = data.storage.aufbereitungszyklen as string | undefined;
  const beschraenkungZyklen = data.storage.beschraenkungZyklen as string | undefined;
  if (aufbereitungszyklen || beschraenkungZyklen) {
    doc.text("• Hinweis: Aufbereitetes Produkt zum Einmalgebrauch", margin + 10, yPos);
    yPos += 5;
    if (aufbereitungszyklen) {
      doc.text(`• Anzahl bereits durchlaufener Aufbereitungszyklen: ${aufbereitungszyklen}`, margin + 10, yPos);
      yPos += 5;
    }
    if (beschraenkungZyklen) {
      doc.text(`• Mögliche Beschränkung der Anzahl der Aufbereitungszyklen: ${beschraenkungZyklen}`, margin + 10, yPos);
      yPos += 5;
    }
  } else {
    doc.text("Keine Angaben zu Aufbereitungszyklen", margin + 10, yPos);
    yPos += 8;
  }

  // ========== SONDERANFERTIGUNG ==========
  yPos += 5;
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = margin;
  }
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SONDERANFERTIGUNG", margin + 2, yPos + 5.5);

  yPos += 14;
  doc.setTextColor(COLORS.text);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  doc.text(`Ist Sonderanfertigung: ${data.custom.isSonderanfertigung ? "Ja" : "Nein"}`, margin, yPos);
  yPos += 7;

  // MD-Kennzeichnung mit Rahmen-Icon
  doc.setDrawColor(COLORS.primary);
  doc.setLineWidth(0.8);
  doc.rect(margin, yPos - 3, 8, 5);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.primary);
  doc.text("MD", margin + 4, yPos, { align: "center" });
  doc.setFont("helvetica", data.custom.mdKennzeichnung ? "bold" : "normal");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.text);
  doc.text(`MD-Kennzeichnung: ${data.custom.mdKennzeichnung ? "Ja" : "Nein"}`, margin + 10, yPos);
  yPos += 7;

  doc.setFont("helvetica", "normal");
  doc.text(`Nur klinische Prüfung: ${data.custom.nurKlinischePruefung ? "Ja" : "Nein"}`, margin, yPos);
  yPos += 7;
  if (data.custom.sichereEntsorgung) {
    doc.setFont("helvetica", "bold");
    addIcon(doc, icons.entsorgung, margin, yPos, 6);
    doc.text("Sichere Entsorgung:", margin + 8, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 5;
    yPos = addWrappedText(doc, data.custom.sichereEntsorgung, margin + 2, yPos, contentWidth - 4);
  }

  // ========== STICHPROBEN-KONTROLLE ==========
  yPos += 8;
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = margin;
  }
  doc.setFillColor(COLORS.primary);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("STICHPROBEN-KONTROLLE", margin + 2, yPos + 5.5);

  yPos += 14;
  doc.setTextColor(COLORS.text);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Es wurde eine Stichproben-Kontrolle durchgeführt.", margin, yPos);
  yPos += 10;

  doc.setDrawColor(COLORS.mediumGray);
  doc.rect(margin, yPos, 5, 5);
  if (data.result === "PASSED") {
    doc.setFillColor(COLORS.primary);
    doc.rect(margin + 1, yPos + 1, 3, 3, "F");
  }
  doc.text("Die Anforderungen sind erfüllt.", margin + 8, yPos + 4);
  yPos += 10;

  doc.rect(margin, yPos, 5, 5);
  if (data.result === "FAILED") {
    doc.setFillColor(COLORS.primary);
    doc.rect(margin + 1, yPos + 1, 3, 3, "F");
  }
  doc.text("Die Anforderungen sind nicht erfüllt.", margin + 8, yPos + 4);

  if (data.result === "FAILED" && data.failureReason) {
    yPos += 7;
    doc.setFontSize(8);
    doc.text("Das Produkt wurde auf dem Markt nicht bereitgestellt und", margin + 8, yPos);
    yPos += 4;
    doc.text("der Hersteller umgehend informiert.", margin + 8, yPos);
    yPos += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Grund:", margin + 8, yPos);
    doc.setFont("helvetica", "normal");
    yPos += 5;
    yPos = addWrappedText(doc, data.failureReason, margin + 10, yPos, contentWidth - 12);
  }

  // ========== ABSCHLUSS (Ort/Datum + Unterschrift) ==========
  yPos += 15;
  if (yPos > pageHeight - 35) {
    doc.addPage();
    yPos = margin;
  }
  doc.setLineWidth(0.3);
  doc.setDrawColor(COLORS.border);

  doc.line(margin, yPos + 8, margin + 80, yPos + 8);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Ort, Datum", margin, yPos + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${data.locationName}, ${formatDe(data.checkDate)}`, margin, yPos + 6);

  doc.line(margin + 100, yPos + 8, pageWidth - margin, yPos + 8);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Unterschrift", margin + 100, yPos + 12);

  if (data.signatureUrl) {
    const sig = await loadUrlAsDataUrl(data.signatureUrl);
    if (sig?.dataUrl.startsWith("data:image")) {
      try {
        doc.addImage(sig.dataUrl, "PNG", margin + 100, yPos - 8, 40, 15);
      } catch {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Unterschrift vorhanden", margin + 100, yPos + 6);
      }
    }
  }

  // ========== ZUSÄTZLICHE BEMERKUNGEN ==========
  if (data.remarks && data.remarks.trim() !== "") {
    yPos += 20;
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(COLORS.primary);
    doc.rect(margin, yPos, contentWidth, 8, "F");
    doc.setTextColor(COLORS.white);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("ZUSÄTZLICHE BEMERKUNGEN", margin + 2, yPos + 5.5);

    yPos += 14;
    doc.setTextColor(COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    yPos = addWrappedText(doc, data.remarks, margin, yPos, contentWidth);
    yPos += 5;
  }

  // ========== ANHÄNGE ==========
  const attachmentUrls = data.attachments.map((a) => a.url).filter((u): u is string => !!u);
  if (attachmentUrls.length > 0) {
    yPos += 25;
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(COLORS.primary);
    doc.rect(margin, yPos, contentWidth, 8, "F");
    doc.setTextColor(COLORS.white);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("ANHÄNGE", margin + 2, yPos + 5.5);

    yPos += 12;
    doc.setTextColor(COLORS.text);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Anzahl hochgeladener Dateien: ${attachmentUrls.length}`, margin, yPos);
    yPos += 8;

    for (let i = 0; i < attachmentUrls.length; i++) {
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = margin;
      }
      const file = await loadUrlAsDataUrl(attachmentUrls[i]);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`Anhang ${i + 1}`, margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `Typ: ${file?.type || "unbekannt"} | Größe: ${file ? (file.size / 1024).toFixed(2) : "—"} KB`,
        margin, yPos,
      );
      yPos += 6;

      if (file && file.type.startsWith("image/")) {
        try {
          const dimensions = await getImageDimensions(file.dataUrl);
          const maxWidth = contentWidth * 0.8;
          const maxHeight = 150;
          const aspectRatio = dimensions.width / dimensions.height;
          let imgWidth = maxWidth;
          let imgHeight = imgWidth / aspectRatio;
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * aspectRatio;
          }
          if (yPos + imgHeight + 10 > pageHeight - 25) {
            doc.addPage();
            yPos = margin;
          }
          const xOffset = margin + (contentWidth - imgWidth) / 2;
          const format = file.type.includes("png") ? "PNG" : "JPEG";
          doc.addImage(file.dataUrl, format, xOffset, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 5;
        } catch {
          doc.text("[Bild konnte nicht geladen werden]", margin, yPos);
          yPos += 6;
        }
      } else if (file) {
        doc.text("[Kein Bild — Datei im QMS hinterlegt]", margin, yPos);
        yPos += 6;
      } else {
        doc.text("[Datei konnte nicht geladen werden]", margin, yPos);
        yPos += 6;
      }
      yPos += 8;
    }
  }

  // ========== FOOTER (Eurocom, letzte Seite) ==========
  yPos = pageHeight - 20;
  doc.setFillColor(COLORS.primary);
  doc.rect(0, yPos, pageWidth, 20, "F");
  doc.setTextColor(COLORS.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Haftung für Darstellungen und Inhalte", margin, yPos + 5);
  doc.setFontSize(6);
  doc.text("Die Checkliste Wareneingang der eurocom e. V. erhebt keinen Anspruch", margin, yPos + 9);
  doc.text("auf Vollständigkeit, Genauigkeit der Symbolzeichen oder Aktualität.", margin, yPos + 12);
  doc.setFontSize(7);
  doc.text("Herausgeber", pageWidth / 2 + 10, yPos + 5);
  doc.setFontSize(6);
  doc.text("eurocom e.V. - European Manufacturers Federation for", pageWidth / 2 + 10, yPos + 9);
  doc.text("Compression Therapy and Orthopaedic Devices", pageWidth / 2 + 10, yPos + 12);
  doc.text("Reinhardtstraße 15 · D - 10117 Berlin", pageWidth / 2 + 10, yPos + 15);

  return doc;
}

/** Browser-Download (async wegen Icon-/Unterschrift-/Anhang-Nachladen) */
export async function downloadIncomingGoodsPdf(
  data: IncomingGoodsCheckData,
  fileName: string,
): Promise<void> {
  const doc = await buildIncomingGoodsPdf(data);
  doc.save(fileName);
}
