# QMS Sanitätshaus — System Design Document

**Date:** 2026-02-23
**Status:** APPROVED
**Stack:** Next.js 16 (App Router) + TypeScript + Convex + Sanity CMS + shadcn/ui + Tailwind CSS + Zod

---

## 1. Decisions

| Decision | Choice |
|---|---|
| Auth | Convex Auth (built-in) |
| Org Structure | Organization > Location > Department |
| Language | UI German, Code English |
| UI Components | shadcn/ui (Radix + Tailwind) |
| Effectiveness Check Default | 30 days (configurable per training) |
| Sanity Studio | Embedded in Next.js at /studio |
| Architecture | Approach A: Sanity = pure content CMS, Convex = all operative data & business logic |

---

## 2. Architecture Overview

```
┌─────────────┐     GROQ Queries      ┌──────────────┐
│   Sanity     │ ◄──────────────────── │   Next.js    │
│   (Content)  │    Server Components  │   App Router │
└─────────────┘                        │              │
                                       │   Client:    │
┌─────────────┐     useQuery/          │   Convex     │
│   Convex     │ ◄──────────────────── │   Provider   │
│  (Operative) │    useMutation        └──────────────┘
└─────────────┘
```

**Sanity** owns: QM handbook chapters, work instructions, form templates, process descriptions.
**Convex** owns: Users, RBAC, tasks, trainings, products, DoCs, audit logs, workflows, file storage, scheduled jobs.
**Bridge:** `documentRecords.sanityDocumentId` links Convex metadata to Sanity content.

---

## 3. Project Structure

```
next-qms/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Sidebar + Topbar + RBAC Provider
│   │   ├── page.tsx                  # Role-based dashboard
│   │   ├── documents/
│   │   │   ├── page.tsx              # Document list (Sanity browser + Convex status)
│   │   │   └── [id]/page.tsx         # Document detail + read confirmation
│   │   ├── trainings/
│   │   │   ├── page.tsx              # Training list
│   │   │   ├── new/page.tsx          # Create training
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Training detail
│   │   │       └── sessions/
│   │   │           ├── page.tsx      # Session list
│   │   │           └── [sessionId]/
│   │   │               ├── page.tsx  # Session detail + participants
│   │   │               └── feedback/page.tsx  # Feedback form
│   │   ├── training-requests/
│   │   │   ├── page.tsx              # Request list
│   │   │   ├── new/page.tsx          # New request
│   │   │   └── [id]/page.tsx         # Request detail + approval
│   │   ├── mdr/
│   │   │   ├── products/
│   │   │   │   ├── page.tsx          # Product list
│   │   │   │   ├── new/page.tsx      # Create product
│   │   │   │   └── [id]/page.tsx     # Product detail
│   │   │   └── declarations/
│   │   │       ├── page.tsx          # DoC list
│   │   │       └── [id]/page.tsx     # DoC detail + file
│   │   ├── tasks/page.tsx            # My tasks
│   │   ├── calendar/page.tsx         # Due dates overview
│   │   ├── admin/
│   │   │   ├── users/page.tsx
│   │   │   ├── locations/page.tsx
│   │   │   ├── departments/page.tsx
│   │   │   └── settings/page.tsx     # Feature flags
│   │   ├── audits/page.tsx           # ⬜ PLACEHOLDER
│   │   ├── capa/page.tsx             # ⬜ PLACEHOLDER
│   │   ├── complaints/page.tsx       # ⬜ PLACEHOLDER
│   │   ├── incoming-goods/page.tsx   # ⬜ PLACEHOLDER
│   │   ├── devices/page.tsx          # ⬜ PLACEHOLDER
│   │   └── reports/page.tsx          # ⬜ PLACEHOLDER
│   └── studio/
│       └── [[...tool]]/page.tsx      # Sanity Studio embedded
├── convex/
│   ├── schema.ts
│   ├── auth.ts                       # Convex Auth config
│   ├── _generated/
│   ├── lib/
│   │   ├── permissions.ts            # can(user, action, resource)
│   │   ├── auditLog.ts              # logAuditEvent()
│   │   ├── stateMachine.ts          # validateTransition()
│   │   ├── withAuth.ts              # Auth + RBAC middleware wrapper
│   │   └── softDelete.ts            # archive() helper
│   ├── users.ts
│   ├── organizations.ts
│   ├── tasks.ts
│   ├── documents.ts
│   ├── trainings.ts
│   ├── participants.ts
│   ├── effectiveness.ts
│   ├── trainingRequests.ts
│   ├── products.ts
│   ├── declarations.ts
│   ├── featureFlags.ts
│   ├── crons.ts                     # Scheduled: DoC expiry, effectiveness due, task reminders
│   ├── seed.ts
│   └── placeholders/
│       ├── audits.ts
│       ├── capa.ts
│       ├── complaints.ts
│       ├── incomingGoods.ts
│       ├── devices.ts
│       └── reports.ts
├── sanity/
│   ├── sanity.config.ts
│   ├── schemas/
│   │   ├── qmDocument.ts
│   │   ├── workInstruction.ts
│   │   ├── formTemplate.ts
│   │   └── processDescription.ts
│   └── lib/
│       ├── client.ts
│       └── queries.ts
├── lib/
│   ├── validators/
│   │   ├── user.ts
│   │   ├── training.ts
│   │   ├── product.ts
│   │   ├── declaration.ts
│   │   └── task.ts
│   ├── types/
│   │   ├── enums.ts
│   │   └── domain.ts
│   ├── hooks/
│   │   ├── useCurrentUser.ts
│   │   ├── usePermissions.ts
│   │   └── useFeatureFlag.ts
│   └── utils/
│       ├── dates.ts
│       └── formatting.ts
├── components/
│   ├── ui/                          # shadcn/ui generated
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   └── page-header.tsx
│   ├── shared/
│   │   ├── data-table.tsx
│   │   ├── status-badge.tsx
│   │   ├── audit-history.tsx
│   │   ├── file-upload.tsx
│   │   ├── placeholder-page.tsx
│   │   └── portable-text.tsx
│   └── domain/
│       ├── training/
│       ├── documents/
│       ├── products/
│       └── tasks/
└── docs/
    └── plans/
```

---

## 4. Convex Data Model

### 4.1 Organization Structure

**organizations**
- `name: string`
- `type: "organization" | "location" | "department"`
- `parentId?: Id<"organizations">`
- `code: string` (e.g. "HQ", "FILIALE-NORD", "WERKSTATT")
- `isArchived: boolean`, `archivedAt?: number`, `archivedBy?: Id<"users">`
- `createdAt: number`, `createdBy?: Id<"users">`, `updatedAt: number`, `updatedBy?: Id<"users">`

**users**
- `email: string`, `firstName: string`, `lastName: string`
- `role: "employee" | "department_lead" | "qmb" | "admin" | "auditor"`
- `organizationId: Id<"organizations">`
- `locationId?: Id<"organizations">`, `departmentId?: Id<"organizations">`
- `status: "active" | "inactive"`
- Audit fields (same pattern as above)

### 4.2 Central Task System

**tasks**
- `type: "READ_DOCUMENT" | "TRAINING_FEEDBACK" | "TRAINING_EFFECTIVENESS" | "DOC_EXPIRY_WARNING" | "TRAINING_REQUEST_REVIEW" | "GENERAL" | "FOLLOW_UP"`
- `title: string`, `description?: string`
- `assigneeId: Id<"users">`
- `dueDate?: number`
- `status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"`
- `priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"`
- `resourceType?: string`, `resourceId?: string`
- Audit fields

### 4.3 Document Control (Convex side)

**documentRecords**
- `sanityDocumentId: string`
- `documentType: "qm_handbook" | "work_instruction" | "form_template" | "process_description"`
- `documentCode: string`, `version: string`
- `status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED"`
- `validFrom?: number`, `validUntil?: number`
- `responsibleUserId: Id<"users">`, `reviewerId?: Id<"users">`
- `approvedAt?: number`, `approvedById?: Id<"users">`
- Audit fields

**readConfirmations**
- `documentRecordId: Id<"documentRecords">`
- `userId: Id<"users">`
- `documentVersion: string`
- `confirmedAt: number`
- Audit fields

### 4.4 Training Management (5 tables)

**trainings**
- `title: string`, `description?: string`
- `category?: string`
- `isRequired: boolean`
- `effectivenessCheckAfterDays: number` (default: 30)
- `targetOrganizationIds?: Id<"organizations">[]`
- `status: "ACTIVE" | "ARCHIVED"`
- Audit fields

**trainingSessions**
- `trainingId: Id<"trainings">`
- `scheduledDate: number`, `endDate?: number`
- `location?: string`
- `trainerId?: Id<"users">`, `trainerName?: string`
- `maxParticipants?: number`
- `status: "PLANNED" | "HELD" | "CANCELLED" | "CLOSED"`
- `notes?: string`
- Audit fields

**trainingParticipants**
- `sessionId: Id<"trainingSessions">`
- `userId: Id<"users">`
- `status: "INVITED" | "ATTENDED" | "NO_SHOW" | "FEEDBACK_PENDING" | "FEEDBACK_DONE" | "EFFECTIVENESS_PENDING" | "EFFECTIVE" | "INEFFECTIVE" | "REQUIRES_ACTION"`
- `attendedAt?: number`
- Audit fields

**trainingFeedback**
- `participantId: Id<"trainingParticipants">`
- `sessionId: Id<"trainingSessions">`
- `userId: Id<"users">`
- `ratings: { contentRelevance: number, trainerCompetence: number, methodology: number, practicalApplicability: number, organizationQuality: number, overallSatisfaction: number }` (each 1-6)
- `comments?: string`, `improvementSuggestions?: string`
- `wouldRecommend: boolean`
- Audit fields

**effectivenessChecks**
- `participantId: Id<"trainingParticipants">`
- `sessionId: Id<"trainingSessions">`
- `userId: Id<"users">` (checked employee)
- `reviewerId: Id<"users">` (reviewer: dept lead / QMB)
- `dueDate: number`, `completedAt?: number`
- `goalAchieved?: boolean`, `applicationVisible?: boolean`, `errorRateReduced?: boolean`
- `decision: "EFFECTIVE" | "INEFFECTIVE" | "PENDING"`
- `justification?: string`
- Audit fields

### 4.5 Training Requests

**trainingRequests**
- `requesterId: Id<"users">`
- `topic: string`, `justification: string`
- `urgency: "LOW" | "MEDIUM" | "HIGH"`
- `externalLink?: string`, `estimatedCost?: number`
- `status: "REQUESTED" | "APPROVED" | "REJECTED" | "PLANNED" | "COMPLETED"`
- `reviewedById?: Id<"users">`, `reviewedAt?: number`
- `rejectionReason?: string`
- `linkedTrainingId?: Id<"trainings">`
- Audit fields

### 4.6 MDR & Products

**products**
- `name: string`, `articleNumber: string`
- `udi?: string`, `productGroup?: string`
- `manufacturerId?: Id<"manufacturers">`
- `riskClass: "I" | "IIa" | "IIb" | "III"`
- `status: "ACTIVE" | "BLOCKED" | "DELISTED"`
- `notes?: string`
- Audit fields

**manufacturers**
- `name: string`, `country?: string`, `contactInfo?: string`
- Audit fields

**declarationsOfConformity**
- `productId: Id<"products">`
- `fileId: Id<"_storage">`, `fileName: string`
- `version: string`
- `issuedAt: number`, `validFrom: number`, `validUntil: number`
- `notifiedBody?: string`, `certificateNumber?: string`
- `status: "MISSING" | "IN_REVIEW" | "VALID" | "EXPIRING" | "EXPIRED"`
- `reviewedById?: Id<"users">`, `reviewedAt?: number`
- Audit fields

### 4.7 Cross-Cutting

**auditLog**
- `userId: Id<"users">`
- `action: "CREATE" | "UPDATE" | "STATUS_CHANGE" | "ARCHIVE" | "FILE_UPLOAD" | "PERMISSION_CHANGE" | "LOGIN" | "LOGOUT"`
- `entityType: string`, `entityId: string`
- `changes?: any`, `previousStatus?: string`, `newStatus?: string`
- `metadata?: any`
- `timestamp: number`

**featureFlags**
- `key: string`, `enabled: boolean`, `description?: string`
- Audit fields

### 4.8 Phase 4 Placeholder Tables

`audits`, `auditFindings`, `capaActions`, `complaints`, `incomingGoodsChecks`, `deviceRecords`, `deviceCalibrations`
- Minimal schema: `title?: string`, `status: "PLACEHOLDER"`, audit fields

---

## 5. RBAC Model

### 5.1 Roles

| Role | Scope |
|---|---|
| admin | Full access, user/system management |
| qmb | Document control, approvals, MDR overview, training management |
| department_lead | Team trainings, effectiveness review, approvals, department KPIs |
| employee | Own tasks, feedback, training requests, read confirmations |
| auditor | Read-only access to records & reports (Phase 4) |

### 5.2 Permission Actions

```
users:list, users:create, users:update, users:archive
documents:read, documents:create, documents:review, documents:approve, documents:archive
trainings:list, trainings:create, trainings:manage
trainings:feedback:submit, trainings:effectiveness:review
trainingRequests:create, trainingRequests:review
products:list, products:create, products:update
declarations:list, declarations:upload, declarations:review
tasks:own, tasks:team, tasks:all
admin:settings, admin:featureFlags
```

### 5.3 Permission Check: `can(user, action, resource?)`

1. Check if user role has the action permission
2. If resource provided and user is not admin/qmb: verify location/department scope match
3. Special cases: `tasks:own` = only own tasks, `tasks:team` = same department tasks

### 5.4 Convex Middleware: `withAuth(requiredActions, handler)`

Every query/mutation is wrapped. Server-side enforcement, no client-side-only security.

---

## 6. State Machines

### 6.1 Document Status
`DRAFT → IN_REVIEW → APPROVED → ARCHIVED`
(APPROVED → DRAFT for new revision, IN_REVIEW → DRAFT for rejection)

### 6.2 Training Session Status
`PLANNED → HELD → CLOSED` | `PLANNED → CANCELLED`

### 6.3 Participant Status
`INVITED → ATTENDED → FEEDBACK_PENDING → FEEDBACK_DONE → EFFECTIVENESS_PENDING → EFFECTIVE | INEFFECTIVE → REQUIRES_ACTION`
(`INVITED → NO_SHOW` as alternative)

### 6.4 Training Request Status
`REQUESTED → APPROVED → PLANNED → COMPLETED` | `REQUESTED → REJECTED`

### 6.5 DoC Status
`MISSING → IN_REVIEW → VALID → EXPIRING → EXPIRED`
(EXPIRED → IN_REVIEW when new doc uploaded)

### 6.6 Task Status
`OPEN → IN_PROGRESS → DONE` | `OPEN → CANCELLED`

All transitions validated by `validateTransition()` in `convex/lib/stateMachine.ts`. Every status change logged in `auditLog`.

---

## 7. Scheduled Jobs (Convex Crons)

| Job | Schedule | Logic |
|---|---|---|
| `checkDocExpirations` | Daily 02:00 | DoCs with validUntil < now+90d → EXPIRING, create task for QMB. validUntil < now → EXPIRED. If feature flag `enforceDocForActiveProduct` → block product. |
| `checkEffectivenessDue` | Daily 02:30 | Participants with FEEDBACK_DONE where session.heldDate + training.effectivenessCheckAfterDays reached → EFFECTIVENESS_PENDING, create task for dept lead. Overdue > 14d → escalate to QMB. |
| `checkOpenTasks` | Daily 03:00 | Tasks with dueDate < now and status OPEN → mark overdue, optional email reminder. |

---

## 8. Sanity Content Model

### Schemas
- `qmDocument`: QM handbook chapters (chapterNumber, category, portableText content)
- `workInstruction`: SOPs (documentCode, scope, targetRoles, attachments)
- `formTemplate`: Form templates (formCode, purpose, templateFile for download)
- `processDescription`: Process descriptions (processCode, processOwner, inputs/outputs, KPIs)

### Integration
- Server Components fetch Sanity content via `sanityFetch()` with `revalidate: 60`
- Client Components load Convex metadata via `useQuery`
- Document detail pages: Server Component for content, nested Client Component for status + read confirmation button

---

## 9. Feature Flags

Three levels:
1. **Environment variables** (build-time): `NEXT_PUBLIC_FF_AUDITS_ENABLED=false`
2. **Convex featureFlags table** (runtime): `enforceDocForActiveProduct`, changeable by admin
3. **UI Hook** `useFeatureFlag(key)`: combines both, controls navigation and badges

---

## 10. Business Rules

1. After training attendance → feedback form is mandatory (blocks further progress)
2. After effectivenessCheckAfterDays → scheduled job creates task for dept lead/QMB
3. If effectiveness = INEFFECTIVE → participant REQUIRES_ACTION, follow-up task created, CAPA trigger placeholder
4. Product must not be ACTIVE without VALID DoC (when feature flag `enforceDocForActiveProduct` enabled)
5. Warning task when DoC expires in < 90 days
6. No hard deletes — only soft delete (isArchived + archivedAt + archivedBy)
7. All writes produce audit log entries

---

## 11. Phase Plan

| Phase | Module | Status |
|---|---|---|
| 0 | Foundations: Next.js, Auth, RBAC, Layout, Navigation, Convex Schema, Sanity Setup, Task system, Audit Log | BUILD |
| 1 | Document Control: Sanity browser, approval status, read confirmations, dashboard feed | BUILD |
| 2 | Trainings: Sessions, participants, feedback form, effectiveness checks, training requests + approval workflow | BUILD |
| 3 | MDR & Products: Product master, DoC upload/versions, alerts, reports | BUILD |
| 4 | Audits, CAPA, Complaints, Incoming Goods, Devices, Reports | PLACEHOLDER (UI + schema + stubs) |

---

## 12. PRD Deviations & Additions

| PRD Point | Design Decision |
|---|---|
| "Digital signature" for effectiveness | Simplified to: confirmation with userId + timestamp + mandatory justification field. Qualified digital signature as future TODO. |
| "Competency matrix update" on EFFECTIVE | TODO prepared. Dedicated `competencyMatrix` table in Phase 4. |
| "Full-text search" | Sanity built-in GROQ text search + Convex `.search()` index. No external search service needed. |
| "Export (PDF/CSV)" | Phase 4 Reports module. CSV export as simple Convex action. PDF via `@react-pdf/renderer` as TODO. |
| "SSO / 2FA" | Convex Auth supports OTP. SSO as later feature. 2FA as TODO. |
| "Change announcements in dashboard" | Implemented as "New/Changed Documents" widget based on documentRecords.updatedAt last 7 days filtered against read confirmations. |
| "Vigilance trigger from complaints" | Placeholder in complaints.ts. Schema field `isVigilanceRelevant: boolean` prepared. |
