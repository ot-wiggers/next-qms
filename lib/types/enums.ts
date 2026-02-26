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
  "DOCUMENT_REVIEW_DUE",
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
// Notification types
// ============================================================
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
export const DIGEST_FREQUENCY_LABELS: Record<DigestFrequency, string> = {
  daily: "Täglich",
  weekly: "Wöchentlich",
  none: "Keine",
};

// Reconfirmation types
export const RECONFIRMATION_TYPES = ["read_only", "training_required"] as const;
export type ReconfirmationType = (typeof RECONFIRMATION_TYPES)[number];

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
  // Review
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800",
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
  CHANGES_REQUESTED: "Änderungen angefordert",
  PLACEHOLDER: "In Planung",
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend",
};
