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
  "AUDIT_PLAN_DUE",
  "CAPA_EFFECTIVENESS_DUE",
  "RISK_REVIEW_DUE",
  "YEAR_CYCLE",
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
  "MISSING", "IN_REVIEW", "VALID", "EXPIRING", "EXPIRED",
  "REJECTED", "WITHDRAWN", "SUPERSEDED",
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const REGULATORY_BASES = ["MDR", "DIRECTIVE"] as const;
export type RegulatoryBasis = (typeof REGULATORY_BASES)[number];

export const URL_STATUSES = ["REACHABLE", "UNREACHABLE", "UNCHECKED"] as const;
export type UrlStatus = (typeof URL_STATUSES)[number];

export const HMV_LEVELS = ["produktgruppe", "anwendungsort", "untergruppe", "produktart"] as const;
export type HmvLevel = (typeof HMV_LEVELS)[number];

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
  "CAPA_ASSIGNED",
  "CAPA_MEASURE_ASSIGNED",
  "COMPLAINT_ASSIGNED",
  "AUDIT_PLAN_DUE",
  "CAPA_EFFECTIVENESS_DUE",
  "RISK_REVIEW_DUE",
  "ANNUAL_REPORT_DUE",
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
  CAPA_ASSIGNED: "CAPA zugewiesen",
  CAPA_MEASURE_ASSIGNED: "CAPA-Maßnahme zugewiesen",
  COMPLAINT_ASSIGNED: "Reklamation zugewiesen",
  AUDIT_PLAN_DUE: "Auditplan: Audit fällig",
  CAPA_EFFECTIVENESS_DUE: "CAPA-Wirksamkeitsprüfung fällig",
  RISK_REVIEW_DUE: "Risiko-Neubewertung fällig",
  ANNUAL_REPORT_DUE: "Jahresbericht fällig",
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
  WITHDRAWN: "bg-gray-100 text-gray-600",
  SUPERSEDED: "bg-purple-100 text-purple-700",
  // Effectiveness
  PENDING: "bg-yellow-100 text-yellow-800",
  // Priority
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
  // Review
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800",
  // Regulatory basis
  MDR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DIRECTIVE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  // URL status
  REACHABLE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UNREACHABLE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  UNCHECKED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
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
  WITHDRAWN: "Zurückgezogen",
  SUPERSEDED: "Ersetzt",
  PENDING: "Ausstehend",
  CHANGES_REQUESTED: "Änderungen angefordert",
  MDR: "MDR (EU 2017/745)",
  DIRECTIVE: "Richtlinie (93/42/EWG)",
  REACHABLE: "Erreichbar",
  UNREACHABLE: "Nicht erreichbar",
  UNCHECKED: "Nicht geprüft",
  PLACEHOLDER: "In Planung",
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

// ============================================================
// Audits (ISO 13485 Kap. 8.2.4) — Phase 1
// ============================================================
export const AUDIT_TYPES = ["INTERNAL", "EXTERNAL"] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];
export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  INTERNAL: "Internes Audit",
  EXTERNAL: "Externes Audit",
};

export const AUDIT_STATUSES = [
  "PLANNED", "IN_PROGRESS", "REPORT_DRAFT", "CLOSED", "CANCELLED",
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];
// "In Durchführung" weicht bewusst von STATUS_LABELS["IN_PROGRESS"] ("In Bearbeitung") ab — Audit-Domäne
export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  PLANNED: "Geplant",
  IN_PROGRESS: "In Durchführung",
  REPORT_DRAFT: "Berichtsentwurf",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Abgebrochen",
};

// Bewertungslegende exakt nach FB 8.2.4 Auditcheckliste v5
export const AUDIT_RATINGS = [
  "KONFORM", "ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG", "NICHT_ANWENDBAR",
] as const;
export type AuditRating = (typeof AUDIT_RATINGS)[number];
export const AUDIT_RATING_LABELS: Record<AuditRating, string> = {
  KONFORM: "Konform",
  ABWEICHUNG: "Abweichung",
  FESTSTELLUNG: "Feststellung",
  EMPFEHLUNG: "Empfehlung",
  NICHT_ANWENDBAR: "nicht anwendbar", // klein geschrieben wie in der Formblatt-Legende (FB 8.2.4 v5)
};
export const AUDIT_RATING_DESCRIPTIONS: Record<AuditRating, string> = {
  KONFORM: "Anforderung vollständig erfüllt",
  ABWEICHUNG: "Erhebliche Nichterfüllung der Anforderung",
  FESTSTELLUNG: "Geringfügige Abweichung / Handlungsbedarf",
  EMPFEHLUNG: "Hinweis zur Verbesserung ohne Abweichung",
  NICHT_ANWENDBAR: "Ausschluss laut QM-Handbuch Kap. 4.3",
};

// Findings sind die nicht-konformen Bewertungen der Legende — Subset von AuditRating,
// per Extract typsicher gekoppelt, Labels aus AUDIT_RATING_LABELS wiederverwendet.
export type FindingClassification = Extract<
  AuditRating,
  "ABWEICHUNG" | "FESTSTELLUNG" | "EMPFEHLUNG"
>;
export const FINDING_CLASSIFICATIONS = [
  "ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG",
] as const satisfies readonly FindingClassification[];
export const FINDING_CLASSIFICATION_LABELS: Record<FindingClassification, string> = {
  ABWEICHUNG: AUDIT_RATING_LABELS.ABWEICHUNG,
  FESTSTELLUNG: AUDIT_RATING_LABELS.FESTSTELLUNG,
  EMPFEHLUNG: AUDIT_RATING_LABELS.EMPFEHLUNG,
};

export const CHECKLIST_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED"] as const;
export type ChecklistTemplateStatus = (typeof CHECKLIST_TEMPLATE_STATUSES)[number];
// "Abgelöst" weicht bewusst von STATUS_LABELS["SUPERSEDED"] ("Ersetzt") ab — Checklisten-Vorlagen-Domäne
export const CHECKLIST_TEMPLATE_STATUS_LABELS: Record<ChecklistTemplateStatus, string> = {
  DRAFT: "Entwurf",
  ACTIVE: "Aktiv",
  SUPERSEDED: "Abgelöst",
};

// ============================================================
// CAPA (ISO 13485 Kap. 8.5.2 / 8.5.3) — Phase 1
// ============================================================
export const CAPA_TYPES = ["CORRECTIVE", "PREVENTIVE"] as const;
export type CapaType = (typeof CAPA_TYPES)[number];
export const CAPA_TYPE_LABELS: Record<CapaType, string> = {
  CORRECTIVE: "Korrekturmaßnahme (8.5.2)",
  PREVENTIVE: "Vorbeugemaßnahme (8.5.3)",
};

export const CAPA_STATUSES = [
  "OPEN", "ANALYSIS", "MEASURES_DEFINED", "IN_PROGRESS",
  "EFFECTIVENESS_CHECK", "CLOSED", "CANCELLED",
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];
// "In Umsetzung" weicht bewusst von STATUS_LABELS["IN_PROGRESS"] ("In Bearbeitung") ab — CAPA-Domäne
export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  OPEN: "Offen",
  ANALYSIS: "Ursachenanalyse",
  MEASURES_DEFINED: "Maßnahmen definiert",
  IN_PROGRESS: "In Umsetzung",
  EFFECTIVENESS_CHECK: "Wirksamkeitsprüfung",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Abgebrochen",
};

export const CAPA_SOURCE_TYPES = [
  "AUDIT", "COMPLAINT", "TRAINING", "RISK", "QUALITY_OBJECTIVE", "MGMT_REVIEW", "MANUAL",
] as const;
export type CapaSourceType = (typeof CAPA_SOURCE_TYPES)[number];
export const CAPA_SOURCE_TYPE_LABELS: Record<CapaSourceType, string> = {
  AUDIT: "Audit",
  COMPLAINT: "Reklamation",
  TRAINING: "Schulung",
  RISK: "Risiko",
  QUALITY_OBJECTIVE: "Qualitätsziel", // FB 5.4.1: Ziel Gelb/Rot → CAPA-Pflichtverknüpfung
  MGMT_REVIEW: "Managementbewertung",
  MANUAL: "Manuell",
};

// Ergebnis der Wirksamkeitsprüfung (8.5.2 e) — bewusst ohne "PENDING": nur dokumentierbare Endergebnisse
export const EFFECTIVENESS_RESULTS = ["EFFECTIVE", "INEFFECTIVE"] as const;
export type EffectivenessResult = (typeof EFFECTIVENESS_RESULTS)[number];

// ============================================================
// Reklamationen (ISO 13485 Kap. 8.2.2, MDR Art. 87) — Phase 2
// ============================================================
export const COMPLAINT_STATUSES = [
  "RECEIVED", "IN_REVIEW", "IN_PROGRESS", "CLOSED",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  RECEIVED: "Eingegangen",
  IN_REVIEW: "In Prüfung",
  IN_PROGRESS: "In Bearbeitung",
  CLOSED: "Abgeschlossen",
};

export const COMPLAINT_ASSESSMENTS = ["JUSTIFIED", "UNJUSTIFIED", "GOODWILL"] as const;
export type ComplaintAssessment = (typeof COMPLAINT_ASSESSMENTS)[number];
export const COMPLAINT_ASSESSMENT_LABELS: Record<ComplaintAssessment, string> = {
  JUSTIFIED: "Berechtigt",
  UNJUSTIFIED: "Unberechtigt",
  GOODWILL: "Kulanz",
};

// MDR Art. 87: Standard-Meldefrist 15 Tage; 2/10 Tage bei schweren Fällen (Frist überschreibbar)
export const VIGILANCE_DEFAULT_DEADLINE_DAYS = 15;

// ============================================================
// Qualitätsziele (ISO 13485 Kap. 5.4.1) — Phase 3
// ============================================================
export const OBJECTIVE_TARGET_TYPES = ["MIN", "MAX"] as const;
export type ObjectiveTargetType = (typeof OBJECTIVE_TARGET_TYPES)[number];
export const OBJECTIVE_TARGET_TYPE_LABELS: Record<ObjectiveTargetType, string> = {
  MIN: "min (mindestens erreichen)",
  MAX: "max (höchstens erreichen)",
};

// Ampel-Konvention wie reale Bedarfsmatrix: ≥100 % GRÜN, ≥70 % GELB, <70 % ROT
export const OBJECTIVE_STATUSES = ["GREEN", "YELLOW", "RED"] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];
export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  GREEN: "Grün", YELLOW: "Gelb", RED: "Rot",
};

// Registrierte Auto-KPIs (convex/kpis.ts) — Schlüssel für qualityObjectives.kpiKey
export const KPI_KEYS = [
  "complaintsYearCount",      // Anzahl Reklamationen im Jahr (App-Register)
  "vigilanceOnTimeRate",      // % fristgerechte Vigilanz-Meldungen (100 wenn keine Fälle)
  "capaClosedInYearCount",    // im Jahr abgeschlossene CAPAs
  "capaOpenOverdueCount",     // offene CAPAs mit überschrittenem Termin
  "auditsClosedInYearCount",  // abgeschlossene Audits im Jahr
  "auditOpenFindingsCount",   // offene Audit-Findings
  "trainingFulfillmentRate",  // Phase 4: erfüllte Pflicht-Themen ÷ Pflicht-Themen über alle Funktionen
] as const;
export type KpiKey = (typeof KPI_KEYS)[number];
export const KPI_KEY_LABELS: Record<KpiKey, string> = {
  complaintsYearCount: "Reklamationen im Jahr (App-Register)",
  vigilanceOnTimeRate: "Fristgerechte Vigilanz-Meldungen (%)",
  capaClosedInYearCount: "Abgeschlossene CAPAs im Jahr",
  capaOpenOverdueCount: "Überfällige offene CAPAs",
  auditsClosedInYearCount: "Abgeschlossene Audits im Jahr",
  auditOpenFindingsCount: "Offene Audit-Findings",
  trainingFulfillmentRate: "Erfüllungsgrad Pflichtschulungen (%)",
};

// ============================================================
// Managementbewertung (ISO 13485 Kap. 5.6) — Phase 3
// ============================================================
export const MGMT_REVIEW_STATUSES = ["DRAFT", "APPROVED"] as const;
export type MgmtReviewStatus = (typeof MGMT_REVIEW_STATUSES)[number];
export const MGMT_REVIEW_STATUS_LABELS: Record<MgmtReviewStatus, string> = {
  DRAFT: "Entwurf", APPROVED: "Freigegeben",
};

// Feste Abschnitte gemäß ISO 13485 §5.6.2 (FB 5.6.0; 2.9/2.10 ergänzt nach
// Auditor-Hinweis 2026: regulatorische Anforderungen + Folgemaßnahmen fehlten)
export const MGMT_REVIEW_SECTIONS = [
  { key: "audits", title: "2.1 Audits" },
  { key: "complaints", title: "2.2 Kundenfeedback / Reklamationen" },
  { key: "pms", title: "2.3 PMS" },
  { key: "processes", title: "2.4 Prozesse — Überwachung und Messung von Prozessen und Produkten" },
  { key: "capa", title: "2.5 CAPA" },
  { key: "changes", title: "2.6 Änderungen" },
  { key: "resources", title: "2.7 Ressourcen" },
  { key: "risks", title: "2.8 Risiken & Chancen" },
  { key: "regulatory", title: "2.9 Regulatorische Anforderungen" },
  { key: "followup", title: "2.10 Folgemaßnahmen aus vorangegangenen Managementbewertungen" },
] as const;

// ============================================================
// Schulungsbedarfsmatrix (ISO 13485 Kap. 6.2, FB 6.2.0 Anhang) — Phase 4
// ============================================================
// Einstufungs-Legende exakt nach FB 6.2.0 Anhang Rev. 1
export const REQUIREMENT_LEVELS = [
  "REQUIRED_DEEP",    // ●●● Pflicht – tiefer Fachbedarf
  "REQUIRED_BASIC",   // ●●  Pflicht – Grundlagen
  "RECOMMENDED",      // ●   Empfohlen
  "ON_DEMAND",        // ○   Bei Bedarf
] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];
export const REQUIREMENT_LEVEL_LABELS: Record<RequirementLevel, string> = {
  REQUIRED_DEEP: "Pflicht – tiefer Fachbedarf",
  REQUIRED_BASIC: "Pflicht – Grundlagen",
  RECOMMENDED: "Empfohlen",
  ON_DEMAND: "Bei Bedarf",
};
export const REQUIREMENT_LEVEL_SYMBOLS: Record<RequirementLevel, string> = {
  REQUIRED_DEEP: "●●●", REQUIRED_BASIC: "●●", RECOMMENDED: "●", ON_DEMAND: "○",
};
// Pflicht-Einstufungen für Soll-Zählung und Erfüllungsgrad
export const MANDATORY_LEVELS: readonly RequirementLevel[] = ["REQUIRED_DEEP", "REQUIRED_BASIC"];

// Besetzungsstatus exakt nach Blatt „Stand & Lücken"
export const STAFFING_STATUSES = [
  "FILLED",            // besetzt (grün)
  "INTERNAL_DEVELOP",  // intern fortbilden / informell — formal nachzuholen (gelb)
  "EXTERNAL_HIRE",     // extern neu zu besetzen (rot)
  "IN_CLARIFICATION",  // Klärungsbedarf, z.B. Doppelrolle (blau)
] as const;
export type StaffingStatus = (typeof STAFFING_STATUSES)[number];
export const STAFFING_STATUS_LABELS: Record<StaffingStatus, string> = {
  FILLED: "Besetzt",
  INTERNAL_DEVELOP: "Intern fortbilden",
  EXTERNAL_HIRE: "Extern zu besetzen",
  IN_CLARIFICATION: "In Klärung",
};

export const TOPIC_CLUSTERS = [
  { key: "A", title: "A. QM & Regulatorik" },
  { key: "B", title: "B. Führung & Personal" },
  { key: "C", title: "C. IT & Datenschutz" },
  { key: "D", title: "D. Versorgung & Werkstatt" },
  { key: "E", title: "E. Reklamation & Vigilanz" },
  { key: "F", title: "F. Abrechnung & Verträge" },
  { key: "G", title: "G. Allgemein-verbindlich" },
] as const;

// ============================================================
// Risikoregister (ISO 13485 Kap. 7.1, FB 7.1.0) — Phase 5
// ============================================================
// RPZ = Auftretenswahrscheinlichkeit × Schweregrad × Folgen; < 100 = akzeptabel (FB 7.1.0 Rev. 1)
export const RPZ_ACCEPT_THRESHOLD = 100;

export type RiskLevelBand = { min: number; max: number; label: string; hint?: string };

// Bewertungskriterien exakt nach FB 7.1.0 (Legenden-Tabellen)
// Auftretenswahrscheinlichkeit („Fehler kann vorkommen")
export const RISK_OCCURRENCE_BANDS: readonly RiskLevelBand[] = [
  { min: 1, max: 1, label: "Unwahrscheinlich", hint: "< 10⁻⁶" },
  { min: 2, max: 3, label: "Fernliegend", hint: "< 10⁻⁵" },
  { min: 4, max: 6, label: "Gelegentlich", hint: "< 10⁻⁴" },
  { min: 7, max: 8, label: "Wahrscheinlich", hint: "< 10⁻³" },
  { min: 9, max: 10, label: "Häufig", hint: "≥ 10⁻³" },
];

// Schweregrad / Bedeutung („Auswirkung auf den Patienten")
export const RISK_SEVERITY_BANDS: readonly RiskLevelBand[] = [
  { min: 1, max: 1, label: "Vernachlässigbar", hint: "Unannehmlichkeiten o. zeitweilige Beschwerden" },
  { min: 2, max: 3, label: "Gering", hint: "Zeitweilige Schädigung o. Behinderung, kein sachkundiges Einschreiten erforderlich" },
  { min: 4, max: 6, label: "Ernst", hint: "Führt zu Schädigung oder Behinderung, die ein Einschreiten erfordern" },
  { min: 7, max: 8, label: "Kritisch", hint: "Führt zu dauernder Behinderung oder lebensbedrohlicher Schädigung" },
  { min: 9, max: 10, label: "Katastrophal", hint: "Führt zum Ableben des Patienten" },
];

// Spalte „Folgen" = Wahrscheinlichkeit der ENTDECKUNG des Fehlers vor Auslieferung an die Anwender
export const RISK_CONSEQUENCE_BANDS: readonly RiskLevelBand[] = [
  { min: 1, max: 1, label: "hoch" },
  { min: 2, max: 3, label: "mäßig" },
  { min: 4, max: 6, label: "gering" },
  { min: 7, max: 8, label: "sehr gering" },
  { min: 9, max: 10, label: "unwahrscheinlich" },
];

export function riskBandLabel(bands: readonly RiskLevelBand[], value: number): string {
  return bands.find((b) => value >= b.min && value <= b.max)?.label ?? String(value);
}

// ============================================================
// PMS-Bericht (MDR Art. 85, FB „7 1") — Phase 6
// ============================================================
// Die 8 festen Abschnitte des realen Berichts (Rev. 1, Stand 01.2026)
export const PMS_SECTIONS = [
  { key: "goal", title: "1. Ziel des PMS" },
  { key: "dataSources", title: "2. Datenquellen und Methodik" },
  { key: "metrics", title: "3. Kennzahlen und Auswertung" },
  { key: "riskAssessment", title: "4. Risikobewertung" },
  { key: "capa", title: "5. CAPA" },
  { key: "pmsSystemAssessment", title: "6. Bewertung des PMS-Systems" },
  { key: "conclusion", title: "7. Schlussfolgerung" },
  { key: "recommendations", title: "8. Empfehlungen" },
] as const;
export type PmsSectionKey = (typeof PMS_SECTIONS)[number]["key"];

export const PMS_DEFAULT_PRODUCT_GROUP =
  "Sonderanfertigungen der Klasse I (Orthesen, Einlagen, Prothesen, Maßschuhe etc.)";

// Vorlagen-Texte für neue Entwürfe (aus dem realen Bericht; editierbar)
export const PMS_TEMPLATE_TEXTS: Partial<Record<PmsSectionKey, string>> = {
  goal: "Sicherstellung der Sicherheit, Leistungsfähigkeit und frühzeitigen Erkennung von Risiken.",
  dataSources:
    "– Reklamationen (OTWin)\n– Interne Fehler (Kunden-, Lieferanten-, interne Fehler - OTWin)\n– Klinische Nachbeobachtung (MPG-Wiedervorlage)\n– Qualitätsziele und Managementbewertung",
};

// ============================================================
// Auditplan-Jahresmatrix (FB 8.2.4) — Phase 7
// ============================================================
export const MONTH_LABELS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] as const;
