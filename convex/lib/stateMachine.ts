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
    IN_REVIEW: ["VALID", "REJECTED"],
    VALID: ["EXPIRING", "WITHDRAWN", "SUPERSEDED"],
    EXPIRING: ["EXPIRED", "VALID", "WITHDRAWN"],
    EXPIRED: ["IN_REVIEW", "WITHDRAWN"],
    REJECTED: ["IN_REVIEW", "WITHDRAWN"],
    WITHDRAWN: [],
    SUPERSEDED: [],
  },
  taskStatus: {
    OPEN: ["IN_PROGRESS", "DONE", "CANCELLED"],
    IN_PROGRESS: ["DONE", "CANCELLED"],
    DONE: [],
    CANCELLED: [],
  },
  reviewStatus: {
    PENDING: ["APPROVED", "CHANGES_REQUESTED"],
    APPROVED: [],
    CHANGES_REQUESTED: [],
  },
  // REPORT_DRAFT/EFFECTIVENESS_CHECK können bewusst NICHT direkt abgebrochen werden —
  // sobald Nachweise existieren, muss ein Abbruch über IN_PROGRESS erfolgen (bewusste Hürde).
  auditStatus: {
    PLANNED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["REPORT_DRAFT", "CANCELLED"],
    REPORT_DRAFT: ["CLOSED", "IN_PROGRESS"],
    CLOSED: [],
    CANCELLED: [],
  },
  capaStatus: {
    OPEN: ["ANALYSIS", "CANCELLED"],
    ANALYSIS: ["MEASURES_DEFINED", "CANCELLED"],
    MEASURES_DEFINED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["EFFECTIVENESS_CHECK", "CANCELLED"],
    EFFECTIVENESS_CHECK: ["CLOSED", "IN_PROGRESS"],
    CLOSED: [],
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
