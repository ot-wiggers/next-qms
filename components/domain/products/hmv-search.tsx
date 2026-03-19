"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { searchHmv, fetchHmvProductByNumber } from "@/lib/hmv/api-client";
import type { HmvProduct } from "@/lib/hmv/api-client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HmvSelectionData {
  hmvNummer: string;
  displayName?: string;
  productGroup?: string;
  /** Full product details if a level 5 product was selected */
  product?: HmvProduct | null;
}

interface Props {
  value: string;
  onChange: (data: HmvSelectionData) => void;
  disabled?: boolean;
}

interface DisplayEntry {
  id: string;
  hmvNummer: string;
  displayName: string;
  level: number;
  herstellerName?: string;
  isProduct?: boolean;
}

export function HmvSearch({ value, onChange, disabled }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [apiResults, setApiResults] = useState<DisplayEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  const upsertCache = useMutation(api.hmv.upsertCacheEntries);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounce search term
  useEffect(() => {
    if (inputValue.length < 2) {
      setDebouncedTerm("");
      setApiResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Query Convex cache
  const cacheResults = useQuery(
    api.hmv.searchCache,
    debouncedTerm.length >= 2 ? { searchTerm: debouncedTerm } : "skip"
  );

  // Always search the API when debounced term changes — show results directly
  useEffect(() => {
    if (debouncedTerm.length < 2) {
      setApiResults([]);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    setIsLoadingApi(true);

    searchHmv(debouncedTerm)
      .then(async (items) => {
        if (currentFetchId !== fetchIdRef.current) return;

        const mapped: DisplayEntry[] = items.map((item) => ({
          id: item.id,
          hmvNummer: item.xSteller,
          displayName: item.displayValue,
          level: item.level,
          herstellerName: item.herstellerName,
          isProduct: item.isProduct ?? item.level === 5,
        }));
        setApiResults(mapped);

        // Fire-and-forget: cache tree items (levels 1-4) in Convex for future use
        const treeItems = items.filter((item) => item.level <= 4);
        if (treeItems.length > 0) {
          upsertCache({
            entries: treeItems.map((item) => ({
              rehadatId: item.id,
              hmvNummer: item.xSteller,
              displayName: item.displayValue,
              level: item.level,
              parentRehadatId: item.parentId ?? undefined,
            })),
          }).catch(() => {
            // Silently ignore cache errors
          });
        }
      })
      .catch(() => {
        if (currentFetchId !== fetchIdRef.current) return;
        setApiResults([]);
      })
      .finally(() => {
        if (currentFetchId !== fetchIdRef.current) return;
        setIsLoadingApi(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

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
      onChange({ hmvNummer: val });
    },
    [onChange]
  );

  const handleSelect = useCallback(
    async (entry: DisplayEntry) => {
      setInputValue(entry.hmvNummer);
      setIsOpen(false);

      // Extract display name
      const dashIndex = entry.displayName.indexOf(" - ");
      const displayName = dashIndex >= 0
        ? entry.displayName.substring(dashIndex + 3).trim()
        : entry.displayName;

      // Product group = first 2 digits of HMV number
      const productGroup = entry.hmvNummer.substring(0, 2);

      // For level 5 products: fetch full details (artikelnummern, UDI, etc.)
      if (entry.isProduct && entry.level === 5) {
        setIsLoadingProduct(true);
        try {
          const product = await fetchHmvProductByNumber(entry.hmvNummer);
          onChange({
            hmvNummer: entry.hmvNummer,
            displayName,
            productGroup,
            product,
          });
        } catch {
          // Even if detail fetch fails, still pass the basic data
          onChange({ hmvNummer: entry.hmvNummer, displayName, productGroup });
        } finally {
          setIsLoadingProduct(false);
        }
      } else {
        onChange({ hmvNummer: entry.hmvNummer, displayName, productGroup });
      }
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

  // Merge cache results and API results, deduplicate by hmvNummer
  const mergedResults = (() => {
    const seen = new Set<string>();
    const merged: DisplayEntry[] = [];

    // API results first (they include products/level 5)
    for (const entry of apiResults) {
      if (!seen.has(entry.hmvNummer)) {
        seen.add(entry.hmvNummer);
        merged.push(entry);
      }
    }

    // Then cache results
    if (cacheResults) {
      for (const entry of cacheResults) {
        if (!seen.has(entry.hmvNummer)) {
          seen.add(entry.hmvNummer);
          merged.push({
            id: entry.rehadatId,
            hmvNummer: entry.hmvNummer,
            displayName: entry.displayName,
            level: entry.level,
          });
        }
      }
    }

    return merged.slice(0, 15);
  })();

  const showDropdown = isOpen && debouncedTerm.length >= 2 && (mergedResults.length > 0 || isLoadingApi);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => debouncedTerm.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="z.B. 18.46.02.1003 oder Produktname"
          disabled={disabled || isLoadingProduct}
        />
        {isLoadingProduct && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-[300px] overflow-auto">
          {isLoadingApi && mergedResults.length === 0 ? (
            <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Suche im Hilfsmittelverzeichnis...
            </div>
          ) : (
            mergedResults.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  "border-b last:border-b-0"
                )}
                onClick={() => handleSelect(entry)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground shrink-0">
                    {entry.hmvNummer}
                  </span>
                  <span className="text-muted-foreground">&mdash;</span>
                  <span className="truncate">
                    {entry.isProduct
                      ? (() => {
                          const dashIdx = entry.displayName.indexOf(" - ");
                          return dashIdx >= 0
                            ? entry.displayName.substring(dashIdx + 3)
                            : entry.displayName;
                        })()
                      : entry.displayName}
                  </span>
                </div>
                {entry.isProduct && entry.herstellerName && (
                  <div className="text-xs text-muted-foreground mt-0.5 pl-[1px]">
                    Hersteller: {entry.herstellerName}
                  </div>
                )}
              </button>
            ))
          )}
          {isLoadingApi && mergedResults.length > 0 && (
            <div className="flex items-center justify-center py-2 text-xs text-muted-foreground border-t">
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              Weitere Ergebnisse laden...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
