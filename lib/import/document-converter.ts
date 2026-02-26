import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ConversionResult {
  json: any; // Tiptap-compatible JSON
  title?: string;
  warnings: string[];
}

export async function convertToTiptapJSON(file: File): Promise<ConversionResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "docx":
      return convertDocx(file);
    case "pdf":
      return convertPdf(file);
    case "xlsx":
    case "xls":
      return convertExcel(file);
    case "pptx":
      return convertPptx(file);
    default:
      throw new Error(`Nicht unterstütztes Dateiformat: .${ext}`);
  }
}

async function convertDocx(file: File): Promise<ConversionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
      ],
    }
  );

  const warnings = result.messages
    .filter((m: { type: string; message: string }) => m.type === "warning")
    .map((m: { type: string; message: string }) => m.message);

  const tiptapJson = htmlToTiptapJSON(result.value);

  const titleMatch = result.value.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "") : undefined;

  return { json: tiptapJson, title, warnings };
}

async function convertPdf(file: File): Promise<ConversionResult> {
  const warnings: string[] = [
    "PDF-Import ist verlustbehaftet — Formatierung und Bilder können verloren gehen.",
  ];

  try {
    // Dynamic import for pdfjs-dist
    const pdfjsLib = await import("pdfjs-dist");

    // Use a CDN worker to avoid bundling issues
    if (typeof window !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    const paragraphs: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      if (pageText.trim()) paragraphs.push(pageText.trim());
    }

    const content = paragraphs.map((text) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text }],
    }));

    return {
      json: { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] },
      title: paragraphs[0]?.substring(0, 100),
      warnings,
    };
  } catch (err) {
    warnings.push(`PDF-Parsing fehlgeschlagen: ${(err as Error).message}`);
    return {
      json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "PDF konnte nicht gelesen werden." }] }] },
      title: file.name.replace(/\.pdf$/i, ""),
      warnings,
    };
  }
}

async function convertExcel(file: File): Promise<ConversionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) {
    return {
      json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Leere Tabelle" }] }] },
      warnings: ["Keine Daten in der Excel-Datei gefunden."],
    };
  }

  // Normalize row lengths
  const maxCols = Math.max(...data.map((r) => r.length));
  const normalizedData = data.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push("");
    return padded;
  });

  const rows = normalizedData.slice(0, 100).map((row, rowIdx) => ({
    type: "tableRow",
    content: row.map((cell: any) => ({
      type: rowIdx === 0 ? "tableHeader" : "tableCell",
      content: [
        {
          type: "paragraph",
          content: cell != null && String(cell) !== ""
            ? [{ type: "text", text: String(cell) }]
            : [],
        },
      ],
    })),
  }));

  return {
    json: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: sheetName }] },
        { type: "table", content: rows },
      ],
    },
    title: sheetName,
    warnings: data.length > 100 ? ["Nur die ersten 100 Zeilen wurden importiert."] : [],
  };
}

async function convertPptx(file: File): Promise<ConversionResult> {
  const warnings: string[] = [
    "PPTX-Import extrahiert nur Text — Bilder und Formatierung gehen verloren.",
  ];

  try {
    const JSZip = (await import("jszip")).default;
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const content: any[] = [];
    const slideFiles = Object.keys(zip.files)
      .filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort();

    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async("text");
      const texts: string[] = [];
      const matches = xml.matchAll(/<a:t>(.*?)<\/a:t>/g);
      for (const match of matches) {
        if (match[1].trim()) texts.push(match[1]);
      }

      if (texts.length > 0) {
        content.push({
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: `Folie ${i + 1}` }],
        });
        for (const text of texts) {
          content.push({
            type: "paragraph",
            content: [{ type: "text", text }],
          });
        }
      }
    }

    return {
      json: { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] },
      title: file.name.replace(/\.pptx$/i, ""),
      warnings,
    };
  } catch (err) {
    warnings.push(`PPTX-Parsing fehlgeschlagen: ${(err as Error).message}`);
    return {
      json: { type: "doc", content: [{ type: "paragraph" }] },
      title: file.name.replace(/\.pptx$/i, ""),
      warnings,
    };
  }
}

/**
 * Convert HTML string to Tiptap JSON using DOMParser.
 */
function htmlToTiptapJSON(html: string): any {
  if (typeof window === "undefined") {
    return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: html.replace(/<[^>]*>/g, "") }] }] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  const content = parseNodes(doc.body);

  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function parseNodes(parent: Node): any[] {
  const result: any[] = [];

  parent.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        result.push({ type: "paragraph", content: [{ type: "text", text }] });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "h1": case "h2": case "h3": case "h4": {
        const level = parseInt(tag.charAt(1));
        const inlineContent = parseInline(el);
        if (inlineContent.length > 0) {
          result.push({ type: "heading", attrs: { level }, content: inlineContent });
        }
        break;
      }
      case "p": {
        const inlineContent = parseInline(el);
        result.push({ type: "paragraph", content: inlineContent.length > 0 ? inlineContent : undefined });
        break;
      }
      case "ul": {
        const items = parseListItems(el);
        if (items.length > 0) result.push({ type: "bulletList", content: items });
        break;
      }
      case "ol": {
        const items = parseListItems(el);
        if (items.length > 0) result.push({ type: "orderedList", content: items });
        break;
      }
      case "table": {
        const rows = parseTable(el);
        if (rows.length > 0) result.push({ type: "table", content: rows });
        break;
      }
      case "blockquote": {
        const children = parseNodes(el);
        result.push({ type: "blockquote", content: children.length > 0 ? children : [{ type: "paragraph" }] });
        break;
      }
      case "img": {
        const src = el.getAttribute("src");
        if (src) result.push({ type: "image", attrs: { src, alt: el.getAttribute("alt") || "" } });
        break;
      }
      case "br": break; // Skip standalone BRs
      case "hr": {
        result.push({ type: "horizontalRule" });
        break;
      }
      default: {
        const children = parseNodes(el);
        result.push(...children);
      }
    }
  });

  return result;
}

function parseInline(el: HTMLElement): any[] {
  const result: any[] = [];

  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) result.push({ type: "text", text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();
    const marks: any[] = [];

    if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
    if (tag === "em" || tag === "i") marks.push({ type: "italic" });
    if (tag === "u") marks.push({ type: "underline" });
    if (tag === "s" || tag === "del") marks.push({ type: "strike" });
    if (tag === "code") marks.push({ type: "code" });
    if (tag === "a") {
      const href = child.getAttribute("href");
      if (href) marks.push({ type: "link", attrs: { href } });
    }
    if (tag === "br") {
      result.push({ type: "hardBreak" });
      return;
    }

    const innerNodes = parseInline(child);
    for (const inner of innerNodes) {
      if (inner.type === "text" && marks.length > 0) {
        const existingMarks = inner.marks || [];
        result.push({ ...inner, marks: [...existingMarks, ...marks] });
      } else {
        result.push(inner);
      }
    }
  });

  return result;
}

function parseListItems(el: HTMLElement): any[] {
  const items: any[] = [];
  el.querySelectorAll(":scope > li").forEach((li) => {
    const content = parseNodes(li);
    const itemContent = content.length > 0 ? content : [{ type: "paragraph" }];
    items.push({ type: "listItem", content: itemContent });
  });
  return items;
}

function parseTable(el: HTMLElement): any[] {
  const rows: any[] = [];
  el.querySelectorAll("tr").forEach((tr, rowIdx) => {
    const cells: any[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      const isHeader = cell.tagName.toLowerCase() === "th" || rowIdx === 0;
      const inlineContent = parseInline(cell as HTMLElement);
      cells.push({
        type: isHeader ? "tableHeader" : "tableCell",
        content: [{ type: "paragraph", content: inlineContent.length > 0 ? inlineContent : undefined }],
      });
    });
    if (cells.length > 0) rows.push({ type: "tableRow", content: cells });
  });
  return rows;
}
