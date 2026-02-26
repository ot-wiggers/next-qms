# Editor Fixes, Import/Export & Document Lifecycle — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix editor rendering bugs (table borders, list bullets), add sticky toolbar, image upload in editor, multi-format document import, branded Word/PDF export, and document archive/delete lifecycle.

**Architecture:** Client-side approach — all conversion (import/export) happens in the browser. New `organizationSettings` table stores per-org branding. Convex Storage handles image uploads from editor. Archive/delete extends existing soft-delete pattern with new permanent-delete for QMB/Admin.

**Tech Stack:** Tiptap v3, mammoth (docx→HTML), pdf-parse (PDF→text), xlsx (already installed), docx (Word generation), jspdf + jspdf-autotable (PDF generation), Convex Storage

---

## Task 1: Editor CSS Fixes — Table Borders & List Bullets

**Files:**
- Modify: `app/globals.css:129-246` (`.tiptap` styles section)

**Step 1: Fix table borders**

In `app/globals.css`, replace the existing `.tiptap table` and `.tiptap th, td` rules (lines 163-183) with explicit border-style declarations:

```css
/* Replace lines 163-183 */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: 1px solid hsl(var(--border));
}

th, td {
  border-width: 1px;
  border-style: solid;
  border-color: hsl(var(--border));
  padding: 0.5rem 0.75rem;
  min-width: 100px;
  vertical-align: top;
  position: relative;
}

th {
  background: hsl(var(--muted));
  font-weight: 600;
  text-align: left;
}

.selectedCell {
  background: hsl(var(--accent));
}
```

**Step 2: Fix list styles**

Replace the existing `ul, ol` rule (lines 139-141) with:

```css
ul:not([data-type="taskList"]) {
  padding-left: 1.5rem;
  list-style-type: disc;
}

ul:not([data-type="taskList"]) ul {
  list-style-type: circle;
}

ul:not([data-type="taskList"]) ul ul {
  list-style-type: square;
}

ol {
  padding-left: 1.5rem;
  list-style-type: decimal;
}

ol ol {
  list-style-type: lower-alpha;
}

li {
  margin-top: 0.25em;
}

li p {
  margin: 0;
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS (CSS-only changes, no TS impact)

**Step 4: Commit**

```bash
git add app/globals.css
git commit -m "fix: add explicit table borders and list-style-type to editor CSS"
```

---

## Task 2: Sticky Toolbar

**Files:**
- Modify: `components/editor/Toolbar.tsx:94` (wrapper div className)
- Modify: `components/editor/DocumentEditor.tsx:180-182` (wrapper structure)

**Step 1: Make toolbar sticky**

In `components/editor/Toolbar.tsx`, change line 94 from:
```tsx
<div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
```
to:
```tsx
<div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background px-2 py-1">
```

**Step 2: Add scrollable content area**

In `components/editor/DocumentEditor.tsx`, change lines 180-182 from:
```tsx
<div className="border rounded-lg overflow-hidden">
  {editable && <Toolbar editor={editor} />}
  <EditorContent editor={editor} className="p-4 min-h-[400px]" />
```
to:
```tsx
<div className="border rounded-lg overflow-hidden">
  {editable && <Toolbar editor={editor} />}
  <div className="overflow-y-auto max-h-[70vh]">
    <EditorContent editor={editor} className="p-4 min-h-[400px]" />
  </div>
```

And close the new div before the existing `</div>`:
```tsx
  </div>
  {editable && (
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add components/editor/Toolbar.tsx components/editor/DocumentEditor.tsx
git commit -m "feat: make editor toolbar sticky on scroll"
```

---

## Task 3: Image Upload in Editor

**Files:**
- Create: `components/editor/hooks/useEditorImageUpload.ts`
- Modify: `convex/documents.ts` — add `generateUploadUrl` + `getFileUrl`
- Modify: `components/editor/Toolbar.tsx` — add upload button
- Modify: `components/editor/DocumentEditor.tsx` — integrate upload hook
- Modify: `components/editor/extensions/slash-command.ts` — add "Bild hochladen" item

**Step 1: Add backend mutations to `convex/documents.ts`**

Append after the existing `archive` mutation (after line 335):

```ts
/** Generate a signed upload URL for document images */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requirePermission(ctx, "documents:create");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Get a public URL for a stored file */
export const getFileUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "documents:read");
    return await ctx.storage.getUrl(args.fileId);
  },
});
```

**Step 2: Push schema**

Run: `npx convex dev --once`
Expected: Deployment succeeds (query + mutation added, no schema change)

**Step 3: Create image upload hook**

Create `components/editor/hooks/useEditorImageUpload.ts`:

```tsx
"use client";

import { useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

export function useEditorImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editorRef.current) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Bitte wählen Sie eine Bilddatei aus");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Datei zu groß (max. 10 MB)");
        return;
      }

      try {
        toast.loading("Bild wird hochgeladen...", { id: "img-upload" });

        // 1. Get upload URL
        const uploadUrl = await generateUploadUrl();

        // 2. Upload file
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();

        // 3. Get public URL — use the upload URL's origin to construct getUrl
        // Convex storage URLs are accessible via ctx.storage.getUrl, but from client
        // we need to use the API. We'll use a temporary approach: query for the URL.
        const getUrlResponse = await fetch(
          `/api/getImageUrl?storageId=${storageId}`
        );

        // Alternative: directly use Convex's storage URL pattern
        // For now, we use a data URL as fallback and let Convex serve it
        const publicUrl = URL.createObjectURL(file);

        // Insert into editor
        editorRef.current
          .chain()
          .focus()
          .setImage({ src: publicUrl, alt: file.name })
          .run();

        toast.success("Bild eingefügt", { id: "img-upload" });
      } catch (err) {
        console.error("Image upload failed:", err);
        toast.error("Fehler beim Hochladen", { id: "img-upload" });
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [generateUploadUrl]
  );

  const triggerUpload = useCallback((editor: Editor) => {
    editorRef.current = editor;
    fileInputRef.current?.click();
  }, []);

  const FileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      className="hidden"
      aria-hidden
    />
  );

  return { triggerUpload, FileInput };
}
```

**Note:** The image URL handling needs refinement. A better approach: after uploading to Convex storage, call a Convex query to get the public URL. Since `useQuery` is reactive, we'll instead make the hook accept a callback-based approach. Here's the refined version:

```tsx
"use client";

import { useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

export function useEditorImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const convex = useConvex();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editorRef.current) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Bitte wählen Sie eine Bilddatei aus");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Datei zu groß (max. 10 MB)");
        return;
      }

      try {
        toast.loading("Bild wird hochgeladen...", { id: "img-upload" });

        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();

        // Get public URL via Convex query
        const url = await convex.query(api.documents.getFileUrl, {
          fileId: storageId,
        });

        if (!url) throw new Error("URL konnte nicht abgerufen werden");

        editorRef.current
          .chain()
          .focus()
          .setImage({ src: url, alt: file.name })
          .run();

        toast.success("Bild eingefügt", { id: "img-upload" });
      } catch (err) {
        console.error("Image upload failed:", err);
        toast.error("Fehler beim Hochladen", { id: "img-upload" });
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [generateUploadUrl, convex]
  );

  const triggerUpload = useCallback((editor: Editor) => {
    editorRef.current = editor;
    fileInputRef.current?.click();
  }, []);

  const FileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      className="hidden"
      aria-hidden
    />
  );

  return { triggerUpload, FileInput };
}
```

**Step 4: Add upload button to Toolbar**

In `components/editor/Toolbar.tsx`:

Add import: `import { ImageUp } from "lucide-react";`

The Toolbar needs access to the `triggerUpload` function. Change the interface:

```tsx
interface ToolbarProps {
  editor: Editor;
  onImageUpload?: () => void;
}
```

After the existing Image button (line 247), add:

```tsx
{onImageUpload && (
  <ToolbarButton onClick={onImageUpload} tooltip="Bild hochladen">
    <ImageUp className="size-4" />
  </ToolbarButton>
)}
```

**Step 5: Integrate in DocumentEditor**

In `components/editor/DocumentEditor.tsx`:

Add import:
```tsx
import { useEditorImageUpload } from "./hooks/useEditorImageUpload";
```

Inside the component, after `const [pickerOpen, setPickerOpen] = useState(false);`:
```tsx
const { triggerUpload, FileInput } = useEditorImageUpload();
```

Update the Toolbar usage:
```tsx
{editable && <Toolbar editor={editor} onImageUpload={() => triggerUpload(editor)} />}
```

Add FileInput before the closing `</div>`:
```tsx
{editable && FileInput}
```

**Step 6: Add to slash menu**

In `components/editor/extensions/slash-command.ts`, add a new item after "Trennlinie" (line 106), in the "Medien" category:

```ts
{
  title: "Bild hochladen",
  description: "Bild von Computer hochladen",
  icon: "ImageUp",
  category: "Medien",
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
    // This will be handled by the DocumentEditor which listens for a custom event
    document.dispatchEvent(new CustomEvent("editor:triggerImageUpload"));
  },
},
```

In `DocumentEditor.tsx`, add an event listener:
```tsx
import { useEffect } from "react";
// ... inside the component, after useEditorImageUpload:
useEffect(() => {
  const handler = () => {
    if (editor) triggerUpload(editor);
  };
  document.addEventListener("editor:triggerImageUpload", handler);
  return () => document.removeEventListener("editor:triggerImageUpload", handler);
}, [editor, triggerUpload]);
```

**Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx convex dev --once`
Expected: Deployment succeeds

**Step 8: Commit**

```bash
git add components/editor/hooks/useEditorImageUpload.ts components/editor/Toolbar.tsx components/editor/DocumentEditor.tsx components/editor/extensions/slash-command.ts convex/documents.ts
git commit -m "feat: add image upload to document editor via toolbar and slash menu"
```

---

## Task 4: Document Import

**Files:**
- Create: `lib/import/document-converter.ts`
- Create: `components/domain/documents/import-dialog.tsx`
- Modify: `app/(dashboard)/documents/page.tsx` — add import button
- Modify: `package.json` — add mammoth dependency

**Step 1: Install dependencies**

Run: `npm install mammoth`

Note: `pdf-parse` has Node.js dependencies (fs, etc.) that won't work client-side. Instead, use `pdfjs-dist` for browser-based PDF text extraction.

Run: `npm install pdfjs-dist`

**Step 2: Create document converter module**

Create `lib/import/document-converter.ts`:

```ts
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ConversionResult {
  json: any; // Tiptap-compatible JSON
  title?: string;
  warnings: string[];
}

/**
 * Convert various file formats to Tiptap-compatible JSON.
 */
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
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  // Convert HTML to Tiptap JSON using DOMParser
  const tiptapJson = htmlToTiptapJSON(result.value);

  // Try to extract title from first heading
  const titleMatch = result.value.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "") : undefined;

  return { json: tiptapJson, title, warnings };
}

async function convertPdf(file: File): Promise<ConversionResult> {
  const warnings: string[] = [
    "PDF-Import ist verlustbehaftet — Formatierung und Bilder können verloren gehen.",
  ];

  try {
    const pdfjsLib = await import("pdfjs-dist");
    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
      type: "paragraph",
      content: [{ type: "text", text }],
    }));

    return {
      json: { type: "doc", content },
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

  // Build Tiptap table
  const rows = data.map((row, rowIdx) => ({
    type: "tableRow",
    content: row.map((cell: any) => ({
      type: rowIdx === 0 ? "tableHeader" : "tableCell",
      content: [
        {
          type: "paragraph",
          content: cell != null && cell !== ""
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
      .filter((f) => f.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort();

    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async("text");
      // Extract text from XML using regex (simple approach)
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
 * This is a simplified converter that handles common HTML elements.
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
        // Wrap orphaned text in paragraph
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
        result.push({ type: "blockquote", content: children });
        break;
      }
      case "img": {
        const src = el.getAttribute("src");
        if (src) result.push({ type: "image", attrs: { src, alt: el.getAttribute("alt") || "" } });
        break;
      }
      case "br": {
        result.push({ type: "hardBreak" });
        break;
      }
      case "hr": {
        result.push({ type: "horizontalRule" });
        break;
      }
      default: {
        // Recurse into unknown elements
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
    // Ensure list items have at least a paragraph
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
```

**Step 3: Create import dialog component**

Create `components/domain/documents/import-dialog.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { convertToTiptapJSON, type ConversionResult } from "@/lib/import/document-converter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { toast } from "sonner";
import { FileUp, Loader2, AlertTriangle } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [converting, setConverting] = useState(false);
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [fileName, setFileName] = useState("");

  // Metadata form
  const [title, setTitle] = useState("");
  const [documentCode, setDocumentCode] = useState("");
  const [documentType, setDocumentType] = useState("work_instruction");
  const [version, setVersion] = useState("1.0");

  const me = useQuery(api.users.me);
  const createDocument = useMutation(api.documents.create);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConverting(true);
    setFileName(file.name);

    try {
      const result = await convertToTiptapJSON(file);
      setConversion(result);
      setTitle(result.title || file.name.replace(/\.[^/.]+$/, ""));
      setDocumentCode(file.name.replace(/\.[^/.]+$/, "").toUpperCase().replace(/\s+/g, "-"));
      setStep("preview");

      if (result.warnings.length > 0) {
        toast.warning(`Import-Hinweise: ${result.warnings.join(", ")}`);
      }
    } catch (err: any) {
      toast.error(`Konvertierung fehlgeschlagen: ${err.message}`);
    } finally {
      setConverting(false);
    }
  }, []);

  const handleImport = async () => {
    if (!conversion || !me) return;

    try {
      const id = await createDocument({
        title,
        documentCode,
        documentType,
        version,
        richContent: conversion.json,
        responsibleUserId: me._id as any,
      });
      toast.success("Dokument importiert");
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Importieren");
    }
  };

  const resetState = () => {
    setStep("upload");
    setConversion(null);
    setFileName("");
    setTitle("");
    setDocumentCode("");
    setDocumentType("work_instruction");
    setVersion("1.0");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" ? "Dokument importieren" : `Vorschau: ${fileName}`}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileUp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Word, PDF, Excel oder PowerPoint Datei auswählen
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Unterstützte Formate: .docx, .pdf, .xlsx, .xls, .pptx
              </p>
              <label className="cursor-pointer">
                <Input
                  type="file"
                  accept=".docx,.pdf,.xlsx,.xls,.pptx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" asChild disabled={converting}>
                  <span>
                    {converting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Konvertiere...
                      </>
                    ) : (
                      "Datei auswählen"
                    )}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        )}

        {step === "preview" && conversion && (
          <div className="space-y-4 py-2">
            {/* Warnings */}
            {conversion.warnings.length > 0 && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    {conversion.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              </div>
            )}

            {/* Metadata form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titel *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dokumenten-Code *</Label>
                <Input value={documentCode} onChange={(e) => setDocumentCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dokumententyp *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} />
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Vorschau</Label>
              <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                <DocumentEditor content={conversion.json} editable={false} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setConversion(null); }}>
                Andere Datei
              </Button>
              <Button onClick={handleImport} disabled={!title || !documentCode}>
                Importieren
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Add import button to documents page**

In `app/(dashboard)/documents/page.tsx`:

Add imports:
```tsx
import { FileUp } from "lucide-react";
import { ImportDialog } from "@/components/domain/documents/import-dialog";
```

Add state inside component:
```tsx
const [importOpen, setImportOpen] = useState(false);
```

Update the `actions` prop of PageHeader to include both buttons:
```tsx
actions={
  can("documents:create") ? (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
        <FileUp className="mr-1 h-4 w-4" />
        Importieren
      </Button>
      <Button size="sm" asChild>
        <Link href="/documents/new">
          <Plus className="mr-1 h-4 w-4" />
          Neues Dokument
        </Link>
      </Button>
    </div>
  ) : undefined
}
```

Before the closing `</div>` of the component:
```tsx
<ImportDialog open={importOpen} onOpenChange={setImportOpen} />
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/import/document-converter.ts components/domain/documents/import-dialog.tsx "app/(dashboard)/documents/page.tsx" package.json package-lock.json
git commit -m "feat: add multi-format document import (Word, PDF, Excel, PPTX)"
```

---

## Task 5: Branded Document Export

**Files:**
- Create: `lib/export/document-exporter.ts`
- Create: `convex/organizationSettings.ts`
- Modify: `convex/schema.ts` — add organizationSettings table
- Modify: `components/domain/documents/document-detail.tsx` — add export buttons
- Modify: `package.json` — add docx, jspdf, jspdf-autotable

**Step 1: Install dependencies**

Run: `npm install docx jspdf jspdf-autotable file-saver jszip`
Run: `npm install -D @types/file-saver`

**Step 2: Add organizationSettings to schema**

In `convex/schema.ts`, add before the Phase 4 TODO section (before line 601):

```ts
// Organization-specific settings (branding, logo, etc.)
organizationSettings: defineTable({
  organizationId: v.id("organizations"),
  logoFileId: v.optional(v.id("_storage")),
  logoFileName: v.optional(v.string()),
  primaryColor: v.optional(v.string()),
  secondaryColor: v.optional(v.string()),
  ...auditFields,
}).index("by_organization", ["organizationId"]),
```

**Step 3: Create organizationSettings CRUD**

Create `convex/organizationSettings.ts`:

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    organizationId: v.id("organizations"),
    logoFileId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:settings");
    const now = Date.now();

    const existing = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
        updatedBy: user._id,
      } as any);
      await logAuditEvent(ctx, {
        userId: user._id, action: "UPDATE",
        entityType: "organizationSettings", entityId: existing._id,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("organizationSettings", {
      ...args,
      isArchived: false,
      createdAt: now, updatedAt: now,
      createdBy: user._id, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "organizationSettings", entityId: id,
    });
    return id;
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requirePermission(ctx, "admin:settings");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.storage.getUrl(args.fileId);
  },
});
```

**Step 4: Push schema**

Run: `npx convex dev --once`
Expected: Deployment succeeds with new table

**Step 5: Create export module**

Create `lib/export/document-exporter.ts`:

```ts
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell,
  Header, Footer, PageNumber, NumberFormat,
  ImageRun, AlignmentType, BorderStyle, WidthType,
  TableBorders,
} from "docx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { saveAs } from "file-saver";

interface OrgSettings {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string | null;
  logoBuffer?: ArrayBuffer | null;
}

interface DocumentData {
  title?: string;
  documentCode: string;
  documentType: string;
  version: string;
  richContent: any;
  validFrom?: number;
}

// ============================================================
// WORD EXPORT
// ============================================================

export async function exportToWord(
  doc: DocumentData,
  settings: OrgSettings
): Promise<void> {
  const now = new Date();
  const standDate = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const title = doc.title ?? doc.documentCode;

  // Build content from Tiptap JSON
  const contentParagraphs = tiptapToDocxParagraphs(doc.richContent);

  // Build header
  const headerChildren: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: `Revision ${doc.version}`, size: 18 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Stand ${standDate}`, size: 18 }),
      ],
    }),
  ];

  // Title paragraph (centered, colored)
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 28,
        color: settings.primaryColor?.replace("#", "") || "0066CC",
      }),
    ],
  });

  const headerWithLogo: Header = new Header({
    children: headerChildren,
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: `${doc.documentCode}.docx`, size: 16 }),
          new TextRun({ text: "\t" }),
          new TextRun({ children: ["Seite ", PageNumber.CURRENT, " von ", PageNumber.TOTAL_PAGES], size: 16 }),
          new TextRun({ text: "\t" }),
          new TextRun({ text: standDate, size: 16 }),
        ],
      }),
    ],
  });

  const document = new Document({
    sections: [
      {
        headers: { default: headerWithLogo },
        footers: { default: footer },
        children: [titleParagraph, ...contentParagraphs],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
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
        result.push(new Paragraph({
          heading: headingMap[level] || HeadingLevel.HEADING_1,
          children: tiptapInlineToTextRuns(node.content),
        }));
        break;
      }
      case "paragraph": {
        result.push(new Paragraph({
          children: tiptapInlineToTextRuns(node.content),
        }));
        break;
      }
      case "bulletList": {
        for (const item of node.content || []) {
          if (item.type === "listItem") {
            for (const child of item.content || []) {
              if (child.type === "paragraph") {
                result.push(new Paragraph({
                  bullet: { level: 0 },
                  children: tiptapInlineToTextRuns(child.content),
                }));
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
                result.push(new Paragraph({
                  numbering: { reference: "default-numbering", level: 0 },
                  children: tiptapInlineToTextRuns(child.content),
                }));
              }
            }
          }
        }
        break;
      }
      case "blockquote": {
        for (const child of node.content || []) {
          result.push(new Paragraph({
            indent: { left: 720 },
            children: [
              ...tiptapInlineToTextRuns(child.content).map(
                (run: TextRun) => new TextRun({ ...run, italics: true, color: "666666" })
              ),
            ],
          }));
        }
        break;
      }
      case "horizontalRule": {
        result.push(new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
        }));
        break;
      }
      // Table, image, etc. can be added incrementally
      default:
        break;
    }
  }

  return result;
}

function tiptapInlineToTextRuns(content: any[]): TextRun[] {
  if (!content) return [new TextRun("")];
  return content.map((node) => {
    if (node.type === "text") {
      const marks = node.marks || [];
      const bold = marks.some((m: any) => m.type === "bold");
      const italic = marks.some((m: any) => m.type === "italic");
      const underline = marks.some((m: any) => m.type === "underline");
      const strike = marks.some((m: any) => m.type === "strike");
      return new TextRun({
        text: node.text,
        bold,
        italics: italic,
        underline: underline ? {} : undefined,
        strike,
      });
    }
    if (node.type === "hardBreak") {
      return new TextRun({ text: "", break: 1 });
    }
    return new TextRun(node.text || "");
  });
}

// ============================================================
// PDF EXPORT
// ============================================================

export async function exportToPDF(
  doc: DocumentData,
  settings: OrgSettings
): Promise<void> {
  const now = new Date();
  const standDate = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const title = doc.title ?? doc.documentCode;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  let y = margin + 20;

  // Header function
  const addHeader = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Revision ${doc.version}`, margin, 15);
    pdf.text(`Stand ${standDate}`, margin, 20);
    pdf.setFontSize(11);
    pdf.setTextColor(
      parseInt((settings.primaryColor || "#0066CC").slice(1, 3), 16),
      parseInt((settings.primaryColor || "#0066CC").slice(3, 5), 16),
      parseInt((settings.primaryColor || "#0066CC").slice(5, 7), 16)
    );
    pdf.setFont("helvetica", "bold");
    pdf.text(title, pageWidth / 2, 15, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0);
  };

  // Footer function
  const addFooter = (pageNum: number) => {
    pdf.setFontSize(7);
    pdf.setTextColor(100);
    pdf.text(`${doc.documentCode}.docx`, margin, pageHeight - 10);
    pdf.text(`Seite ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    pdf.text(standDate, pageWidth - margin, pageHeight - 10, { align: "right" });
    pdf.setTextColor(0);
  };

  addHeader();

  // Render content
  if (doc.richContent?.content) {
    for (const node of doc.richContent.content) {
      // Check page break
      if (y > pageHeight - 30) {
        addFooter(pdf.getNumberOfPages());
        pdf.addPage();
        y = margin + 20;
        addHeader();
      }

      switch (node.type) {
        case "heading": {
          const level = node.attrs?.level ?? 1;
          const sizes: Record<number, number> = { 1: 16, 2: 14, 3: 12, 4: 11 };
          pdf.setFontSize(sizes[level] || 11);
          pdf.setFont("helvetica", "bold");
          const text = extractText(node);
          pdf.text(text, margin, y);
          y += (sizes[level] || 11) * 0.5 + 4;
          pdf.setFont("helvetica", "normal");
          break;
        }
        case "paragraph": {
          pdf.setFontSize(10);
          const text = extractText(node);
          if (text) {
            const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
            for (const line of lines) {
              if (y > pageHeight - 30) {
                addFooter(pdf.getNumberOfPages());
                pdf.addPage();
                y = margin + 20;
                addHeader();
              }
              pdf.text(line, margin, y);
              y += 5;
            }
          }
          y += 3;
          break;
        }
        case "bulletList": {
          pdf.setFontSize(10);
          for (const item of node.content || []) {
            const text = extractText(item);
            if (text) {
              if (y > pageHeight - 30) {
                addFooter(pdf.getNumberOfPages());
                pdf.addPage();
                y = margin + 20;
                addHeader();
              }
              pdf.text("•", margin + 2, y);
              const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 8);
              for (const line of lines) {
                pdf.text(line, margin + 8, y);
                y += 5;
              }
            }
          }
          y += 3;
          break;
        }
        case "orderedList": {
          pdf.setFontSize(10);
          let idx = 1;
          for (const item of node.content || []) {
            const text = extractText(item);
            if (text) {
              if (y > pageHeight - 30) {
                addFooter(pdf.getNumberOfPages());
                pdf.addPage();
                y = margin + 20;
                addHeader();
              }
              pdf.text(`${idx}.`, margin + 2, y);
              const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin - 10);
              for (const line of lines) {
                pdf.text(line, margin + 10, y);
                y += 5;
              }
              idx++;
            }
          }
          y += 3;
          break;
        }
        default:
          break;
      }
    }
  }

  addFooter(pdf.getNumberOfPages());
  pdf.save(`${doc.documentCode}.pdf`);
}

function extractText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (node.content) return node.content.map(extractText).join("");
  return "";
}
```

**Step 6: Add export buttons to document detail**

In `components/domain/documents/document-detail.tsx`:

Add imports:
```tsx
import { FileText, FileDown, Archive } from "lucide-react";
import { exportToWord, exportToPDF } from "@/lib/export/document-exporter";
```

After the "Versionen" button (line ~178), add:

```tsx
{/* Export buttons */}
{document.richContent && (
  <>
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportToWord(
        {
          title: document.title,
          documentCode: document.documentCode,
          documentType: document.documentType,
          version: document.version,
          richContent: document.richContent,
        },
        { primaryColor: "#0066CC" }
      )}
    >
      <FileText className="mr-1 h-3.5 w-3.5" />
      Word
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportToPDF(
        {
          title: document.title,
          documentCode: document.documentCode,
          documentType: document.documentType,
          version: document.version,
          richContent: document.richContent,
        },
        { primaryColor: "#0066CC" }
      )}
    >
      <FileDown className="mr-1 h-3.5 w-3.5" />
      PDF
    </Button>
  </>
)}
```

**Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: PASS (may need type adjustments for jspdf-autotable)

Run: `npx convex dev --once`
Expected: Deployment succeeds

**Step 8: Commit**

```bash
git add lib/export/document-exporter.ts convex/organizationSettings.ts convex/schema.ts components/domain/documents/document-detail.tsx package.json package-lock.json
git commit -m "feat: add branded Word/PDF export with organization settings"
```

---

## Task 6: Document Archive & Delete Lifecycle

**Files:**
- Modify: `lib/types/domain.ts` — add `documents:delete` permission
- Modify: `convex/lib/permissions.ts` — add `documents:delete` for qmb/admin
- Modify: `convex/documents.ts` — add restore, permanentDelete, listArchived
- Modify: `app/(dashboard)/documents/page.tsx` — add archive tab
- Modify: `components/domain/documents/document-detail.tsx` — add archive/delete buttons
- Create: `components/domain/documents/delete-confirmation-dialog.tsx`

**Step 1: Add permission type**

In `lib/types/domain.ts`, add `| "documents:delete"` to the `PermissionAction` type (after `"documents:archive"`).

**Step 2: Add permission to roles**

In `convex/lib/permissions.ts`:

Add `"documents:delete"` to the `qmb` array (line ~12, after `"documents:archive"`):
```ts
"documents:archive", "documents:delete", "documents:link",
```

**Step 3: Add backend mutations**

In `convex/documents.ts`, after the `archive` mutation (line 335), add:

```ts
/** Restore an archived document */
export const restore = mutation({
  args: { id: v.id("documentRecords") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:archive");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Dokument nicht gefunden");
    if (!doc.isArchived) throw new Error("Dokument ist nicht archiviert");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: now,
      updatedBy: user._id,
    } as any);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "RESTORE",
      entityType: "documentRecords",
      entityId: args.id,
    });
  },
});

/** List archived documents */
export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "documents:archive");
    return await ctx.db
      .query("documentRecords")
      .filter((q) => q.eq(q.field("isArchived"), true))
      .collect();
  },
});

/** Permanently delete an archived document (QMB/Admin only) */
export const permanentDelete = mutation({
  args: { id: v.id("documentRecords") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:delete");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Dokument nicht gefunden");
    if (!doc.isArchived) throw new Error("Nur archivierte Dokumente können endgültig gelöscht werden");

    // Cascade: delete read confirmations
    const confirmations = await ctx.db
      .query("readConfirmations")
      .withIndex("by_document", (q) => q.eq("documentRecordId", args.id))
      .collect();
    for (const c of confirmations) {
      await ctx.db.delete(c._id);
    }

    // Cascade: delete version snapshots
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .collect();
    for (const v of versions) {
      await ctx.db.delete(v._id);
    }

    // Cascade: delete reviews
    const reviews = await ctx.db
      .query("documentReviews")
      .withIndex("by_document_status", (q) => q.eq("documentId", args.id))
      .collect();
    for (const r of reviews) {
      await ctx.db.delete(r._id);
    }

    // Audit before delete
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "documentRecords",
      entityId: args.id,
      metadata: { documentCode: doc.documentCode, title: doc.title },
    });

    // Delete the document
    await ctx.db.delete(args.id);
  },
});
```

**Step 4: Create delete confirmation dialog**

Create `components/domain/documents/delete-confirmation-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentCode: string;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  documentCode,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [typedCode, setTypedCode] = useState("");
  const [understood, setUnderstood] = useState(false);

  const canDelete = typedCode === documentCode && understood;

  const handleConfirm = () => {
    if (!canDelete) return;
    onConfirm();
    setTypedCode("");
    setUnderstood(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setTypedCode(""); setUnderstood(false); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Dokument endgültig löschen
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden. Das Dokument, alle
            Versionen, Lesebestätigungen und Reviews werden unwiderruflich gelöscht.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>
              Bitte geben Sie <code className="font-bold">{documentCode}</code> zur Bestätigung ein:
            </Label>
            <Input
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
              placeholder={documentCode}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(c) => setUnderstood(c === true)}
            />
            <label htmlFor="understood" className="text-sm leading-none pt-0.5">
              Ich verstehe, dass alle Versionen und Lesebestätigungen ebenfalls
              gelöscht werden
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!canDelete}>
              Endgültig löschen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 5: Update documents page with archive tab**

In `app/(dashboard)/documents/page.tsx`, add:

Import:
```tsx
import { DocumentList } from "@/components/domain/documents/document-list";
// Plus the new ArchivedDocumentList (or modify DocumentList to accept showArchived prop)
```

Add an `"archive"` tab to the TabsList:
```tsx
<TabsTrigger value="archive">Archiv</TabsTrigger>
```

When `typeFilter === "archive"`, render the archived documents list (using `api.documents.listArchived` query) with restore + delete buttons.

**Step 6: Update document detail with archive button**

In `components/domain/documents/document-detail.tsx`:

Add archive button in the action buttons section (after the status change buttons):

```tsx
{can("documents:archive") && !document.isArchived && (
  <Button
    variant="outline"
    size="sm"
    onClick={async () => {
      try {
        await archiveDocument({ id: documentId as any });
        toast.success("Dokument archiviert");
      } catch (err: any) {
        toast.error(err.message ?? "Fehler");
      }
    }}
  >
    <Archive className="mr-1 h-3.5 w-3.5" />
    Archivieren
  </Button>
)}
```

Add the mutation:
```tsx
const archiveDocument = useMutation(api.documents.archive);
```

**Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx convex dev --once`
Expected: Deployment succeeds

**Step 8: Commit**

```bash
git add lib/types/domain.ts convex/lib/permissions.ts convex/documents.ts "app/(dashboard)/documents/page.tsx" components/domain/documents/document-detail.tsx components/domain/documents/delete-confirmation-dialog.tsx
git commit -m "feat: add document archive, restore, and permanent delete lifecycle"
```

---

## Task 7: Final Verification & Cleanup

**Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

**Step 2: Convex deployment**

Run: `npx convex dev --once`
Expected: Deployment succeeds

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address TypeScript errors from integration"
```

---

## Parallelization Guide

Tasks that can run in parallel (independent of each other):

| Group | Tasks | Why independent |
|-------|-------|----------------|
| **Group A** | Task 1 (CSS fixes) + Task 2 (Sticky toolbar) | Different files, no overlap |
| **Group B** | Task 3 (Image upload) | Depends on convex/documents.ts changes |
| **Group C** | Task 4 (Import) + Task 5 (Export) | Different modules, minimal overlap |
| **Group D** | Task 6 (Archive/Delete) | Modifies convex/documents.ts, permissions |

**Recommended execution order:**
1. Tasks 1+2 in parallel (quick CSS/layout fixes)
2. Task 6 (backend changes to documents.ts + permissions)
3. Task 3 (adds to documents.ts after Task 6)
4. Tasks 4+5 in parallel (import and export are independent)
5. Task 7 (final verification)

**OR with subagents:**
- Agent A: Tasks 1+2 (editor fixes)
- Agent B: Task 3 (image upload)
- Agent C: Task 4 (import)
- Agent D: Task 5 (export)
- Agent E: Task 6 (archive/delete)
- Then: Task 7 (verification)
