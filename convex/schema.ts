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
