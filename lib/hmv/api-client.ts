// ============================================================
// HMV API Client — client-side helpers for HMV and conformity search
// ============================================================

export interface HmvTreeItem {
  id: string;
  parentId: string | null;
  displayValue: string;
  xStellerDisplayValue: string;
  xSteller: string;
  level: number;
  keywords: string | null;
  containsInvalidProductsOnly: boolean;
}

export interface HmvProduct {
  id: string;
  zehnSteller: string;
  name: string;
  herstellerName: string;
  produktartBezeichnung: string;
  produktgruppeNummer: number;
  anwendungsortNummer: number;
  untergruppeNummer: number;
  produktartNummer: number;
  nummer: number;
  aufnahmeDatum: string;
  aenderungsDatum: string;
  istHerausgenommen: boolean;
  basisUDIDI: string | null;
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

/** Search for conformity declarations via Google Custom Search */
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
