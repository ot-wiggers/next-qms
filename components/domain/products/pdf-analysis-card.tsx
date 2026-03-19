"use client";

import { useState } from "react";
import { analyzePdf } from "@/lib/hmv/api-client";
import type { PdfAnalysisResult, MdrCheckItem } from "@/lib/pdf/mdr-checklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileSearch,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pdfUrl: string;
}

export function PdfAnalysisCard({ pdfUrl }: Props) {
  const [analysis, setAnalysis] = useState<PdfAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzePdf(pdfUrl);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message ?? "Fehler bei der PDF-Analyse");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading && !error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Button variant="outline" onClick={handleAnalyze}>
            <FileSearch className="mr-2 h-4 w-4" />
            PDF analysieren (MDR-Prüfung)
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          PDF wird analysiert...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
          <Button variant="outline" size="sm" onClick={handleAnalyze}>
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const scoreColor =
    analysis.complianceScore >= 80
      ? "text-green-700 bg-green-100"
      : analysis.complianceScore >= 50
        ? "text-amber-700 bg-amber-100"
        : "text-red-700 bg-red-100";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            MDR-Prüfung
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {analysis.pageCount} Seiten · {Math.round(analysis.textLength / 1000)}k Zeichen
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", scoreColor)}>
              {analysis.complianceScore}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Extracted fields */}
        {Object.entries(analysis.extracted).some(([, v]) => v) && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Extrahierte Daten</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {analysis.extracted.manufacturer && (
                <div>
                  <span className="text-xs text-muted-foreground">Hersteller:</span>
                  <p className="text-sm">{analysis.extracted.manufacturer}</p>
                </div>
              )}
              {analysis.extracted.productName && (
                <div>
                  <span className="text-xs text-muted-foreground">Produkt:</span>
                  <p className="text-sm">{analysis.extracted.productName}</p>
                </div>
              )}
              {analysis.extracted.udi && (
                <div>
                  <span className="text-xs text-muted-foreground">UDI:</span>
                  <p className="text-sm font-mono">{analysis.extracted.udi}</p>
                </div>
              )}
              {analysis.extracted.regulatoryBasis && (
                <div>
                  <span className="text-xs text-muted-foreground">Grundlage:</span>
                  <p className="text-sm">{analysis.extracted.regulatoryBasis}</p>
                </div>
              )}
              {analysis.extracted.notifiedBody && (
                <div>
                  <span className="text-xs text-muted-foreground">Benannte Stelle:</span>
                  <p className="text-sm">{analysis.extracted.notifiedBody}</p>
                </div>
              )}
              {analysis.extracted.certificateNumber && (
                <div>
                  <span className="text-xs text-muted-foreground">Zertifikatsnr.:</span>
                  <p className="text-sm font-mono">{analysis.extracted.certificateNumber}</p>
                </div>
              )}
              {analysis.extracted.issueDate && (
                <div>
                  <span className="text-xs text-muted-foreground">Datum:</span>
                  <p className="text-sm">{analysis.extracted.issueDate}</p>
                </div>
              )}
              {analysis.extracted.signatory && (
                <div>
                  <span className="text-xs text-muted-foreground">Unterzeichner:</span>
                  <p className="text-sm">{analysis.extracted.signatory}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MDR Checklist */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            MDR Anhang IV Prüfpunkte
          </p>
          {analysis.checklist.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </div>

        {/* Re-analyze button */}
        <Button variant="outline" size="sm" onClick={handleAnalyze}>
          Erneut analysieren
        </Button>
      </CardContent>
    </Card>
  );
}

function ChecklistRow({ item }: { item: MdrCheckItem }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2",
        item.passed ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
      )}
    >
      {item.passed ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
        {item.extractedValue && (
          <p className="text-xs mt-0.5 text-foreground/80">
            → {item.extractedValue}
          </p>
        )}
      </div>
    </div>
  );
}
