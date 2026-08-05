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

// Phase 7 (Jahreszyklus): Fälligkeits-Checks täglich 04:00/05:00 CET
crons.daily(
  "check-audit-plan-due",
  { hourUTC: 3, minuteUTC: 0 },
  internal.audits.checkPlanDue
);

crons.daily(
  "check-capa-effectiveness-due",
  { hourUTC: 3, minuteUTC: 15 },
  internal.capas.checkEffectivenessDue
);

crons.daily(
  "check-risk-review-due",
  { hourUTC: 3, minuteUTC: 30 },
  internal.risks.checkReviewDue
);

crons.daily(
  "check-year-cycle",
  { hourUTC: 3, minuteUTC: 45 },
  internal.yearCycle.checkAnnualReports
);

crons.daily(
  "year-opening-tasks",
  { hourUTC: 4, minuteUTC: 0 },
  internal.yearCycle.yearOpeningTasks
);

// Wareneingang: Monats-Erinnerung je Filiale (sendet nur am 15./22./29.)
crons.daily(
  "check-incoming-goods-due",
  { hourUTC: 4, minuteUTC: 30 },
  internal.incomingGoods.checkMonthlyDue,
  {}
);

// §7.6: Prüfmittel-Kalibrierfälligkeit täglich prüfen
crons.daily(
  "check-calibration-due",
  { hourUTC: 4, minuteUTC: 45 },
  internal.devices.checkCalibrationDue,
);

// E-Learning: fällige Auffrischungen anmahnen
crons.daily(
  "elearning-refresh-due",
  { hourUTC: 5, minuteUTC: 30 },
  internal.elearning.checkRefreshDue,
);

export default crons;
