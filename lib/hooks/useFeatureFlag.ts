"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Check if a feature flag is enabled (Convex featureFlags table).
 * Returns false while the query is loading or if the flag doesn't exist.
 */
export function useFeatureFlag(key: string): boolean {
  const flag = useQuery(api.featureFlags.get, { key });
  return flag?.enabled ?? false;
}
