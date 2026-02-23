# QMS Sanitätshaus — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a digital Quality Management System for a medical supply store (Sanitätshaus), ISO 13485 compliant with MDR support, using Next.js 16 + Convex + Sanity + shadcn/ui.

**Architecture:** Sanity serves as pure content CMS (QM documents). Convex handles all operative data: users, RBAC, tasks, trainings, products, DoCs, audit logs, workflows, file storage, scheduled jobs. Next.js 16 App Router with Server Components for Sanity content and Client Components for Convex reactive data.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Convex (DB + auth + functions + file storage + crons), Sanity CMS (next-sanity + embedded studio), shadcn/ui, Tailwind CSS v4, Zod.

**Design Doc:** `docs/plans/2026-02-23-qms-system-design.md`

---

## Phase 0: Foundations

### Task 0.1: Project Scaffold — Next.js 16 + Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local`, `.gitignore`

**Step 1: Create Next.js 16 project**

```bash
npx create-next-app@latest next-qms --typescript --tailwind --eslint --app --src=false --import-alias "@/*" --turbopack
cd next-qms
```

Select: Yes to all defaults. This creates a Next.js 16 project with App Router, TypeScript, Tailwind CSS, and ESLint.

**Step 2: Install core dependencies**

```bash
npm install convex @convex-dev/auth @auth/core@0.37.0
npm install next-sanity @sanity/client @sanity/image-url @portabletext/react
npm install zod date-fns lucide-react
npm install -D @types/node
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables = yes.

Then install needed components:

```bash
npx shadcn@latest add button input label card badge table dialog sheet select textarea tabs separator avatar dropdown-menu calendar popover command form toast tooltip scroll-area
```

**Step 4: Create `.env.local`**

```env
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-02-23

# Feature Flags (build-time)
NEXT_PUBLIC_FF_AUDITS_ENABLED=false
NEXT_PUBLIC_FF_CAPA_ENABLED=false
NEXT_PUBLIC_FF_COMPLAINTS_ENABLED=false
NEXT_PUBLIC_FF_INCOMING_GOODS_ENABLED=false
NEXT_PUBLIC_FF_DEVICES_ENABLED=false
NEXT_PUBLIC_FF_REPORTS_ENABLED=false
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 16 project with core dependencies"
```

---

### Task 0.2: Convex Init + Schema

**Files:**
- Create: `convex/schema.ts`, `convex/tsconfig.json`

**Step 1: Initialize Convex**

```bash
npx convex dev
```

This will prompt to login and create a project. It creates `convex/` folder with `_generated/`.

**Step 2: Write `convex/schema.ts`**

This is the complete schema for the entire system (implemented + placeholders).

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// ============================================================
// Shared field definitions (reusable audit fields)
// ============================================================
const auditFields = {
  createdAt: v.number(),
  createdBy: v.optional(v.id("users")),
  updatedAt: v.number(),
  updatedBy: v.optional(v.id("users")),
  isArchived: v.boolean(),
  archivedAt: v.optional(v.number()),
  archivedBy: v.optional(v.id("users")),
};

// ============================================================
// Enums as string literals (validated by Zod on input)
// ============================================================
const orgType = v.union(
  v.literal("organization"),
  v.literal("location"),
  v.literal("department")
);

const userRole = v.union(
  v.literal("employee"),
  v.literal("department_lead"),
  v.literal("qmb"),
  v.literal("admin"),
  v.literal("auditor")
);

const userStatus = v.union(v.literal("active"), v.literal("inactive"));

const taskType = v.union(
  v.literal("READ_DOCUMENT"),
  v.literal("TRAINING_FEEDBACK"),
  v.literal("TRAINING_EFFECTIVENESS"),
  v.literal("DOC_EXPIRY_WARNING"),
  v.literal("TRAINING_REQUEST_REVIEW"),
  v.literal("GENERAL"),
  v.literal("FOLLOW_UP")
);

const taskStatus = v.union(
  v.literal("OPEN"),
  v.literal("IN_PROGRESS"),
  v.literal("DONE"),
  v.literal("CANCELLED")
);

const taskPriority = v.union(
  v.literal("LOW"),
  v.literal("MEDIUM"),
  v.literal("HIGH"),
  v.literal("URGENT")
);

const documentType = v.union(
  v.literal("qm_handbook"),
  v.literal("work_instruction"),
  v.literal("form_template"),
  v.literal("process_description")
);

const documentStatus = v.union(
  v.literal("DRAFT"),
  v.literal("IN_REVIEW"),
  v.literal("APPROVED"),
  v.literal("ARCHIVED")
);

const trainingStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("ARCHIVED")
);

const sessionStatus = v.union(
  v.literal("PLANNED"),
  v.literal("HELD"),
  v.literal("CANCELLED"),
  v.literal("CLOSED")
);

const participantStatus = v.union(
  v.literal("INVITED"),
  v.literal("ATTENDED"),
  v.literal("NO_SHOW"),
  v.literal("FEEDBACK_PENDING"),
  v.literal("FEEDBACK_DONE"),
  v.literal("EFFECTIVENESS_PENDING"),
  v.literal("EFFECTIVE"),
  v.literal("INEFFECTIVE"),
  v.literal("REQUIRES_ACTION")
);

const effectivenessDecision = v.union(
  v.literal("EFFECTIVE"),
  v.literal("INEFFECTIVE"),
  v.literal("PENDING")
);

const trainingRequestStatus = v.union(
  v.literal("REQUESTED"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
  v.literal("PLANNED"),
  v.literal("COMPLETED")
);

const urgency = v.union(
  v.literal("LOW"),
  v.literal("MEDIUM"),
  v.literal("HIGH")
);

const riskClass = v.union(
  v.literal("I"),
  v.literal("IIa"),
  v.literal("IIb"),
  v.literal("III")
);

const productStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("BLOCKED"),
  v.literal("DELISTED")
);

const docStatus = v.union(
  v.literal("MISSING"),
  v.literal("IN_REVIEW"),
  v.literal("VALID"),
  v.literal("EXPIRING"),
  v.literal("EXPIRED")
);

const auditAction = v.union(
  v.literal("CREATE"),
  v.literal("UPDATE"),
  v.literal("STATUS_CHANGE"),
  v.literal("ARCHIVE"),
  v.literal("FILE_UPLOAD"),
  v.literal("PERMISSION_CHANGE"),
  v.literal("LOGIN"),
  v.literal("LOGOUT")
);

export default defineSchema({
  // Auth tables (from @convex-dev/auth)
  ...authTables,

  // ============================================================
  // PHASE 0: Foundations
  // ============================================================

  organizations: defineTable({
    name: v.string(),
    type: orgType,
    parentId: v.optional(v.id("organizations")),
    code: v.string(),
    ...auditFields,
  })
    .index("by_parent", ["parentId"])
    .index("by_type", ["type"])
    .index("by_code", ["code"]),

  users: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: userRole,
    organizationId: v.id("organizations"),
    locationId: v.optional(v.id("organizations")),
    departmentId: v.optional(v.id("organizations")),
    status: userStatus,
    authId: v.optional(v.string()), // links to Convex Auth user
    ...auditFields,
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_organization", ["organizationId"])
    .index("by_department", ["departmentId"])
    .index("by_location", ["locationId"])
    .index("by_authId", ["authId"])
    .index("by_status", ["status"]),

  tasks: defineTable({
    type: taskType,
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.id("users"),
    dueDate: v.optional(v.number()),
    status: taskStatus,
    priority: taskPriority,
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    isOverdue: v.optional(v.boolean()),
    ...auditFields,
  })
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"])
    .index("by_assignee_status", ["assigneeId", "status"])
    .index("by_type", ["type"])
    .index("by_dueDate", ["dueDate"])
    .index("by_resource", ["resourceType", "resourceId"]),

  auditLog: defineTable({
    userId: v.optional(v.id("users")),
    action: auditAction,
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(v.any()),
    previousStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),

  featureFlags: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
    ...auditFields,
  }).index("by_key", ["key"]),

  // ============================================================
  // PHASE 1: Document Control
  // ============================================================

  documentRecords: defineTable({
    sanityDocumentId: v.string(),
    documentType: documentType,
    documentCode: v.string(),
    version: v.string(),
    status: documentStatus,
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    responsibleUserId: v.id("users"),
    reviewerId: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    approvedById: v.optional(v.id("users")),
    ...auditFields,
  })
    .index("by_sanityId", ["sanityDocumentId"])
    .index("by_status", ["status"])
    .index("by_documentCode", ["documentCode"])
    .index("by_responsible", ["responsibleUserId"])
    .index("by_type", ["documentType"]),

  readConfirmations: defineTable({
    documentRecordId: v.id("documentRecords"),
    userId: v.id("users"),
    documentVersion: v.string(),
    confirmedAt: v.number(),
    ...auditFields,
  })
    .index("by_document", ["documentRecordId"])
    .index("by_user", ["userId"])
    .index("by_document_user", ["documentRecordId", "userId"]),

  // ============================================================
  // PHASE 2: Training Management
  // ============================================================

  trainings: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isRequired: v.boolean(),
    effectivenessCheckAfterDays: v.number(), // default: 30
    targetOrganizationIds: v.optional(v.array(v.id("organizations"))),
    status: trainingStatus,
    ...auditFields,
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"]),

  trainingSessions: defineTable({
    trainingId: v.id("trainings"),
    scheduledDate: v.number(),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    trainerId: v.optional(v.id("users")),
    trainerName: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    status: sessionStatus,
    notes: v.optional(v.string()),
    ...auditFields,
  })
    .index("by_training", ["trainingId"])
    .index("by_status", ["status"])
    .index("by_scheduledDate", ["scheduledDate"]),

  trainingParticipants: defineTable({
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    status: participantStatus,
    attendedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_session_user", ["sessionId", "userId"])
    .index("by_status", ["status"]),

  trainingFeedback: defineTable({
    participantId: v.id("trainingParticipants"),
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    ratings: v.object({
      contentRelevance: v.number(),
      trainerCompetence: v.number(),
      methodology: v.number(),
      practicalApplicability: v.number(),
      organizationQuality: v.number(),
      overallSatisfaction: v.number(),
    }),
    comments: v.optional(v.string()),
    improvementSuggestions: v.optional(v.string()),
    wouldRecommend: v.boolean(),
    ...auditFields,
  })
    .index("by_participant", ["participantId"])
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  effectivenessChecks: defineTable({
    participantId: v.id("trainingParticipants"),
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    reviewerId: v.id("users"),
    dueDate: v.number(),
    completedAt: v.optional(v.number()),
    goalAchieved: v.optional(v.boolean()),
    applicationVisible: v.optional(v.boolean()),
    errorRateReduced: v.optional(v.boolean()),
    decision: effectivenessDecision,
    justification: v.optional(v.string()),
    ...auditFields,
  })
    .index("by_participant", ["participantId"])
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_reviewer", ["reviewerId"])
    .index("by_decision", ["decision"])
    .index("by_dueDate", ["dueDate"]),

  trainingRequests: defineTable({
    requesterId: v.id("users"),
    topic: v.string(),
    justification: v.string(),
    urgency: urgency,
    externalLink: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
    status: trainingRequestStatus,
    reviewedById: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    linkedTrainingId: v.optional(v.id("trainings")),
    ...auditFields,
  })
    .index("by_requester", ["requesterId"])
    .index("by_status", ["status"])
    .index("by_urgency", ["urgency"]),

  // ============================================================
  // PHASE 3: MDR & Products
  // ============================================================

  manufacturers: defineTable({
    name: v.string(),
    country: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
    ...auditFields,
  })
    .index("by_name", ["name"]),

  products: defineTable({
    name: v.string(),
    articleNumber: v.string(),
    udi: v.optional(v.string()),
    productGroup: v.optional(v.string()),
    manufacturerId: v.optional(v.id("manufacturers")),
    riskClass: riskClass,
    status: productStatus,
    notes: v.optional(v.string()),
    ...auditFields,
  })
    .index("by_articleNumber", ["articleNumber"])
    .index("by_status", ["status"])
    .index("by_manufacturer", ["manufacturerId"])
    .index("by_riskClass", ["riskClass"])
    .index("by_productGroup", ["productGroup"]),

  declarationsOfConformity: defineTable({
    productId: v.id("products"),
    fileId: v.id("_storage"),
    fileName: v.string(),
    version: v.string(),
    issuedAt: v.number(),
    validFrom: v.number(),
    validUntil: v.number(),
    notifiedBody: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    status: docStatus,
    reviewedById: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_product", ["productId"])
    .index("by_status", ["status"])
    .index("by_validUntil", ["validUntil"]),

  // ============================================================
  // PHASE 4: Placeholders (IN PLANUNG)
  // ============================================================

  // TODO: Phase 4 — Interne Audits (ISO 13485 Kap. 8.2.2)
  audits: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),

  // TODO: Phase 4 — Audit-Findings
  auditFindings: defineTable({
    title: v.optional(v.string()),
    auditId: v.optional(v.id("audits")),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),

  // TODO: Phase 4 — CAPA (Corrective & Preventive Actions)
  capaActions: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    sourceType: v.optional(v.string()), // "audit", "complaint", "training"
    sourceId: v.optional(v.string()),
    ...auditFields,
  }),

  // TODO: Phase 4 — Reklamationen
  complaints: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    isVigilanceRelevant: v.optional(v.boolean()),
    ...auditFields,
  }),

  // TODO: Phase 4 — Wareneingang & Stichproben
  incomingGoodsChecks: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),

  // TODO: Phase 4 — Prüfmittel/Geräte
  deviceRecords: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),

  // TODO: Phase 4 — Gerätekalibrierungen
  deviceCalibrations: defineTable({
    title: v.optional(v.string()),
    deviceId: v.optional(v.id("deviceRecords")),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),
});
```

**Step 3: Verify schema compiles**

```bash
npx convex dev
```

Expected: "✓ Schema validation complete" with no errors, then Ctrl+C.

**Step 4: Commit**

```bash
git add convex/
git commit -m "feat: add complete Convex schema with all tables and indexes"
```

---

### Task 0.3: Shared Types & Enums

**Files:**
- Create: `lib/types/enums.ts`
- Create: `lib/types/domain.ts`

**Step 1: Write `lib/types/enums.ts`**

```typescript
// ============================================================
// All status enums used across the system.
// Single source of truth — used by Zod validators, UI badges, etc.
// ============================================================

export const USER_ROLES = [
  "employee",
  "department_lead",
  "qmb",
  "admin",
  "auditor",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  employee: "Mitarbeiter",
  department_lead: "Abteilungsleitung",
  qmb: "QMB",
  admin: "Administrator",
  auditor: "Auditor",
};

export const ORG_TYPES = ["organization", "location", "department"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const TASK_TYPES = [
  "READ_DOCUMENT",
  "TRAINING_FEEDBACK",
  "TRAINING_EFFECTIVENESS",
  "DOC_EXPIRY_WARNING",
  "TRAINING_REQUEST_REVIEW",
  "GENERAL",
  "FOLLOW_UP",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DOCUMENT_TYPES = [
  "qm_handbook",
  "work_instruction",
  "form_template",
  "process_description",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  qm_handbook: "QM-Handbuch",
  work_instruction: "Arbeitsanweisung",
  form_template: "Formblatt-Vorlage",
  process_description: "Prozessbeschreibung",
};

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "ARCHIVED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const TRAINING_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const SESSION_STATUSES = [
  "PLANNED",
  "HELD",
  "CANCELLED",
  "CLOSED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PARTICIPANT_STATUSES = [
  "INVITED",
  "ATTENDED",
  "NO_SHOW",
  "FEEDBACK_PENDING",
  "FEEDBACK_DONE",
  "EFFECTIVENESS_PENDING",
  "EFFECTIVE",
  "INEFFECTIVE",
  "REQUIRES_ACTION",
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const EFFECTIVENESS_DECISIONS = [
  "EFFECTIVE",
  "INEFFECTIVE",
  "PENDING",
] as const;
export type EffectivenessDecision = (typeof EFFECTIVENESS_DECISIONS)[number];

export const TRAINING_REQUEST_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PLANNED",
  "COMPLETED",
] as const;
export type TrainingRequestStatus = (typeof TRAINING_REQUEST_STATUSES)[number];

export const URGENCY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const RISK_CLASSES = ["I", "IIa", "IIb", "III"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export const PRODUCT_STATUSES = ["ACTIVE", "BLOCKED", "DELISTED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const DOC_STATUSES = [
  "MISSING",
  "IN_REVIEW",
  "VALID",
  "EXPIRING",
  "EXPIRED",
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "STATUS_CHANGE",
  "ARCHIVE",
  "FILE_UPLOAD",
  "PERMISSION_CHANGE",
  "LOGIN",
  "LOGOUT",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ============================================================
// Status badge colors for UI
// ============================================================
export const STATUS_COLORS: Record<string, string> = {
  // Task
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  DONE: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  // Document
  DRAFT: "bg-gray-100 text-gray-800",
  IN_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
  // Training
  ACTIVE: "bg-green-100 text-green-800",
  // Session
  PLANNED: "bg-blue-100 text-blue-800",
  HELD: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-600",
  // Participant
  INVITED: "bg-blue-100 text-blue-800",
  ATTENDED: "bg-green-100 text-green-800",
  NO_SHOW: "bg-red-100 text-red-800",
  FEEDBACK_PENDING: "bg-orange-100 text-orange-800",
  FEEDBACK_DONE: "bg-teal-100 text-teal-800",
  EFFECTIVENESS_PENDING: "bg-purple-100 text-purple-800",
  EFFECTIVE: "bg-green-100 text-green-800",
  INEFFECTIVE: "bg-red-100 text-red-800",
  REQUIRES_ACTION: "bg-red-200 text-red-900",
  // Training request
  REQUESTED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  COMPLETED: "bg-green-100 text-green-800",
  // Product
  BLOCKED: "bg-red-100 text-red-800",
  DELISTED: "bg-gray-100 text-gray-600",
  // DoC
  MISSING: "bg-red-200 text-red-900",
  VALID: "bg-green-100 text-green-800",
  EXPIRING: "bg-orange-100 text-orange-800",
  EXPIRED: "bg-red-100 text-red-800",
  // Effectiveness
  PENDING: "bg-yellow-100 text-yellow-800",
  // Priority
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
  // Placeholder
  PLACEHOLDER: "bg-gray-100 text-gray-500",
};

// German labels for statuses
export const STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  DONE: "Erledigt",
  CANCELLED: "Abgebrochen",
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  ARCHIVED: "Archiviert",
  ACTIVE: "Aktiv",
  PLANNED: "Geplant",
  HELD: "Durchgeführt",
  CLOSED: "Abgeschlossen",
  INVITED: "Eingeladen",
  ATTENDED: "Teilgenommen",
  NO_SHOW: "Nicht erschienen",
  FEEDBACK_PENDING: "Feedback ausstehend",
  FEEDBACK_DONE: "Feedback abgegeben",
  EFFECTIVENESS_PENDING: "Wirksamkeit ausstehend",
  EFFECTIVE: "Wirksam",
  INEFFECTIVE: "Nicht wirksam",
  REQUIRES_ACTION: "Maßnahme erforderlich",
  REQUESTED: "Beantragt",
  REJECTED: "Abgelehnt",
  COMPLETED: "Abgeschlossen",
  BLOCKED: "Gesperrt",
  DELISTED: "Ausgelistet",
  MISSING: "Fehlend",
  VALID: "Gültig",
  EXPIRING: "Läuft bald ab",
  EXPIRED: "Abgelaufen",
  PENDING: "Ausstehend",
  PLACEHOLDER: "In Planung",
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend",
};
```

**Step 2: Write `lib/types/domain.ts`**

```typescript
import { Id } from "../../convex/_generated/dataModel";

// ============================================================
// Domain types derived from Convex schema for use in UI
// ============================================================

export interface AppUser {
  _id: Id<"users">;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: Id<"organizations">;
  locationId?: Id<"organizations">;
  departmentId?: Id<"organizations">;
  status: string;
}

// Used for RBAC permission checks
export type PermissionAction =
  | "users:list" | "users:create" | "users:update" | "users:archive"
  | "documents:read" | "documents:create" | "documents:review"
  | "documents:approve" | "documents:archive"
  | "trainings:list" | "trainings:create" | "trainings:manage"
  | "trainings:feedback:submit" | "trainings:effectiveness:review"
  | "trainingRequests:create" | "trainingRequests:review"
  | "products:list" | "products:create" | "products:update"
  | "declarations:list" | "declarations:upload" | "declarations:review"
  | "tasks:own" | "tasks:team" | "tasks:all"
  | "admin:settings" | "admin:featureFlags";
```

**Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add shared types, enums, and status labels (DE/EN)"
```

---

### Task 0.4: Zod Validators

**Files:**
- Create: `lib/validators/user.ts`
- Create: `lib/validators/training.ts`
- Create: `lib/validators/product.ts`
- Create: `lib/validators/declaration.ts`
- Create: `lib/validators/task.ts`

**Step 1: Write all validators**

`lib/validators/user.ts`:
```typescript
import { z } from "zod";
import { USER_ROLES } from "@/lib/types/enums";

export const createUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  firstName: z.string().min(1, "Vorname ist erforderlich").max(100),
  lastName: z.string().min(1, "Nachname ist erforderlich").max(100),
  role: z.enum(USER_ROLES, { message: "Ungültige Rolle" }),
  organizationId: z.string().min(1, "Organisation ist erforderlich"),
  locationId: z.string().optional(),
  departmentId: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

`lib/validators/training.ts`:
```typescript
import { z } from "zod";

export const createTrainingSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  isRequired: z.boolean().default(false),
  effectivenessCheckAfterDays: z.number().min(1).max(365).default(30),
  targetOrganizationIds: z.array(z.string()).optional(),
});

export const createSessionSchema = z.object({
  trainingId: z.string().min(1),
  scheduledDate: z.number().min(1, "Datum ist erforderlich"),
  endDate: z.number().optional(),
  location: z.string().max(200).optional(),
  trainerId: z.string().optional(),
  trainerName: z.string().max(200).optional(),
  maxParticipants: z.number().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

const ratingField = z.number().min(1, "Bewertung erforderlich").max(6);

export const trainingFeedbackSchema = z.object({
  participantId: z.string().min(1),
  sessionId: z.string().min(1),
  ratings: z.object({
    contentRelevance: ratingField,
    trainerCompetence: ratingField,
    methodology: ratingField,
    practicalApplicability: ratingField,
    organizationQuality: ratingField,
    overallSatisfaction: ratingField,
  }),
  comments: z.string().max(2000).optional(),
  improvementSuggestions: z.string().max(2000).optional(),
  wouldRecommend: z.boolean(),
});

export const effectivenessCheckSchema = z.object({
  participantId: z.string().min(1),
  goalAchieved: z.boolean(),
  applicationVisible: z.boolean(),
  errorRateReduced: z.boolean(),
  decision: z.enum(["EFFECTIVE", "INEFFECTIVE"]),
  justification: z.string().min(1, "Begründung ist erforderlich").max(2000),
});

export const trainingRequestSchema = z.object({
  topic: z.string().min(1, "Thema ist erforderlich").max(200),
  justification: z.string().min(1, "Begründung ist erforderlich").max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  externalLink: z.string().url("Ungültige URL").optional().or(z.literal("")),
  estimatedCost: z.number().min(0).optional(),
});

export type CreateTrainingInput = z.infer<typeof createTrainingSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type TrainingFeedbackInput = z.infer<typeof trainingFeedbackSchema>;
export type EffectivenessCheckInput = z.infer<typeof effectivenessCheckSchema>;
export type TrainingRequestInput = z.infer<typeof trainingRequestSchema>;
```

`lib/validators/product.ts`:
```typescript
import { z } from "zod";
import { RISK_CLASSES } from "@/lib/types/enums";

export const createProductSchema = z.object({
  name: z.string().min(1, "Produktname ist erforderlich").max(200),
  articleNumber: z.string().min(1, "Artikelnummer ist erforderlich").max(50),
  udi: z.string().max(100).optional(),
  productGroup: z.string().max(100).optional(),
  manufacturerId: z.string().optional(),
  riskClass: z.enum(RISK_CLASSES, { message: "Ungültige Risikoklasse" }),
  notes: z.string().max(2000).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().min(1),
});

export const createManufacturerSchema = z.object({
  name: z.string().min(1, "Herstellername ist erforderlich").max(200),
  country: z.string().max(100).optional(),
  contactInfo: z.string().max(500).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateManufacturerInput = z.infer<typeof createManufacturerSchema>;
```

`lib/validators/declaration.ts`:
```typescript
import { z } from "zod";

export const createDeclarationSchema = z.object({
  productId: z.string().min(1, "Produkt ist erforderlich"),
  version: z.string().min(1, "Version ist erforderlich").max(20),
  issuedAt: z.number().min(1, "Ausstellungsdatum ist erforderlich"),
  validFrom: z.number().min(1, "Gültig ab ist erforderlich"),
  validUntil: z.number().min(1, "Gültig bis ist erforderlich"),
  notifiedBody: z.string().max(200).optional(),
  certificateNumber: z.string().max(100).optional(),
}).refine(data => data.validUntil > data.validFrom, {
  message: "Gültig bis muss nach Gültig ab liegen",
  path: ["validUntil"],
});

export const reviewDeclarationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["VALID", "IN_REVIEW"]),
});

export type CreateDeclarationInput = z.infer<typeof createDeclarationSchema>;
export type ReviewDeclarationInput = z.infer<typeof reviewDeclarationSchema>;
```

`lib/validators/task.ts`:
```typescript
import { z } from "zod";
import { TASK_TYPES, TASK_PRIORITIES } from "@/lib/types/enums";

export const createTaskSchema = z.object({
  type: z.enum(TASK_TYPES).default("GENERAL"),
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().min(1, "Zuständige Person ist erforderlich"),
  dueDate: z.number().optional(),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

**Step 2: Commit**

```bash
git add lib/validators/
git commit -m "feat: add Zod validators for all entities (DE error messages)"
```

---

### Task 0.5: Convex Lib — RBAC, Audit Log, State Machine, Soft Delete

**Files:**
- Create: `convex/lib/permissions.ts`
- Create: `convex/lib/auditLog.ts`
- Create: `convex/lib/stateMachine.ts`
- Create: `convex/lib/withAuth.ts`
- Create: `convex/lib/softDelete.ts`

**Step 1: Write `convex/lib/permissions.ts`**

```typescript
import { type UserRole } from "../../lib/types/enums";
import { type PermissionAction } from "../../lib/types/domain";

// ============================================================
// RBAC Permission Matrix
// ============================================================

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  admin: [], // handled via wildcard check below
  qmb: [
    "documents:read", "documents:create", "documents:review",
    "documents:approve", "documents:archive",
    "trainings:list", "trainings:create", "trainings:manage",
    "trainings:feedback:submit", "trainings:effectiveness:review",
    "trainingRequests:create", "trainingRequests:review",
    "products:list", "products:create", "products:update",
    "declarations:list", "declarations:upload", "declarations:review",
    "tasks:all",
    "users:list",
  ],
  department_lead: [
    "documents:read",
    "trainings:list", "trainings:manage",
    "trainings:feedback:submit", "trainings:effectiveness:review",
    "trainingRequests:create", "trainingRequests:review",
    "products:list",
    "declarations:list",
    "tasks:team",
    "users:list",
  ],
  employee: [
    "documents:read",
    "trainings:list",
    "trainings:feedback:submit",
    "trainingRequests:create",
    "products:list",
    "declarations:list",
    "tasks:own",
  ],
  auditor: [
    "documents:read",
    "trainings:list",
    "products:list",
    "declarations:list",
    "tasks:own",
  ],
};

/**
 * Check if a user role has permission to perform an action.
 * Admin role has implicit wildcard access.
 */
export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  if (role === "admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

/**
 * Check if a user role has any of the given permissions.
 */
export function hasAnyPermission(
  role: UserRole,
  actions: PermissionAction[]
): boolean {
  return actions.some((action) => hasPermission(role, action));
}
```

**Step 2: Write `convex/lib/auditLog.ts`**

```typescript
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

interface AuditLogEntry {
  userId?: Id<"users">;
  action: "CREATE" | "UPDATE" | "STATUS_CHANGE" | "ARCHIVE" | "FILE_UPLOAD" | "PERMISSION_CHANGE" | "LOGIN" | "LOGOUT";
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event. Call this from every mutation that modifies data.
 */
export async function logAuditEvent(
  ctx: MutationCtx,
  entry: AuditLogEntry
): Promise<void> {
  await ctx.db.insert("auditLog", {
    ...entry,
    timestamp: Date.now(),
  });
}
```

**Step 3: Write `convex/lib/stateMachine.ts`**

```typescript
// ============================================================
// State machine transition definitions.
// Every status change must pass through validateTransition().
// ============================================================

const TRANSITIONS: Record<string, Record<string, string[]>> = {
  documentStatus: {
    DRAFT: ["IN_REVIEW"],
    IN_REVIEW: ["APPROVED", "DRAFT"],
    APPROVED: ["ARCHIVED", "DRAFT"],
    ARCHIVED: [],
  },
  sessionStatus: {
    PLANNED: ["HELD", "CANCELLED"],
    HELD: ["CLOSED"],
    CANCELLED: [],
    CLOSED: [],
  },
  participantStatus: {
    INVITED: ["ATTENDED", "NO_SHOW"],
    ATTENDED: ["FEEDBACK_PENDING"],
    FEEDBACK_PENDING: ["FEEDBACK_DONE"],
    FEEDBACK_DONE: ["EFFECTIVENESS_PENDING"],
    EFFECTIVENESS_PENDING: ["EFFECTIVE", "INEFFECTIVE"],
    INEFFECTIVE: ["REQUIRES_ACTION"],
    EFFECTIVE: [],
    NO_SHOW: [],
    REQUIRES_ACTION: [],
  },
  trainingRequestStatus: {
    REQUESTED: ["APPROVED", "REJECTED"],
    APPROVED: ["PLANNED"],
    PLANNED: ["COMPLETED"],
    REJECTED: [],
    COMPLETED: [],
  },
  docStatus: {
    MISSING: ["IN_REVIEW"],
    IN_REVIEW: ["VALID"],
    VALID: ["EXPIRING"],
    EXPIRING: ["EXPIRED", "VALID"],
    EXPIRED: ["IN_REVIEW"],
  },
  taskStatus: {
    OPEN: ["IN_PROGRESS", "DONE", "CANCELLED"],
    IN_PROGRESS: ["DONE", "CANCELLED"],
    DONE: [],
    CANCELLED: [],
  },
};

/**
 * Validate a state transition. Throws if invalid.
 */
export function validateTransition(
  machine: keyof typeof TRANSITIONS,
  fromStatus: string,
  toStatus: string
): void {
  const allowed = TRANSITIONS[machine]?.[fromStatus];
  if (!allowed) {
    throw new Error(
      `Ungültiger Status '${fromStatus}' für State Machine '${machine}'`
    );
  }
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Ungültiger Statusübergang: ${fromStatus} → ${toStatus} (erlaubt: ${allowed.join(", ") || "keine"})`
    );
  }
}

/**
 * Get allowed next statuses for a given state machine and current status.
 */
export function getAllowedTransitions(
  machine: keyof typeof TRANSITIONS,
  currentStatus: string
): string[] {
  return TRANSITIONS[machine]?.[currentStatus] ?? [];
}
```

**Step 4: Write `convex/lib/withAuth.ts`**

```typescript
import {
  query,
  mutation,
  QueryCtx,
  MutationCtx,
} from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission } from "./permissions";
import type { PermissionAction } from "../../lib/types/domain";
import type { UserRole } from "../../lib/types/enums";
import { Id } from "../_generated/dataModel";

interface AuthenticatedUser {
  _id: Id<"users">;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: Id<"organizations">;
  locationId?: Id<"organizations">;
  departmentId?: Id<"organizations">;
  status: string;
}

/**
 * Get the current authenticated user from context.
 * Throws if not authenticated or user not found.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) {
    throw new Error("Nicht authentifiziert");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUserId))
    .first();

  if (!user) {
    throw new Error("Benutzer nicht gefunden");
  }

  if (user.status !== "active") {
    throw new Error("Benutzerkonto ist deaktiviert");
  }

  return user as AuthenticatedUser;
}

/**
 * Check permissions for the current user. Throws if unauthorized.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  ...actions: PermissionAction[]
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(ctx);

  const hasAccess = actions.some((action) =>
    hasPermission(user.role as UserRole, action)
  );

  if (!hasAccess) {
    throw new Error(
      `Keine Berechtigung für: ${actions.join(", ")}`
    );
  }

  return user;
}
```

**Step 5: Write `convex/lib/softDelete.ts`**

```typescript
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { logAuditEvent } from "./auditLog";

/**
 * Soft-delete (archive) a record. Sets isArchived=true and logs the event.
 * NEVER hard-delete — ISO 13485 requires full traceability.
 */
export async function archiveRecord<T extends string>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  userId: Id<"users">
): Promise<void> {
  const now = Date.now();

  await ctx.db.patch(id as any, {
    isArchived: true,
    archivedAt: now,
    archivedBy: userId,
    updatedAt: now,
    updatedBy: userId,
  } as any);

  await logAuditEvent(ctx, {
    userId,
    action: "ARCHIVE",
    entityType: table,
    entityId: id as string,
  });
}
```

**Step 6: Commit**

```bash
git add convex/lib/
git commit -m "feat: add RBAC permissions, audit log, state machine, auth middleware, soft delete"
```

---

### Task 0.6: Convex Auth Setup

**Files:**
- Create: `convex/auth.ts`
- Create: `app/ConvexClientProvider.tsx`

**Step 1: Write `convex/auth.ts`**

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

**Step 2: Write `app/ConvexClientProvider.tsx`**

```tsx
"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
```

**Step 3: Update `app/layout.tsx` to wrap with provider**

The root layout should import and wrap children with `ConvexClientProvider`.

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QMS — Qualitätsmanagementsystem",
  description: "Digitales QMS für Sanitätshaus (ISO 13485 + MDR)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

**Step 4: Run `npx @convex-dev/auth` to configure auth environment**

Follow prompts to set up JWT secret and auth tables.

**Step 5: Commit**

```bash
git add convex/auth.ts app/ConvexClientProvider.tsx app/layout.tsx
git commit -m "feat: configure Convex Auth with Password provider"
```

---

### Task 0.7: Convex Core Functions — Users & Organizations

**Files:**
- Create: `convex/users.ts`
- Create: `convex/organizations.ts`

**Step 1: Write `convex/users.ts`**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission, getAuthenticatedUser } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

/** Get current authenticated user profile */
export const me = query({
  handler: async (ctx) => {
    return await getAuthenticatedUser(ctx);
  },
});

/** List all active users (requires users:list) */
export const list = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "users:list");
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Get user by ID */
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db.get(args.id);
  },
});

/** Create a new user (admin only) */
export const create = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.string(),
    organizationId: v.id("organizations"),
    locationId: v.optional(v.id("organizations")),
    departmentId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requirePermission(ctx, "users:create");
    const now = Date.now();

    const id = await ctx.db.insert("users", {
      ...args,
      role: args.role as any,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
    });

    await logAuditEvent(ctx, {
      userId: currentUser._id,
      action: "CREATE",
      entityType: "users",
      entityId: id,
      metadata: { email: args.email, role: args.role },
    });

    return id;
  },
});

/** Update a user (admin only) */
export const update = mutation({
  args: {
    id: v.id("users"),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    locationId: v.optional(v.id("organizations")),
    departmentId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const currentUser = await requirePermission(ctx, "users:update");
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Benutzer nicht gefunden");

    const now = Date.now();
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now,
      updatedBy: currentUser._id,
    } as any);

    await logAuditEvent(ctx, {
      userId: currentUser._id,
      action: "UPDATE",
      entityType: "users",
      entityId: id,
      changes: updates,
    });
  },
});

/** Archive a user (soft delete — admin only) */
export const archive = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await requirePermission(ctx, "users:archive");
    await archiveRecord(ctx, "users", args.id, currentUser._id);
  },
});
```

**Step 2: Write `convex/organizations.ts`**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

/** List all organizations (by type) */
export const list = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "users:list"); // org management tied to admin
    let q = ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("isArchived"), false));

    const all = await q.collect();
    if (args.type) {
      return all.filter((org) => org.type === args.type);
    }
    return all;
  },
});

/** Get organization by ID */
export const getById = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Get children of an organization */
export const getChildren = query({
  args: { parentId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** Create organization/location/department (admin only) */
export const create = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    parentId: v.optional(v.id("organizations")),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:settings");
    const now = Date.now();

    const id = await ctx.db.insert("organizations", {
      ...args,
      type: args.type as any,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "organizations",
      entityId: id,
      metadata: { name: args.name, type: args.type },
    });

    return id;
  },
});

/** Archive organization (admin only) */
export const archive = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:settings");
    await archiveRecord(ctx, "organizations", args.id, user._id);
  },
});
```

**Step 3: Commit**

```bash
git add convex/users.ts convex/organizations.ts
git commit -m "feat: add Convex functions for users and organizations"
```

---

### Task 0.8: Convex Core Functions — Tasks & Feature Flags

**Files:**
- Create: `convex/tasks.ts`
- Create: `convex/featureFlags.ts`

**Step 1: Write `convex/tasks.ts`**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";

/** List tasks for current user */
export const myTasks = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("tasks")
      .withIndex("by_assignee_status", (q) =>
        q.eq("assigneeId", user._id)
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** List all tasks (qmb/admin) */
export const listAll = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "tasks:all");
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/** List team tasks (department_lead) */
export const teamTasks = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "tasks:team");
    // Get all users in same department
    const teamUsers = await ctx.db
      .query("users")
      .withIndex("by_department", (q) =>
        q.eq("departmentId", user.departmentId)
      )
      .collect();
    const teamUserIds = new Set(teamUsers.map((u) => u._id));

    const allTasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return allTasks.filter((t) => teamUserIds.has(t.assigneeId));
  },
});

/** Create a task */
export const create = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.id("users"),
    dueDate: v.optional(v.number()),
    priority: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("tasks", {
      ...args,
      type: args.type as any,
      priority: args.priority as any,
      status: "OPEN",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "tasks",
      entityId: id,
      metadata: { type: args.type, title: args.title, assigneeId: args.assigneeId },
    });

    return id;
  },
});

/** Update task status */
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Aufgabe nicht gefunden");

    validateTransition("taskStatus", task.status, args.status);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "tasks",
      entityId: args.id,
      previousStatus: task.status,
      newStatus: args.status,
    });
  },
});
```

**Step 2: Write `convex/featureFlags.ts`**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

/** Get a feature flag by key */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/** List all feature flags */
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("featureFlags").collect();
  },
});

/** Update a feature flag (admin only) */
export const update = mutation({
  args: {
    key: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "admin:featureFlags");
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();

    if (flag) {
      await ctx.db.patch(flag._id, {
        enabled: args.enabled,
        updatedAt: now,
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("featureFlags", {
        key: args.key,
        enabled: args.enabled,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "featureFlags",
      entityId: args.key,
      changes: { enabled: args.enabled },
    });
  },
});
```

**Step 3: Commit**

```bash
git add convex/tasks.ts convex/featureFlags.ts
git commit -m "feat: add Convex functions for tasks and feature flags"
```

---

### Task 0.9: Sanity Setup — Config, Schemas, Client

**Files:**
- Create: `sanity/sanity.config.ts`
- Create: `sanity/schemas/qmDocument.ts`
- Create: `sanity/schemas/workInstruction.ts`
- Create: `sanity/schemas/formTemplate.ts`
- Create: `sanity/schemas/processDescription.ts`
- Create: `sanity/lib/client.ts`
- Create: `sanity/lib/queries.ts`
- Create: `app/studio/[[...tool]]/page.tsx`

**Step 1: Write Sanity config**

`sanity/sanity.config.ts`:
```typescript
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemas";

export default defineConfig({
  name: "qms",
  title: "QMS — Dokumentenmanagement",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  basePath: "/studio",
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
```

**Step 2: Write Sanity schemas**

`sanity/schemas/index.ts`:
```typescript
import { qmDocument } from "./qmDocument";
import { workInstruction } from "./workInstruction";
import { formTemplate } from "./formTemplate";
import { processDescription } from "./processDescription";

export const schemaTypes = [
  qmDocument,
  workInstruction,
  formTemplate,
  processDescription,
];
```

`sanity/schemas/qmDocument.ts`:
```typescript
import { defineType, defineField } from "sanity";

export const qmDocument = defineType({
  name: "qmDocument",
  title: "QM-Handbuch Kapitel",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titel",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
    }),
    defineField({
      name: "chapterNumber",
      title: "Kapitelnummer",
      type: "string",
      description: "z.B. 4.2.3",
    }),
    defineField({
      name: "category",
      title: "Kategorie",
      type: "string",
      options: {
        list: [
          { title: "Qualitätspolitik", value: "quality_policy" },
          { title: "Prozess", value: "process" },
          { title: "Verantwortung", value: "responsibility" },
          { title: "Ressource", value: "resource" },
        ],
      },
    }),
    defineField({
      name: "content",
      title: "Inhalt",
      type: "array",
      of: [
        { type: "block" },
        { type: "image" },
      ],
    }),
    defineField({
      name: "relatedDocuments",
      title: "Verwandte Dokumente",
      type: "array",
      of: [{ type: "reference", to: [{ type: "qmDocument" }] }],
    }),
    defineField({
      name: "effectiveDate",
      title: "Gültigkeitsdatum",
      type: "date",
    }),
    defineField({
      name: "lastReviewDate",
      title: "Letztes Prüfdatum",
      type: "date",
    }),
  ],
});
```

`sanity/schemas/workInstruction.ts`:
```typescript
import { defineType, defineField } from "sanity";

export const workInstruction = defineType({
  name: "workInstruction",
  title: "Arbeitsanweisung",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titel", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "documentCode", title: "Dokumenten-Code", type: "string", description: "z.B. AA-001" }),
    defineField({ name: "scope", title: "Geltungsbereich", type: "text" }),
    defineField({ name: "content", title: "Inhalt", type: "array", of: [{ type: "block" }, { type: "image" }] }),
    defineField({ name: "targetRoles", title: "Zielgruppe (Rollen)", type: "array", of: [{ type: "string" }], options: { list: [
      { title: "Mitarbeiter", value: "employee" },
      { title: "Abteilungsleitung", value: "department_lead" },
      { title: "QMB", value: "qmb" },
      { title: "Alle", value: "all" },
    ]}  }),
    defineField({ name: "attachments", title: "Anhänge", type: "array", of: [{ type: "file" }] }),
    defineField({ name: "effectiveDate", title: "Gültigkeitsdatum", type: "date" }),
    defineField({ name: "lastReviewDate", title: "Letztes Prüfdatum", type: "date" }),
  ],
});
```

`sanity/schemas/formTemplate.ts`:
```typescript
import { defineType, defineField } from "sanity";

export const formTemplate = defineType({
  name: "formTemplate",
  title: "Formblatt-Vorlage",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titel", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "formCode", title: "Formblatt-Code", type: "string", description: "z.B. FB-012" }),
    defineField({ name: "purpose", title: "Zweck", type: "text" }),
    defineField({ name: "content", title: "Beschreibung/Anleitung", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "templateFile", title: "Vorlage (PDF/DOCX)", type: "file" }),
    defineField({ name: "effectiveDate", title: "Gültigkeitsdatum", type: "date" }),
  ],
});
```

`sanity/schemas/processDescription.ts`:
```typescript
import { defineType, defineField } from "sanity";

export const processDescription = defineType({
  name: "processDescription",
  title: "Prozessbeschreibung",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titel", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "processCode", title: "Prozess-Code", type: "string", description: "z.B. PB-003" }),
    defineField({ name: "processOwner", title: "Prozessverantwortlicher", type: "string" }),
    defineField({ name: "inputs", title: "Inputs", type: "text" }),
    defineField({ name: "outputs", title: "Outputs", type: "text" }),
    defineField({ name: "content", title: "Ablaufbeschreibung", type: "array", of: [{ type: "block" }, { type: "image" }] }),
    defineField({
      name: "kpis",
      title: "Kennzahlen",
      type: "array",
      of: [{
        type: "object",
        fields: [
          { name: "name", title: "KPI Name", type: "string" },
          { name: "target", title: "Zielwert", type: "string" },
          { name: "unit", title: "Einheit", type: "string" },
        ],
      }],
    }),
    defineField({
      name: "relatedWorkInstructions",
      title: "Verknüpfte Arbeitsanweisungen",
      type: "array",
      of: [{ type: "reference", to: [{ type: "workInstruction" }] }],
    }),
  ],
});
```

**Step 3: Write Sanity client + queries**

`sanity/lib/client.ts`:
```typescript
import { createClient } from "next-sanity";

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION!,
  useCdn: true,
});
```

`sanity/lib/queries.ts`:
```typescript
import { sanityClient } from "./client";

// ============================================================
// Typed GROQ Queries for Sanity Content
// ============================================================

export async function fetchAllQmDocuments() {
  return sanityClient.fetch(
    `*[_type == "qmDocument"] | order(chapterNumber asc) {
      _id, title, slug, chapterNumber, category,
      effectiveDate, lastReviewDate
    }`
  );
}

export async function fetchQmDocumentBySlug(slug: string) {
  return sanityClient.fetch(
    `*[_type == "qmDocument" && slug.current == $slug][0] {
      _id, title, slug, chapterNumber, category,
      content, relatedDocuments[]->{ _id, title, chapterNumber },
      effectiveDate, lastReviewDate
    }`,
    { slug }
  );
}

export async function fetchAllWorkInstructions() {
  return sanityClient.fetch(
    `*[_type == "workInstruction"] | order(documentCode asc) {
      _id, title, slug, documentCode, scope, targetRoles,
      effectiveDate, lastReviewDate
    }`
  );
}

export async function fetchAllFormTemplates() {
  return sanityClient.fetch(
    `*[_type == "formTemplate"] | order(formCode asc) {
      _id, title, slug, formCode, purpose,
      "templateFileUrl": templateFile.asset->url,
      effectiveDate
    }`
  );
}

export async function fetchAllProcessDescriptions() {
  return sanityClient.fetch(
    `*[_type == "processDescription"] | order(processCode asc) {
      _id, title, slug, processCode, processOwner,
      kpis
    }`
  );
}

/** Search across all document types */
export async function searchDocuments(searchTerm: string) {
  return sanityClient.fetch(
    `*[_type in ["qmDocument", "workInstruction", "formTemplate", "processDescription"]
      && (title match $search || documentCode match $search || formCode match $search || processCode match $search)] {
      _id, _type, title,
      "code": coalesce(chapterNumber, documentCode, formCode, processCode)
    }`,
    { search: `${searchTerm}*` }
  );
}
```

**Step 4: Write embedded Sanity Studio page**

`app/studio/[[...tool]]/page.tsx`:
```tsx
"use client";

import { NextStudio } from "next-sanity/studio";
import config from "../../../sanity/sanity.config";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
```

**Step 5: Commit**

```bash
git add sanity/ app/studio/
git commit -m "feat: add Sanity config, 4 document schemas, GROQ queries, embedded studio"
```

---

### Task 0.10: Custom Hooks & Utilities

**Files:**
- Create: `lib/hooks/useCurrentUser.ts`
- Create: `lib/hooks/usePermissions.ts`
- Create: `lib/hooks/useFeatureFlag.ts`
- Create: `lib/utils/dates.ts`
- Create: `lib/utils/formatting.ts`

**Step 1: Write hooks**

`lib/hooks/useCurrentUser.ts`:
```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useCurrentUser() {
  const user = useQuery(api.users.me);
  return {
    user,
    isLoading: user === undefined,
    isAuthenticated: user !== null && user !== undefined,
  };
}
```

`lib/hooks/usePermissions.ts`:
```typescript
"use client";

import { useCurrentUser } from "./useCurrentUser";
import { hasPermission } from "../../convex/lib/permissions";
import type { PermissionAction } from "@/lib/types/domain";
import type { UserRole } from "@/lib/types/enums";

export function usePermissions() {
  const { user } = useCurrentUser();

  const can = (action: PermissionAction): boolean => {
    if (!user) return false;
    return hasPermission(user.role as UserRole, action);
  };

  return { can, role: user?.role as UserRole | undefined };
}
```

`lib/hooks/useFeatureFlag.ts`:
```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Check if a feature flag is enabled.
 * Checks both env var (build-time) and Convex flag (runtime).
 */
export function useFeatureFlag(key: string): boolean {
  // Check build-time env var first
  const envKey = `NEXT_PUBLIC_FF_${key.toUpperCase()}_ENABLED`;
  const envValue = typeof window !== "undefined"
    ? (process.env as Record<string, string | undefined>)[envKey]
    : undefined;

  if (envValue === "false") return false;
  if (envValue === "true") return true;

  // Fall back to Convex runtime flag
  const flag = useQuery(api.featureFlags.get, { key });
  return flag?.enabled ?? false;
}
```

**Step 2: Write utilities**

`lib/utils/dates.ts`:
```typescript
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), "dd.MM.yyyy", { locale: de });
}

export function formatDateTime(timestamp: number): string {
  return format(new Date(timestamp), "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatRelative(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: de });
}

export function daysUntil(timestamp: number): number {
  return differenceInDays(new Date(timestamp), new Date());
}

export function isOverdue(dueDate: number): boolean {
  return dueDate < Date.now();
}
```

`lib/utils/formatting.ts`:
```typescript
export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

/** Format a number as Euro */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
```

**Step 3: Commit**

```bash
git add lib/hooks/ lib/utils/
git commit -m "feat: add custom hooks (auth, permissions, feature flags) and utilities"
```

---

### Task 0.11: Layout & Navigation — Sidebar, Topbar, Shared Components

**Files:**
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/topbar.tsx`
- Create: `components/layout/page-header.tsx`
- Create: `components/shared/status-badge.tsx`
- Create: `components/shared/placeholder-page.tsx`
- Create: `components/shared/data-table.tsx`
- Create: `components/shared/audit-history.tsx`
- Create: `components/shared/file-upload.tsx`
- Create: `components/shared/portable-text.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`

This task builds the full app shell with sidebar navigation, topbar, and all shared UI components. The sidebar includes all menu items with "IN PLANUNG" badges for Phase 4 modules. Use shadcn/ui components (Sheet, Button, Badge, Avatar, DropdownMenu). Sidebar items are filtered by user role via `usePermissions()`. The layout wraps all `(dashboard)` routes.

Build each component one at a time, verify it renders, then move to the next. All German labels. Mobile-responsive sidebar (Sheet on mobile, fixed on desktop).

**Step: Commit after all components**

```bash
git add components/ app/
git commit -m "feat: add app shell — sidebar, topbar, page header, shared components, auth layout"
```

---

### Task 0.12: Dashboard Page (Role-Based Widgets)

**Files:**
- Create: `app/(dashboard)/page.tsx`
- Create: `components/domain/tasks/task-list-widget.tsx`
- Create: `components/domain/documents/recent-documents-widget.tsx`
- Create: `components/domain/training/training-status-widget.tsx`

Build the role-based dashboard as described in the design doc. Each role sees different widgets. Use `useCurrentUser()` to determine role, then render appropriate widgets. Each widget is a separate Client Component using Convex `useQuery`. Widget cards use shadcn Card component.

**Step: Commit**

```bash
git add app/(dashboard)/page.tsx components/domain/
git commit -m "feat: add role-based dashboard with task, document, and training widgets"
```

---

### Task 0.13: Tasks & Calendar Pages

**Files:**
- Create: `app/(dashboard)/tasks/page.tsx`
- Create: `app/(dashboard)/calendar/page.tsx`

Tasks page: Lists user's tasks with filter by status, type, priority. Uses `data-table` component. Click to complete/cancel. Calendar page: Simple list view of upcoming due dates sorted by date. Both pages use Convex queries.

**Step: Commit**

```bash
git add app/(dashboard)/tasks/ app/(dashboard)/calendar/
git commit -m "feat: add tasks page and calendar/due dates page"
```

---

### Task 0.14: Admin Pages — Users, Locations, Departments, Settings

**Files:**
- Create: `app/(dashboard)/admin/users/page.tsx`
- Create: `app/(dashboard)/admin/locations/page.tsx`
- Create: `app/(dashboard)/admin/departments/page.tsx`
- Create: `app/(dashboard)/admin/settings/page.tsx`

Admin pages for managing users (CRUD with role assignment), locations, departments (org hierarchy), and system settings (feature flags). Protected by `admin` role. Uses data tables and forms with Zod validation.

**Step: Commit**

```bash
git add app/(dashboard)/admin/
git commit -m "feat: add admin pages — users, locations, departments, settings"
```

---

## Phase 1: Document Control

### Task 1.1: Convex Functions — Document Records & Read Confirmations

**Files:**
- Create: `convex/documents.ts`

Write queries/mutations for: listing document records (with status), creating/updating document records, changing document status (with state machine validation), submitting read confirmations, listing read confirmations per document. All with RBAC checks and audit logging.

**Step: Commit**

```bash
git add convex/documents.ts
git commit -m "feat: add Convex functions for document records and read confirmations"
```

---

### Task 1.2: Document Pages — List & Detail

**Files:**
- Create: `app/(dashboard)/documents/page.tsx`
- Create: `app/(dashboard)/documents/[id]/page.tsx`
- Create: `components/domain/documents/document-list.tsx`
- Create: `components/domain/documents/document-detail.tsx`
- Create: `components/domain/documents/read-confirmation-button.tsx`

Document list page: Fetches Sanity content list + Convex status metadata. Filter by type, status. Document detail page: Server Component fetches Sanity content (Portable Text), nested Client Component shows Convex status + read confirmation button + audit history timeline.

**Step: Commit**

```bash
git add app/(dashboard)/documents/ components/domain/documents/
git commit -m "feat: add document control pages — list, detail, read confirmations"
```

---

## Phase 2: Training Management

### Task 2.1: Convex Functions — Trainings, Sessions, Participants

**Files:**
- Create: `convex/trainings.ts`
- Create: `convex/participants.ts`

Write queries/mutations for: CRUD trainings, CRUD sessions (with state machine), adding/removing participants, marking attendance, transitioning participant status through the full lifecycle. Business rule: When session marked HELD → all confirmed participants move to FEEDBACK_PENDING + task created.

**Step: Commit**

```bash
git add convex/trainings.ts convex/participants.ts
git commit -m "feat: add Convex functions for trainings, sessions, and participants"
```

---

### Task 2.2: Convex Functions — Feedback & Effectiveness

**Files:**
- Create: `convex/effectiveness.ts`
- Modify: `convex/participants.ts` (add feedback submission logic)

Write mutations for: submitting training feedback (validates ratings 1-6, transitions participant to FEEDBACK_DONE, marks task DONE), submitting effectiveness check (transitions participant to EFFECTIVE/INEFFECTIVE, if INEFFECTIVE → REQUIRES_ACTION + creates follow-up task + CAPA trigger placeholder).

**Step: Commit**

```bash
git add convex/effectiveness.ts convex/participants.ts
git commit -m "feat: add feedback submission and effectiveness check functions"
```

---

### Task 2.3: Convex Functions — Training Requests

**Files:**
- Create: `convex/trainingRequests.ts`

Write mutations for: creating training request (employee), reviewing request (approve/reject by dept lead or QMB), linking approved request to training. Full state machine validation.

**Step: Commit**

```bash
git add convex/trainingRequests.ts
git commit -m "feat: add training request functions with approval workflow"
```

---

### Task 2.4: Training Pages — List, Detail, Sessions, Feedback

**Files:**
- Create: `app/(dashboard)/trainings/page.tsx`
- Create: `app/(dashboard)/trainings/new/page.tsx`
- Create: `app/(dashboard)/trainings/[id]/page.tsx`
- Create: `app/(dashboard)/trainings/[id]/sessions/page.tsx`
- Create: `app/(dashboard)/trainings/[id]/sessions/[sessionId]/page.tsx`
- Create: `app/(dashboard)/trainings/[id]/sessions/[sessionId]/feedback/page.tsx`
- Create: `components/domain/training/training-form.tsx`
- Create: `components/domain/training/session-form.tsx`
- Create: `components/domain/training/participant-list.tsx`
- Create: `components/domain/training/feedback-form.tsx`
- Create: `components/domain/training/effectiveness-form.tsx`

Training list with filter/search. Create/edit training form. Session management (plan, mark as held, close). Participant list with status badges. Feedback form with 1-6 rating scale per item. Effectiveness check form. All with Zod validation and audit history.

**Step: Commit**

```bash
git add app/(dashboard)/trainings/ components/domain/training/
git commit -m "feat: add training pages — list, detail, sessions, feedback, effectiveness"
```

---

### Task 2.5: Training Request Pages

**Files:**
- Create: `app/(dashboard)/training-requests/page.tsx`
- Create: `app/(dashboard)/training-requests/new/page.tsx`
- Create: `app/(dashboard)/training-requests/[id]/page.tsx`

Request list (filtered by role: employee sees own, dept_lead sees team, qmb sees all). Create request form. Detail page with approval/rejection UI for dept_lead/qmb.

**Step: Commit**

```bash
git add app/(dashboard)/training-requests/
git commit -m "feat: add training request pages with approval workflow UI"
```

---

## Phase 3: MDR & Products

### Task 3.1: Convex Functions — Products, Manufacturers, Declarations

**Files:**
- Create: `convex/products.ts`
- Create: `convex/declarations.ts`

Write queries/mutations for: CRUD products (with manufacturer reference), CRUD manufacturers, uploading DoC (Convex file storage), reviewing DoC, DoC status transitions. Business rule: Check feature flag `enforceDocForActiveProduct` — if enabled, block product activation without VALID DoC.

**Step: Commit**

```bash
git add convex/products.ts convex/declarations.ts
git commit -m "feat: add Convex functions for products, manufacturers, and declarations of conformity"
```

---

### Task 3.2: MDR Pages — Products & Declarations

**Files:**
- Create: `app/(dashboard)/mdr/products/page.tsx`
- Create: `app/(dashboard)/mdr/products/new/page.tsx`
- Create: `app/(dashboard)/mdr/products/[id]/page.tsx`
- Create: `app/(dashboard)/mdr/declarations/page.tsx`
- Create: `app/(dashboard)/mdr/declarations/[id]/page.tsx`
- Create: `components/domain/products/product-form.tsx`
- Create: `components/domain/products/declaration-upload.tsx`

Product list with filter by status, risk class, manufacturer. Product detail with linked DoCs. Declaration list with expiry warnings. Declaration detail with file download and review UI. File upload component using Convex file storage.

**Step: Commit**

```bash
git add app/(dashboard)/mdr/ components/domain/products/
git commit -m "feat: add MDR pages — product list, detail, declarations with file upload"
```

---

### Task 3.3: Scheduled Jobs — Crons

**Files:**
- Create: `convex/crons.ts`

Write three cron jobs:
1. `checkDocExpirations`: Daily, checks DoC validUntil dates, transitions VALID→EXPIRING (90d) and EXPIRING→EXPIRED, creates tasks.
2. `checkEffectivenessDue`: Daily, checks participants with FEEDBACK_DONE where effectiveness check is due, transitions to EFFECTIVENESS_PENDING, creates tasks.
3. `checkOpenTasks`: Daily, marks overdue tasks.

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "check-doc-expirations",
  { hourUTC: 1, minuteUTC: 0 }, // 02:00 CET
  internal.declarations.checkExpirations
);

crons.daily(
  "check-effectiveness-due",
  { hourUTC: 1, minuteUTC: 30 },
  internal.effectiveness.checkDue
);

crons.daily(
  "check-open-tasks",
  { hourUTC: 2, minuteUTC: 0 },
  internal.tasks.checkOverdue
);

export default crons;
```

The internal functions (`checkExpirations`, `checkDue`, `checkOverdue`) are `internalMutation` functions in their respective files.

**Step: Commit**

```bash
git add convex/crons.ts
git commit -m "feat: add scheduled cron jobs for DoC expiry, effectiveness checks, and task reminders"
```

---

## Phase 4: Placeholders

### Task 4.1: Placeholder Pages & Stub Functions

**Files:**
- Create: `app/(dashboard)/audits/page.tsx`
- Create: `app/(dashboard)/capa/page.tsx`
- Create: `app/(dashboard)/complaints/page.tsx`
- Create: `app/(dashboard)/incoming-goods/page.tsx`
- Create: `app/(dashboard)/devices/page.tsx`
- Create: `app/(dashboard)/reports/page.tsx`
- Create: `convex/placeholders/audits.ts`
- Create: `convex/placeholders/capa.ts`
- Create: `convex/placeholders/complaints.ts`
- Create: `convex/placeholders/incomingGoods.ts`
- Create: `convex/placeholders/devices.ts`
- Create: `convex/placeholders/reports.ts`

Each page uses `<PlaceholderPage>` component with: module name, description (German), planned workflows, planned entities, expected availability. Each Convex file has a single stub query returning empty array with a TODO comment.

**Step: Commit**

```bash
git add app/(dashboard)/audits/ app/(dashboard)/capa/ app/(dashboard)/complaints/ app/(dashboard)/incoming-goods/ app/(dashboard)/devices/ app/(dashboard)/reports/ convex/placeholders/
git commit -m "feat: add Phase 4 placeholder pages and stub functions (IN PLANUNG)"
```

---

## Phase 5: Seed Data & Final Wiring

### Task 5.1: Seed Script

**Files:**
- Create: `convex/seed.ts`

Write a Convex mutation that seeds demo data: 1 organization + 2 locations + 4 departments, 8 sample users (one per role + extras), 3 trainings with sessions + participants, 5 products with manufacturers, 3 DoCs (one valid, one expiring, one expired), Feature flags (enforceDocForActiveProduct: false), Sample tasks.

**Step: Commit**

```bash
git add convex/seed.ts
git commit -m "feat: add seed script with demo data for all modules"
```

---

### Task 5.2: Audit Log Page + Dashboard Wiring

**Files:**
- Modify: `app/(dashboard)/page.tsx` (wire all dashboard widgets to real queries)
- Create: `components/shared/audit-history.tsx` (if not already)

Ensure the dashboard correctly queries and renders all role-based widgets. Audit history component on every detail page shows timeline from `auditLog` table.

**Step: Commit**

```bash
git add app/(dashboard)/page.tsx components/shared/
git commit -m "feat: wire dashboard widgets and audit history component"
```

---

## Summary: Task Checklist

| # | Task | Phase | Depends On |
|---|---|---|---|
| 0.1 | Project scaffold | 0 | — |
| 0.2 | Convex schema | 0 | 0.1 |
| 0.3 | Shared types & enums | 0 | 0.2 |
| 0.4 | Zod validators | 0 | 0.3 |
| 0.5 | Convex lib (RBAC, audit, state machine) | 0 | 0.2 |
| 0.6 | Convex Auth setup | 0 | 0.2 |
| 0.7 | Users & Organizations functions | 0 | 0.5, 0.6 |
| 0.8 | Tasks & Feature Flags functions | 0 | 0.5 |
| 0.9 | Sanity setup (config, schemas, client) | 0 | 0.1 |
| 0.10 | Custom hooks & utilities | 0 | 0.7, 0.8 |
| 0.11 | Layout & shared components | 0 | 0.10 |
| 0.12 | Dashboard page | 0 | 0.11 |
| 0.13 | Tasks & Calendar pages | 0 | 0.11 |
| 0.14 | Admin pages | 0 | 0.11 |
| 1.1 | Document Control functions | 1 | 0.5 |
| 1.2 | Document pages | 1 | 0.11, 0.9, 1.1 |
| 2.1 | Training + Session + Participant functions | 2 | 0.5 |
| 2.2 | Feedback & Effectiveness functions | 2 | 2.1 |
| 2.3 | Training Request functions | 2 | 0.5 |
| 2.4 | Training pages | 2 | 0.11, 2.1, 2.2 |
| 2.5 | Training Request pages | 2 | 0.11, 2.3 |
| 3.1 | Products + Declarations functions | 3 | 0.5 |
| 3.2 | MDR pages | 3 | 0.11, 3.1 |
| 3.3 | Cron jobs | 3 | 2.2, 3.1 |
| 4.1 | Placeholder pages + stubs | 4 | 0.11 |
| 5.1 | Seed script | 5 | 0.7, 2.1, 3.1 |
| 5.2 | Dashboard wiring + audit history | 5 | all above |

---

## Parallelization Opportunities

These task groups can run in parallel (no dependencies between groups):

**Group A (Convex Backend):** 0.5 → 0.7 → 0.8 → 1.1 → 2.1 → 2.2 → 2.3 → 3.1 → 3.3
**Group B (Sanity):** 0.9 (independent)
**Group C (UI Foundation):** 0.3 → 0.4 → 0.10 → 0.11

After Groups A+B+C complete: 0.12 → 0.13 → 0.14 → 1.2 → 2.4 → 2.5 → 3.2 → 4.1 → 5.1 → 5.2
