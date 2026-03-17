"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { fetchHmvTree, type HmvTreeItem } from "@/lib/hmv/api-client";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

interface TreeNode {
  id: string;
  parentId: string | null;
  displayValue: string;
  hmvNummer: string;
  level: number;
}

const LEVEL_TO_HMV_LEVEL = {
  1: "produktgruppe",
  2: "anwendungsort",
  3: "untergruppe",
  4: "produktart",
} as const;

export function HmvTreeBrowser() {
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, TreeNode[]>>(new Map());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const organizationId = user?.organizationId as Id<"organizations"> | undefined;

  const markedItems = useQuery(
    api.hmv.listMarkedItems,
    organizationId ? { organizationId } : "skip"
  );

  const searchResults = useQuery(
    api.hmv.searchCache,
    searchTerm.length >= 2 ? { searchTerm } : "skip"
  );

  const markItem = useMutation(api.hmv.markItem);
  const unmarkItem = useMutation(api.hmv.unmarkItem);
  const upsertCache = useMutation(api.hmv.upsertCacheEntries);

  const markedNummern = new Set(
    (markedItems ?? []).map((item: { hmvNummer: string }) => item.hmvNummer)
  );

  // Fetch root level on mount
  useEffect(() => {
    let cancelled = false;
    async function loadRoot() {
      setRootLoading(true);
      try {
        const items = await fetchHmvTree(1);
        if (cancelled) return;

        const nodes: TreeNode[] = items.map((item) => ({
          id: item.id,
          parentId: item.parentId,
          displayValue: item.displayValue,
          hmvNummer: item.xSteller,
          level: item.level,
        }));
        setRootNodes(nodes);

        // Cache in Convex
        await upsertCache({
          entries: items.map((item) => ({
            rehadatId: item.id,
            hmvNummer: item.xSteller,
            displayName: item.displayValue,
            level: item.level,
            parentRehadatId: item.parentId ?? undefined,
          })),
        });
      } catch (err) {
        if (!cancelled) {
          toast.error("Fehler beim Laden des Hilfsmittelverzeichnisses");
        }
      } finally {
        if (!cancelled) setRootLoading(false);
      }
    }
    loadRoot();
    return () => { cancelled = true; };
  }, [upsertCache]);

  const handleToggleExpand = useCallback(
    async (node: TreeNode) => {
      const nodeId = node.id;

      if (expandedNodes.has(nodeId)) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // Already loaded children
      if (loadedChildren.has(nodeId)) {
        setExpandedNodes((prev) => new Set(prev).add(nodeId));
        return;
      }

      // Fetch children
      setLoadingNodes((prev) => new Set(prev).add(nodeId));
      try {
        const nextLevel = node.level + 1;
        const items = await fetchHmvTree(nextLevel, nodeId);

        const children: TreeNode[] = items.map((item) => ({
          id: item.id,
          parentId: item.parentId,
          displayValue: item.displayValue,
          hmvNummer: item.xSteller,
          level: item.level,
        }));

        setLoadedChildren((prev) => new Map(prev).set(nodeId, children));
        setExpandedNodes((prev) => new Set(prev).add(nodeId));

        // Cache in Convex
        if (items.length > 0) {
          await upsertCache({
            entries: items.map((item) => ({
              rehadatId: item.id,
              hmvNummer: item.xSteller,
              displayName: item.displayValue,
              level: item.level,
              parentRehadatId: item.parentId ?? undefined,
            })),
          });
        }
      } catch (err) {
        toast.error("Fehler beim Laden der Unterkategorien");
      } finally {
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }
    },
    [expandedNodes, loadedChildren, upsertCache]
  );

  const handleCheckChange = useCallback(
    async (node: TreeNode, checked: boolean) => {
      if (!organizationId) return;

      const levelKey = LEVEL_TO_HMV_LEVEL[node.level as keyof typeof LEVEL_TO_HMV_LEVEL];
      if (!levelKey) return;

      try {
        if (checked) {
          await markItem({
            hmvNummer: node.hmvNummer,
            hmvLevel: levelKey,
            displayName: node.displayValue,
            rehadatId: node.id,
            organizationId,
          });
          toast.success(`${node.hmvNummer} als Versorgungsbereich markiert`);
        } else {
          await unmarkItem({ hmvNummer: node.hmvNummer });
          toast.success(`Markierung fuer ${node.hmvNummer} entfernt`);
        }
      } catch (err) {
        toast.error(
          checked
            ? "Fehler beim Markieren"
            : "Fehler beim Entfernen der Markierung"
        );
      }
    },
    [organizationId, markItem, unmarkItem]
  );

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const isMarked = markedNummern.has(node.hmvNummer);
    const children = loadedChildren.get(node.id) ?? [];
    const canExpand = node.level < 4;
    const canMark = can("hmv:mark" as any);

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors",
            isMarked && "bg-primary/5"
          )}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {canExpand ? (
            <button
              onClick={() => handleToggleExpand(node)}
              className="shrink-0 p-0.5 rounded hover:bg-muted"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {canMark && (
            <Checkbox
              checked={isMarked}
              onCheckedChange={(checked) =>
                handleCheckChange(node, checked === true)
              }
              className="shrink-0"
            />
          )}

          <button
            onClick={() => canExpand && handleToggleExpand(node)}
            className="flex-1 text-left text-sm truncate"
          >
            <span className="font-mono text-muted-foreground mr-2">
              {node.hmvNummer}
            </span>
            <span>{node.displayValue}</span>
          </button>
        </div>

        {isExpanded &&
          children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  // Determine what to display
  const isSearching = searchTerm.length >= 2;
  const displayNodes = isSearching
    ? (searchResults ?? []).map((item: { rehadatId: string; hmvNummer: string; displayName: string; level: number; parentRehadatId?: string }) => ({
        id: item.rehadatId,
        parentId: item.parentRehadatId ?? null,
        displayValue: item.displayName,
        hmvNummer: item.hmvNummer,
        level: item.level,
      }))
    : rootNodes;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Suche im Hilfsmittelverzeichnis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card p-2">
        {rootLoading && !isSearching ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Hilfsmittelverzeichnis wird geladen...
          </div>
        ) : displayNodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {isSearching
              ? "Keine Ergebnisse gefunden."
              : "Keine Eintraege vorhanden."}
          </div>
        ) : isSearching ? (
          <div className="space-y-0.5">
            {displayNodes.map((node: TreeNode) => (
              <div
                key={node.id}
                className={cn(
                  "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors",
                  markedNummern.has(node.hmvNummer) && "bg-primary/5"
                )}
              >
                {can("hmv:mark" as any) && (
                  <Checkbox
                    checked={markedNummern.has(node.hmvNummer)}
                    onCheckedChange={(checked) =>
                      handleCheckChange(node, checked === true)
                    }
                    className="shrink-0"
                  />
                )}
                <span className="text-sm">
                  <span className="font-mono text-muted-foreground mr-2">
                    {node.hmvNummer}
                  </span>
                  <span>{node.displayValue}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    (Ebene {node.level})
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayNodes.map((node: TreeNode) => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}
