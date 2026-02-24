"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AppUser } from "@/lib/types/domain";

export function useCurrentUser() {
  const raw = useQuery(api.users.me);
  const user = raw as AppUser | null | undefined;
  return {
    user,
    isLoading: user === undefined,
    isAuthenticated: user !== null && user !== undefined,
  };
}
