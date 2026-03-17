"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { searchConformityDeclarations, ConformitySearchResult } from "@/lib/hmv/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  manufacturerName: string;
  organizationId: string;
  onSelected: (url: string) => void;
}

export function ConformitySearchDialog({
  open,
  onOpenChange,
  productId,
  productName,
  manufacturerName,
  organizationId,
  onSelected,
}: Props) {
  const [manufacturer, setManufacturer] = useState(manufacturerName);
  const [product, setProduct] = useState(productName);
  const [results, setResults] = useState<ConformitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const incrementQuota = useMutation(api.searchQuota.incrementQuota);
  const quota = useQuery(api.searchQuota.getQuota, {
    organizationId: organizationId as any,
  });

  const handleSearch = async () => {
    if (!manufacturer.trim() && !product.trim()) {
      toast.error("Bitte Hersteller oder Produktname eingeben");
      return;
    }

    if (quota && quota.remaining <= 0) {
      toast.error("Tageslimit für Suchen erreicht");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      await incrementQuota({ organizationId: organizationId as any });
      const data = await searchConformityDeclarations(manufacturer, product);
      setResults(data.results);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler bei der Suche");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (url: string) => {
    onSelected(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Konformitätserklärung suchen</DialogTitle>
            {quota && (
              <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
                {quota.used}/{quota.max} Suchen heute
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Hersteller</Label>
              <Input
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Herstellername"
              />
            </div>
            <div className="space-y-1">
              <Label>Produkt</Label>
              <Input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Produktname"
              />
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={loading || (quota !== undefined && quota.remaining <= 0)}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Suchen
          </Button>

          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Suche läuft...
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Ergebnisse gefunden
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {result.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {result.snippet}
                      </p>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {result.url.length > 60
                          ? result.url.slice(0, 60) + "..."
                          : result.url}
                      </a>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelect(result.url)}
                    >
                      Übernehmen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
