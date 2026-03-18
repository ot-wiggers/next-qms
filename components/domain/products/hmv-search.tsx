"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { searchHmv } from "@/lib/hmv/api-client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (hmvNummer: string, displayName?: string, productGroup?: string) => void;
  disabled?: boolean;
}

interface CacheEntry {
  rehadatId: string;
  hmvNummer: string;
  displayName: string;
  level: number;
  parentRehadatId?: string;
}

export function HmvSearch({ value, onChange, disabled }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const upsertCache = useMutation(api.hmv.upsertCacheEntries);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounce search term
  useEffect(() => {
    if (inputValue.length < 2) {
      setDebouncedTerm("");
      setHasTriedFetch(false);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
      setHasTriedFetch(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Query Convex cache
  const searchResults = useQuery(
    api.hmv.searchCache,
    debouncedTerm.length >= 2 ? { searchTerm: debouncedTerm } : "skip"
  ) as CacheEntry[] | undefined;

  // If no local results, search the API directly across all levels
  useEffect(() => {
    if (
      debouncedTerm.length < 2 ||
      searchResults === undefined ||
      searchResults.length > 0 ||
      hasTriedFetch ||
      isLoadingApi
    ) {
      return;
    }

    let cancelled = false;
    setIsLoadingApi(true);
    setHasTriedFetch(true);

    searchHmv(debouncedTerm)
      .then(async (items) => {
        if (cancelled || items.length === 0) return;
        // Cache the results in Convex for future searches
        await upsertCache({
          entries: items.map((item) => ({
            rehadatId: item.id,
            hmvNummer: item.xSteller,
            displayName: item.displayValue,
            level: item.level,
            parentRehadatId: item.parentId ?? undefined,
          })),
        });
      })
      .catch(() => {
        // Silently ignore - user can still type manually
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApi(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTerm, searchResults, hasTriedFetch, isLoadingApi, upsertCache]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      setIsOpen(true);
      onChange(val);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (entry: CacheEntry) => {
      setInputValue(entry.hmvNummer);
      setIsOpen(false);

      // Extract display name: part after " - " in displayValue
      const dashIndex = entry.displayName.indexOf(" - ");
      const displayName = dashIndex >= 0
        ? entry.displayName.substring(dashIndex + 3).trim()
        : entry.displayName;

      // Product group = first 2 digits of HMV number
      const productGroup = entry.hmvNummer.substring(0, 2);

      onChange(entry.hmvNummer, displayName, productGroup);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    []
  );

  const displayResults = (searchResults ?? []).slice(0, 10);
  const showDropdown = isOpen && debouncedTerm.length >= 2 && (displayResults.length > 0 || isLoadingApi);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => debouncedTerm.length >= 2 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="z.B. 18.46.02.1003"
        disabled={disabled}
      />

      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-[240px] overflow-auto">
          {isLoadingApi && displayResults.length === 0 ? (
            <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Lade HMV-Daten...
            </div>
          ) : (
            displayResults.map((entry) => (
              <button
                key={entry.rehadatId}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  "border-b last:border-b-0"
                )}
                onClick={() => handleSelect(entry)}
              >
                <span className="font-mono text-muted-foreground mr-2">
                  {entry.hmvNummer}
                </span>
                <span>&mdash;</span>
                <span className="ml-2">{entry.displayName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
