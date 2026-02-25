# QMS Enhancements Design: Rich-Text Editor, Notifications & Extended Features

**Date:** 2026-02-25
**Status:** Approved
**Scope:** QM-Handbuch Editor, Notification System, Document Workflows, Dashboard, Search

---

## 1. Overview

This design covers five major enhancements to the QMS application:

1. **Sanity ablösen** — migrate all content from Sanity to Convex, remove Sanity Studio
2. **Tiptap Rich-Text Editor** — hybrid editor (toolbar + slash menu) for all document types
3. **Notification System** — in-app, email, and digest notifications
4. **Extended Document Workflows** — multi-reviewer, version diff, auto-reconfirmation
5. **Additional Features** — document graph, review scheduling, dashboard KPIs, global search

### Key Decisions

- **Approach:** Tiptap JSON stored directly in Convex (Ansatz 1 — simplest, no information loss)
- **Editor style:** Hybrid (toolbar + slash menu) using Tiptap
- **Sanity:** Complete removal — all content migrated to Convex
- **Notifications:** In-app (realtime) + individual emails + daily/weekly digest
- **Email provider:** Resend
- **Document workflows:** Multi-reviewer (parallel/sequential) + version diff (no check-out/check-in locking)

---

## 2. Data Model

### Modified Tables

**`documents`** (extends existing `documentRecords`):
- `id`, `title`, `slug`, `documentNumber` (e.g., "QMH-4.2.3")
- `documentType`: qm_handbook | work_instruction | form_template | process_description
- `category`: quality_policy | process | responsibility | resource
- `content`: JSON (Tiptap document tree)
- `contentPlaintext`: string (extracted text for full-text search)
- `status`: DRAFT | IN_REVIEW | APPROVED | ARCHIVED
- `version`: number (incremental)
- `effectiveDate`, `nextReviewDate`, `reviewIntervalDays`
- `responsibleUserId`, `departmentId`
- `attachments`: Array<{ fileId, fileName, fileSize, uploadedAt, uploadedBy }>
- `parentDocumentId?`: for handbook chapter hierarchy
- `sortOrder`: number (ordering within hierarchy)
- `requiresReconfirmation`: boolean (default true)
- `reconfirmationType`: read_only | training_required
- Remove: `sanityDocumentId`
- Standard audit fields (createdAt, createdBy, updatedAt, updatedBy, isArchived)

### New Tables

**`documentVersions`** — version snapshots for diff:
- `documentId`, `version`, `content` (JSON snapshot), `contentPlaintext`
- `changedBy`, `changedAt`, `changeDescription`
- `status` (document status at time of snapshot)

**`documentReviews`** — extended multi-reviewer workflow:
- `documentId`, `version`, `reviewerId`
- `status`: PENDING | APPROVED | CHANGES_REQUESTED
- `comments`: string
- `reviewedAt`

**`documentLinks`** — relationships between documents:
- `sourceDocumentId`, `targetDocumentId`
- `linkType`: references | supersedes | implements | related

**`notifications`**:
- `userId`, `type` (enum of all trigger events)
- `title`, `message`
- `resourceType`: document | training | task | training_request
- `resourceId`
- `isRead`: boolean, `readAt`
- `createdAt`

**`notificationPreferences`**:
- `userId`
- `emailEnabled`: boolean
- `digestFrequency`: daily | weekly | none
- `mutedEventTypes`: Array<string>

### Removed

- All Sanity schemas (qmDocument, workInstruction, formTemplate)
- `sanityDocumentId` reference from document records
- Sanity Studio route (`/studio`)

---

## 3. Tiptap Editor Architecture

### Standard Extensions

StarterKit (paragraphs, bold, italic, headings H1-H4, lists, blockquotes, code), Table, TaskList, Link, Image, Placeholder, Typography, TextAlign, Highlight, Underline.

### Custom QMS Extensions

**DocumentReference Node** — inline/block element referencing another QM document. Renders as chip/badge (e.g., `[QMH-4.2.3 Verantwortlichkeiten]`). Click navigates, hover shows preview popup with status and version.

**AttachmentBlock Node** — block element for file attachments. Shows filename, size, upload date, download button. Files stored in Convex Storage.

**CalloutBlock Node** — colored hint boxes with icon:
- `info` (blue), `warning` (yellow), `danger` (red), `tip` (green)
- Contains rich text (paragraphs, lists, bold inside the box)

**ProcessDiagram Node** — embedded flowcharts using Mermaid.js syntax, rendered as SVG preview. Text-based for version diffing.

**TableOfContents Node** — auto-generated TOC from document headings. Live-updating, clickable jump links.

### UI Components

**Toolbar:** H1-H4 | B I U S | Align | List | Table | Link Image | DocRef Attachment | Callout Diagram | TOC

**Slash Menu (`/`):** All insertable elements searchable via dropdown.

### Component Structure

```
components/editor/
  DocumentEditor.tsx          (main component with Tiptap instance)
  Toolbar.tsx                 (toolbar with all buttons)
  SlashMenu.tsx               (slash menu dropdown)
  extensions/
    document-reference.ts     (custom node)
    attachment-block.ts       (custom node)
    callout-block.ts          (custom node)
    process-diagram.ts        (custom node)
    table-of-contents.ts      (custom node)
  nodes/
    DocumentReferenceNode.tsx  (React rendering)
    AttachmentBlockNode.tsx
    CalloutBlockNode.tsx
    ProcessDiagramNode.tsx
    TableOfContentsNode.tsx
```

---

## 4. Notification System

### Three-Layer Architecture

**Layer 1: Event Detection** — triggered directly in Convex mutations. No separate event bus needed.

**Layer 2: Notification Creation** — central `createNotification()` internal function called by all mutations. Checks user preferences before queuing email.

**Layer 3: Delivery** — three channels:
- **In-App (realtime):** Convex subscription, bell icon with unread badge, notification center (sidebar/dropdown), filterable by type
- **Email (individual):** Resend, async via Convex scheduler, HTML templates per type, direct link to resource, unsubscribe per event type
- **Digest (daily/weekly):** Cron job at 7:00, groups unread by category, only sends if unread notifications exist

### Trigger Mapping

| Event | Recipients |
|---|---|
| Document → IN_REVIEW | All assigned reviewers |
| Document → APPROVED / rejected | Document author |
| Document → APPROVED (newly published) | All affected employees (dept/location) |
| Document review due in 30 days | Responsible person + QMB |
| Linked document changed | Authors of all linked documents |
| Training request submitted | QMB + department lead |
| Training request approved/rejected | Requester |
| Training assigned | Participants |
| Feedback due | Participants |
| Effectiveness check due | Participant + department lead |
| Effectiveness "ineffective" | QMB + department lead |
| Task assigned | Task assignee |
| Task overdue | Assignee + creator |
| Task completed | Task creator |

### Cron Jobs (new)

- `checkDocumentReviewDates` (daily) — documents with nextReviewDate within 30/60 days
- `checkOverdueReviews` (daily) — document reviews PENDING for >7 days
- `sendDailyDigest` (daily 7:00)
- `sendWeeklyDigest` (Mondays 7:00)

### Notification Preferences UI

Route: `/settings/notifications`
- Toggle: email notifications on/off
- Digest frequency: daily / weekly / off
- Per event category: in-app / email / both / muted

---

## 5. Extended Features

### 5.1 Auto-Reconfirmation on Document Changes

When a document is approved at a new version:
- If `requiresReconfirmation` is true: create READ_DOCUMENT tasks for all employees who confirmed the previous version
- Mark existing read confirmations as `outdated`
- QMB can choose: "read confirmation only" vs. "retraining required"
- Affected employees determined by: department, location, or all active employees (company-wide documents)

### 5.2 Document Relationship Graph

Route: `/documents/graph`

Technology: React Flow (`@xyflow/react`)

- Documents as nodes, colored by type (handbook=blue, work instruction=green, form=orange, process=purple)
- Edges show relationship type (references, supersedes, implements)
- Click node → navigate to document
- Filter by document type and status
- Impact analysis: click "Auswirkungsanalyse" to see all directly/indirectly linked documents, optionally create tasks for responsible persons

### 5.3 Review Scheduling (Wiedervorlage)

Automatic periodic review cycles for documents:

1. Document approved → `nextReviewDate` calculated (effectiveDate + reviewIntervalDays)
2. Daily cron checks upcoming reviews
3. **60 days before:** info notification to responsible person
4. **30 days before:** task created + notification to QMB
5. **Overdue:** escalation to QMB + department lead, task marked URGENT
6. After review: responsible person confirms "document is current" or starts revision

New task type: `DOCUMENT_REVIEW_DUE`

Dashboard widget: "Anstehende Überprüfungen" with traffic light colors (green >60d, yellow 30-60d, red <30d/overdue)

### 5.4 Dashboard & Reporting

Extended dashboard at `/dashboard` with role-based KPI widgets:

| Widget | Content |
|---|---|
| Offene Reviews | Documents in IN_REVIEW, oldest review |
| Lesebestätigungen | Confirmed/total ratio per document |
| Schulungsquote | % employees with completed mandatory trainings |
| Überfällige Aufgaben | Count + list of most overdue tasks |
| Anstehende Überprüfungen | Documents with review due in next 90 days |
| Wirksamkeitsquote | % trainings rated "effective" |
| Dokumenten-Status | Pie chart: document count per status |

Technology: Recharts

Role-based visibility:
- Admin/QMB: all widgets, all data
- Department lead: filtered to own department
- Employee: only "my open tasks", "my pending read confirmations"

### 5.5 Global Full-Text Search

Command palette (`Cmd+K` / `Ctrl+K`) in topbar.

- Searches: documents (contentPlaintext, title, documentNumber), trainings (name, description), tasks (title, description), users (name, email)
- Results grouped by type with badges, status, text excerpt with highlight
- Enter → navigate to resource
- Component: `cmdk` (shadcn/ui Command component)

### 5.6 Version Diff

On each status change to APPROVED: current content JSON saved as snapshot in `documentVersions`.

- Diff view: two versions side-by-side, changes color-coded
- Tiptap JSON rendered to HTML, then HTML diff
- UI: "Versionen vergleichen" button on document detail → modal with side-by-side view, dropdown to select versions
- Technology: `diff` library

---

## 6. Sanity Migration Strategy

### Removal

- `/sanity` directory (schemas, client, queries)
- `/app/studio` route (embedded Sanity Studio)
- All `@sanity/*` and `@portabletext/*` dependencies
- `sanityDocumentId` reference field
- Sanity environment variables

### Data Migration

- One-time migration script: Sanity Portable Text → Tiptap JSON
- Both formats JSON-based, 1:1 mapping (block → paragraph, heading → heading, etc.)
- Migration script as Convex internal function
- Images: Sanity CDN → Convex Storage, update references

---

## 7. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                   │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Dashboard │  │ Dokumente│  │ Schulungen/Tasks   │ │
│  │ Widgets   │  │ + Editor │  │ (bestehend)        │ │
│  │ (Recharts)│  │ (Tiptap) │  │                    │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Notification  │  │ Cmd+K    │  │ Dok-Graph     │  │
│  │ Center        │  │ Suche    │  │ (React Flow)  │  │
│  └──────────────┘  └──────────┘  └───────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │ Realtime Sync
┌───────────────────────▼─────────────────────────────┐
│                    Convex Backend                      │
│                                                       │
│  Mutations & Queries                                  │
│  documents | trainings | tasks | notifications        │
│  users | organizations | audit                        │
│                                                       │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Cron-Jobs    │  │ Storage  │  │ Auth           │  │
│  │ (Reviews,    │  │ (Files,  │  │ (Convex Auth)  │  │
│  │  Digests,    │  │  Images, │  │                │  │
│  │  Overdue)    │  │  Attach.)│  │                │  │
│  └──────────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────────────────────────────────────────────┐│
│  │ Email (Resend)                                   ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## 8. New Dependencies

| Package | Purpose |
|---|---|
| `@tiptap/react` + extensions | Rich text editor |
| `@tiptap/starter-kit` | Base extensions |
| `@tiptap/extension-table` | Tables |
| `@tiptap/extension-link` | Links |
| `@tiptap/extension-image` | Images |
| `@tiptap/extension-task-list` | Checklists |
| `@tiptap/extension-placeholder` | Placeholder text |
| `@tiptap/extension-text-align` | Text alignment |
| `@tiptap/extension-highlight` | Highlights |
| `@tiptap/extension-underline` | Underline |
| `@tiptap/suggestion` | Slash menu base |
| `mermaid` | Process diagrams (lazy-loaded) |
| `@xyflow/react` | Document graph |
| `recharts` | Dashboard charts |
| `resend` | Email delivery |
| `diff` | Version comparison |

### Removed Dependencies

| Package | Reason |
|---|---|
| `@sanity/client` | Sanity removal |
| `@sanity/image-url` | Sanity removal |
| `@sanity/vision` | Sanity removal |
| `@portabletext/react` | Sanity removal |
| `next-sanity` | Sanity removal |
| `sanity` | Sanity removal |

---

## 9. Route Changes

| Route | Change |
|---|---|
| `/studio/**` | **Remove** (Sanity Studio) |
| `/documents` | Extend (new editor instead of Sanity link) |
| `/documents/[id]/edit` | **New** (Tiptap editor page) |
| `/documents/[id]/versions` | **New** (version diff) |
| `/documents/graph` | **New** (relationship graph) |
| `/dashboard` | Extend (KPI widgets) |
| `/settings/notifications` | **New** (notification preferences) |

---

## 10. Permission Matrix (Extensions)

| Action | Admin | QMB | Dept. Lead | Employee | Auditor |
|---|---|---|---|---|---|
| Create/edit documents | ✅ | ✅ | ❌ | ❌ | ❌ |
| Review documents | ✅ | ✅ | ✅ (own dept) | ❌ | ❌ |
| Approve documents | ✅ | ✅ | ❌ | ❌ | ❌ |
| Compare versions | ✅ | ✅ | ✅ | ✅ | ✅ |
| View document graph | ✅ | ✅ | ✅ | ❌ | ✅ |
| Dashboard (all KPIs) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Dashboard (dept KPIs) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Notification settings | ✅ | ✅ | ✅ | ✅ | ✅ |
