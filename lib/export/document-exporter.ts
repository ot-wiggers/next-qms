import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Header, Footer, PageNumber,
  AlignmentType, BorderStyle,
} from "docx";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

interface OrgSettings {
  primaryColor?: string;
  secondaryColor?: string;
}

interface DocumentData {
  title?: string;
  documentCode: string;
  documentType: string;
  version: string;
  richContent: any;
}

// ============================================================
// WORD EXPORT
// ============================================================

export async function exportToWord(
  doc: DocumentData,
  settings: OrgSettings = {}
): Promise<void> {
  const now = new Date();
  const standDate = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const title = doc.title ?? doc.documentCode;
  const contentParagraphs = tiptapToDocxParagraphs(doc.richContent);

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: `Revision ${doc.version}`, size: 18, color: "666666" }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Stand ${standDate}`, size: 18, color: "666666" }),
      ],
    }),
  ];

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 400 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 32,
        color: (settings.primaryColor || "#0066CC").replace("#", ""),
      }),
    ],
  });

  const document_obj = new Document({
    sections: [
      {
        headers: {
          default: new Header({ children: headerParagraphs }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${doc.documentCode}.docx`, size: 16, color: "999999" }),
                  new TextRun({ text: "     " }),
                  new TextRun({ text: "Seite ", size: 16, color: "999999" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
                  new TextRun({ text: " von ", size: 16, color: "999999" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "999999" }),
                  new TextRun({ text: "     " }),
                  new TextRun({ text: standDate, size: 16, color: "999999" }),
                ],
              }),
            ],
          }),
        },
        children: [titleParagraph, ...contentParagraphs],
      },
    ],
  });

  const blob = await Packer.toBlob(document_obj);
  saveAs(blob, `${doc.documentCode}.docx`);
}

function tiptapToDocxParagraphs(json: any): Paragraph[] {
  if (!json?.content) return [];
  const result: Paragraph[] = [];

  for (const node of json.content) {
    switch (node.type) {
      case "heading": {
        const level = node.attrs?.level ?? 1;
        const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
        };
        result.push(
          new Paragraph({
            heading: headingMap[level] || HeadingLevel.HEADING_1,
            children: tiptapInlineToTextRuns(node.content),
          })
        );
        break;
      }
      case "paragraph": {
        result.push(
          new Paragraph({
            spacing: { after: 120 },
            children: tiptapInlineToTextRuns(node.content),
          })
        );
        break;
      }
      case "bulletList": {
        for (const item of node.content || []) {
          if (item.type === "listItem") {
            for (const child of item.content || []) {
              if (child.type === "paragraph") {
                result.push(
                  new Paragraph({
                    bullet: { level: 0 },
                    children: tiptapInlineToTextRuns(child.content),
                  })
                );
              }
            }
          }
        }
        break;
      }
      case "orderedList": {
        for (const item of node.content || []) {
          if (item.type === "listItem") {
            for (const child of item.content || []) {
              if (child.type === "paragraph") {
                result.push(
                  new Paragraph({
                    numbering: { reference: "default-numbering", level: 0 },
                    children: tiptapInlineToTextRuns(child.content),
                  })
                );
              }
            }
          }
        }
        break;
      }
      case "blockquote": {
        for (const child of node.content || []) {
          if (child.type === "paragraph") {
            const inlineText = extractAllText(child);
            result.push(
              new Paragraph({
                indent: { left: 720 },
                border: {
                  left: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 10 },
                },
                children: [
                  new TextRun({ text: inlineText, italics: true, color: "666666" }),
                ],
              })
            );
          }
        }
        break;
      }
      case "horizontalRule": {
        result.push(
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            },
            spacing: { before: 200, after: 200 },
          })
        );
        break;
      }
      default:
        // Skip unsupported node types
        break;
    }
  }

  return result;
}

function tiptapInlineToTextRuns(content: any[] | undefined): TextRun[] {
  if (!content || content.length === 0) return [new TextRun("")];

  return content.map((node) => {
    if (node.type === "text") {
      const marks = node.marks || [];
      return new TextRun({
        text: node.text || "",
        bold: marks.some((m: any) => m.type === "bold"),
        italics: marks.some((m: any) => m.type === "italic"),
        underline: marks.some((m: any) => m.type === "underline") ? {} : undefined,
        strike: marks.some((m: any) => m.type === "strike"),
      });
    }
    if (node.type === "hardBreak") {
      return new TextRun({ text: "", break: 1 });
    }
    return new TextRun("");
  });
}

// ============================================================
// PDF EXPORT
// ============================================================

export async function exportToPDF(
  doc: DocumentData,
  settings: OrgSettings = {}
): Promise<void> {
  const now = new Date();
  const standDate = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const title = doc.title ?? doc.documentCode;
  const primaryColor = settings.primaryColor || "#0066CC";

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  let y = margin + 25; // Start below header

  const colorR = parseInt(primaryColor.slice(1, 3), 16);
  const colorG = parseInt(primaryColor.slice(3, 5), 16);
  const colorB = parseInt(primaryColor.slice(5, 7), 16);

  function addHeader() {
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`Revision ${doc.version}`, margin, 15);
    pdf.text(`Stand ${standDate}`, margin, 20);

    pdf.setFontSize(12);
    pdf.setTextColor(colorR, colorG, colorB);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, pageWidth / 2, 17, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);

    // Line under header
    pdf.setDrawColor(200);
    pdf.line(margin, 24, pageWidth - margin, 24);
  }

  function addFooter() {
    const pageNum = pdf.getNumberOfPages();
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(`${doc.documentCode}.docx`, margin, pageHeight - 10);
    pdf.text(`Seite ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    pdf.text(standDate, pageWidth - margin, pageHeight - 10, { align: "right" });
    pdf.setTextColor(0, 0, 0);
  }

  function checkPageBreak(neededSpace: number = 15) {
    if (y > pageHeight - 30) {
      addFooter();
      pdf.addPage();
      y = margin + 25;
      addHeader();
    }
  }

  addHeader();

  // Render Tiptap content
  if (doc.richContent?.content) {
    for (const node of doc.richContent.content) {
      checkPageBreak();

      switch (node.type) {
        case "heading": {
          const level = node.attrs?.level ?? 1;
          const sizes: Record<number, number> = { 1: 16, 2: 14, 3: 12, 4: 11 };
          const fontSize = sizes[level] || 11;
          pdf.setFontSize(fontSize);
          pdf.setFont("helvetica", "bold");
          const text = extractAllText(node);
          if (text) {
            const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
            for (const line of lines) {
              checkPageBreak();
              pdf.text(line, margin, y);
              y += fontSize * 0.45 + 2;
            }
          }
          y += 3;
          pdf.setFont("helvetica", "normal");
          break;
        }
        case "paragraph": {
          pdf.setFontSize(10);
          const text = extractAllText(node);
          if (text) {
            const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
            for (const line of lines) {
              checkPageBreak();
              pdf.text(line, margin, y);
              y += 5;
            }
          }
          y += 2;
          break;
        }
        case "bulletList": {
          pdf.setFontSize(10);
          for (const item of node.content || []) {
            const text = extractAllText(item);
            if (text) {
              checkPageBreak();
              pdf.text("\u2022", margin + 2, y);
              const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 10);
              for (const line of lines) {
                checkPageBreak();
                pdf.text(line, margin + 8, y);
                y += 5;
              }
            }
          }
          y += 2;
          break;
        }
        case "orderedList": {
          pdf.setFontSize(10);
          let idx = 1;
          for (const item of node.content || []) {
            const text = extractAllText(item);
            if (text) {
              checkPageBreak();
              pdf.text(`${idx}.`, margin + 2, y);
              const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 10);
              for (const line of lines) {
                checkPageBreak();
                pdf.text(line, margin + 10, y);
                y += 5;
              }
              idx++;
            }
          }
          y += 2;
          break;
        }
        case "blockquote": {
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          pdf.setDrawColor(200);
          const text = extractAllText(node);
          if (text) {
            pdf.line(margin + 2, y - 3, margin + 2, y + 4);
            const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 15);
            for (const line of lines) {
              checkPageBreak();
              pdf.text(line, margin + 8, y);
              y += 5;
            }
          }
          pdf.setTextColor(0, 0, 0);
          y += 3;
          break;
        }
        case "horizontalRule": {
          pdf.setDrawColor(200);
          pdf.line(margin, y, pageWidth - margin, y);
          y += 8;
          break;
        }
        default:
          break;
      }
    }
  }

  addFooter();
  pdf.save(`${doc.documentCode}.pdf`);
}

function extractAllText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (node.content) return node.content.map(extractAllText).join("");
  return "";
}
