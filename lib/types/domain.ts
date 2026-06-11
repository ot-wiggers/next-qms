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
  | "documents:approve" | "documents:archive" | "documents:delete" | "documents:link"
  | "trainings:list" | "trainings:create" | "trainings:manage"
  | "trainings:feedback:submit" | "trainings:effectiveness:review"
  | "trainingRequests:create" | "trainingRequests:review"
  | "products:list" | "products:create" | "products:update" | "products:delete"
  | "declarations:list" | "declarations:upload" | "declarations:review" | "declarations:delete"
  | "hmv:browse" | "hmv:mark"
  | "tasks:own" | "tasks:team" | "tasks:all"
  | "notifications:read" | "notifications:manage"
  | "dashboard:view" | "dashboard:view_all"
  | "audits:list" | "audits:manage" | "audits:report"
  | "capa:list" | "capa:create" | "capa:manage" | "capa:close"
  | "complaints:list" | "complaints:create" | "complaints:manage" | "complaints:close"
  | "qualityObjectives:list" | "qualityObjectives:manage"
  | "mgmtReview:list" | "mgmtReview:manage" | "mgmtReview:approve"
  | "trainingMatrix:list" | "trainingMatrix:manage"
  | "risks:list" | "risks:manage"
  | "pmsReports:list" | "pmsReports:manage" | "pmsReports:approve"
  | "admin:settings" | "admin:featureFlags";
