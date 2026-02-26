# Design: Editor-Fixes, Import/Export, Archivierung & Bildupload

**Datum**: 2026-02-26
**Status**: Approved

## Übersicht

7 Anforderungen gruppiert in 3 Kategorien:

- **A) Editor-Fixes** — Tabellenlinien, Bullets, Sticky Toolbar, Bildupload (Punkte 2, 3, 7)
- **B) Dokument Import/Export** — Multi-Format Import + gebrandeter Word/PDF Export (Punkte 4, 5)
- **C) Dokument Lifecycle** — Archivieren, Wiederherstellen, endgültiges Löschen (Punkt 6)

---

## A) Editor-Fixes

### A1) Tabellenlinien sichtbar machen

**Problem**: Tailwind v4 Preflight entfernt Border-Styles. Die bestehenden CSS-Regeln in `globals.css` (`.tiptap th, td`) haben `border: 1px solid hsl(var(--border))`, aber `border-style` wird nicht explizit gesetzt.

**Fix** (`globals.css`):
- `.tiptap table` bekommt `border: 1px solid hsl(var(--border))`
- `.tiptap th, .tiptap td` bekommt explizites `border-style: solid; border-width: 1px`

### A2) Bullet-Points und nummerierte Listen

**Problem**: Tailwind Preflight entfernt `list-style-type`. CSS setzt nur `padding-left`.

**Fix** (`globals.css`):
```css
.tiptap ul:not([data-type="taskList"]) { list-style-type: disc; }
.tiptap ol { list-style-type: decimal; }
.tiptap li { margin-top: 0.25em; }
.tiptap ul ul { list-style-type: circle; }
.tiptap ul ul ul { list-style-type: square; }
```

### A3) Sticky Toolbar

**Änderungen**:
- `DocumentEditor.tsx`: Editor-Content-Area bekommt `overflow-y: auto` und `max-h-[70vh]`
- `Toolbar.tsx`: Wrapper-div bekommt `sticky top-0 z-10 bg-background`

```tsx
// DocumentEditor.tsx
<div className="border rounded-lg overflow-hidden">
  {editable && <Toolbar editor={editor} />}
  <div className="overflow-y-auto max-h-[70vh]">
    <EditorContent editor={editor} className="p-4 min-h-[400px]" />
  </div>
</div>

// Toolbar.tsx
<div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background px-2 py-1">
```

### A4) Bildupload im Editor

**Backend** (`convex/documents.ts`):
- `generateUploadUrl` mutation — benötigt `documents:create` Permission
- `getFileUrl` query — benötigt `documents:read` Permission

**Custom Hook** (`components/editor/hooks/useEditorImageUpload.ts`):
```ts
export function useEditorImageUpload() {
  // Returns: { fileInputRef, triggerUpload: (editor) => void, FileInput: JSX.Element }
  // Flow: generateUploadUrl → fetch POST → getFileUrl → editor.setImage({ src })
}
```

**Toolbar** — Neuer Button `ImageUp` neben bestehendem `Image` (URL-Eingabe bleibt erhalten)

**Slash-Menü** — Neuer Eintrag „Bild hochladen" in Kategorie „Medien"

---

## B) Dokument Import/Export

### B1) Dokumentenimport

**Neue Dependencies**: `mammoth`, `pdf-parse`

**Konvertierungs-Modul** (`lib/import/document-converter.ts`):
```ts
export async function convertToTiptapJSON(
  file: File
): Promise<{ json: any; title?: string; warnings: string[] }>
```

| Format | Bibliothek | Strategie |
|--------|-----------|-----------|
| .docx | `mammoth` | HTML → Tiptap `generateJSON()`. Bilder → Convex Storage Upload |
| .pdf | `pdf-parse` | Text-Extraktion → Paragraphen-Erkennung → Tiptap JSON |
| .xlsx | `xlsx` (installiert) | Sheet → Tiptap-Tabelle mit Header-Row |
| .pptx | `jszip` + XML | Folien-Text → H2 + Paragraphen pro Folie |

**UI-Flow** (Neuer Dialog auf Dokumenten-Seite):
1. Datei auswählen (Drag & Drop oder Picker)
2. Vorschau (Tiptap read-only) + Metadaten-Formular (Titel, Code, Typ, Version, Verantwortlicher)
3. „Importieren" erstellt Dokument mit Status DRAFT

**Button**: „Importieren" (FileUp Icon) neben „Neues Dokument" auf der Dokumenten-Seite

### B2) Gebrandeter Dokumentenexport

**Neue Tabelle** `organizationSettings`:
```ts
organizationSettings: defineTable({
  organizationId: v.id("organizations"),
  logoFileId: v.optional(v.id("_storage")),
  logoFileName: v.optional(v.string()),
  primaryColor: v.optional(v.string()),     // Default: "#0066CC"
  secondaryColor: v.optional(v.string()),   // Default: "#CC0000"
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
}).index("by_organization", ["organizationId"])
```

**Export-Template** (basierend auf Wiggers-PDF):

Header jede Seite:
- Links: `Revision {version}`, `Stand {MM.YYYY}`
- Mitte: Kapitel-Titel (primaryColor, fett), Untertitel
- Rechts: Org-Logo

Footer jede Seite:
- Links: `{documentCode}.docx`
- Mitte: `Seite {n} von {total}`
- Rechts: `{MM.YYYY}`

**Export-Modul** (`lib/export/document-exporter.ts`):
```ts
export async function exportToWord(doc, settings): Promise<Blob>  // npm `docx`
export async function exportToPDF(doc, settings): Promise<Blob>   // npm `jspdf` + `jspdf-autotable`
```

**Neue Dependencies**: `docx`, `jspdf`, `jspdf-autotable`

**UI**: Zwei Buttons in der Dokument-Detailansicht:
- „Als Word exportieren" (FileText Icon)
- „Als PDF exportieren" (FileDown Icon)

**Admin-UI**: Neuer Bereich in Einstellungen → „Organisation" → Logo hochladen, Farben konfigurieren

---

## C) Dokument Lifecycle — Archivieren & Löschen

### Permissions

| Aktion | Rollen | Permission |
|--------|--------|------------|
| Archivieren | department_lead, qmb, admin | `documents:archive` (existiert) |
| Wiederherstellen | qmb, admin | `documents:archive` |
| Endgültig Löschen | qmb, admin | `documents:delete` (neu) |

### Backend (`convex/documents.ts`)

**`archive`** — Existiert bereits (Zeile 329–335)

**`restore`** (Neu):
- Setzt `isArchived: false`
- Erfordert `documents:archive` Permission
- Audit-Log mit Action `RESTORE`

**`permanentDelete`** (Neu):
- Erfordert `documents:delete` Permission (nur QMB/Admin)
- Validierung: Dokument muss archiviert sein
- Cascade-Deletes: readConfirmations, documentVersions, documentReviews, verknüpfte Tasks
- Audit-Log mit Action `PERMANENT_DELETE`
- Physisches `ctx.db.delete()`

**`listArchived`** (Neu):
- Gibt nur `isArchived: true` Dokumente zurück
- Erfordert `documents:archive` Permission

### UI-Änderungen

**Dokumenten-Seite** (`documents/page.tsx`):
- Neuer Tab „Archiv" in der TabsList
- Archivierte Dokumente mit gedämpfter Darstellung + Badge
- Aktionen pro archiviertem Dokument: „Wiederherstellen", „Endgültig löschen"

**Dokument-Detailansicht** (`document-detail.tsx`):
- Button „Archivieren" (Archive Icon) für department_lead+
- Wenn archiviert: Alert-Banner mit Restore-Button

**Bestätigungsdialog für Permanent Delete**:
- Warnung: „Diese Aktion kann nicht rückgängig gemacht werden"
- Nutzer tippt Dokumenten-Code zur Bestätigung
- Checkbox: „Alle Versionen und Lesebestätigungen werden ebenfalls gelöscht"

---

## Dateien-Übersicht

### Neue Dateien
- `lib/import/document-converter.ts` — Multi-Format → Tiptap JSON Konvertierung
- `lib/export/document-exporter.ts` — Tiptap JSON → gebrandete Word/PDF
- `components/editor/hooks/useEditorImageUpload.ts` — Upload-Hook für Editor
- `convex/organizationSettings.ts` — CRUD für Org-Settings

### Geänderte Dateien
- `app/globals.css` — Table borders, list styles
- `components/editor/Toolbar.tsx` — Sticky, Bildupload-Button
- `components/editor/DocumentEditor.tsx` — Scrollable content area, Bildupload-Integration
- `components/editor/extensions/slash-command.ts` — „Bild hochladen" Eintrag
- `convex/schema.ts` — `organizationSettings` Tabelle
- `convex/documents.ts` — generateUploadUrl, getFileUrl, restore, permanentDelete, listArchived
- `convex/lib/permissions.ts` — `documents:delete` Permission
- `app/(dashboard)/documents/page.tsx` — Import-Button, Archiv-Tab
- `components/domain/documents/document-detail.tsx` — Export-Buttons, Archiv-Buttons
- `package.json` — mammoth, pdf-parse, docx, jspdf, jspdf-autotable

### Neue Dependencies
- `mammoth` — .docx → HTML
- `pdf-parse` — PDF → Text
- `docx` — .docx Generierung
- `jspdf` + `jspdf-autotable` — PDF Generierung
