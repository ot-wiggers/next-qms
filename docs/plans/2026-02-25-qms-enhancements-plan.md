# QMS Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Sanity with Tiptap + Convex, add notification system, extended document workflows, dashboard KPIs, document graph, review scheduling, and global search.

**Architecture:** All content moves from Sanity to Convex with Tiptap JSON storage. Notifications use a three-layer system (event detection → creation → delivery via in-app/email/digest). Extended features build on existing Convex patterns (state machines, RBAC, audit logging).

**Tech Stack:** Next.js 16, Convex, Tiptap, Resend, React Flow, Recharts, cmdk

**Design Doc:** `docs/plans/2026-02-25-qms-enhancements-design.md`

---

## Phase 1: Foundation — Schema & Sanity Removal

### Task 1: Update Convex Schema with New Tables

**Files:**
- Modify: `convex/schema.ts`
- Modify: `lib/types/enums.ts`
- Modify: `lib/types/domain.ts`

**Step 1: Add new table definitions to schema.ts**

Add these tables after the existing `readConfirmations` table:

```typescript
// Document Versions — snapshots for diff view
documentVersions: defineTable({
  documentId: v.id("documentRecords"),
  version: v.number(),
  content: v.any(), // Tiptap JSON snapshot
  contentPlaintext: v.string(),
  changedBy: v.id("users"),
  changedAt: v.number(),
  changeDescription: v.optional(v.string()),
  status: v.string(),
}).index("by_document", ["documentId"])
  .index("by_document_version", ["documentId", "version"]),

// Document Reviews — multi-reviewer workflow
documentReviews: defineTable({
  documentId: v.id("documentRecords"),
  version: v.number(),
  reviewerId: v.id("users"),
  status: v.string(), // PENDING | APPROVED | CHANGES_REQUESTED
  comments: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_document", ["documentId"])
  .index("by_reviewer", ["reviewerId"])
  .index("by_document_status", ["documentId", "status"]),

// Document Links — relationships between documents
documentLinks: defineTable({
  sourceDocumentId: v.id("documentRecords"),
  targetDocumentId: v.id("documentRecords"),
  linkType: v.string(), // references | supersedes | implements | related
  createdAt: v.number(),
  createdBy: v.id("users"),
}).index("by_source", ["sourceDocumentId"])
  .index("by_target", ["targetDocumentId"]),

// Notifications
notifications: defineTable({
  userId: v.id("users"),
  type: v.string(),
  title: v.string(),
  message: v.string(),
  resourceType: v.optional(v.string()), // document | training | task | training_request
  resourceId: v.optional(v.string()),
  isRead: v.boolean(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_user", ["userId"])
  .index("by_user_unread", ["userId", "isRead"])
  .index("by_user_created", ["userId", "createdAt"]),

// Notification Preferences
notificationPreferences: defineTable({
  userId: v.id("users"),
  emailEnabled: v.boolean(),
  digestFrequency: v.string(), // daily | weekly | none
  mutedEventTypes: v.array(v.string()),
}).index("by_user", ["userId"]),
```

**Step 2: Modify existing documentRecords table**

Add new fields to the `documentRecords` table definition:

```typescript
documentRecords: defineTable({
  // Existing fields remain...
  sanityDocumentId: v.optional(v.string()), // Keep temporarily for migration
  documentType: v.string(),
  documentCode: v.string(),
  version: v.string(),
  content: v.optional(v.string()),
  status: v.string(),
  validFrom: v.optional(v.number()),
  validUntil: v.optional(v.number()),
  responsibleUserId: v.id("users"),
  reviewerId: v.optional(v.id("users")),
  approvedAt: v.optional(v.number()),
  approvedById: v.optional(v.id("users")),

  // NEW fields
  title: v.optional(v.string()),
  slug: v.optional(v.string()),
  richContent: v.optional(v.any()), // Tiptap JSON document tree
  contentPlaintext: v.optional(v.string()), // Extracted text for search
  category: v.optional(v.string()), // quality_policy | process | responsibility | resource
  nextReviewDate: v.optional(v.number()),
  reviewIntervalDays: v.optional(v.number()), // Default 365
  departmentId: v.optional(v.id("organizations")),
  attachments: v.optional(v.array(v.object({
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    uploadedAt: v.number(),
    uploadedBy: v.id("users"),
  }))),
  parentDocumentId: v.optional(v.id("documentRecords")),
  sortOrder: v.optional(v.number()),
  requiresReconfirmation: v.optional(v.boolean()),
  reconfirmationType: v.optional(v.string()), // read_only | training_required

  // Audit fields (existing)
  isArchived: v.boolean(),
  createdAt: v.number(),
  createdBy: v.id("users"),
  updatedAt: v.number(),
  updatedBy: v.id("users"),
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),
}).index("by_status", ["status"])
  .index("by_type", ["documentType"])
  .index("by_parent", ["parentDocumentId"])
  .index("by_responsible", ["responsibleUserId"])
  .index("by_review_date", ["nextReviewDate"])
  .index("by_slug", ["slug"]),
```

**Step 3: Add new enums to lib/types/enums.ts**

```typescript
// Notification types
export const NOTIFICATION_TYPES = [
  "DOCUMENT_REVIEW_REQUESTED",
  "DOCUMENT_APPROVED",
  "DOCUMENT_REJECTED",
  "DOCUMENT_PUBLISHED",
  "DOCUMENT_REVIEW_DUE",
  "DOCUMENT_LINKED_CHANGED",
  "TRAINING_REQUEST_SUBMITTED",
  "TRAINING_REQUEST_APPROVED",
  "TRAINING_REQUEST_REJECTED",
  "TRAINING_ASSIGNED",
  "TRAINING_FEEDBACK_DUE",
  "TRAINING_EFFECTIVENESS_DUE",
  "TRAINING_INEFFECTIVE",
  "TASK_ASSIGNED",
  "TASK_OVERDUE",
  "TASK_COMPLETED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  DOCUMENT_REVIEW_REQUESTED: "Dokument zur Prüfung",
  DOCUMENT_APPROVED: "Dokument freigegeben",
  DOCUMENT_REJECTED: "Dokument abgelehnt",
  DOCUMENT_PUBLISHED: "Neues Dokument veröffentlicht",
  DOCUMENT_REVIEW_DUE: "Dokumentenüberprüfung fällig",
  DOCUMENT_LINKED_CHANGED: "Verlinktes Dokument geändert",
  TRAINING_REQUEST_SUBMITTED: "Schulungswunsch eingereicht",
  TRAINING_REQUEST_APPROVED: "Schulungswunsch genehmigt",
  TRAINING_REQUEST_REJECTED: "Schulungswunsch abgelehnt",
  TRAINING_ASSIGNED: "Schulung zugeteilt",
  TRAINING_FEEDBACK_DUE: "Feedback fällig",
  TRAINING_EFFECTIVENESS_DUE: "Wirksamkeitsprüfung fällig",
  TRAINING_INEFFECTIVE: "Schulung unwirksam",
  TASK_ASSIGNED: "Aufgabe zugewiesen",
  TASK_OVERDUE: "Aufgabe überfällig",
  TASK_COMPLETED: "Aufgabe abgeschlossen",
};

// Review statuses
export const REVIEW_STATUSES = ["PENDING", "APPROVED", "CHANGES_REQUESTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Document link types
export const DOCUMENT_LINK_TYPES = ["references", "supersedes", "implements", "related"] as const;
export type DocumentLinkType = (typeof DOCUMENT_LINK_TYPES)[number];

// Document categories
export const DOCUMENT_CATEGORIES = ["quality_policy", "process", "responsibility", "resource"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  quality_policy: "Qualitätspolitik",
  process: "Prozess",
  responsibility: "Verantwortlichkeit",
  resource: "Ressource",
};

// Digest frequencies
export const DIGEST_FREQUENCIES = ["daily", "weekly", "none"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

// Reconfirmation types
export const RECONFIRMATION_TYPES = ["read_only", "training_required"] as const;
export type ReconfirmationType = (typeof RECONFIRMATION_TYPES)[number];

// Add to existing TASK_TYPES
// "DOCUMENT_REVIEW_DUE" — add to the existing TASK_TYPES array
```

**Step 4: Add new permission actions to lib/types/domain.ts**

Add to the `PermissionAction` type:

```typescript
| "notifications:read" | "notifications:manage"
| "documents:link"
| "dashboard:view" | "dashboard:view_all"
```

**Step 5: Run `npx convex dev` to verify schema compiles**

Run: `npx convex dev`
Expected: Schema successfully deployed, no errors

**Step 6: Commit**

```bash
git add convex/schema.ts lib/types/enums.ts lib/types/domain.ts
git commit -m "feat: add schema for notifications, document versions, reviews, links"
```

---

### Task 2: Remove Sanity — Files, Dependencies, Routes

**Files:**
- Delete: `sanity/` directory (all files)
- Delete: `app/studio/[[...tool]]/page.tsx`
- Modify: `package.json`
- Modify: any files importing from `@sanity/*`, `next-sanity`, or `@portabletext/react`

**Step 1: Find all Sanity imports across the codebase**

Run: `grep -r "@sanity\|next-sanity\|@portabletext\|sanity/" --include="*.ts" --include="*.tsx" -l`

Remove or replace all found imports. The `components/shared/portable-text.tsx` component will be replaced by Tiptap rendering later.

**Step 2: Delete Sanity directory and Studio route**

```bash
rm -rf sanity/
rm -rf app/studio/
```

**Step 3: Remove Sanity dependencies from package.json**

Remove these from `dependencies`:
- `@portabletext/react`
- `@sanity/client`
- `@sanity/image-url`
- `next-sanity`

**Step 4: Remove Sanity environment variables**

Remove from `.env.local` (if present):
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`

**Step 5: Remove Sanity references from sidebar navigation**

Modify: `components/layout/sidebar.tsx` — remove any "Studio" nav item

**Step 6: Install packages and verify build**

Run: `npm install && npm run build`
Expected: Build succeeds with no Sanity-related errors

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove Sanity CMS — all content moves to Convex"
```

---

### Task 3: Update Permissions and State Machine

**Files:**
- Modify: `convex/lib/permissions.ts`
- Modify: `convex/lib/stateMachine.ts`

**Step 1: Add new permissions to the RBAC matrix**

In `convex/lib/permissions.ts`, add to each role:

```typescript
// qmb additions:
"notifications:read", "notifications:manage",
"documents:link",
"dashboard:view", "dashboard:view_all",

// department_lead additions:
"notifications:read", "notifications:manage",
"documents:review", // NEW — dept leads can now review
"documents:link",
"dashboard:view",

// employee additions:
"notifications:read", "notifications:manage",

// auditor additions:
"notifications:read",
"dashboard:view_all",
```

**Step 2: Add review status state machine**

In `convex/lib/stateMachine.ts`, add:

```typescript
reviewStatus: {
  PENDING: ["APPROVED", "CHANGES_REQUESTED"],
  APPROVED: [],
  CHANGES_REQUESTED: [],
},
```

**Step 3: Verify Convex deploys**

Run: `npx convex dev`
Expected: No errors

**Step 4: Commit**

```bash
git add convex/lib/permissions.ts convex/lib/stateMachine.ts
git commit -m "feat: extend permissions for notifications, reviews, dashboard"
```

---

## Phase 2: Tiptap Editor

### Task 4: Install Tiptap Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install all Tiptap packages**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-link @tiptap/extension-image @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-placeholder @tiptap/extension-text-align @tiptap/extension-highlight @tiptap/extension-underline @tiptap/extension-typography @tiptap/suggestion
```

**Step 2: Install Mermaid for process diagrams (lazy-loaded)**

```bash
npm install mermaid
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Tiptap editor dependencies"
```

---

### Task 5: Build Base Editor Component

**Files:**
- Create: `components/editor/DocumentEditor.tsx`
- Create: `components/editor/Toolbar.tsx`
- Create: `components/editor/SlashMenu.tsx`
- Create: `components/editor/extensions/slash-command.ts`

**Step 1: Create the slash command extension**

Create `components/editor/extensions/slash-command.ts`:

Build a Tiptap suggestion extension that:
- Triggers on `/` character
- Shows a dropdown with available block types
- Each item has: title, description, icon, command function
- Items: Überschrift 1-4, Tabelle, Aufzählung, Nummerierte Liste, Checkliste, Zitat, Trennlinie, Dokument-Referenz, Anhang, Hinweisbox, Prozessdiagramm, Inhaltsverzeichnis
- Filter items as user types after `/`
- Execute the command on selection (insert the block)
- Use `@tiptap/suggestion` as the foundation
- Render the popup using a React component (see SlashMenu.tsx)

**Step 2: Create the SlashMenu component**

Create `components/editor/SlashMenu.tsx`:

- React component rendered by the suggestion extension
- Styled with shadcn/ui patterns (rounded border, shadow, bg-popover)
- Keyboard navigation (arrow up/down, enter to select, escape to close)
- Each item shows: Lucide icon, title, short description
- Group items by category (Text, Listen, Medien, QMS)

**Step 3: Create the Toolbar component**

Create `components/editor/Toolbar.tsx`:

- Horizontal toolbar with button groups separated by dividers
- Uses shadcn `Toggle` or custom buttons with Lucide icons
- Groups:
  1. Headings: H1, H2, H3, H4 (dropdown or individual buttons)
  2. Text formatting: Bold, Italic, Underline, Strikethrough, Highlight
  3. Alignment: Left, Center, Right
  4. Lists: Bullet, Numbered, Checklist
  5. Insert: Table, Link, Image
  6. QMS: Document Reference, Attachment, Callout, Diagram, TOC
- Active state highlighting (when cursor is in bold text, bold button is active)
- Disabled states (e.g., can't bold inside code block)
- Receives `editor` instance as prop

**Step 4: Create the DocumentEditor component**

Create `components/editor/DocumentEditor.tsx`:

```typescript
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Typography from "@tiptap/extension-typography";
import { Toolbar } from "./Toolbar";
// Custom extensions added in later tasks

interface DocumentEditorProps {
  content?: any; // Tiptap JSON
  onChange?: (json: any) => void;
  editable?: boolean;
}

export function DocumentEditor({ content, onChange, editable = true }: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Schreiben Sie hier oder tippen Sie / für Befehle...",
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Underline,
      Typography,
      // SlashCommand extension added here
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {editable && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[400px] focus:outline-none"
      />
    </div>
  );
}
```

**Step 5: Add Tiptap prose styles to globals.css**

Add editor-specific styles for headings, tables, callouts, task lists, etc.:

```css
/* Tiptap Editor Styles */
.tiptap {
  > * + * { margin-top: 0.75em; }
  h1 { font-size: 1.875rem; font-weight: 700; }
  h2 { font-size: 1.5rem; font-weight: 600; }
  h3 { font-size: 1.25rem; font-weight: 600; }
  h4 { font-size: 1.125rem; font-weight: 500; }
  ul[data-type="taskList"] { list-style: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid hsl(var(--border)); padding: 0.5rem; }
  th { background: hsl(var(--muted)); font-weight: 600; }
}
```

**Step 6: Verify editor renders**

Create a temporary test page or add the editor to an existing page to verify it renders and basic typing works.

Run: `npm run dev` → navigate to page with editor
Expected: Editor renders with toolbar, typing works, slash menu appears on `/`

**Step 7: Commit**

```bash
git add components/editor/ app/globals.css
git commit -m "feat: add Tiptap base editor with toolbar and slash menu"
```

---

### Task 6: Build Custom QMS Extensions

**Files:**
- Create: `components/editor/extensions/document-reference.ts`
- Create: `components/editor/extensions/attachment-block.ts`
- Create: `components/editor/extensions/callout-block.ts`
- Create: `components/editor/extensions/process-diagram.ts`
- Create: `components/editor/extensions/table-of-contents.ts`
- Create: `components/editor/nodes/DocumentReferenceNode.tsx`
- Create: `components/editor/nodes/AttachmentBlockNode.tsx`
- Create: `components/editor/nodes/CalloutBlockNode.tsx`
- Create: `components/editor/nodes/ProcessDiagramNode.tsx`
- Create: `components/editor/nodes/TableOfContentsNode.tsx`

**Step 1: DocumentReference extension + node**

Extension (`document-reference.ts`):
- Inline node type `documentReference`
- Attributes: `documentId` (string), `documentCode` (string), `documentTitle` (string), `documentStatus` (string)
- Renders using `DocumentReferenceNode.tsx`
- Parsed from / serialized to Tiptap JSON

Node (`DocumentReferenceNode.tsx`):
- Renders as inline chip/badge: `[QMH-4.2.3 Verantwortlichkeiten]`
- Color based on status (green=APPROVED, yellow=IN_REVIEW, gray=DRAFT)
- Click → `router.push(/documents/${documentId})`
- Hover → tooltip with status, version, last updated
- When inserting via slash menu: show a search dialog to pick a document (query `documents.list`)

**Step 2: AttachmentBlock extension + node**

Extension (`attachment-block.ts`):
- Block node type `attachmentBlock`
- Attributes: `fileId` (string), `fileName` (string), `fileSize` (number), `uploadedAt` (number), `uploadedBy` (string)

Node (`AttachmentBlockNode.tsx`):
- Renders as a card with: file icon (based on extension), filename, file size, upload date
- Download button → uses Convex storage URL
- Delete button (only in edit mode)
- When inserting: trigger file upload dialog, upload to Convex Storage, insert node with metadata

**Step 3: CalloutBlock extension + node**

Extension (`callout-block.ts`):
- Block node type `calloutBlock`
- Attributes: `type` ("info" | "warning" | "danger" | "tip")
- Content: allows rich text inside (paragraphs, bold, lists)
- Use `Node.create` with `content: "block+"` to allow nested content

Node (`CalloutBlockNode.tsx`):
- Renders as colored box with icon:
  - info: blue bg, Info icon
  - warning: yellow bg, AlertTriangle icon
  - danger: red bg, AlertCircle icon
  - tip: green bg, Lightbulb icon
- Dropdown to change callout type
- Content area is editable rich text

**Step 4: ProcessDiagram extension + node**

Extension (`process-diagram.ts`):
- Block node type `processDiagram`
- Attributes: `code` (string — Mermaid syntax)

Node (`ProcessDiagramNode.tsx`):
- Toggle between: code editor (textarea with Mermaid syntax) and SVG preview
- Use `mermaid.render()` for preview (lazy-loaded: `dynamic import`)
- Error display if Mermaid syntax is invalid
- Default template when inserting:
  ```
  graph TD
    A[Start] --> B[Prozessschritt]
    B --> C{Entscheidung}
    C -->|Ja| D[Ergebnis A]
    C -->|Nein| E[Ergebnis B]
  ```

**Step 5: TableOfContents extension + node**

Extension (`table-of-contents.ts`):
- Block node type `tableOfContents`
- No attributes — auto-generated from document headings
- Read-only node (not editable)

Node (`TableOfContentsNode.tsx`):
- Scans the editor document for all heading nodes
- Renders as ordered list with indent based on heading level
- Each item is clickable → scrolls to the heading in the editor
- Live-updating as headings change (use `editor.on('update')`)

**Step 6: Register all extensions in DocumentEditor.tsx**

Add all custom extensions to the `extensions` array in `DocumentEditor.tsx`.

**Step 7: Update SlashMenu with QMS items**

Add items for all custom extensions: `/dokument`, `/anhang`, `/hinweis`, `/warnung`, `/diagramm`, `/inhaltsverzeichnis`

**Step 8: Verify all extensions work**

Run: `npm run dev` → test each extension in the editor
Expected: All nodes insert, render, and function correctly

**Step 9: Commit**

```bash
git add components/editor/
git commit -m "feat: add custom QMS editor extensions (doc-ref, attachment, callout, diagram, TOC)"
```

---

### Task 7: Integrate Editor into Document Pages

**Files:**
- Modify: `convex/documents.ts` — update create/update mutations for rich content
- Create: `app/(dashboard)/documents/[id]/edit/page.tsx`
- Modify: `app/(dashboard)/documents/[id]/page.tsx` — render rich content read-only
- Modify: `app/(dashboard)/documents/new/page.tsx` — use editor for creation
- Modify: `components/domain/documents/document-list.tsx` — add edit button

**Step 1: Update document mutations in convex/documents.ts**

Add/modify `create` mutation to accept:
- `title`, `richContent` (Tiptap JSON), `contentPlaintext`, `category`, `parentDocumentId`, `sortOrder`, `reviewIntervalDays`, `requiresReconfirmation`, `reconfirmationType`

Add/modify `update` mutation to accept the same fields.

Add a helper function `extractPlaintext(tiptapJson)` that recursively walks the JSON tree and extracts all text content. Call it when saving to populate `contentPlaintext`.

**Step 2: Create document edit page**

Create `app/(dashboard)/documents/[id]/edit/page.tsx`:

- Load document by ID via `useQuery(api.documents.getById)`
- Permission check: only admin/qmb can edit
- Form with: title, documentCode, documentType, category, responsible user
- DocumentEditor component with current `richContent`
- Auto-save with debounce (500ms) via `useMutation(api.documents.update)`
- "Speichern" button for explicit save
- "Zurück" link to document detail
- Attachment upload integrated (Convex Storage)

**Step 3: Update document detail page for read-only rendering**

Modify `app/(dashboard)/documents/[id]/page.tsx`:

- Replace Sanity Portable Text rendering with Tiptap read-only editor
- Use `<DocumentEditor content={doc.richContent} editable={false} />`
- Add "Bearbeiten" button (visible to admin/qmb only) → links to edit page
- Keep existing read confirmation button

**Step 4: Update document creation page**

Modify `app/(dashboard)/documents/new/page.tsx`:

- Add DocumentEditor for content authoring
- Add all new fields (title, category, review interval, etc.)
- On submit: call `documents.create` with richContent + extracted plaintext

**Step 5: Update document list**

Modify `components/domain/documents/document-list.tsx`:

- Add "Bearbeiten" action button in row actions (admin/qmb only)
- Add title column (in addition to documentCode)
- Add category filter

**Step 6: Remove portable-text.tsx component**

Delete `components/shared/portable-text.tsx` (replaced by Tiptap rendering).

**Step 7: Verify full document CRUD flow**

Run: `npm run dev`
Test: Create document → Edit with rich content → View read-only → List shows correctly

**Step 8: Commit**

```bash
git add convex/documents.ts app/(dashboard)/documents/ components/domain/documents/ components/shared/
git commit -m "feat: integrate Tiptap editor into document pages, replace Portable Text"
```

---

## Phase 3: Notification System

### Task 8: Notification Backend — Queries, Mutations, Helpers

**Files:**
- Create: `convex/notifications.ts`
- Create: `convex/lib/notificationHelpers.ts`

**Step 1: Create notification helpers**

Create `convex/lib/notificationHelpers.ts`:

```typescript
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function createNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: string;
    title: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
  }
) {
  // Check if user has muted this notification type
  const prefs = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();

  if (prefs?.mutedEventTypes?.includes(args.type)) return;

  // Create in-app notification
  const notificationId = await ctx.db.insert("notifications", {
    ...args,
    isRead: false,
    createdAt: Date.now(),
  });

  // Schedule email if enabled
  if (prefs?.emailEnabled !== false) { // Default to enabled
    await ctx.scheduler.runAfter(0, internal.email.sendNotificationEmail, {
      notificationId,
      userId: args.userId,
    });
  }

  return notificationId;
}

export async function createNotificationsForUsers(
  ctx: MutationCtx,
  userIds: Id<"users">[],
  notification: Omit<Parameters<typeof createNotification>[1], "userId">
) {
  for (const userId of userIds) {
    await createNotification(ctx, { ...notification, userId });
  }
}
```

**Step 2: Create notifications.ts with queries and mutations**

Create `convex/notifications.ts`:

Queries:
- `listUnread(userId)` — returns unread notifications for current user, ordered by createdAt desc
- `listAll({ limit })` — returns all notifications for current user (paginated), ordered by createdAt desc
- `unreadCount()` — returns count of unread notifications for current user

Mutations:
- `markAsRead({ id })` — sets isRead=true, readAt=Date.now()
- `markAllAsRead()` — marks all unread notifications for current user as read
- `updatePreferences({ emailEnabled, digestFrequency, mutedEventTypes })` — upsert notification preferences
- `getPreferences()` — query to get current user's notification preferences

Follow existing patterns: use `requirePermission(ctx, "notifications:read")`, audit fields not needed for notifications (they are ephemeral).

**Step 3: Verify Convex deploys**

Run: `npx convex dev`
Expected: No errors

**Step 4: Commit**

```bash
git add convex/notifications.ts convex/lib/notificationHelpers.ts
git commit -m "feat: add notification backend — queries, mutations, helper functions"
```

---

### Task 9: Notification UI — Bell, Center, Preferences

**Files:**
- Create: `components/notifications/NotificationBell.tsx`
- Create: `components/notifications/NotificationCenter.tsx`
- Create: `components/notifications/NotificationItem.tsx`
- Create: `app/(dashboard)/settings/notifications/page.tsx`
- Modify: `components/layout/topbar.tsx` — add NotificationBell

**Step 1: Create NotificationItem component**

Create `components/notifications/NotificationItem.tsx`:

- Props: notification object
- Renders: icon (based on type), title, message, timestamp (relative — "vor 5 Min.")
- Unread indicator (blue dot)
- Click handler: mark as read + navigate to resource
- Resource link based on `resourceType` + `resourceId`

**Step 2: Create NotificationCenter component**

Create `components/notifications/NotificationCenter.tsx`:

- Uses shadcn `Sheet` or `Popover` (side panel or dropdown)
- Header: "Benachrichtigungen" + "Alle als gelesen markieren" button
- Filter tabs: Alle | Dokumente | Schulungen | Aufgaben
- Scrollable list of NotificationItem components
- Empty state: "Keine Benachrichtigungen"
- Uses `useQuery(api.notifications.listAll)` with Convex real-time subscription

**Step 3: Create NotificationBell component**

Create `components/notifications/NotificationBell.tsx`:

- Bell icon (Lucide `Bell`)
- Red badge with unread count (uses `useQuery(api.notifications.unreadCount)`)
- Click opens NotificationCenter
- Badge hidden when count is 0

**Step 4: Add NotificationBell to Topbar**

Modify `components/layout/topbar.tsx`:
- Import and add `<NotificationBell />` next to user menu
- Position: right side of topbar, before user avatar

**Step 5: Create Notification Preferences page**

Create `app/(dashboard)/settings/notifications/page.tsx`:

- Form with:
  - Toggle: E-Mail-Benachrichtigungen (emailEnabled)
  - Select: Digest-Frequenz (daily | weekly | none)
  - Checkbox group: Events stummschalten (grouped by category)
- Uses `useQuery(api.notifications.getPreferences)` for current values
- Uses `useMutation(api.notifications.updatePreferences)` on save

**Step 6: Add Settings link to sidebar**

Modify `components/layout/sidebar.tsx`:
- Add "Einstellungen" section with "Benachrichtigungen" link → `/settings/notifications`

**Step 7: Verify UI works**

Run: `npm run dev`
Test: Bell appears in topbar, clicking opens notification center, preferences page loads

**Step 8: Commit**

```bash
git add components/notifications/ components/layout/ app/(dashboard)/settings/
git commit -m "feat: add notification UI — bell icon, notification center, preferences page"
```

---

### Task 10: Email Integration with Resend

**Files:**
- Install: `resend` package
- Create: `convex/email.ts`

**Step 1: Install Resend**

```bash
npm install resend
```

**Step 2: Create email module**

Create `convex/email.ts`:

- Internal action `sendNotificationEmail({ notificationId, userId })`:
  - Fetch notification and user from DB
  - Build HTML email using template function
  - Send via Resend API
  - Uses `RESEND_API_KEY` environment variable

- Internal action `sendDigestEmail({ userId })`:
  - Fetch all unread notifications since last digest
  - Group by category
  - Build digest HTML template
  - Send via Resend

- Template functions:
  - `buildNotificationEmailHtml(notification, user)` — single notification email
  - `buildDigestEmailHtml(notifications, user)` — grouped summary email
  - All emails include: app logo, notification content, direct link to resource, unsubscribe link
  - German language

**Step 3: Add Resend API key to Convex environment**

Run: `npx convex env set RESEND_API_KEY <key>` (user provides their key)

**Step 4: Commit**

```bash
git add convex/email.ts package.json package-lock.json
git commit -m "feat: add Resend email integration for notifications"
```

---

### Task 11: Digest Cron Jobs

**Files:**
- Modify: `convex/crons.ts`
- Modify: `convex/email.ts` (add digest logic)

**Step 1: Add digest cron jobs to crons.ts**

```typescript
// Daily digest at 07:00 CET (06:00 UTC)
crons.daily(
  "send-daily-digest",
  { hourUTC: 6, minuteUTC: 0 },
  internal.email.sendDailyDigest
);

// Weekly digest Monday at 07:00 CET (06:00 UTC)
crons.weekly(
  "send-weekly-digest",
  { dayOfWeek: "monday", hourUTC: 6, minuteUTC: 0 },
  internal.email.sendWeeklyDigest
);

// Check document review dates daily at 03:30 CET
crons.daily(
  "check-document-review-dates",
  { hourUTC: 2, minuteUTC: 30 },
  internal.documents.checkReviewDates
);

// Check overdue document reviews daily at 04:00 CET
crons.daily(
  "check-overdue-reviews",
  { hourUTC: 3, minuteUTC: 0 },
  internal.documents.checkOverdueReviews
);
```

**Step 2: Implement digest internal actions in email.ts**

`sendDailyDigest`:
- Query all users where `notificationPreferences.digestFrequency === "daily"`
- For each user: fetch unread notifications since yesterday 07:00
- If any exist: call `sendDigestEmail`

`sendWeeklyDigest`:
- Query all users where `notificationPreferences.digestFrequency === "weekly"`
- For each user: fetch unread notifications since last Monday 07:00
- If any exist: call `sendDigestEmail`

**Step 3: Commit**

```bash
git add convex/crons.ts convex/email.ts
git commit -m "feat: add daily/weekly digest cron jobs and document review date checks"
```

---

### Task 12: Wire Notification Triggers into Existing Mutations

**Files:**
- Modify: `convex/documents.ts`
- Modify: `convex/trainings.ts`
- Modify: `convex/trainingRequests.ts`
- Modify: `convex/tasks.ts`

**Step 1: Document notifications in documents.ts**

In `updateStatus` mutation, after status change:

```typescript
import { createNotification, createNotificationsForUsers } from "./lib/notificationHelpers";

// When status changes to IN_REVIEW:
if (args.status === "IN_REVIEW") {
  // Notify all assigned reviewers
  const reviews = await ctx.db
    .query("documentReviews")
    .withIndex("by_document_status", (q) =>
      q.eq("documentId", args.id).eq("status", "PENDING")
    )
    .collect();
  for (const review of reviews) {
    await createNotification(ctx, {
      userId: review.reviewerId,
      type: "DOCUMENT_REVIEW_REQUESTED",
      title: "Dokument zur Prüfung",
      message: `"${doc.documentCode}" wurde zur Prüfung eingereicht.`,
      resourceType: "document",
      resourceId: args.id,
    });
  }
}

// When status changes to APPROVED:
if (args.status === "APPROVED") {
  // Notify document author
  await createNotification(ctx, {
    userId: doc.createdBy,
    type: "DOCUMENT_APPROVED",
    title: "Dokument freigegeben",
    message: `"${doc.documentCode}" wurde freigegeben.`,
    resourceType: "document",
    resourceId: args.id,
  });

  // Create READ_DOCUMENT tasks + notifications for affected employees
  // (reuse existing logic from documents.ts, add notification call)
}
```

**Step 2: Training notifications in trainings.ts**

- When participant added → TRAINING_ASSIGNED notification
- When session status → HELD → TRAINING_FEEDBACK_DUE for participants
- When effectiveness check due → TRAINING_EFFECTIVENESS_DUE
- When effectiveness = INEFFECTIVE → TRAINING_INEFFECTIVE to QMB + dept lead

**Step 3: Training request notifications in trainingRequests.ts**

- When request created → TRAINING_REQUEST_SUBMITTED to QMB + dept lead
- When request approved → TRAINING_REQUEST_APPROVED to requester
- When request rejected → TRAINING_REQUEST_REJECTED to requester

**Step 4: Task notifications in tasks.ts**

- When task created/assigned → TASK_ASSIGNED
- In `checkOverdue` cron → TASK_OVERDUE
- When task status → DONE → TASK_COMPLETED to creator

**Step 5: Add checkReviewDates and checkOverdueReviews internal mutations to documents.ts**

```typescript
// Internal mutation called by cron
export const checkReviewDates = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysFromNow = now + 60 * 24 * 60 * 60 * 1000;

    const documents = await ctx.db
      .query("documentRecords")
      .withIndex("by_review_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("status"), "APPROVED"),
          q.lte(q.field("nextReviewDate"), sixtyDaysFromNow)
        )
      )
      .collect();

    for (const doc of documents) {
      if (!doc.nextReviewDate || !doc.responsibleUserId) continue;
      const daysUntilDue = (doc.nextReviewDate - now) / (24 * 60 * 60 * 1000);

      if (daysUntilDue <= 0) {
        // Overdue — escalate: notify QMB + dept lead, create URGENT task
        // ...
      } else if (daysUntilDue <= 30) {
        // 30 days — create task + notify responsible + QMB
        // ...
      } else if (daysUntilDue <= 60) {
        // 60 days — info notification to responsible
        // ...
      }
    }
  },
});
```

**Step 6: Verify all triggers work**

Run: `npm run dev`
Test: Change document status → verify notification appears in notification center

**Step 7: Commit**

```bash
git add convex/documents.ts convex/trainings.ts convex/trainingRequests.ts convex/tasks.ts
git commit -m "feat: wire notification triggers into all existing mutations"
```

---

## Phase 4: Extended Document Workflows

### Task 13: Multi-Reviewer System

**Files:**
- Create: `convex/documentReviews.ts`
- Modify: `convex/documents.ts` — connect review workflow
- Create: `components/domain/documents/review-panel.tsx`
- Modify: `app/(dashboard)/documents/[id]/page.tsx` — add review UI

**Step 1: Create documentReviews.ts**

Queries:
- `listByDocument({ documentId })` — all reviews for a document
- `getMyReview({ documentId })` — current user's review for a document

Mutations:
- `assignReviewers({ documentId, reviewerIds })` — create PENDING reviews, send notifications
- `submitReview({ documentId, status, comments })` — update review status, validate state machine
- `removeReviewer({ reviewId })` — delete a pending review

Logic:
- When all reviews are APPROVED → auto-transition document to APPROVED (or notify QMB to approve)
- When any review is CHANGES_REQUESTED → notify document author

**Step 2: Create review-panel.tsx component**

- Shows list of assigned reviewers with their review status
- QMB/admin can add/remove reviewers (user picker dialog)
- Each reviewer row: avatar, name, status badge, comments (if any), reviewed date
- Current user can submit their review (approve/request changes + comment field)
- Only visible when document is IN_REVIEW

**Step 3: Integrate review panel into document detail page**

Modify `app/(dashboard)/documents/[id]/page.tsx`:
- Add ReviewPanel component below document content
- Show "Zur Prüfung einreichen" button (creates reviews + transitions to IN_REVIEW)
- "Prüfer zuweisen" dialog before submitting for review

**Step 4: Update document status flow**

Modify `convex/documents.ts`:
- When transitioning to IN_REVIEW: verify at least one reviewer is assigned
- When all reviewers approve: allow transition to APPROVED

**Step 5: Commit**

```bash
git add convex/documentReviews.ts convex/documents.ts components/domain/documents/review-panel.tsx app/(dashboard)/documents/
git commit -m "feat: add multi-reviewer workflow with review panel"
```

---

### Task 14: Version Snapshots and Diff View

**Files:**
- Create: `convex/documentVersions.ts`
- Modify: `convex/documents.ts` — create snapshot on approval
- Create: `app/(dashboard)/documents/[id]/versions/page.tsx`
- Create: `components/domain/documents/version-diff.tsx`
- Install: `diff` package

**Step 1: Install diff library**

```bash
npm install diff
npm install -D @types/diff
```

**Step 2: Create documentVersions.ts**

Queries:
- `listByDocument({ documentId })` — all versions ordered by version number desc
- `getVersion({ documentId, version })` — specific version snapshot

Mutations:
- `createSnapshot({ documentId })` — internal, called when document reaches APPROVED
  - Reads current document content
  - Increments version counter
  - Stores full JSON snapshot + plaintext

**Step 3: Create version snapshot on approval**

Modify `convex/documents.ts` — in `updateStatus` mutation:
- When status changes to APPROVED: call `documentVersions.createSnapshot`

**Step 4: Create version-diff.tsx component**

Uses the `diff` library to compare two plaintext versions:
- Side-by-side view (two columns)
- Color coding: green for additions, red for deletions
- Line numbers
- Dropdown selectors for "Version A" and "Version B"

**Step 5: Create versions page**

Create `app/(dashboard)/documents/[id]/versions/page.tsx`:
- List of all versions with: version number, date, changed by, status, change description
- "Vergleichen" button opens diff view modal
- Default: compare latest two versions

**Step 6: Add "Versionen" tab/link on document detail page**

Modify document detail page: add link to versions page.

**Step 7: Commit**

```bash
git add convex/documentVersions.ts convex/documents.ts app/(dashboard)/documents/ components/domain/documents/ package.json package-lock.json
git commit -m "feat: add document version snapshots and diff view"
```

---

### Task 15: Auto-Reconfirmation on Document Changes

**Files:**
- Modify: `convex/documents.ts` — add reconfirmation logic

**Step 1: Implement auto-reconfirmation in updateStatus**

In `convex/documents.ts`, when document transitions to APPROVED and version > 1:

```typescript
if (args.status === "APPROVED" && doc.requiresReconfirmation !== false) {
  // Mark existing read confirmations as outdated
  const existingConfirmations = await ctx.db
    .query("readConfirmations")
    .withIndex("by_document", (q) => q.eq("documentRecordId", args.id))
    .collect();

  // Get all users who need to reconfirm
  const confirmedUserIds = existingConfirmations.map((c) => c.userId);

  // Create new tasks for reconfirmation
  for (const userId of confirmedUserIds) {
    const taskType = doc.reconfirmationType === "training_required"
      ? "TRAINING_FEEDBACK"
      : "READ_DOCUMENT";

    await ctx.db.insert("tasks", {
      type: taskType,
      title: `Dokument "${doc.documentCode}" wurde aktualisiert — bitte erneut bestätigen`,
      description: `Version ${doc.version} wurde freigegeben. Bitte lesen und bestätigen Sie das aktualisierte Dokument.`,
      status: "OPEN",
      priority: "MEDIUM",
      assigneeId: userId,
      resourceType: "documentRecords",
      resourceId: args.id,
      dueDate: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
      isArchived: false,
      createdAt: Date.now(),
      createdBy: user._id,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });

    // Notification
    await createNotification(ctx, {
      userId,
      type: "DOCUMENT_PUBLISHED",
      title: "Aktualisiertes Dokument",
      message: `"${doc.documentCode}" wurde in einer neuen Version veröffentlicht. Bitte erneut bestätigen.`,
      resourceType: "document",
      resourceId: args.id,
    });
  }
}
```

**Step 2: Commit**

```bash
git add convex/documents.ts
git commit -m "feat: auto-create reconfirmation tasks when approved documents are updated"
```

---

## Phase 5: Additional Features

### Task 16: Document Relationship Graph

**Files:**
- Install: `@xyflow/react`
- Create: `convex/documentLinks.ts`
- Create: `app/(dashboard)/documents/graph/page.tsx`
- Create: `components/domain/documents/document-graph.tsx`

**Step 1: Install React Flow**

```bash
npm install @xyflow/react
```

**Step 2: Create documentLinks.ts**

Queries:
- `listByDocument({ documentId })` — all links where source or target matches
- `listAll()` — all document links (for full graph view)

Mutations:
- `create({ sourceDocumentId, targetDocumentId, linkType })` — create link, validate both docs exist
- `delete({ linkId })` — remove link

**Step 3: Create document-graph.tsx component**

- Fetches all documents + links via Convex queries
- Transforms to React Flow nodes and edges:
  - Nodes: document card (code, title, status badge), colored by type
  - Edges: labeled with link type, colored by type
- Interactive: zoom, pan, click node to navigate
- Filter controls: document type, status
- Layout algorithm: dagre or elkjs for automatic positioning

**Step 4: Create graph page**

Create `app/(dashboard)/documents/graph/page.tsx`:
- Full-width layout (no sidebar constraints)
- DocumentGraph component
- "Auswirkungsanalyse" mode: highlight a document and all its connections

**Step 5: Add "Verlinkung" UI in document editor**

- In document detail/edit page: section showing linked documents
- "Verknüpfung hinzufügen" button → dialog to search and link another document
- Each link shows: target document, link type, remove button

**Step 6: Add sidebar navigation item**

Modify `components/layout/sidebar.tsx`: add "Dokumenten-Graph" under Documents section.

**Step 7: Commit**

```bash
git add convex/documentLinks.ts app/(dashboard)/documents/graph/ components/domain/documents/ components/layout/sidebar.tsx package.json package-lock.json
git commit -m "feat: add document relationship graph with React Flow"
```

---

### Task 17: Review Scheduling (Wiedervorlage)

**Files:**
- Modify: `convex/documents.ts` — add review date calculation on approval
- The cron jobs were already added in Task 11

**Step 1: Auto-calculate nextReviewDate on approval**

In `convex/documents.ts`, when document transitions to APPROVED:

```typescript
if (args.status === "APPROVED") {
  const reviewIntervalDays = doc.reviewIntervalDays ?? 365;
  const effectiveDate = doc.validFrom ?? Date.now();
  const nextReviewDate = effectiveDate + reviewIntervalDays * 24 * 60 * 60 * 1000;

  patch.nextReviewDate = nextReviewDate;
}
```

**Step 2: Add "Überprüfung bestätigen" action**

New mutation `confirmReview({ documentId })`:
- Only callable by responsible user or QMB
- Resets nextReviewDate to now + reviewIntervalDays
- Logs audit event
- Closes the DOCUMENT_REVIEW_DUE task

**Step 3: Add review date display on document detail page**

Show: "Nächste Überprüfung: DD.MM.YYYY" with traffic light color:
- Green: >60 days
- Yellow: 30-60 days
- Red: <30 days or overdue

Add "Überprüfung bestätigen" button (for responsible user / QMB).

**Step 4: Commit**

```bash
git add convex/documents.ts app/(dashboard)/documents/
git commit -m "feat: add automatic review scheduling with confirmation workflow"
```

---

### Task 18: Dashboard KPI Widgets

**Files:**
- Install: `recharts`
- Modify: `app/(dashboard)/page.tsx` — add KPI widgets
- Create: `components/domain/dashboard/kpi-open-reviews.tsx`
- Create: `components/domain/dashboard/kpi-read-confirmations.tsx`
- Create: `components/domain/dashboard/kpi-training-quota.tsx`
- Create: `components/domain/dashboard/kpi-overdue-tasks.tsx`
- Create: `components/domain/dashboard/kpi-upcoming-reviews.tsx`
- Create: `components/domain/dashboard/kpi-effectiveness-rate.tsx`
- Create: `components/domain/dashboard/kpi-document-status.tsx`
- Create: `convex/dashboard.ts` — aggregation queries

**Step 1: Install Recharts**

```bash
npm install recharts
```

**Step 2: Create dashboard aggregation queries**

Create `convex/dashboard.ts`:

Queries (all permission-gated):
- `openReviews()` — count documents in IN_REVIEW, oldest review date
- `readConfirmationRates()` — per APPROVED document: confirmed/total ratio
- `trainingQuota()` — % employees with all required trainings completed
- `overdueTasks({ scope })` — count + list of overdue tasks (filtered by role)
- `upcomingReviews()` — documents with nextReviewDate in next 90 days
- `effectivenessRate()` — % of effectiveness checks rated EFFECTIVE
- `documentStatusDistribution()` — count per status for pie chart

Role-based filtering:
- Admin/QMB/Auditor: all data
- Department lead: own department only
- Employee: own tasks/confirmations only

**Step 3: Create KPI widget components**

Each widget:
- Uses shadcn `Card` component
- Shows: title, main KPI number, trend/detail
- Some use Recharts (pie chart for document status, bar chart for training quota)
- Click navigates to detailed view

**Step 4: Update dashboard page**

Modify `app/(dashboard)/page.tsx`:
- Grid layout with KPI widgets
- Role-based rendering (admin/QMB see all, employee sees reduced set)
- Responsive: 3 columns on desktop, 1 on mobile

**Step 5: Commit**

```bash
git add convex/dashboard.ts app/(dashboard)/page.tsx components/domain/dashboard/ package.json package-lock.json
git commit -m "feat: add dashboard KPI widgets with Recharts"
```

---

### Task 19: Global Full-Text Search (Cmd+K)

**Files:**
- Create: `components/shared/command-search.tsx`
- Create: `convex/search.ts`
- Modify: `components/layout/topbar.tsx` — add search trigger
- Modify: `app/(dashboard)/layout.tsx` — add keyboard shortcut

**Step 1: Create search backend**

Create `convex/search.ts`:

Query `globalSearch({ query })`:
- Search documents: match against `contentPlaintext`, `title`, `documentCode` (case-insensitive substring match)
- Search trainings: match against `title`, `description`
- Search tasks: match against `title`, `description`
- Search users: match against `firstName`, `lastName`, `email`
- Return grouped results: `{ documents: [...], trainings: [...], tasks: [...], users: [...] }`
- Limit to 5 results per category
- Permission-gated: employee can't search users (unless they have users:list)

Note: Convex has built-in full-text search via `searchIndex`. Add search indexes to schema:

```typescript
// Add to documentRecords table definition:
.searchIndex("search_content", {
  searchField: "contentPlaintext",
  filterFields: ["status", "documentType", "isArchived"],
})
.searchIndex("search_title", {
  searchField: "title",
  filterFields: ["status", "documentType", "isArchived"],
})

// Add to trainings table:
.searchIndex("search_title", {
  searchField: "title",
  filterFields: ["status", "isArchived"],
})

// Add to tasks table:
.searchIndex("search_title", {
  searchField: "title",
  filterFields: ["status", "isArchived"],
})
```

**Step 2: Create command-search.tsx component**

Uses the existing `cmdk` dependency (already in package.json) and shadcn Command component:

- `Cmd+K` / `Ctrl+K` opens the dialog
- Search input at top
- Results grouped by category with icons:
  - Documents: FileText icon
  - Trainings: GraduationCap icon
  - Tasks: CheckSquare icon
  - Users: User icon
- Each result shows: title, type badge, status badge, text excerpt
- Arrow keys to navigate, Enter to select (navigate to resource)
- Escape to close
- Debounced search (300ms)

**Step 3: Integrate into layout**

Modify `components/layout/topbar.tsx`:
- Add search icon/button that opens CommandSearch
- Show keyboard shortcut hint "⌘K"

Modify `app/(dashboard)/layout.tsx`:
- Add CommandSearch component at layout level (so it's available everywhere)

**Step 4: Commit**

```bash
git add convex/search.ts convex/schema.ts components/shared/command-search.tsx components/layout/topbar.tsx app/(dashboard)/layout.tsx
git commit -m "feat: add global full-text search with Cmd+K command palette"
```

---

## Phase 6: Cleanup & Polish

### Task 20: Final Cleanup and Verification

**Files:**
- Various

**Step 1: Remove any remaining Sanity references**

Run: `grep -r "sanity\|portable-text\|@portabletext" --include="*.ts" --include="*.tsx" -l`
Clean up any remaining references.

**Step 2: Verify full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Verify all routes work**

Manual testing checklist:
- [ ] `/documents` — list loads, filters work
- [ ] `/documents/new` — create with Tiptap editor
- [ ] `/documents/[id]` — detail page with read-only content
- [ ] `/documents/[id]/edit` — edit with Tiptap editor
- [ ] `/documents/[id]/versions` — version history + diff
- [ ] `/documents/graph` — relationship graph renders
- [ ] `/dashboard` — KPI widgets load with real data
- [ ] `/settings/notifications` — preferences save correctly
- [ ] Notification bell shows unread count
- [ ] Notification center opens and shows notifications
- [ ] `Cmd+K` opens global search
- [ ] Document review workflow: assign reviewers → submit → review → approve
- [ ] Auto-reconfirmation: approve updated doc → tasks created for previous readers

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup — remove Sanity remnants, fix build issues"
```

---

## Dependency Summary

### Install
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-link @tiptap/extension-image @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-placeholder @tiptap/extension-text-align @tiptap/extension-highlight @tiptap/extension-underline @tiptap/extension-typography @tiptap/suggestion mermaid @xyflow/react recharts resend diff
npm install -D @types/diff
```

### Remove
```bash
npm uninstall @sanity/client @sanity/image-url next-sanity @portabletext/react sanity
```

## Task Order & Dependencies

```
Phase 1 (Foundation):
  Task 1 (Schema) → Task 2 (Remove Sanity) → Task 3 (Permissions)

Phase 2 (Editor):
  Task 4 (Install) → Task 5 (Base Editor) → Task 6 (Custom Extensions) → Task 7 (Integration)

Phase 3 (Notifications):
  Task 8 (Backend) → Task 9 (UI) → Task 10 (Email) → Task 11 (Crons) → Task 12 (Wire Triggers)

Phase 4 (Workflows):
  Task 13 (Multi-Reviewer) → Task 14 (Versioning) → Task 15 (Auto-Reconfirmation)

Phase 5 (Features):
  Task 16 (Graph) | Task 17 (Review Scheduling) | Task 18 (Dashboard) | Task 19 (Search)
  — These four can be done in parallel

Phase 6:
  Task 20 (Cleanup) — after all other tasks

Phases 1-2 must complete before Phase 3.
Phase 3 must complete before Phase 4.
Phase 5 can start after Phase 2.
```
