"use client";

import { useCurrentUser } from "./useCurrentUser";
import { hasPermission } from "../../convex/lib/permissions";
import type { PermissionAction } from "@/lib/types/domain";
import type { UserRole } from "@/lib/types/enums";

export function usePermissions() {
  const { user } = useCurrentUser();

  const can = (action: PermissionAction): boolean => {
    if (!user) return false;
    return hasPermission(user.role as UserRole, action);
  };

  return { can, role: user?.role as UserRole | undefined };
}
