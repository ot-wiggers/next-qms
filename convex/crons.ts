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

export default crons;
