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
