import {
  QueryCtx,
  MutationCtx,
} from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission } from "./permissions";
import type { PermissionAction } from "../../lib/types/domain";
import type { UserRole } from "../../lib/types/enums";
import { Id } from "../_generated/dataModel";

interface AuthenticatedUser {
  _id: Id<"users">;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: Id<"organizations">;
  locationId?: Id<"organizations">;
  departmentId?: Id<"organizations">;
  status: string;
}

/**
 * Get the current authenticated user from context.
 * Throws if not authenticated or user not found.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) {
    throw new Error("Nicht authentifiziert");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUserId))
    .first();

  if (!user) {
    throw new Error("Benutzer nicht gefunden");
  }

  if (user.status !== "active") {
    throw new Error("Benutzerkonto ist deaktiviert");
  }

  return user as AuthenticatedUser;
}

/**
 * Check permissions for the current user. Throws if unauthorized.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  ...actions: PermissionAction[]
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(ctx);

  const hasAccess = actions.some((action) =>
    hasPermission(user.role as UserRole, action)
  );

  if (!hasAccess) {
    throw new Error(
      `Keine Berechtigung für: ${actions.join(", ")}`
    );
  }

  return user;
}
