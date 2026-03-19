// ============================================================
// HMV API Client — client-side helpers for HMV and conformity search
// ============================================================

import type { PdfAnalysisResult } from "@/lib/pdf/mdr-checklist";

export interface HmvTreeItem {
  id: string;
  parentId: string | null;
  displayValue: string;
  xStellerDisplayValue?: string;
  xSteller: string;
  level: number;
  keywords?: string | null;
  containsInvalidProductsOnly?: boolean;
  herstellerName?: string;
  isProduct?: boolean;
}

export interface HmvProduct {
  id: string;
  zehnSteller: string;
  name: string;
  herstellerName: string;
  produktartBezeichnung?: string;
  produktgruppeNummer?: number;
  anwendungsortNummer?: number;
  untergruppeNummer?: number;
  produktartNummer?: number;
  nummer?: number;
  aufnahmeDatum?: string;
  aenderungsDatum?: string | null;
  istHerausgenommen: boolean;
  basisUDIDI: string | null;
  artikelnummern?: string[];
  typenAusfuehrungen?: string[];
  nutzungsdauer?: string | null;
  wiedereinsatzVerbrauchsmaterialText?: string;
  herstellungsende?: string | null;
  vertriebsende?: string | null;
}

export interface ConformitySearchResult {
  title: string;
  url: string;
  snippet: string;
  fileFormat: string | null;
}

/** Fetch HMV tree items for a given level, optionally filtered by parent */
export async function fetchHmvTree(
  level: number,
  parentId?: string
): Promise<HmvTreeItem[]> {
  const params = new URLSearchParams({ action: "tree", level: String(level) });
  if (parentId) {
    params.set("parentId", parentId);
  }

  const response = await fetch(`/api/hmv?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HMV API Fehler: ${response.status}`);
  }

  return response.json();
}

/** Fetch a single HMV product by ID */
export async function fetchHmvProduct(productId: string): Promise<HmvProduct> {
  const params = new URLSearchParams({ action: "product", productId });

  const response = await fetch(`/api/hmv?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HMV API Fehler: ${response.status}`);
  }

  return response.json();
}

/** Search HMV entries by name or number across all levels */
export async function searchHmv(term: string): Promise<HmvTreeItem[]> {
  const params = new URLSearchParams({ action: "search", term });
  const response = await fetch(`/api/hmv?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HMV API Fehler: ${response.status}`);
  }
  return response.json();
}

/** Fetch full product details by 10-digit HMV number (zehnSteller) */
export async function fetchHmvProductByNumber(zehnSteller: string): Promise<HmvProduct | null> {
  const params = new URLSearchParams({ action: "productByNumber", number: zehnSteller });
  const response = await fetch(`/api/hmv?${params.toString()}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HMV API Fehler: ${response.status}`);
  }
  return response.json();
}

/** Search for conformity declarations on a specific manufacturer website */
export async function searchConformityOnSite(
  manufacturer: string,
  product: string,
  site: string
): Promise<{ results: ConformitySearchResult[]; totalResults: string }> {
  const params = new URLSearchParams({ manufacturer, product, site });
  const response = await fetch(`/api/conformity-search?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Conformity Search Fehler: ${response.status}`);
  }
  return response.json();
}

/** Fetch current Serper.dev account balance */
export async function fetchSerperBalance(): Promise<{ balance: number; rateLimit: number }> {
  const response = await fetch("/api/serper-balance");
  if (!response.ok) {
    throw new Error("Fehler beim Abrufen des Serper-Kontostands");
  }
  return response.json();
}

/** Scrape a manufacturer page for PDF links */
export interface ScrapedPdf {
  url: string;
  text: string;
  context: string;
  score: number;
}

export async function scrapePdfLinks(
  pageUrl: string,
  productName?: string
): Promise<{ pdfs: ScrapedPdf[]; pageTitle: string; totalFound: number }> {
  const params = new URLSearchParams({ url: pageUrl });
  if (productName) params.set("product", productName);

  const response = await fetch(`/api/scrape-pdfs?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Scraper Fehler: ${response.status}`);
  }
  return response.json();
}

/** Analyze a PDF for MDR compliance */
export async function analyzePdf(pdfUrl: string): Promise<PdfAnalysisResult> {
  const params = new URLSearchParams({ url: pdfUrl });
  const response = await fetch(`/api/analyze-pdf?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `PDF Analyse Fehler: ${response.status}`);
  }
  return response.json();
}

/** Search for conformity declarations via Serper.dev (Google Search) */
export async function searchConformityDeclarations(
  manufacturer: string,
  product: string
): Promise<{ results: ConformitySearchResult[]; totalResults: string }> {
  const params = new URLSearchParams({ manufacturer, product });

  const response = await fetch(
    `/api/conformity-search?${params.toString()}`
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || `Conformity Search Fehler: ${response.status}`
    );
  }

  return response.json();
}
