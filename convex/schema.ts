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
  v.literal("DOCUMENT_REVIEW_DUE"),
  v.literal("GENERAL"),
  v.literal("FOLLOW_UP"),
  v.literal("AUDIT_PLAN_DUE"),         // Phase 7: geplantes Audit nicht durchgeführt
  v.literal("CAPA_EFFECTIVENESS_DUE"), // Phase 7: Wirksamkeitsprüfung fällig
  v.literal("RISK_REVIEW_DUE"),        // Phase 7: Risiko-Neubewertung fällig
  v.literal("YEAR_CYCLE")             // Phase 7: Jahreswechsel-Erinnerungen
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

const auditType = v.union(v.literal("INTERNAL"), v.literal("EXTERNAL"));
const auditStatusEnum = v.union(
  v.literal("PLANNED"), v.literal("IN_PROGRESS"), v.literal("REPORT_DRAFT"),
  v.literal("CLOSED"), v.literal("CANCELLED")
);
const auditRating = v.union(
  v.literal("KONFORM"), v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"),
  v.literal("EMPFEHLUNG"), v.literal("NICHT_ANWENDBAR")
);
const findingClassification = v.union(
  v.literal("ABWEICHUNG"), v.literal("FESTSTELLUNG"), v.literal("EMPFEHLUNG")
);
const checklistTemplateStatus = v.union(
  v.literal("DRAFT"), v.literal("ACTIVE"), v.literal("SUPERSEDED")
);
const capaStatusEnum = v.union(
  v.literal("OPEN"), v.literal("ANALYSIS"), v.literal("MEASURES_DEFINED"),
  v.literal("IN_PROGRESS"), v.literal("EFFECTIVENESS_CHECK"),
  v.literal("CLOSED"), v.literal("CANCELLED")
);
const capaTypeEnum = v.union(v.literal("CORRECTIVE"), v.literal("PREVENTIVE"));
const capaSourceType = v.union(
  v.literal("AUDIT"), v.literal("COMPLAINT"), v.literal("TRAINING"),
  v.literal("RISK"), v.literal("QUALITY_OBJECTIVE"),
  v.literal("MGMT_REVIEW"), v.literal("MANUAL")
);

const complaintStatus = v.union(
  v.literal("RECEIVED"), v.literal("IN_REVIEW"),
  v.literal("IN_PROGRESS"), v.literal("CLOSED")
);
const complaintAssessment = v.union(
  v.literal("JUSTIFIED"), v.literal("UNJUSTIFIED"), v.literal("GOODWILL")
);

const objectiveTargetType = v.union(v.literal("MIN"), v.literal("MAX"));
const objectiveStatusEnum = v.union(
  v.literal("GREEN"), v.literal("YELLOW"), v.literal("RED")
);
const mgmtReviewStatus = v.union(v.literal("DRAFT"), v.literal("APPROVED"));
const pmsReportStatus = v.union(v.literal("DRAFT"), v.literal("APPROVED"));

const requirementLevel = v.union(
  v.literal("REQUIRED_DEEP"), v.literal("REQUIRED_BASIC"),
  v.literal("RECOMMENDED"), v.literal("ON_DEMAND")
);
const staffingStatus = v.union(
  v.literal("FILLED"), v.literal("INTERNAL_DEVELOP"),
  v.literal("EXTERNAL_HIRE"), v.literal("IN_CLARIFICATION")
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

const regulatoryBasis = v.union(v.literal("MDR"), v.literal("DIRECTIVE"));
const urlStatus = v.union(v.literal("REACHABLE"), v.literal("UNREACHABLE"), v.literal("UNCHECKED"));

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
  v.literal("EXPIRED"),
  v.literal("REJECTED"),
  v.literal("WITHDRAWN"),
  v.literal("SUPERSEDED"),
);

const auditAction = v.union(
  v.literal("CREATE"),
  v.literal("UPDATE"),
  v.literal("STATUS_CHANGE"),
  v.literal("ARCHIVE"),
  v.literal("RESTORE"),
  v.literal("PERMANENT_DELETE"),
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
    .index("by_resource", ["resourceType", "resourceId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "isArchived"],
    }),

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
    documentType: documentType,
    documentCode: v.string(),
    version: v.string(),
    status: documentStatus,
    content: v.optional(v.string()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    responsibleUserId: v.id("users"),
    reviewerId: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    approvedById: v.optional(v.id("users")),

    // DEPRECATED: kept for backwards-compat with existing data, remove after migration
    sanityDocumentId: v.optional(v.string()),

    // NEW: Rich content fields
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

    ...auditFields,
  })
    .index("by_status", ["status"])
    .index("by_documentCode", ["documentCode"])
    .index("by_responsible", ["responsibleUserId"])
    .index("by_type", ["documentType"])
    .index("by_parent", ["parentDocumentId"])
    .index("by_review_date", ["nextReviewDate"])
    .index("by_slug", ["slug"])
    .searchIndex("search_content", {
      searchField: "contentPlaintext",
      filterFields: ["status", "documentType", "isArchived"],
    })
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "documentType", "isArchived"],
    }),

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
  })
    .index("by_document", ["documentId"])
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
  })
    .index("by_document", ["documentId"])
    .index("by_reviewer", ["reviewerId"])
    .index("by_document_status", ["documentId", "status"]),

  // Document Links — relationships between documents
  documentLinks: defineTable({
    sourceDocumentId: v.id("documentRecords"),
    targetDocumentId: v.id("documentRecords"),
    linkType: v.string(), // references | supersedes | implements | related
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_source", ["sourceDocumentId"])
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
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_user_created", ["userId", "createdAt"]),

  // Notification Preferences
  notificationPreferences: defineTable({
    userId: v.id("users"),
    emailEnabled: v.boolean(),
    digestFrequency: v.string(), // daily | weekly | none
    mutedEventTypes: v.array(v.string()),
  }).index("by_user", ["userId"]),

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
    externalLink: v.optional(v.string()), // e.g. link to external training provider
    status: trainingStatus,
    ...auditFields,
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "isArchived"],
    }),

  trainingSessions: defineTable({
    trainingId: v.id("trainings"),
    scheduledDate: v.number(),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    trainerId: v.optional(v.id("users")),
    trainerName: v.optional(v.string()),
    maxParticipants: v.optional(v.number()),
    externalLink: v.optional(v.string()), // e.g. link to external training provider
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

    // Schulungsbewertungsbogen 6.2.0
    shortReport: v.string(), // Kurzbericht (min 30 chars, validated in mutation)

    organizationRatings: v.object({
      venueAccessibility: v.number(),   // Erreichbarkeit des Veranstaltungsortes (1-6)
      conferenceRooms: v.number(),      // Konferenzräume (1-6)
      catering: v.number(),             // Verpflegung (1-6)
      staffSupport: v.number(),         // Betreuung durch Personal (1-6)
    }),

    eventRatings: v.object({
      overallEvent: v.number(),           // Veranstaltung insgesamt (1-6)
      knowledgeUsefulness: v.number(),    // Verwertbarkeit der Kenntnisse (1-6)
      structurePresentation: v.number(),  // Aufbau und Darstellung (1-6)
      seminarContent: v.number(),         // Seminarinhalt (1-6)
      questionOpportunity: v.number(),    // Fragemöglichkeit (1-6)
      seminarMaterials: v.number(),       // Seminarunterlagen (1-6)
      speakerExpertise: v.number(),       // Fachkompetenz des Referenten (1-6)
      presentationQuality: v.number(),    // Qualität des Vortrags (1-6)
    }),

    badRatingReason: v.optional(v.string()), // "Ich habe eine 5/6 vergeben weil:"

    // Certificate / Teilnehmerliste upload
    certificateFileId: v.optional(v.id("_storage")),
    certificateFileName: v.optional(v.string()),

    // Legacy fields (kept for backwards-compat, optional)
    ratings: v.optional(v.object({
      contentRelevance: v.number(),
      trainerCompetence: v.number(),
      methodology: v.number(),
      practicalApplicability: v.number(),
      organizationQuality: v.number(),
      overallSatisfaction: v.number(),
    })),
    comments: v.optional(v.string()),
    improvementSuggestions: v.optional(v.string()),
    wouldRecommend: v.optional(v.boolean()),

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
  // Calendar Events (user-created personal/shared events)
  // ============================================================

  calendarEvents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    color: v.optional(v.string()), // hex color for display
    isPrivate: v.boolean(), // only visible to creator
    createdByUserId: v.id("users"),
    ...auditFields,
  })
    .index("by_creator", ["createdByUserId"])
    .index("by_startDate", ["startDate"])
    .index("by_endDate", ["endDate"]),

  // ============================================================
  // PHASE 3: MDR & Products
  // ============================================================

  manufacturers: defineTable({
    name: v.string(),
    country: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
    website: v.optional(v.string()),
    ...auditFields,
  })
    .index("by_name", ["name"]),

  products: defineTable({
    name: v.string(),
    articleNumber: v.string(),
    udi: v.optional(v.string()),
    productGroup: v.optional(v.string()),
    manufacturerId: v.optional(v.id("manufacturers")),
    departmentId: v.optional(v.id("organizations")), // Abteilung
    riskClass: riskClass,
    status: productStatus,
    notes: v.optional(v.string()),
    hmvNummer: v.optional(v.string()),          // 10-digit HMV number e.g. "18.46.02.1003"
    ceMarkPresent: v.optional(v.boolean()),      // CE-Zeichen vorhanden
    instructionsPresent: v.optional(v.boolean()), // Gebrauchsanweisung vorhanden
    regulatoryBasis: v.optional(regulatoryBasis), // MDR or DIRECTIVE (MDD)
    migrationRequired: v.optional(v.boolean()),   // true if DIRECTIVE, needs MDR migration
    ...auditFields,
  })
    .index("by_articleNumber", ["articleNumber"])
    .index("by_status", ["status"])
    .index("by_manufacturer", ["manufacturerId"])
    .index("by_riskClass", ["riskClass"])
    .index("by_productGroup", ["productGroup"])
    .index("by_department", ["departmentId"])
    .index("by_hmvNummer", ["hmvNummer"]),

  declarationsOfConformity: defineTable({
    productId: v.id("products"),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    version: v.string(),
    issuedAt: v.number(),
    validFrom: v.number(),
    validUntil: v.number(),
    notifiedBody: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    status: docStatus,
    reviewedById: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewComment: v.optional(v.string()),
    externalUrl: v.optional(v.string()),        // URL to manufacturer's PDF
    urlLastChecked: v.optional(v.number()),     // timestamp of last URL check
    urlStatus: v.optional(urlStatus),           // REACHABLE | UNREACHABLE | UNCHECKED
    ...auditFields,
  })
    .index("by_product", ["productId"])
    .index("by_status", ["status"])
    .index("by_validUntil", ["validUntil"]),

  // HMV (Hilfsmittelverzeichnis) - cached from REHADAT API
  hmvCache: defineTable({
    rehadatId: v.string(),                    // UUID from REHADAT API
    hmvNummer: v.string(),                    // e.g. "18.46.02.1003"
    displayName: v.string(),                  // e.g. "18.46.02.1003 - Duschrollstuhl"
    level: v.number(),                        // 1=Produktgruppe, 2=Anwendungsort, 3=Untergruppe, 4=Produktart, 5=Produkt
    parentRehadatId: v.optional(v.string()),  // parent UUID
    herstellerName: v.optional(v.string()),   // manufacturer (only for level 5 products)
    lastSynced: v.number(),                   // timestamp
    ...auditFields,
  })
    .index("by_rehadatId", ["rehadatId"])
    .index("by_hmvNummer", ["hmvNummer"])
    .index("by_parent", ["parentRehadatId"])
    .index("by_level", ["level"]),

  // Marked HMV items = Versorgungsspektrum (supply spectrum)
  hmvMarkedItems: defineTable({
    hmvNummer: v.string(),                    // Can be 2-digit (Produktgruppe), 4-digit, 6-digit, or 7-digit
    hmvLevel: v.union(
      v.literal("produktgruppe"),
      v.literal("anwendungsort"),
      v.literal("untergruppe"),
      v.literal("produktart"),
    ),
    displayName: v.string(),                  // Cached display name
    rehadatId: v.string(),                    // UUID for linking back to HMV tree
    organizationId: v.id("organizations"),
    ...auditFields,
  })
    .index("by_organization", ["organizationId"])
    .index("by_hmvNummer", ["hmvNummer"]),

  // Google Search quota tracking (no auditFields — simple counter, not an auditable entity)
  searchQuota: defineTable({
    organizationId: v.id("organizations"),
    date: v.string(),                         // YYYY-MM-DD
    count: v.number(),                        // searches used today
    maxPerDay: v.number(),                    // configurable limit (default 20)
  })
    .index("by_org_date", ["organizationId", "date"]),

  // ============================================================
  // PHASE 1 (QM-Jahreszyklus): Interne Audits (8.2.4) + CAPA (8.5.2/8.5.3)
  // Design: docs/superpowers/plans/2026-06-10-qm-jahreszyklus-design.md
  // ============================================================

  auditChecklistTemplates: defineTable({
    name: v.string(),                    // z.B. "Auditcheckliste 2026"
    formNumber: v.string(),              // "8.2.4"
    version: v.number(),                 // 5
    status: checklistTemplateStatus,
    basis: v.optional(v.string()),       // Normen/QMH-Bezug
    ...auditFields,
  }).index("by_status", ["status"]),

  auditChecklistTemplateItems: defineTable({
    templateId: v.id("auditChecklistTemplates"),
    chapter: v.string(),                 // "4.1.1"
    chapterTitle: v.string(),            // "Regulatorische Anforderungen & Rollen"
    requirements: v.string(),            // Prüfpunkte/Anforderungen
    sortOrder: v.number(),
    ...auditFields,
  }).index("by_template", ["templateId"]),

  audits: defineTable({
    title: v.string(),                   // "Internes Audit 2026"
    auditYear: v.number(),
    auditType: auditType,
    status: auditStatusEnum,
    leadAuditorId: v.optional(v.id("users")),
    auditTeam: v.optional(v.string()),   // Auditor/Fachexperte/Mitarbeiter des Bereichs
    basis: v.optional(v.string()),
    location: v.optional(v.string()),
    reportingPeriod: v.optional(v.string()),
    plannedFor: v.optional(v.string()),  // z.B. "05/2026"
    area: v.optional(v.string()),                   // Auditplan-Thema (FB 8.2.4): "Reha / Rollstuhl"
    plannedMonths: v.optional(v.array(v.number())), // SOLL-Monate 1–12 laut Auditplan
    affectedAreas: v.optional(v.string()),          // "betroffene Bereiche" (FB 8.2.4)
    auditDate: v.optional(v.number()),
    templateId: v.optional(v.id("auditChecklistTemplates")),
    templateVersion: v.optional(v.number()),
    summaryResult: v.optional(v.string()),   // Zusammenfassendes Ergebnis
    chapterSummaries: v.optional(v.array(v.object({
      chapter: v.string(),               // "Kapitel 4 – Qualitätsmanagementsystem"
      summary: v.string(),
    }))),
    reportFileId: v.optional(v.id("_storage")),
    closedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_year", ["auditYear"])
    .index("by_status", ["status"]),

  auditChecklistAnswers: defineTable({
    auditId: v.id("audits"),
    chapter: v.string(),                 // eingefrorene Kopie aus der Vorlage
    chapterTitle: v.string(),
    requirements: v.string(),
    sortOrder: v.number(),
    rating: v.optional(auditRating),
    evidence: v.optional(v.string()),    // Nachweis (PA/AA/FB/QMH inkl. Rev.)
    sample: v.optional(v.string()),      // Stichprobe (konkrete Aufzeichnung)
    interviewedWith: v.optional(v.string()),
    comments: v.optional(v.string()),
    ...auditFields,
  }).index("by_audit", ["auditId"]),

  auditFindings: defineTable({
    auditId: v.id("audits"),
    answerId: v.optional(v.id("auditChecklistAnswers")),
    chapter: v.optional(v.string()),
    classification: findingClassification,
    description: v.string(),
    capaId: v.optional(v.id("capas")), // autoritative Verknüpfung Finding→CAPA; capas.sourceId ist nur Anzeige-Provenienz
    status: v.union(v.literal("OPEN"), v.literal("RESOLVED")),
    ...auditFields,
  })
    .index("by_audit", ["auditId"])
    .index("by_capa", ["capaId"]),

  capas: defineTable({
    capaNumber: v.string(),              // "CAPA-2026-11" (reales Format)
    year: v.number(),
    seq: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    capaType: capaTypeEnum,
    sourceType: capaSourceType,
    sourceId: v.optional(v.string()),    // z.B. auditFindings-Id als String
    rootCauseAnalysis: v.optional(v.string()),
    status: capaStatusEnum,
    assigneeId: v.optional(v.id("users")),
    responsible: v.optional(v.string()),          // Freitext-Rollen wie im echten FB ("BDL / IT", "GF / BDL")
    dueAt: v.optional(v.number()),
    effectivenessCriterion: v.optional(v.string()), // vorab definiert, wie im FB: "Wirksam: Q3/Q4-Auswertung ≥ 95 %"
    effectivenessDueAt: v.optional(v.number()),
    effectivenessResult: v.optional(v.union(v.literal("EFFECTIVE"), v.literal("INEFFECTIVE"))),
    effectivenessNote: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_year", ["year"])
    .index("by_status", ["status"])
    .index("by_number", ["capaNumber"]),

  capaMeasures: defineTable({
    capaId: v.id("capas"),
    description: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
    status: v.union(v.literal("OPEN"), v.literal("DONE")),
    doneAt: v.optional(v.number()),
    ...auditFields,
  }).index("by_capa", ["capaId"]),

  // ============================================================
  // PHASE 2 (QM-Jahreszyklus): Reklamationen (8.2.2, MDR Art. 87)
  // ============================================================
  complaints: defineTable({
    complaintNumber: v.string(),         // "REK-2026-01"
    year: v.number(),
    seq: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    receivedAt: v.number(),              // Eingangsdatum
    receivedVia: v.optional(v.string()), // Filiale, Telefon, E-Mail …
    customerName: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    productText: v.optional(v.string()), // Freitext, wenn Produkt nicht im Stamm
    failureCategory: v.optional(v.string()), // Fehlerart (vgl. OTWin-Fehlerbücher)
    assessment: v.optional(complaintAssessment), // Pflicht vor Abschluss
    assessmentNote: v.optional(v.string()),
    correctionNote: v.optional(v.string()),  // Sofortkorrektur
    isVigilanceRelevant: v.boolean(),
    vigilanceDeadline: v.optional(v.number()),     // berechnet: receivedAt + 15 Tage (überschreibbar)
    vigilanceReportedAt: v.optional(v.number()),
    vigilanceReportReference: v.optional(v.string()),
    vigilanceReportChannel: v.optional(v.string()), // BfArM-Portal, Hersteller …
    capaId: v.optional(v.id("capas")),   // autoritative Verknüpfung; capas.sourceId = Anzeige-Provenienz
    assigneeId: v.optional(v.id("users")),
    otwinRef: v.optional(v.string()),    // Abgleichschlüssel für spätere Sybase-Anbindung (OTWin)
    status: complaintStatus,
    closedAt: v.optional(v.number()),
    ...auditFields,
  })
    .index("by_year", ["year"])
    .index("by_status", ["status"])
    .index("by_number", ["complaintNumber"])
    .index("by_product", ["productId"]),

  // === PHASE 3 (QM-Jahreszyklus): Qualitätsziele (5.4.1) + Managementbewertung (5.6) ===

  qualityObjectives: defineTable({
    year: v.number(),
    seq: v.number(),                       // Nr. im Formblatt
    area: v.string(),                      // Bereich
    title: v.string(),                     // Qualitätsziel
    kpiDefinition: v.optional(v.string()), // KPI-Definition / Messgröße
    dataSource: v.optional(v.string()),    // OTWin, FB 6.2.0 …
    responsible: v.optional(v.string()),   // Freitext-Rolle wie im FB
    targetType: objectiveTargetType,
    targetValue: v.number(),               // Zielwert Jahresende
    unit: v.optional(v.string()),          // %, Anzahl …
    isPhaseModel: v.boolean(),             // Phasenmodell (Q-Meilensteine 25/50/75/100)
    kpiKey: v.optional(v.string()),        // Auto-KPI aus KPI_KEYS (Vorschlag, kein Zwang)
    capaId: v.optional(v.id("capas")),     // Pflicht bei Gelb/Rot (soft enforced)
    comment: v.optional(v.string()),
    ...auditFields,
  }).index("by_year", ["year"]),

  qualityObjectiveReadings: defineTable({
    objectiveId: v.id("qualityObjectives"),
    quarter: v.number(),                   // 1–4
    targetValue: v.number(),               // SOLL des Quartals
    actualValue: v.optional(v.number()),   // IST (leer = noch nicht erfasst)
    percent: v.optional(v.number()),       // berechnet bei Erfassung
    status: v.optional(objectiveStatusEnum), // Ampel, berechnet bei Erfassung
    note: v.optional(v.string()),
    ...auditFields,
  }).index("by_objective", ["objectiveId"]),

  managementReviews: defineTable({
    year: v.number(),
    reportingPeriod: v.string(),           // "01.01.2026 – 31.12.2026"
    participants: v.optional(v.string()),
    companyNote: v.optional(v.string()),   // "Sanitätshaus mit ca. 30 MA an 4 Standorten"
    status: mgmtReviewStatus,
    sections: v.array(v.object({
      key: v.string(),                     // audits|complaints|pms|processes|capa|changes|resources|risks
      autoData: v.optional(v.string()),    // Daten-Snapshot (beim Anlegen generiert, einfrierbar)
      assessment: v.optional(v.string()),  // Prosa "Bewertung: …"
    })),
    overallAssessment: v.optional(v.string()), // 3. Gesamtbewertung
    measures: v.array(v.object({
      description: v.string(),
      responsible: v.optional(v.string()),
      dueText: v.optional(v.string()),       // "Q4 2026", "laufend"
      effectivenessCheck: v.optional(v.string()), // "Audit", "Stichproben"
      capaId: v.optional(v.id("capas")),
    })),
    improvements: v.optional(v.string()),  // 5. Verbesserungen
    reportFileId: v.optional(v.id("_storage")),
    approvedAt: v.optional(v.number()),
    ...auditFields,
  }).index("by_year", ["year"]),

  // === PHASE 4 (QM-Jahreszyklus): Schulungsbedarfsmatrix (6.2) ===

  jobFunctions: defineTable({
    name: v.string(),                       // "Verwaltungsleiter / QMB"
    holder: v.optional(v.string()),         // Stelleninhaber/-in (Freitext wie im Blatt)
    staffingStatus: staffingStatus,
    userId: v.optional(v.id("users")),      // optionale Verknüpfung zum App-Nutzer
    sortOrder: v.number(),
    notes: v.optional(v.string()),
    // Nachfolge & Besetzung (Blatt 4) — Felder je Funktion
    successionPath: v.optional(v.string()),     // Besetzungsweg
    successionState: v.optional(v.string()),    // Aktueller Stand
    successionNextSteps: v.optional(v.string()),// Konkrete nächste Schritte
    successionResponsible: v.optional(v.string()),
    successionDueText: v.optional(v.string()),  // "Q4 2026", Datum als Freitext wie im Blatt
    successionStatus: v.optional(v.string()),   // Freitext wie im Blatt
    ...auditFields,
  }).index("by_sortOrder", ["sortOrder"]),

  trainingTopics: defineTable({
    cluster: v.string(),                    // "A".."G" (TOPIC_CLUSTERS)
    title: v.string(),
    frequency: v.optional(v.string()),      // "1× initial, Refresher alle 3 Jahre"
    provider: v.optional(v.string()),       // Quelle/Anbieter
    sortOrder: v.number(),
    ...auditFields,
  }).index("by_cluster", ["cluster"]),

  trainingRequirements: defineTable({
    functionId: v.id("jobFunctions"),
    topicId: v.id("trainingTopics"),
    level: requirementLevel,                // kein Eintrag = "—" nicht relevant
    ...auditFields,
  })
    .index("by_function", ["functionId"])
    .index("by_topic", ["topicId"]),

  trainingFulfillments: defineTable({
    functionId: v.id("jobFunctions"),
    topicId: v.id("trainingTopics"),
    fulfilled: v.boolean(),
    validUntil: v.optional(v.number()),     // Wiederholungstermin, optional
    note: v.optional(v.string()),
    ...auditFields,
  }).index("by_function", ["functionId"]),

  // ============================================================
  // PHASE 5 (QM-Jahreszyklus): Risikoregister (7.1)
  // ============================================================

  risks: defineTable({
    riskNumber: v.string(),               // "RS-01" — globaler Nummernkreis ohne Jahr (FB 7.1.0 führt kein Jahr)
    seq: v.number(),
    title: v.string(),                    // Spalte „Risiko"
    measures: v.optional(v.string()),     // „Maßnahmen der Minimierung / Kontrolle" (Freitext wie im FB)
    responsible: v.optional(v.string()),  // Freitext wie im FB ("GF / MA", "BDL / IT")
    // RPZ-Faktoren NACH Maßnahme (aktueller Stand) — RPZ wird NIE gespeichert, immer berechnet
    occurrenceProbability: v.number(),    // Auftretenswahrscheinlichkeit 1–10
    severity: v.number(),                 // Schweregrad 1–10
    consequences: v.number(),             // „Folgen" 1–10 (= Entdeckungswahrscheinlichkeit vor Auslieferung)
    // Optionale Faktoren VOR Maßnahme (App-Mehrwert; Original führt nur Nach-Werte)
    initialOccurrenceProbability: v.optional(v.number()),
    initialSeverity: v.optional(v.number()),
    initialConsequences: v.optional(v.number()),
    capaIds: v.optional(v.array(v.id("capas"))),  // Maßnahmen-Links auf CAPAs
    addedInRevision: v.optional(v.number()),      // 1 = blau markiert (neu in Rev. 1, 04.2026)
    sourceNote: v.optional(v.string()),           // Herkunft (z.B. "Q-Ziele-Quartalsauswertungen 2025")
    nextReviewAt: v.optional(v.number()),         // jährliche Neubewertung
    ...auditFields,
  })
    .index("by_number", ["riskNumber"])
    .index("by_seq", ["seq"]),

  // ============================================================
  // PHASE 6 (QM-Jahreszyklus): PMS-Bericht (7.1 / MDR Art. 85)
  // ============================================================

  pmsReports: defineTable({
    year: v.number(),                      // Berichtsjahr (Ende des Zeitraums): 2025 für "01.01.2025 – 31.12.2025"
    reportingPeriod: v.string(),           // "01.01.2025 – 31.12.2025"
    revision: v.number(),                  // Revision des Berichts (real: 1)
    standText: v.optional(v.string()),     // "01.2026" — Stand-Angabe wie im Original-Kopf
    productGroup: v.string(),              // "Sonderanfertigungen der Klasse I (…)"
    status: pmsReportStatus,
    sections: v.array(v.object({
      key: v.string(),                     // PmsSectionKey: goal|dataSources|metrics|riskAssessment|capa|pmsSystemAssessment|conclusion|recommendations
      autoData: v.optional(v.string()),    // Daten-Snapshot aus der App (metrics/riskAssessment/capa)
      text: v.optional(v.string()),        // Prosa des Abschnitts
    })),
    reportFileId: v.optional(v.id("_storage")),  // eingefrorenes Nachweis-PDF
    approvedAt: v.optional(v.number()),
    ...auditFields,
  }).index("by_year", ["year"]),

  // ============================================================
  // AUSBLICK: Platzhalter (Wareneingang, Prüfmittel)
  // ============================================================

  // Organization-specific settings (branding, logo, etc.)
  organizationSettings: defineTable({
    organizationId: v.id("organizations"),
    logoFileId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    ...auditFields,
  }).index("by_organization", ["organizationId"]),

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
