# HMV Integration & MDR Product Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the GKV Hilfsmittelverzeichnis (HMV) via the REHADAT API into the existing MDR product system, extend the product schema with regulatory fields, add conformity declaration web search, import 87 existing products from Excel, and provide quick-add workflows.

**Architecture:** Server-side Next.js API routes proxy the REHADAT API and Google Custom Search API (avoiding CORS). Convex tables cache HMV data and track the organization's supply spectrum (Versorgungsspektrum). The existing `products` and `declarationsOfConformity` tables are extended with new fields. A dedicated Excel import maps the Wiggers legacy data into the new schema.

**Tech Stack:** Next.js 16 API Routes, Convex (DB + functions), REHADAT Hilfsmittelverzeichnis API (`https://hilfsmittel-api.gkv-spitzenverband.de/api/verzeichnis/`), Google Custom Search API, xlsx (already installed), shadcn/ui, Tailwind CSS, Sonner (toasts)

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `app/api/hmv/route.ts` | Next.js API route proxying REHADAT Hilfsmittelverzeichnis API (tree + product endpoints) |
| `app/api/conformity-search/route.ts` | Next.js API route proxying Google Custom Search for conformity declaration PDFs |
| `convex/hmv.ts` | Convex functions for HMV cache (upsert, query) and marked items (mark, unmark, list) |
| `convex/searchQuota.ts` | Convex functions for tracking daily Google Search quota per organization |
| `app/(dashboard)/mdr/hilfsmittelverzeichnis/page.tsx` | HMV tree browser page with marking checkboxes |
| `app/(dashboard)/mdr/versorgungsspektrum/page.tsx` | Supply spectrum overview page |
| `components/domain/products/hmv-tree-browser.tsx` | Hierarchical HMV tree component (expandable levels 1-4) |
| `components/domain/products/hmv-search.tsx` | HMV search/autocomplete component for product forms |
| `components/domain/products/conformity-search-dialog.tsx` | Dialog for searching + selecting conformity declarations online |
| `components/domain/products/legacy-import-dialog.tsx` | Dialog for importing the Wiggers Excel with field mapping preview |
| `lib/hmv/api-client.ts` | Client-side helper to call `/api/hmv` proxy and `/api/conformity-search` |

### Modified Files

| File | Changes |
|------|---------|
| `convex/schema.ts` | Add `hmvCache`, `hmvMarkedItems`, `searchQuota` tables; extend `products` with `hmvNummer`, `ceMarkPresent`, `instructionsPresent`, `regulatoryBasis`; extend `declarationsOfConformity` with `externalUrl`, `urlLastChecked`, `urlStatus` |
| `convex/products.ts` | Add `importLegacyProducts` mutation (Excel-specific with manufacturer auto-creation + DoC creation); extend `create`/`update`/`importProducts` to handle new fields; add `listByHmv` query |
| `convex/declarations.ts` | Make `fileId`/`fileName` optional in `create` mutation args; add `externalUrl` field |
| `lib/types/domain.ts` | Add `hmv:browse`, `hmv:mark` permission actions |
| `lib/types/enums.ts` | Add `REGULATORY_BASES`, `URL_STATUSES` enums; add labels/colors |
| `convex/lib/permissions.ts` | Add `hmv:browse`, `hmv:mark` to qmb role |
| `components/layout/sidebar.tsx` | Add Hilfsmittelverzeichnis and Versorgungsspektrum nav items under "MDR & Produkte" |
| `components/domain/products/product-form.tsx` | Add CE mark, instructions, regulatory basis, HMV number fields |
| `app/(dashboard)/mdr/products/[id]/page.tsx` | Add "Regulatorische Details" card; add conformity search button; display HMV link |
| `app/(dashboard)/mdr/products/page.tsx` | Add legacy import button; integrate legacy-import-dialog |

---

## Chunk 1: Schema & Backend Foundation

### Task 1: Extend Convex Schema

**Files:**
- Modify: `convex/schema.ts:546-582` (products + declarations tables)
- Modify: `convex/schema.ts:583` (insert new tables before Phase 4)

- [ ] **Step 1: Add new enums to schema.ts**

At the top of `convex/schema.ts`, near the existing enum definitions (around line 5), add:

```typescript
const regulatoryBasis = v.union(v.literal("MDR"), v.literal("DIRECTIVE"));
const urlStatus = v.union(v.literal("REACHABLE"), v.literal("UNREACHABLE"), v.literal("UNCHECKED"));
```

- [ ] **Step 2: Extend products table**

In the `products` defineTable (line 546-563), add these fields after `notes`:

```typescript
hmvNummer: v.optional(v.string()),          // 10-digit HMV number e.g. "18.46.02.1003"
ceMarkPresent: v.optional(v.boolean()),      // CE-Zeichen vorhanden
instructionsPresent: v.optional(v.boolean()), // Gebrauchsanweisung vorhanden
regulatoryBasis: v.optional(regulatoryBasis), // MDR or DIRECTIVE (MDD)
migrationRequired: v.optional(v.boolean()),   // true if DIRECTIVE, needs MDR migration
```

Add index after existing indexes:
```typescript
.index("by_hmvNummer", ["hmvNummer"])
```

- [ ] **Step 3: Extend declarationsOfConformity table**

In the `declarationsOfConformity` defineTable (line 565-582), add after `reviewedAt`:

```typescript
externalUrl: v.optional(v.string()),        // URL to manufacturer's PDF
urlLastChecked: v.optional(v.number()),     // timestamp of last URL check
urlStatus: v.optional(urlStatus),           // REACHABLE | UNREACHABLE | UNCHECKED
```

- [ ] **Step 4: Add HMV cache table**

Insert before the Phase 4 comment (line 584):

```typescript
// HMV (Hilfsmittelverzeichnis) - cached from REHADAT API
hmvCache: defineTable({
  rehadatId: v.string(),                    // UUID from REHADAT API
  hmvNummer: v.string(),                    // e.g. "18.46.02.1003"
  displayName: v.string(),                  // e.g. "18.46.02.1003 - Duschrollstuhl"
  level: v.number(),                        // 1=Produktgruppe, 2=Anwendungsort, 3=Untergruppe, 4=Produktart, 5=Produkt
  parentRehadatId: v.optional(v.string()),  // parent UUID
  herstellerName: v.optional(v.string()),   // manufacturer (only for level 5 products)
  lastSynced: v.number(),                   // timestamp
  ...auditFields,
})
  .index("by_rehadatId", ["rehadatId"])
  .index("by_hmvNummer", ["hmvNummer"])
  .index("by_parent", ["parentRehadatId"])
  .index("by_level", ["level"]),

// Marked HMV items = Versorgungsspektrum (supply spectrum)
hmvMarkedItems: defineTable({
  hmvNummer: v.string(),                    // Can be 2-digit (Produktgruppe), 4-digit, 6-digit, or 7-digit
  hmvLevel: v.union(
    v.literal("produktgruppe"),
    v.literal("anwendungsort"),
    v.literal("untergruppe"),
    v.literal("produktart"),
  ),
  displayName: v.string(),                  // Cached display name
  rehadatId: v.string(),                    // UUID for linking back to HMV tree
  organizationId: v.id("organizations"),
  ...auditFields,
})
  .index("by_organization", ["organizationId"])
  .index("by_hmvNummer", ["hmvNummer"]),

// Google Search quota tracking (no auditFields — simple counter, not an auditable entity)
searchQuota: defineTable({
  organizationId: v.id("organizations"),
  date: v.string(),                         // YYYY-MM-DD
  count: v.number(),                        // searches used today
  maxPerDay: v.number(),                    // configurable limit (default 20)
})
  .index("by_org_date", ["organizationId", "date"]),
```

- [ ] **Step 5: Run Convex type check**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: extend schema with HMV cache, marked items, search quota, and regulatory product fields"
```

---

### Task 2: Add Enums and Type Extensions

**Files:**
- Modify: `lib/types/enums.ts:110-123`
- Modify: `lib/types/domain.ts:20-32`

- [ ] **Step 1: Add regulatory enums to enums.ts**

After `DOC_STATUSES` (line 123), add:

```typescript
export const REGULATORY_BASES = ["MDR", "DIRECTIVE"] as const;
export type RegulatoryBasis = (typeof REGULATORY_BASES)[number];

export const URL_STATUSES = ["REACHABLE", "UNREACHABLE", "UNCHECKED"] as const;
export type UrlStatus = (typeof URL_STATUSES)[number];

export const HMV_LEVELS = ["produktgruppe", "anwendungsort", "untergruppe", "produktart"] as const;
export type HmvLevel = (typeof HMV_LEVELS)[number];
```

- [ ] **Step 2: Add labels and colors for new enums**

In the `STATUS_LABELS` object, add:

```typescript
MDR: "MDR (EU 2017/745)",
DIRECTIVE: "Richtlinie (93/42/EWG)",
REACHABLE: "Erreichbar",
UNREACHABLE: "Nicht erreichbar",
UNCHECKED: "Nicht geprüft",
```

In the `STATUS_COLORS` object, add:

```typescript
MDR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
DIRECTIVE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
REACHABLE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
UNREACHABLE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
UNCHECKED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
```

- [ ] **Step 3: Add permissions to domain.ts**

In the `PermissionAction` type union (line 27), after `"declarations:review"`, add:

```typescript
| "hmv:browse" | "hmv:mark"
```

- [ ] **Step 4: Add permissions to RBAC matrix**

In `convex/lib/permissions.ts`, add to `qmb` role (after line 17):

```typescript
"hmv:browse", "hmv:mark",
```

Add `"hmv:browse"` to `department_lead` (after `"declarations:list"`) and `employee` (after `"declarations:list"`) and `auditor` (after `"declarations:list"`).

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/types/enums.ts lib/types/domain.ts convex/lib/permissions.ts
git commit -m "feat: add regulatory basis, URL status, and HMV permission types"
```

---

### Task 3: HMV Convex Functions

> **Dependency:** Task 2 MUST be completed first (Task 2 Step 3 adds `"hmv:browse"` and `"hmv:mark"` to `PermissionAction` type, which Task 3 code references via `requirePermission`). Do NOT parallelize Tasks 2 and 3.

**Files:**
- Create: `convex/hmv.ts`
- Create: `convex/searchQuota.ts`

- [ ] **Step 1: Create convex/hmv.ts**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";

/** Upsert HMV cache entries (called by API route after fetching from REHADAT) */
export const upsertCacheEntries = mutation({
  args: {
    entries: v.array(
      v.object({
        rehadatId: v.string(),
        hmvNummer: v.string(),
        displayName: v.string(),
        level: v.number(),
        parentRehadatId: v.optional(v.string()),
        herstellerName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "hmv:browse");
    const now = Date.now();

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("hmvCache")
        .withIndex("by_rehadatId", (q) => q.eq("rehadatId", entry.rehadatId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...entry,
          lastSynced: now,
          updatedAt: now,
          updatedBy: user._id,
        });
      } else {
        await ctx.db.insert("hmvCache", {
          ...entry,
          lastSynced: now,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          createdBy: user._id,
          updatedBy: user._id,
        });
      }
    }
  },
});

/** Get cached HMV entries by parent (for tree browsing) */
export const getCachedChildren = query({
  args: {
    parentRehadatId: v.optional(v.string()),
    level: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    if (args.parentRehadatId) {
      return await ctx.db
        .query("hmvCache")
        .withIndex("by_parent", (q) => q.eq("parentRehadatId", args.parentRehadatId as string))
        .collect();
    }

    // Top-level (no parent)
    return await ctx.db
      .query("hmvCache")
      .withIndex("by_level", (q) => q.eq("level", 1))
      .collect();
  },
});

/** Search HMV cache by number or name */
export const searchCache = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");
    const term = args.searchTerm.toLowerCase();

    const all = await ctx.db
      .query("hmvCache")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return all
      .filter(
        (e) =>
          e.hmvNummer.includes(term) ||
          e.displayName.toLowerCase().includes(term)
      )
      .slice(0, 50);
  },
});

/** Mark an HMV item as part of Versorgungsspektrum */
export const markItem = mutation({
  args: {
    hmvNummer: v.string(),
    hmvLevel: v.union(
      v.literal("produktgruppe"),
      v.literal("anwendungsort"),
      v.literal("untergruppe"),
      v.literal("produktart"),
    ),
    displayName: v.string(),
    rehadatId: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "hmv:mark");
    const now = Date.now();

    // Check if already marked (scoped to this organization for multi-tenancy)
    const existing = await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("hmvNummer"), args.hmvNummer))
      .first();

    if (existing) return existing._id;

    const id = await ctx.db.insert("hmvMarkedItems", {
      hmvNummer: args.hmvNummer,
      hmvLevel: args.hmvLevel,
      displayName: args.displayName,
      rehadatId: args.rehadatId,
      organizationId: args.organizationId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "hmvMarkedItems",
      entityId: id,
      metadata: { hmvNummer: args.hmvNummer, displayName: args.displayName },
    });

    return id;
  },
});

/** Unmark an HMV item */
export const unmarkItem = mutation({
  args: { hmvNummer: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "hmv:mark");

    const existing = await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_hmvNummer", (q) => q.eq("hmvNummer", args.hmvNummer))
      .first();

    if (!existing) return;

    await ctx.db.delete(existing._id);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "hmvMarkedItems",
      entityId: existing._id,
      metadata: { hmvNummer: args.hmvNummer },
    });
  },
});

/** List all marked items for organization (Versorgungsspektrum) */
export const listMarkedItems = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    return await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
  },
});

/** Check if a specific HMV number is marked */
export const isMarked = query({
  args: { hmvNummer: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "hmv:browse");

    const item = await ctx.db
      .query("hmvMarkedItems")
      .withIndex("by_hmvNummer", (q) => q.eq("hmvNummer", args.hmvNummer))
      .first();

    return !!item;
  },
});
```

- [ ] **Step 2: Create convex/searchQuota.ts**

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";

/** Get today's search quota for an organization */
export const getQuota = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "declarations:list");
    const today = new Date().toISOString().slice(0, 10);

    const quota = await ctx.db
      .query("searchQuota")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", today)
      )
      .first();

    return {
      used: quota?.count ?? 0,
      max: quota?.maxPerDay ?? 20,
      remaining: (quota?.maxPerDay ?? 20) - (quota?.count ?? 0),
    };
  },
});

/** Increment search count for today */
export const incrementQuota = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:list");
    const today = new Date().toISOString().slice(0, 10);

    const existing = await ctx.db
      .query("searchQuota")
      .withIndex("by_org_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("date", today)
      )
      .first();

    if (existing) {
      if (existing.count >= existing.maxPerDay) {
        throw new Error("Tageslimit für Suchen erreicht");
      }
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
    } else {
      await ctx.db.insert("searchQuota", {
        organizationId: args.organizationId,
        date: today,
        count: 1,
        maxPerDay: 20,
      });
    }
  },
});
```

- [ ] **Step 3: Run Convex deployment**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add convex/hmv.ts convex/searchQuota.ts
git commit -m "feat: add Convex functions for HMV cache, marking, and search quota"
```

---

### Task 4: Next.js API Routes (REHADAT Proxy + Conformity Search)

**Files:**
- Create: `app/api/hmv/route.ts`
- Create: `app/api/conformity-search/route.ts`
- Create: `lib/hmv/api-client.ts`

- [ ] **Step 1: Create the HMV proxy API route**

Create `app/api/hmv/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://hilfsmittel-api.gkv-spitzenverband.de/api/verzeichnis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action"); // "tree" or "product"
  const level = searchParams.get("level");    // 1-4 for tree
  const parentId = searchParams.get("parentId"); // UUID for sub-levels
  const productId = searchParams.get("productId"); // UUID for single product

  try {
    let url: string;

    if (action === "tree") {
      // Fetch tree hierarchy
      // Level 1: /VerzeichnisTree/1 (top-level Produktgruppen)
      // Level 2+: /VerzeichnisTree/{level} (get children of a level)
      url = `${BASE_URL}/VerzeichnisTree/${level || "1"}`;
    } else if (action === "product") {
      // Fetch single product
      url = `${BASE_URL}/Produkt/${productId}`;
    } else if (action === "products") {
      // Fetch all products (paginated by REHADAT)
      url = `${BASE_URL}/Produkt`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `REHADAT API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter by parentId on client side if needed (API returns all for a level)
    if (action === "tree" && parentId) {
      const filtered = Array.isArray(data)
        ? data.filter((item: any) => item.parentId === parentId)
        : data;
      return NextResponse.json(filtered);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("HMV API error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Verbindung zur REHADAT API" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Create the conformity search API route**

Create `app/api/conformity-search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CUSTOM_SEARCH_CX;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const manufacturer = searchParams.get("manufacturer");
  const product = searchParams.get("product");

  if (!manufacturer || !product) {
    return NextResponse.json(
      { error: "manufacturer and product are required" },
      { status: 400 }
    );
  }

  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    return NextResponse.json(
      { error: "Google Custom Search is not configured. Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_CX in .env.local" },
      { status: 503 }
    );
  }

  try {
    const query = `"${manufacturer}" "${product}" Konformitätserklärung filetype:pdf`;
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", GOOGLE_API_KEY);
    url.searchParams.set("cx", GOOGLE_CX);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "5");

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Google Search API error:", errorBody);
      return NextResponse.json(
        { error: "Fehler bei der Google-Suche" },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = (data.items ?? []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      fileFormat: item.fileFormat ?? null,
    }));

    return NextResponse.json({ results, totalResults: data.searchInformation?.totalResults ?? "0" });
  } catch (error: any) {
    console.error("Conformity search error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Suche nach Konformitätserklärungen" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 3: Create the client-side API helper**

Create `lib/hmv/api-client.ts`:

```typescript
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

/** Fetch HMV tree hierarchy from local proxy */
export async function fetchHmvTree(level: number, parentId?: string): Promise<HmvTreeItem[]> {
  const params = new URLSearchParams({ action: "tree", level: String(level) });
  if (parentId) params.set("parentId", parentId);

  const res = await fetch(`/api/hmv?${params}`);
  if (!res.ok) throw new Error(`HMV API error: ${res.status}`);
  return res.json();
}

/** Fetch single HMV product */
export async function fetchHmvProduct(productId: string): Promise<HmvProduct> {
  const params = new URLSearchParams({ action: "product", productId });

  const res = await fetch(`/api/hmv?${params}`);
  if (!res.ok) throw new Error(`HMV API error: ${res.status}`);
  return res.json();
}

/** Search for conformity declarations online */
export async function searchConformityDeclarations(
  manufacturer: string,
  product: string
): Promise<{ results: ConformitySearchResult[]; totalResults: string }> {
  const params = new URLSearchParams({ manufacturer, product });

  const res = await fetch(`/api/conformity-search?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Search API error: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/api/hmv/route.ts app/api/conformity-search/route.ts lib/hmv/api-client.ts
git commit -m "feat: add REHADAT HMV proxy and Google conformity search API routes"
```

---

## Chunk 2: Extend Existing Products Backend

### Task 5: Extend Product Mutations

**Files:**
- Modify: `convex/products.ts:100-268` (create, update, importProducts mutations)
- Modify: `convex/declarations.ts` (create mutation)

- [ ] **Step 1: Extend the create mutation args**

In `convex/products.ts`, the `create` mutation (around line 100), add to `args`:

```typescript
hmvNummer: v.optional(v.string()),
ceMarkPresent: v.optional(v.boolean()),
instructionsPresent: v.optional(v.boolean()),
regulatoryBasis: v.optional(v.string()),
```

In the handler's `ctx.db.insert` call, add:

```typescript
hmvNummer: args.hmvNummer,
ceMarkPresent: args.ceMarkPresent ?? false,
instructionsPresent: args.instructionsPresent ?? false,
regulatoryBasis: args.regulatoryBasis as any,
migrationRequired: args.regulatoryBasis === "DIRECTIVE" ? true : undefined,
```

- [ ] **Step 2: Extend the update mutation args**

In the `update` mutation (around line 139), add the same optional args. In the handler's `ctx.db.patch` call, include the new fields only if provided.

- [ ] **Step 3: Extend importProducts mutation**

In the `importProducts` mutation args object (line 211-219), add:

```typescript
hmvNummer: v.optional(v.string()),
ceMarkPresent: v.optional(v.boolean()),
instructionsPresent: v.optional(v.boolean()),
regulatoryBasis: v.optional(v.string()),
```

In the insert call inside the loop, add:

```typescript
hmvNummer: product.hmvNummer,
ceMarkPresent: product.ceMarkPresent ?? false,
instructionsPresent: product.instructionsPresent ?? false,
regulatoryBasis: product.regulatoryBasis as any,
migrationRequired: product.regulatoryBasis === "DIRECTIVE" ? true : undefined,
```

- [ ] **Step 4: Add importLegacyProducts mutation**

After the `importProducts` mutation, add a new mutation specifically for the Wiggers Excel import:

```typescript
/** Import products from Wiggers legacy Excel with manufacturer + DoC auto-creation */
export const importLegacyProducts = mutation({
  args: {
    products: v.array(
      v.object({
        name: v.string(),
        manufacturer: v.string(),
        productGroup: v.optional(v.string()),
        riskClass: v.string(),
        ceMarkPresent: v.boolean(),
        instructionsPresent: v.boolean(),
        docPresent: v.boolean(),
        regulatoryBasis: v.string(),       // "MDR" or "DIRECTIVE"
        externalUrl: v.optional(v.string()),
        issuedAt: v.optional(v.number()),
        validUntil: v.optional(v.number()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "products:create");
    const now = Date.now();
    const validRiskClasses = ["I", "IIa", "IIb", "III"];
    const productIds: string[] = [];

    // Collect unique manufacturers and auto-create
    const manufacturerCache: Record<string, string> = {};
    const existingManufacturers = await ctx.db
      .query("manufacturers")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    for (const m of existingManufacturers) {
      manufacturerCache[m.name.toLowerCase()] = m._id;
    }

    for (let i = 0; i < args.products.length; i++) {
      const product = args.products[i];
      if (!product.name || !product.riskClass) {
        throw new Error(`Pflichtfelder fehlen für Produkt: ${product.name || "unbekannt"}`);
      }
      if (!validRiskClasses.includes(product.riskClass)) {
        throw new Error(`Ungültige Risikoklasse "${product.riskClass}" für ${product.name}`);
      }

      // Find or create manufacturer
      let manufacturerId: string | undefined;
      if (product.manufacturer) {
        const key = product.manufacturer.toLowerCase();
        if (manufacturerCache[key]) {
          manufacturerId = manufacturerCache[key];
        } else {
          const mId = await ctx.db.insert("manufacturers", {
            name: product.manufacturer,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
            createdBy: user._id,
            updatedBy: user._id,
          });
          manufacturerCache[key] = mId;
          manufacturerId = mId;
        }
      }

      // Create product (counter-based article number for guaranteed uniqueness)
      const productId = await ctx.db.insert("products", {
        name: product.name,
        articleNumber: `LEGACY-${String(i + 1).padStart(4, "0")}`,
        productGroup: product.productGroup,
        manufacturerId: manufacturerId as any,
        riskClass: product.riskClass as any,
        status: "ACTIVE",
        ceMarkPresent: product.ceMarkPresent,
        instructionsPresent: product.instructionsPresent,
        regulatoryBasis: product.regulatoryBasis as any,
        migrationRequired: product.regulatoryBasis === "DIRECTIVE" ? true : undefined,
        notes: product.notes,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user._id,
        updatedBy: user._id,
      });
      productIds.push(productId);

      // Create Declaration of Conformity if present
      if (product.docPresent && (product.externalUrl || product.issuedAt)) {
        await ctx.db.insert("declarationsOfConformity", {
          productId: productId as any,
          version: "1.0",
          issuedAt: product.issuedAt ?? now,
          validFrom: product.issuedAt ?? now,
          validUntil: product.validUntil ?? now + 157680000000, // 5 years default
          status: product.validUntil && product.validUntil < now ? "EXPIRED" : "VALID",
          externalUrl: product.externalUrl,
          urlStatus: product.externalUrl ? "UNCHECKED" : undefined,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          createdBy: user._id,
          updatedBy: user._id,
        });
      }
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "CREATE",
      entityType: "products",
      entityId: productIds[0] ?? "legacy-import",
      metadata: { legacyImport: true, count: args.products.length },
    });

    return { imported: productIds.length, ids: productIds };
  },
});
```

- [ ] **Step 5: Add listByHmv query**

After `exportProducts`, add:

```typescript
/** List products linked to a specific HMV number prefix */
export const listByHmv = query({
  args: { hmvPrefix: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "products:list");

    const allProducts = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return allProducts.filter(
      (p) => p.hmvNummer && p.hmvNummer.startsWith(args.hmvPrefix)
    );
  },
});
```

- [ ] **Step 6: Extend declarations create mutation**

In `convex/declarations.ts`, in the `create` mutation args:

1. Make `fileId` and `fileName` optional (they are currently required, but URL-only DoCs won't have a file):
```typescript
fileId: v.optional(v.id("_storage")),   // was: v.id("_storage")
fileName: v.optional(v.string()),        // was: v.string()
```

2. Add:
```typescript
externalUrl: v.optional(v.string()),
```

3. Add validation in the handler (before insert): at least one of `fileId` or `externalUrl` must be provided:
```typescript
if (!args.fileId && !args.externalUrl) {
  throw new Error("Entweder eine Datei oder eine externe URL muss angegeben werden");
}
```

4. In the `ctx.db.insert` call, add:
```typescript
externalUrl: args.externalUrl,
urlStatus: args.externalUrl ? "UNCHECKED" : undefined,
```

- [ ] **Step 7: Run TypeScript check + Convex deploy**

Run: `npx tsc --noEmit && npx convex dev --once --typecheck=disable`
Expected: 0 errors, "Convex functions ready!"

- [ ] **Step 8: Commit**

```bash
git add convex/products.ts convex/declarations.ts
git commit -m "feat: extend product/declaration mutations with regulatory fields, legacy import, and HMV linking"
```

---

## Chunk 3: UI — Product Form & Detail Extensions

### Task 6: Extend Product Form with Regulatory Fields

**Files:**
- Modify: `components/domain/products/product-form.tsx`

- [ ] **Step 1: Add new form state fields**

Extend the form state to include:

```typescript
const [ceMarkPresent, setCeMarkPresent] = useState(false);
const [instructionsPresent, setInstructionsPresent] = useState(false);
const [regulatoryBasis, setRegulatoryBasis] = useState<string>("MDR");
const [hmvNummer, setHmvNummer] = useState("");
```

- [ ] **Step 2: Add form fields to JSX**

After the existing riskClass/manufacturer row, add a new section "Regulatorische Details":

```tsx
<div className="space-y-2">
  <h3 className="text-sm font-medium">Regulatorische Details</h3>
  <div className="grid grid-cols-2 gap-4">
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="ceMarkPresent"
        checked={ceMarkPresent}
        onChange={(e) => setCeMarkPresent(e.target.checked)}
        className="h-4 w-4"
      />
      <Label htmlFor="ceMarkPresent">CE-Zeichen vorhanden</Label>
    </div>
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="instructionsPresent"
        checked={instructionsPresent}
        onChange={(e) => setInstructionsPresent(e.target.checked)}
        className="h-4 w-4"
      />
      <Label htmlFor="instructionsPresent">Gebrauchsanweisung vorhanden</Label>
    </div>
  </div>
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-1">
      <Label htmlFor="regulatoryBasis">Grundlage</Label>
      <Select value={regulatoryBasis} onValueChange={setRegulatoryBasis}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="MDR">MDR (EU 2017/745)</SelectItem>
          <SelectItem value="DIRECTIVE">Richtlinie (93/42/EWG)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1">
      <Label htmlFor="hmvNummer">HMV-Nummer (optional)</Label>
      <Input
        id="hmvNummer"
        value={hmvNummer}
        onChange={(e) => setHmvNummer(e.target.value)}
        placeholder="z.B. 18.46.02.1003"
      />
    </div>
  </div>
  {regulatoryBasis === "DIRECTIVE" && (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
      ⚠ Dieses Produkt basiert auf der alten Richtlinie (MDD). Eine Migration auf die MDR ist erforderlich.
    </div>
  )}
</div>
```

- [ ] **Step 3: Pass new fields to create mutation**

In the `handleSubmit` function, add the new fields to the mutation call:

```typescript
ceMarkPresent,
instructionsPresent,
regulatoryBasis,
hmvNummer: hmvNummer || undefined,
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/domain/products/product-form.tsx
git commit -m "feat: add regulatory fields (CE, instructions, basis, HMV) to product form"
```

---

### Task 7: Extend Product Detail Page

**Files:**
- Modify: `app/(dashboard)/mdr/products/[id]/page.tsx`
- Create: `components/domain/products/conformity-search-dialog.tsx`

- [ ] **Step 1: Add regulatory fields to Product interface**

In the `Product` interface (line 39-50), add:

```typescript
hmvNummer?: string;
ceMarkPresent?: boolean;
instructionsPresent?: boolean;
regulatoryBasis?: string;
migrationRequired?: boolean;
```

- [ ] **Step 2: Add regulatory fields to edit form state**

Extend `editForm` state (line 96-103) and `openEdit` function (line 117-127) with:

```typescript
ceMarkPresent: false,
instructionsPresent: false,
regulatoryBasis: "MDR",
hmvNummer: "",
```

- [ ] **Step 3: Add "Regulatorische Details" card to the detail view**

After the existing product info card, add a new Card:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">Regulatorische Details</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">CE-Zeichen:</span>{" "}
        <span>{product.ceMarkPresent ? "✅ Vorhanden" : "❌ Fehlt"}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Gebrauchsanweisung:</span>{" "}
        <span>{product.instructionsPresent ? "✅ Vorhanden" : "❌ Fehlt"}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Grundlage:</span>{" "}
        <StatusBadge status={product.regulatoryBasis ?? "MDR"} />
      </div>
      {product.hmvNummer && (
        <div>
          <span className="text-muted-foreground">HMV-Nr.:</span>{" "}
          <Link href={`/mdr/hilfsmittelverzeichnis?highlight=${product.hmvNummer}`} className="text-blue-600 hover:underline">
            {product.hmvNummer}
          </Link>
        </div>
      )}
    </div>
    {product.migrationRequired && (
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
        ⚠ Migration erforderlich: Dieses Produkt basiert auf der alten Richtlinie (MDD) und muss auf die MDR (EU 2017/745) migriert werden.
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 4: Create conformity search dialog**

Create `components/domain/products/conformity-search-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { searchConformityDeclarations, type ConformitySearchResult } from "@/lib/hmv/api-client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

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
  open, onOpenChange, productId, productName, manufacturerName, organizationId, onSelected,
}: Props) {
  const [results, setResults] = useState<ConformitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [customManufacturer, setCustomManufacturer] = useState(manufacturerName);
  const [customProduct, setCustomProduct] = useState(productName);

  const quota = useQuery(api.searchQuota.getQuota, {
    organizationId: organizationId as Id<"organizations">,
  });
  const incrementQuota = useMutation(api.searchQuota.incrementQuota);

  const handleSearch = async () => {
    if (!customManufacturer || !customProduct) {
      toast.error("Hersteller und Produkt sind erforderlich");
      return;
    }
    if (quota && quota.remaining <= 0) {
      toast.error("Tageslimit für Suchen erreicht");
      return;
    }

    setLoading(true);
    try {
      await incrementQuota({ organizationId: organizationId as Id<"organizations"> });
      const data = await searchConformityDeclarations(customManufacturer, customProduct);
      setResults(data.results);
      setSearchDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler bei der Suche");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Konformitätserklärung suchen</DialogTitle>
          <DialogDescription>
            Suche im Internet nach Konformitätserklärungen für dieses Produkt.
            {quota && (
              <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                {quota.used}/{quota.max} Suchen heute
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Hersteller</label>
              <Input value={customManufacturer} onChange={(e) => setCustomManufacturer(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Produkt</label>
              <Input value={customProduct} onChange={(e) => setCustomProduct(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSearch} disabled={loading || (quota?.remaining ?? 0) <= 0}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Suchen
          </Button>

          {searchDone && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Ergebnisse gefunden.</p>
          )}

          {results.map((result, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    <ExternalLink className="h-3 w-3" /> {result.url}
                  </a>
                </div>
                <Button size="sm" variant="outline" onClick={() => { onSelected(result.url); onOpenChange(false); }}>
                  Übernehmen
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Integrate conformity search into product detail page**

Add a "Konformitätserklärung suchen" button in the Declarations tab, after the existing upload component. Import and render the `ConformitySearchDialog`. When a URL is selected, use the existing `declarations.create` mutation with the `externalUrl` field.

- [ ] **Step 6: Add edit form fields for regulatory details**

In the edit dialog, add checkboxes for CE mark and instructions, a Select for regulatory basis, and an Input for HMV number. Pass all fields to the `updateProduct` mutation call.

- [ ] **Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/mdr/products/[id]/page.tsx components/domain/products/conformity-search-dialog.tsx
git commit -m "feat: add regulatory details card and conformity search to product detail"
```

---

## Chunk 4: UI — HMV Browser & Versorgungsspektrum

### Task 8: HMV Tree Browser Page

**Files:**
- Create: `components/domain/products/hmv-tree-browser.tsx`
- Create: `app/(dashboard)/mdr/hilfsmittelverzeichnis/page.tsx`

- [ ] **Step 1: Create the HMV tree browser component**

Create `components/domain/products/hmv-tree-browser.tsx`:

This component should:
- Fetch level 1 (Produktgruppen) on mount via `fetchHmvTree(1)`
- Cache results in Convex via `api.hmv.upsertCacheEntries`
- Display as expandable tree with chevron icons
- On expand: fetch next level via `fetchHmvTree(level+1, parentId)`
- Show checkbox next to each item (checked = marked as Versorgungsspektrum)
- On check: call `api.hmv.markItem`; on uncheck: call `api.hmv.unmarkItem`
- Use existing Convex query `api.hmv.listMarkedItems` to show current state
- Show product count badge if products are linked to that HMV number
- Include a search input at top that calls `api.hmv.searchCache`

Key UI structure:
```
[Search Input: "Suche im Hilfsmittelverzeichnis..."]

▶ ☐ 01 - Absauggeräte
▶ ☐ 02 - Adaptionshilfen
▼ ☑ 18 - Kranken-/Behindertenfahrzeuge          [12 Produkte]
  ▶ ☐ 18.24 - Arm
  ▼ ☑ 18.46 - Untere Extremität                  [8 Produkte]
    ▶ ☐ 18.46.01 - Rollstühle mit Greifreifen
    ▼ ☑ 18.46.02 - Rollstühle mit Elektroantrieb  [3 Produkte]
      ☑ 18.46.02.0 - Elektrorollstühle             [3 Produkte]
```

Permissions: Only show checkboxes if `can("hmv:mark")`. Everyone with `hmv:browse` can view the tree.

- [ ] **Step 2: Create the HMV browser page**

Create `app/(dashboard)/mdr/hilfsmittelverzeichnis/page.tsx`:

```tsx
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { HmvTreeBrowser } from "@/components/domain/products/hmv-tree-browser";

export default function HilfsmittelverzeichnisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hilfsmittelverzeichnis"
        description="GKV-Hilfsmittelverzeichnis durchsuchen und Versorgungsbereiche markieren"
      />
      <HmvTreeBrowser />
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/domain/products/hmv-tree-browser.tsx app/(dashboard)/mdr/hilfsmittelverzeichnis/page.tsx
git commit -m "feat: add HMV tree browser page with marking for Versorgungsspektrum"
```

---

### Task 9: Versorgungsspektrum Page

**Files:**
- Create: `app/(dashboard)/mdr/versorgungsspektrum/page.tsx`

- [ ] **Step 1: Create the supply spectrum page**

This page shows:
1. All marked HMV items grouped by level (Produktgruppe → Anwendungsort → ...)
2. For each marked item: count of linked products
3. Expandable sections showing the actual products
4. "Als Produkt übernehmen" (Quick-Add) button that navigates to product creation with HMV data pre-filled

Key UI structure:
```
Versorgungsspektrum                    [X markierte Bereiche]

┌──────────────────────────────────────────────────────┐
│ 18 - Kranken-/Behindertenfahrzeuge      12 Produkte  │
│   18.46 - Untere Extremität              8 Produkte  │
│     18.46.02 - Elektrorollstühle         3 Produkte  │
│       • Sopur Attitude Hybrid (sunrise medical)      │
│       • HUSK-E (Pro Active)                          │
│       • Speedy 4all (Pro Active)                     │
│     [+ Produkt aus HMV übernehmen]                   │
│                                                      │
│ 10 - Gehhilfen                           4 Produkte  │
│   ...                                                │
└──────────────────────────────────────────────────────┘
```

Queries used:
- `api.hmv.listMarkedItems` — all marked items
- `api.products.listByHmv` — products per HMV prefix

The user's `organizationId` comes from `useCurrentUser()` hook (see existing patterns in the codebase).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/mdr/versorgungsspektrum/page.tsx
git commit -m "feat: add Versorgungsspektrum page showing marked HMV items with linked products"
```

---

### Task 10: Navigation Updates

**Files:**
- Modify: `components/layout/sidebar.tsx:68-73`

- [ ] **Step 1: Add new nav items**

In the "MDR & Produkte" section (line 68-73), add two new items after the existing ones:

```typescript
{
  title: "MDR & Produkte",
  items: [
    { label: "Produkte", href: "/mdr/products", icon: Package, permission: "products:list" },
    { label: "Konformitätserklärungen", href: "/mdr/declarations", icon: Shield, permission: "declarations:list" },
    { label: "Hilfsmittelverzeichnis", href: "/mdr/hilfsmittelverzeichnis", icon: BookOpen, permission: "hmv:browse" },
    { label: "Versorgungsspektrum", href: "/mdr/versorgungsspektrum", icon: CheckSquare, permission: "hmv:browse" },
  ],
},
```

Import `BookOpen` and `CheckSquare` from `lucide-react` at the top.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: add Hilfsmittelverzeichnis and Versorgungsspektrum to sidebar navigation"
```

---

## Chunk 5: Legacy Excel Import & Quick-Add

### Task 11: Legacy Excel Import Dialog

**Files:**
- Create: `components/domain/products/legacy-import-dialog.tsx`
- Modify: `app/(dashboard)/mdr/products/page.tsx`

- [ ] **Step 1: Create the legacy import dialog**

Create `components/domain/products/legacy-import-dialog.tsx`:

This dialog handles the import of the Wiggers Excel (`Datenbank Konformitätserklärungen.xlsx`) with these features:

1. File upload (accepts `.xlsx`, `.xls`)
2. Parses using `xlsx` library with this column mapping (0-indexed, header row 1):
   - Col 0 (A): Status → ignored (internal reference number)
   - Col 1 (B): Hersteller/Lieferant → `manufacturer`
   - Col 2 (C): Produktgruppe → `productGroup`
   - Col 3 (D): Produkt → `name`
   - Col 4 (E): ~~Anschaffungsjahr~~ → SKIPPED
   - Col 5 (F): ~~Stilllegungsdatum~~ → SKIPPED
   - Col 6 (G): CE-Zeichen vorhanden → `ceMarkPresent` (string "ja" → true)
   - Col 7 (H): Gebrauchsanweisung vorhanden → `instructionsPresent` (string "ja" → true)
   - Col 8 (I): Konformitätserklärung vorhanden → `docPresent` (string "ja" → true)
   - Col 9 (J): Grundlage → `regulatoryBasis` ("MDR" → "MDR", "Richtlinie" → "DIRECTIVE")
   - Col 10 (K): Ablage → `externalUrl`
   - Col 11 (L): Ausgabedatum → `issuedAt` (parse date → timestamp)
   - Col 12 (M): Gültig bis → `validUntil` (parse date → timestamp)
   - Col 13 (N): Bemerkungen → `notes`

3. Preview table showing parsed data with validation status per row:
   - Green: all required fields present
   - Yellow: missing optional fields
   - Red: missing name (skip row)

4. Shows summary: "X Produkte, Y Hersteller, Z Konformitätserklärungen"

5. "Importieren" button calls `api.products.importLegacyProducts`

6. On success: toast with count, close dialog, refresh page

The dialog should handle the specific Excel structure (header on row 1, data starts row 2, the first column contains numeric status codes that should be ignored).

- [ ] **Step 2: Integrate into products page**

In `app/(dashboard)/mdr/products/page.tsx`, add:
- Import `LegacyImportDialog`
- Add state `const [legacyImportOpen, setLegacyImportOpen] = useState(false);`
- Add button next to existing import: `<Button variant="outline" onClick={() => setLegacyImportOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" /> Wiggers Excel importieren</Button>`
- Render `<LegacyImportDialog open={legacyImportOpen} onOpenChange={setLegacyImportOpen} />`
- Only show button if `can("products:create")`

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/domain/products/legacy-import-dialog.tsx app/(dashboard)/mdr/products/page.tsx
git commit -m "feat: add legacy Wiggers Excel import for MDR products with DoC auto-creation"
```

---

### Task 12: HMV Quick-Add to Product Form

**Files:**
- Create: `components/domain/products/hmv-search.tsx`
- Modify: `components/domain/products/product-form.tsx`

- [ ] **Step 1: Create HMV search/autocomplete component**

Create `components/domain/products/hmv-search.tsx`:

This component provides:
- Input field with search-as-you-type
- Searches both local Convex cache (`api.hmv.searchCache`) and (if no local results) the REHADAT API via `/api/hmv`
- Dropdown showing matching HMV entries with number + name
- On select: fills the HMV number AND auto-fills product name + product group from the HMV data
- Props: `value`, `onChange(hmvNummer, displayName, productGroup)`, `disabled`

Key behavior:
- Debounce search input by 300ms
- Show max 10 results
- Display format: `18.46.02.1003 — Elektrorollstuhl (sunrise medical)`

- [ ] **Step 2: Replace plain HMV Input with HmvSearch component**

In `product-form.tsx`, replace the plain `<Input>` for HMV number with:

```tsx
<HmvSearch
  value={hmvNummer}
  onChange={(nummer, displayName, productGroup) => {
    setHmvNummer(nummer);
    if (displayName && !name) setName(displayName);
    if (productGroup && !formProductGroup) setProductGroup(productGroup);
  }}
/>
```

This enables the "Quick-Add from HMV" workflow: user types an HMV number or product name, selects from autocomplete, and the form auto-fills.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/domain/products/hmv-search.tsx components/domain/products/product-form.tsx
git commit -m "feat: add HMV autocomplete search with auto-fill in product form"
```

---

### Task 13: Final Verification & Cleanup

**Files:** All modified files

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Deploy Convex functions**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 3: Verify new pages load**

Manually verify these routes work in the browser:
- `/mdr/products` — new import button visible
- `/mdr/hilfsmittelverzeichnis` — tree browser loads
- `/mdr/versorgungsspektrum` — page loads (empty state)
- `/mdr/products/new` — new form fields visible (CE, instructions, basis, HMV)

- [ ] **Step 4: Create .env.local template note**

Add a comment to the existing `.env.local` (or `.env.example` if exists) documenting the new optional env vars:

```
# Google Custom Search (optional, for conformity declaration search)
# GOOGLE_CUSTOM_SEARCH_API_KEY=your-api-key
# GOOGLE_CUSTOM_SEARCH_CX=your-search-engine-id
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification and env template for HMV integration"
```
