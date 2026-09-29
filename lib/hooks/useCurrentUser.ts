"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AppUser } from "@/lib/types/domain";

export function useCurrentUser() {
  // Erst den Auth-Status abwarten: sonst liefert users.me beim Neuladen einmal
  // anonym `null`, bevor der gespeicherte Token greift → falscher Login-Redirect.
  const { isLoading: authLoading, isAuthenticated: hasToken } = useConvexAuth();
  const raw = useQuery(api.users.me, hasToken ? {} : "skip");
  const user = raw as AppUser | null | undefined;
  return {
    user,
    isLoading: authLoading || (hasToken && user === undefined),
    isAuthenticated: hasToken && user !== null && user !== undefined,
  };
}
