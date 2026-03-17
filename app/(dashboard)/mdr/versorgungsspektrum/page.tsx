"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Id } from "../../../../convex/_generated/dataModel";

interface MarkedItem {
  _id: string;
  hmvNummer: string;
  hmvLevel: string;
  displayName: string;
}

interface ProductGroup {
  prefix: string;
  displayName: string;
  items: MarkedItem[];
}

function groupByProduktgruppe(items: MarkedItem[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();

  for (const item of items) {
    const prefix = item.hmvNummer.substring(0, 2);
    if (!groups.has(prefix)) {
      // Find the produktgruppe-level item for the display name, or use prefix
      const pgItem = items.find(
        (i) => i.hmvLevel === "produktgruppe" && i.hmvNummer === prefix
      );
      groups.set(prefix, {
        prefix,
        displayName: pgItem?.displayName ?? prefix,
        items: [],
      });
    }
    groups.get(prefix)!.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.prefix.localeCompare(b.prefix)
  );
}

function MarkedItemRow({ item }: { item: MarkedItem }) {
  const [expanded, setExpanded] = useState(false);

  const products = useQuery(
    api.products.listByHmv,
    expanded ? { hmvPrefix: item.hmvNummer } : "skip"
  );

  const productCount = products?.length;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 w-full py-2 px-3 rounded-md hover:bg-muted/50 transition-colors text-left",
          expanded && "bg-muted/30"
        )}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-mono text-sm text-muted-foreground">
          {item.hmvNummer}
        </span>
        <span className="text-sm flex-1 truncate">{item.displayName}</span>
        {productCount !== undefined && (
          <Badge variant="secondary" className="ml-auto shrink-0">
            {productCount} {productCount === 1 ? "Produkt" : "Produkte"}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="ml-10 border-l pl-4 py-1 space-y-1">
          {products === undefined ? (
            <p className="text-sm text-muted-foreground py-1">Laden...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">
              Keine Produkte zugeordnet.
            </p>
          ) : (
            products.map((product: { _id: string; name: string; articleNumber?: string }) => (
              <Link
                key={product._id}
                href={`/mdr/products/${product._id}`}
                className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 text-sm transition-colors"
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{product.name}</span>
                {product.articleNumber && (
                  <code className="text-xs text-muted-foreground ml-auto">
                    {product.articleNumber}
                  </code>
                )}
              </Link>
            ))
          )}
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link href={`/mdr/products/new?hmv=${item.hmvNummer}`}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Neues Produkt
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VersorgungsspektrumPage() {
  const { user } = useCurrentUser();
  const organizationId = user?.organizationId as Id<"organizations"> | undefined;

  const markedItems = useQuery(
    api.hmv.listMarkedItems,
    organizationId ? { organizationId } : "skip"
  ) as MarkedItem[] | undefined;

  const groups = markedItems ? groupByProduktgruppe(markedItems) : [];
  const totalMarked = markedItems?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Versorgungsspektrum"
        description="Markierte HMV-Bereiche und zugeordnete Produkte"
        actions={
          totalMarked > 0 ? (
            <Badge variant="outline" className="text-sm">
              {totalMarked} markierte {totalMarked === 1 ? "Bereich" : "Bereiche"}
            </Badge>
          ) : undefined
        }
      />

      {markedItems === undefined ? (
        <div className="text-center py-12 text-muted-foreground">
          Laden...
        </div>
      ) : totalMarked === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Noch keine Versorgungsbereiche markiert.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Markieren Sie Bereiche im{" "}
              <Link
                href="/mdr/hilfsmittelverzeichnis"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Hilfsmittelverzeichnis
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.prefix}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">
                    {group.prefix}
                  </span>
                  <span>{group.displayName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {group.items
                  .sort((a, b) => a.hmvNummer.localeCompare(b.hmvNummer))
                  .map((item) => (
                    <MarkedItemRow key={item._id} item={item} />
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
