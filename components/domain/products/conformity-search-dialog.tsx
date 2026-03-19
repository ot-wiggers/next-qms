"use client";

import { searchConformityDeclarations, searchConformityOnSite, ConformitySearchResult, fetchSerperBalance, scrapePdfLinks, ScrapedPdf } from "@/lib/hmv/api-client";
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
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  manufacturerName: string;
  manufacturerWebsite?: string;
  onSelected: (url: string) => void;
}

export function ConformitySearchDialog({
  open,
  onOpenChange,
  productId,
  productName,
  manufacturerName,
  manufacturerWebsite,
  onSelected,
}: Props) {
  const [manufacturer, setManufacturer] = useState(manufacturerName);
  const [product, setProduct] = useState(productName);
  const [scrapeResults, setScrapeResults] = useState<ScrapedPdf[]>([]);
  const [siteResults, setSiteResults] = useState<ConformitySearchResult[]>([]);
  const [webResults, setWebResults] = useState<ConformitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  // Sync state when dialog opens or props change
  useEffect(() => {
    if (open) {
      setManufacturer(manufacturerName);
      setProduct(productName);
      setScrapeResults([]);
      setSiteResults([]);
      setWebResults([]);
      setHasSearched(false);
      fetchSerperBalance()
        .then((data) => setBalance(data.balance))
        .catch(() => setBalance(null));
    }
  }, [open, manufacturerName, productName]);

  const handleSearch = async () => {
    if (!manufacturer.trim() && !product.trim()) {
      toast.error("Bitte Hersteller oder Produktname eingeben");
      return;
    }

    if (balance !== null && balance <= 0) {
      toast.error("Serper-Guthaben aufgebraucht");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setScrapeResults([]);
    setSiteResults([]);
    setWebResults([]);

    try {
      // Phase 0: Scrape manufacturer website for PDF links (free, no credits)
      if (manufacturerWebsite) {
        try {
          const scrapeData = await scrapePdfLinks(manufacturerWebsite, product);
          setScrapeResults(scrapeData.pdfs);
        } catch {
          // Scraping failed, continue with search
        }
      }

      // Phase 1: Search manufacturer website first (if available)
      if (manufacturerWebsite) {
        try {
          const siteData = await searchConformityOnSite(manufacturer, product, manufacturerWebsite);
          setSiteResults(siteData.results);
        } catch {
          // Site search failed, continue with web search
        }
      }

      // Phase 2: Search the entire web
      const webData = await searchConformityDeclarations(manufacturer, product);
      setWebResults(webData.results);

      // Refresh balance after search
      fetchSerperBalance()
        .then((data) => setBalance(data.balance))
        .catch(() => {});
    } catch (err: any) {
      toast.error(err.message ?? "Fehler bei der Suche");
      setWebResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (url: string) => {
    onSelected(url);
    onOpenChange(false);
  };

  const renderResultCard = (result: ConformitySearchResult, idx: number) => {
    const isPdf = result.fileFormat === "PDF";
    return (
      <div
        key={idx}
        className={`rounded-lg border p-4 space-y-2 ${isPdf ? "border-green-200 bg-green-50/50" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isPdf && (
                <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 uppercase">
                  PDF
                </span>
              )}
              <p className="text-sm font-medium leading-snug">
                {result.title}
              </p>
            </div>
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
              {result.url.length > 70
                ? result.url.slice(0, 70) + "..."
                : result.url}
            </a>
          </div>
          <Button
            variant={isPdf ? "default" : "outline"}
            size="sm"
            onClick={() => handleSelect(result.url)}
          >
            Übernehmen
          </Button>
        </div>
      </div>
    );
  };

  const allResults = scrapeResults.length + siteResults.length + webResults.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Konformitätserklärung suchen</DialogTitle>
            {balance !== null && (
              <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
                {balance} Credits verbleibend
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
            disabled={loading || (balance !== null && balance <= 0)}
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

          {!loading && hasSearched && allResults === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Ergebnisse gefunden
            </div>
          )}

          {!loading && scrapeResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                PDFs auf Herstellerwebsite gefunden
              </h4>
              {scrapeResults.map((pdf, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-green-200 bg-green-50/50 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 uppercase">
                          PDF
                        </span>
                        <p className="text-sm font-medium leading-snug">{pdf.text}</p>
                      </div>
                      {pdf.context && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {pdf.context}
                        </p>
                      )}
                      <a
                        href={pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {pdf.url.length > 70 ? pdf.url.slice(0, 70) + "..." : pdf.url}
                      </a>
                    </div>
                    <Button size="sm" onClick={() => handleSelect(pdf.url)}>
                      Übernehmen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && siteResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Ergebnisse von Herstellerwebsite
              </h4>
              {siteResults.map((result, idx) => renderResultCard(result, idx))}
            </div>
          )}

          {!loading && webResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {siteResults.length > 0 ? "Weitere Ergebnisse aus dem Web" : "Ergebnisse"}
              </h4>
              {webResults.map((result, idx) => renderResultCard(result, idx))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
