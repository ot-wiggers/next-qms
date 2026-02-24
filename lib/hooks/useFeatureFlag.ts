"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Check if a feature flag is enabled.
 * Checks both env var (build-time) and Convex flag (runtime).
 */
export function useFeatureFlag(key: string): boolean {
  // Check build-time env var first
  const envKey = `NEXT_PUBLIC_FF_${key.toUpperCase()}_ENABLED`;
  const envValue = typeof window !== "undefined"
    ? (process.env as Record<string, string | undefined>)[envKey]
    : undefined;

  if (envValue === "false") return false;
  if (envValue === "true") return true;

  // Fall back to Convex runtime flag
  const flag = useQuery(api.featureFlags.get, { key });
  return flag?.enabled ?? false;
}
