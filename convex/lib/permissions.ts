import { type UserRole } from "../../lib/types/enums";
import { type PermissionAction } from "../../lib/types/domain";

// ============================================================
// RBAC Permission Matrix
// ============================================================

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  admin: [], // handled via wildcard check below
  qmb: [
    "documents:read", "documents:create", "documents:review",
    "documents:approve", "documents:archive",
    "trainings:list", "trainings:create", "trainings:manage",
    "trainings:feedback:submit", "trainings:effectiveness:review",
    "trainingRequests:create", "trainingRequests:review",
    "products:list", "products:create", "products:update",
    "declarations:list", "declarations:upload", "declarations:review",
    "tasks:all",
    "users:list",
  ],
  department_lead: [
    "documents:read",
    "trainings:list", "trainings:manage",
    "trainings:feedback:submit", "trainings:effectiveness:review",
    "trainingRequests:create", "trainingRequests:review",
    "products:list",
    "declarations:list",
    "tasks:team",
    "users:list",
  ],
  employee: [
    "documents:read",
    "trainings:list",
    "trainings:feedback:submit",
    "trainingRequests:create",
    "products:list",
    "declarations:list",
    "tasks:own",
  ],
  auditor: [
    "documents:read",
    "trainings:list",
    "products:list",
    "declarations:list",
    "tasks:own",
  ],
};

/**
 * Check if a user role has permission to perform an action.
 * Admin role has implicit wildcard access.
 */
export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  if (role === "admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

/**
 * Check if a user role has any of the given permissions.
 */
export function hasAnyPermission(
  role: UserRole,
  actions: PermissionAction[]
): boolean {
  return actions.some((action) => hasPermission(role, action));
}
