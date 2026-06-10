# DoC Workflow, Website Scraper, PDF Analysis & Serper Balance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Konformitätserklärung (DoC) system with website scraping for PDF discovery, expanded status workflow with edit/delete, server-side PDF text analysis with MDR checklist, and live Serper.dev balance tracking.

**Architecture:** Four independent features that enhance the existing DoC pipeline. Feature 1 adds a Cheerio-based scraper API route that crawls manufacturer product pages for PDF links. Feature 2 extends the docStatus state machine with REJECTED/WITHDRAWN/SUPERSEDED states, adds edit/delete mutations, and requires comments on status changes. Feature 3 uses `pdf-parse` for server-side text extraction from uploaded/external PDFs and checks against an MDR compliance checklist. Feature 4 replaces the per-org daily quota system with a live Serper.dev `/account` balance query.

**Tech Stack:** Next.js 16 App Router, Convex (DB/auth/mutations), Cheerio (HTML parsing), pdf-parse (PDF text extraction), Serper.dev API, shadcn/ui, Tailwind CSS v4, TypeScript

---

## Chunk 1: Feature 4 — Serper Balance Counter

*Smallest feature first — replaces the existing quota system with live Serper balance.*

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/serper-balance/route.ts` | API route that queries Serper `/account` endpoint |
| Modify | `components/domain/products/conformity-search-dialog.tsx` | Replace quota display with live balance |
| Modify | `convex/searchQuota.ts` | Remove `incrementQuota` / simplify `getQuota` (keep for backward compat) |
| Modify | `lib/hmv/api-client.ts` | Add `fetchSerperBalance()` client function |

### Task 1: Serper Balance API Route

**Files:**
- Create: `app/api/serper-balance/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// app/api/serper-balance/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SERPER_API_KEY nicht konfiguriert" },
        { status: 503 }
      );
    }

    const response = await fetch("https://google.serper.dev/account", {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      // Cache for 60 seconds to avoid hammering the API
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Serper API Fehler: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      balance: data.balance ?? 0,
      rateLimit: data.rateLimit ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Serper-Kontostands" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add client function**

Add to `lib/hmv/api-client.ts`:

```typescript
/** Fetch current Serper.dev account balance */
export async function fetchSerperBalance(): Promise<{ balance: number; rateLimit: number }> {
  const response = await fetch("/api/serper-balance");
  if (!response.ok) {
    throw new Error("Fehler beim Abrufen des Serper-Kontostands");
  }
  return response.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/serper-balance/route.ts lib/hmv/api-client.ts
git commit -m "feat: add Serper balance API route and client function"
```

### Task 2: Update Conformity Search Dialog

**Files:**
- Modify: `components/domain/products/conformity-search-dialog.tsx`

- [ ] **Step 1: Replace quota with live balance**

Replace the quota-related code in `conformity-search-dialog.tsx`:

1. Remove `incrementQuota` mutation and `quota` query imports/usage (lines 58-61)
2. Add state for balance: `const [balance, setBalance] = useState<number | null>(null);`
3. Fetch balance on dialog open:

```typescript
useEffect(() => {
  if (open) {
    fetchSerperBalance()
      .then((data) => setBalance(data.balance))
      .catch(() => setBalance(null));
  }
}, [open]);
```

4. Replace quota display (line 162-166):

```tsx
{balance !== null && (
  <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
    {balance} Credits verbleibend
  </span>
)}
```

5. Replace quota check in `handleSearch` (line 69-72):

```typescript
if (balance !== null && balance <= 0) {
  toast.error("Serper-Credits aufgebraucht");
  return;
}
```

6. After search completes, refresh balance:

```typescript
// At end of handleSearch try block, before finally:
fetchSerperBalance()
  .then((data) => setBalance(data.balance))
  .catch(() => {});
```

7. Remove `organizationId` from Props interface (no longer needed for quota).

- [ ] **Step 2: Update product detail page prop passing**

In `app/(dashboard)/mdr/products/[id]/page.tsx` line 632: remove `organizationId={user.organizationId}` prop from `<ConformitySearchDialog>`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/domain/products/conformity-search-dialog.tsx app/(dashboard)/mdr/products/[id]/page.tsx
git commit -m "feat: replace daily quota with live Serper balance counter"
```

### Task 3: Clean Up Old Quota System

**Files:**
- Modify: `convex/searchQuota.ts`

- [ ] **Step 1: Deprecate quota functions**

Add deprecation comments to `convex/searchQuota.ts`. Keep the functions for now (they don't hurt), but remove `incrementQuota` calls from the search dialog (already done in Task 2). The `searchQuota` table can remain — removing tables requires a migration.

- [ ] **Step 2: Commit**

```bash
git add convex/searchQuota.ts
git commit -m "chore: deprecate daily search quota (replaced by Serper balance)"
```

---

## Chunk 2: Feature 1 — Website Scraper

*Cheerio-based scraper that crawls a manufacturer's product page for PDF links.*

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/scrape-pdfs/route.ts` | API route: fetch page HTML, extract PDF links with Cheerio |
| Modify | `lib/hmv/api-client.ts` | Add `scrapePdfLinks()` client function |
| Modify | `components/domain/products/conformity-search-dialog.tsx` | Add "Website durchsuchen" phase before Serper search |

### Task 4: Install Cheerio

**Files:** None (package.json)

- [ ] **Step 1: Install cheerio**

Run: `npm install cheerio`
Expected: cheerio added to dependencies

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cheerio for HTML parsing"
```

### Task 5: Create Scraper API Route

**Files:**
- Create: `app/api/scrape-pdfs/route.ts`

- [ ] **Step 1: Write the scraper route**

```typescript
// app/api/scrape-pdfs/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface PdfLink {
  url: string;
  text: string;
  context: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get("url");
    const productName = searchParams.get("product") ?? "";

    if (!pageUrl) {
      return NextResponse.json(
        { error: "Parameter 'url' ist erforderlich" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(pageUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    // Fetch the page
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QMS-Bot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Seite nicht erreichbar: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Seite liefert kein HTML" },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract all links to PDF files
    const pdfLinks: PdfLink[] = [];
    const seenUrls = new Set<string>();
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      // Resolve relative URLs
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, pageUrl).toString();
      } catch {
        return;
      }

      // Check if it's a PDF
      const isLikelyPdf =
        absoluteUrl.toLowerCase().endsWith(".pdf") ||
        absoluteUrl.toLowerCase().includes(".pdf?") ||
        absoluteUrl.toLowerCase().includes("/pdf/");

      if (!isLikelyPdf) return;
      if (seenUrls.has(absoluteUrl)) return;
      seenUrls.add(absoluteUrl);

      // Get link text and surrounding context
      const linkText = $(el).text().trim();
      const parentText = $(el).parent().text().trim().slice(0, 200);

      pdfLinks.push({
        url: absoluteUrl,
        text: linkText || absoluteUrl.split("/").pop() || "PDF",
        context: parentText,
      });
    });

    // Also check for iframe/embed/object sources pointing to PDFs
    $("iframe[src], embed[src], object[data]").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data");
      if (!src) return;

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(src, pageUrl).toString();
      } catch {
        return;
      }

      if (
        absoluteUrl.toLowerCase().endsWith(".pdf") ||
        absoluteUrl.toLowerCase().includes(".pdf?")
      ) {
        if (!seenUrls.has(absoluteUrl)) {
          seenUrls.add(absoluteUrl);
          pdfLinks.push({
            url: absoluteUrl,
            text: "Eingebettetes PDF",
            context: "",
          });
        }
      }
    });

    // Score and sort: prioritize DoC/conformity-related PDFs
    const docKeywords = [
      "conformity", "konformität", "doc", "declaration", "erklärung",
      "ce", "mdr", "certificate", "zertifikat",
    ];
    const productLower = productName.toLowerCase();

    const scored = pdfLinks.map((link) => {
      let score = 0;
      const combined = `${link.text} ${link.context} ${link.url}`.toLowerCase();

      for (const kw of docKeywords) {
        if (combined.includes(kw)) score += 2;
      }
      if (productLower && combined.includes(productLower)) score += 3;

      return { ...link, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      pdfs: scored.slice(0, 20),
      pageTitle: $("title").text().trim(),
      totalFound: scored.length,
    });
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return NextResponse.json(
        { error: "Zeitüberschreitung beim Laden der Seite" },
        { status: 504 }
      );
    }
    console.error("Scrape Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Durchsuchen der Website" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add client function to api-client.ts**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add app/api/scrape-pdfs/route.ts lib/hmv/api-client.ts
git commit -m "feat: add Cheerio-based website scraper for PDF discovery"
```

### Task 6: Integrate Scraper into Conformity Search Dialog

**Files:**
- Modify: `components/domain/products/conformity-search-dialog.tsx`

- [ ] **Step 1: Add scraper phase to search flow**

The search flow becomes 3 phases:
1. **Phase 0 (NEW):** Scrape manufacturer product page for PDFs (free, no Serper credits)
2. **Phase 1:** Serper site-scoped search (1 credit)
3. **Phase 2:** Serper broad web search (1 credit)

Add new state:

```typescript
const [scrapeResults, setScrapeResults] = useState<ScrapedPdf[]>([]);
```

In `handleSearch`, add Phase 0 before the existing phases:

```typescript
// Phase 0: Scrape manufacturer website for PDF links (free, no credits)
if (manufacturerWebsite) {
  try {
    const scrapeData = await scrapePdfLinks(manufacturerWebsite, product);
    setScrapeResults(scrapeData.pdfs);
  } catch {
    // Scraping failed, continue with search
  }
}
```

Add a new results section in the UI (before "Ergebnisse von Herstellerwebsite"):

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/domain/products/conformity-search-dialog.tsx
git commit -m "feat: integrate website scraper as Phase 0 in conformity search"
```

---

## Chunk 3: Feature 2 — DoC Workflow Expansion

*Extend docStatus state machine, add edit/delete mutations, require comments on status changes.*

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `convex/lib/stateMachine.ts` | Add REJECTED, WITHDRAWN, SUPERSEDED states |
| Modify | `convex/schema.ts` | Add `reviewComment` field to declarationsOfConformity |
| Modify | `convex/declarations.ts` | Add `update`, `archive`, `permanentDelete` mutations; extend `review` with comment |
| Modify | `lib/types/enums.ts` | Add new status labels and badge colors |
| Modify | `lib/types/domain.ts` | Add `declarations:delete` permission |
| Modify | `convex/lib/permissions.ts` | Grant `declarations:delete` to admin |
| Create | `components/domain/products/declaration-edit-dialog.tsx` | Edit dialog for DoC fields |
| Create | `components/domain/products/declaration-status-dialog.tsx` | Status change dialog with required comment |
| Modify | `app/(dashboard)/mdr/declarations/[id]/page.tsx` | Add edit, delete, new status buttons, show comment |
| Modify | `app/(dashboard)/mdr/products/[id]/page.tsx` | Add edit/delete actions to declaration list items |

### Task 7: Extend State Machine

**Files:**
- Modify: `convex/lib/stateMachine.ts:37-43`

- [ ] **Step 1: Update docStatus transitions**

Replace the existing `docStatus` block (lines 37-43):

```typescript
  docStatus: {
    MISSING: ["IN_REVIEW"],
    IN_REVIEW: ["VALID", "REJECTED"],
    VALID: ["EXPIRING", "WITHDRAWN", "SUPERSEDED"],
    EXPIRING: ["EXPIRED", "VALID", "WITHDRAWN"],
    EXPIRED: ["IN_REVIEW", "WITHDRAWN"],
    REJECTED: ["IN_REVIEW", "WITHDRAWN"],
    WITHDRAWN: [],
    SUPERSEDED: [],
  },
```

State machine rationale:
- `IN_REVIEW → REJECTED`: DoC is invalid/incorrect after review
- `VALID → WITHDRAWN`: Manufacturer withdraws the declaration
- `VALID → SUPERSEDED`: Replaced by a newer version
- `REJECTED → IN_REVIEW`: Re-submit after corrections
- `REJECTED → WITHDRAWN`: Give up on this DoC
- `EXPIRED → WITHDRAWN`: Clean up old expired DoC
- `WITHDRAWN` and `SUPERSEDED` are terminal states

- [ ] **Step 2: Commit**

```bash
git add convex/lib/stateMachine.ts
git commit -m "feat: extend docStatus state machine with REJECTED, WITHDRAWN, SUPERSEDED"
```

### Task 8: Schema & Enum Updates

**Files:**
- Modify: `convex/schema.ts`
- Modify: `lib/types/enums.ts`
- Modify: `lib/types/domain.ts`
- Modify: `convex/lib/permissions.ts`

- [ ] **Step 1: Update schema — add reviewComment and new status values**

In `convex/schema.ts`, find the `docStatus` validator (should be near the top with other union types) and add the new values:

```typescript
const docStatus = v.union(
  v.literal("MISSING"),
  v.literal("IN_REVIEW"),
  v.literal("VALID"),
  v.literal("EXPIRING"),
  v.literal("EXPIRED"),
  v.literal("REJECTED"),
  v.literal("WITHDRAWN"),
  v.literal("SUPERSEDED"),
);
```

Add `reviewComment` field to the `declarationsOfConformity` table definition (after `reviewedAt`):

```typescript
reviewComment: v.optional(v.string()),
```

- [ ] **Step 2: Update enums**

In `lib/types/enums.ts`, update `DOC_STATUSES`:

```typescript
export const DOC_STATUSES = [
  "MISSING", "IN_REVIEW", "VALID", "EXPIRING", "EXPIRED",
  "REJECTED", "WITHDRAWN", "SUPERSEDED",
] as const;
```

Add to `STATUS_LABELS` (note: `REJECTED: "Abgelehnt"` already exists at line 305 for training requests, so only add):

```typescript
WITHDRAWN: "Zurückgezogen",
SUPERSEDED: "Ersetzt",
```

Add to `STATUS_COLORS` (note: `REJECTED` already exists at line 251, so only add):

```typescript
WITHDRAWN: "bg-gray-100 text-gray-600",
SUPERSEDED: "bg-purple-100 text-purple-700",
```

- [ ] **Step 3: Add declarations:delete permission**

In `lib/types/domain.ts`, add `"declarations:delete"` to the `PermissionAction` type.

In `convex/lib/permissions.ts`, grant `declarations:delete` to the `admin` role.

- [ ] **Step 4: Deploy Convex**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts lib/types/enums.ts lib/types/domain.ts convex/lib/permissions.ts
git commit -m "feat: add REJECTED/WITHDRAWN/SUPERSEDED status, reviewComment field, declarations:delete permission"
```

### Task 9: Backend Mutations for Edit, Delete, Review with Comment

**Files:**
- Modify: `convex/declarations.ts`

- [ ] **Step 1: Extend review mutation to require comment**

Update the `review` mutation args to include an optional `comment`:

```typescript
export const review = mutation({
  args: {
    id: v.id("declarationsOfConformity"),
    status: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:review");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    // Require comment for REJECTED and WITHDRAWN transitions
    if (
      (args.status === "REJECTED" || args.status === "WITHDRAWN") &&
      !args.comment?.trim()
    ) {
      throw new Error("Ein Kommentar ist für diesen Statuswechsel erforderlich");
    }

    validateTransition("docStatus", doc.status, args.status);

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      reviewedById: user._id,
      reviewedAt: now,
      reviewComment: args.comment?.trim() || undefined,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "STATUS_CHANGE",
      entityType: "declarationsOfConformity",
      entityId: args.id,
      previousStatus: doc.status,
      newStatus: args.status,
      metadata: args.comment ? { comment: args.comment } : undefined,
    });
  },
});
```

- [ ] **Step 2: Add update mutation**

```typescript
/** Update declaration fields */
export const update = mutation({
  args: {
    id: v.id("declarationsOfConformity"),
    version: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    notifiedBody: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:upload");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    // Don't allow editing terminal states
    if (doc.status === "WITHDRAWN" || doc.status === "SUPERSEDED") {
      throw new Error("Konformitätserklärungen im Status 'Zurückgezogen' oder 'Ersetzt' können nicht bearbeitet werden");
    }

    const { id, ...updates } = args;
    const now = Date.now();

    // Build patch — only include provided fields
    const patch: Record<string, any> = {
      updatedAt: now,
      updatedBy: user._id,
    };

    if (updates.version !== undefined) patch.version = updates.version;
    if (updates.issuedAt !== undefined) patch.issuedAt = updates.issuedAt;
    if (updates.validFrom !== undefined) patch.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) patch.validUntil = updates.validUntil;
    if (updates.notifiedBody !== undefined) patch.notifiedBody = updates.notifiedBody || undefined;
    if (updates.certificateNumber !== undefined) patch.certificateNumber = updates.certificateNumber || undefined;
    if (updates.externalUrl !== undefined) {
      patch.externalUrl = updates.externalUrl || undefined;
      patch.urlStatus = updates.externalUrl ? "UNCHECKED" : undefined;
    }

    await ctx.db.patch(id, patch);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "declarationsOfConformity",
      entityId: id,
      metadata: { updatedFields: Object.keys(updates).filter((k) => (updates as any)[k] !== undefined) },
    });
  },
});
```

- [ ] **Step 3: Add archive (soft delete) mutation**

```typescript
/** Soft-delete a declaration */
export const archive = mutation({
  args: { id: v.id("declarationsOfConformity") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:upload");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      archivedBy: user._id,
      updatedAt: now,
      updatedBy: user._id,
    });

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "ARCHIVE",
      entityType: "declarationsOfConformity",
      entityId: args.id,
    });
  },
});
```

- [ ] **Step 4: Add permanent delete mutation (admin only)**

```typescript
/** Permanently delete a declaration (admin only) */
export const permanentDelete = mutation({
  args: { id: v.id("declarationsOfConformity") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "declarations:delete");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Konformitätserklärung nicht gefunden");

    // Delete associated file from storage
    if (doc.fileId) {
      await ctx.storage.delete(doc.fileId);
    }

    await ctx.db.delete(args.id);

    await logAuditEvent(ctx, {
      userId: user._id,
      action: "DELETE",
      entityType: "declarationsOfConformity",
      entityId: args.id,
      metadata: {
        productId: doc.productId,
        version: doc.version,
      },
    });
  },
});
```

- [ ] **Step 5: Deploy Convex**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 6: Commit**

```bash
git add convex/declarations.ts
git commit -m "feat: add update, archive, permanentDelete mutations; review requires comment for REJECTED/WITHDRAWN"
```

### Task 10: Declaration Status Change Dialog

**Files:**
- Create: `components/domain/products/declaration-status-dialog.tsx`

- [ ] **Step 1: Create the status change dialog with required comment**

```typescript
// components/domain/products/declaration-status-dialog.tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS } from "@/lib/types/enums";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declarationId: string;
  currentStatus: string;
  targetStatus: string;
}

const COMMENT_REQUIRED_STATUSES = ["REJECTED", "WITHDRAWN"];

export function DeclarationStatusDialog({
  open,
  onOpenChange,
  declarationId,
  currentStatus,
  targetStatus,
}: Props) {
  const reviewDeclaration = useMutation(api.declarations.review);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const requiresComment = COMMENT_REQUIRED_STATUSES.includes(targetStatus);

  const handleSubmit = async () => {
    if (requiresComment && !comment.trim()) {
      toast.error("Ein Kommentar ist für diesen Statuswechsel erforderlich");
      return;
    }

    setLoading(true);
    try {
      await reviewDeclaration({
        id: declarationId as any,
        status: targetStatus,
        comment: comment.trim() || undefined,
      });
      toast.success(`Status geändert zu "${STATUS_LABELS[targetStatus] ?? targetStatus}"`);
      onOpenChange(false);
      setComment("");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Statuswechsel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Status ändern</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Status wird geändert von{" "}
            <strong>{STATUS_LABELS[currentStatus] ?? currentStatus}</strong>
            {" → "}
            <strong>{STATUS_LABELS[targetStatus] ?? targetStatus}</strong>
          </p>

          <div className="space-y-2">
            <Label>
              Kommentar {requiresComment ? "*" : "(optional)"}
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                requiresComment
                  ? "Begründung für den Statuswechsel eingeben..."
                  : "Optionaler Kommentar zum Statuswechsel..."
              }
              rows={3}
            />
            {requiresComment && (
              <p className="text-xs text-muted-foreground">
                Ein Kommentar ist für diesen Statuswechsel erforderlich (Audit-Trail).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (requiresComment && !comment.trim())}
            variant={targetStatus === "REJECTED" || targetStatus === "WITHDRAWN" ? "destructive" : "default"}
          >
            {loading ? "Wird geändert..." : `→ ${STATUS_LABELS[targetStatus] ?? targetStatus}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/domain/products/declaration-status-dialog.tsx
git commit -m "feat: add declaration status change dialog with comment requirement"
```

### Task 11: Declaration Edit Dialog

**Files:**
- Create: `components/domain/products/declaration-edit-dialog.tsx`

- [ ] **Step 1: Create the edit dialog**

```typescript
// components/domain/products/declaration-edit-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DeclarationData {
  _id: string;
  version: string;
  issuedAt: number;
  validFrom: number;
  validUntil: number;
  notifiedBody?: string;
  certificateNumber?: string;
  externalUrl?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declaration: DeclarationData;
}

function toDateInput(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

export function DeclarationEditDialog({ open, onOpenChange, declaration }: Props) {
  const updateDeclaration = useMutation(api.declarations.update);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    version: "",
    issuedAt: "",
    validFrom: "",
    validUntil: "",
    notifiedBody: "",
    certificateNumber: "",
    externalUrl: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        version: declaration.version,
        issuedAt: toDateInput(declaration.issuedAt),
        validFrom: toDateInput(declaration.validFrom),
        validUntil: toDateInput(declaration.validUntil),
        notifiedBody: declaration.notifiedBody ?? "",
        certificateNumber: declaration.certificateNumber ?? "",
        externalUrl: declaration.externalUrl ?? "",
      });
    }
  }, [open, declaration]);

  const handleSubmit = async () => {
    if (!form.version || !form.issuedAt || !form.validFrom || !form.validUntil) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    setLoading(true);
    try {
      await updateDeclaration({
        id: declaration._id as any,
        version: form.version,
        issuedAt: new Date(form.issuedAt).getTime(),
        validFrom: new Date(form.validFrom).getTime(),
        validUntil: new Date(form.validUntil).getTime(),
        notifiedBody: form.notifiedBody || undefined,
        certificateNumber: form.certificateNumber || undefined,
        externalUrl: form.externalUrl || undefined,
      });
      toast.success("Konformitätserklärung aktualisiert");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konformitätserklärung bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Version *</Label>
              <Input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ausstellungsdatum *</Label>
              <Input
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gültig ab *</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis *</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Benannte Stelle</Label>
              <Input
                value={form.notifiedBody}
                onChange={(e) => setForm({ ...form, notifiedBody: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Zertifikatsnummer</Label>
              <Input
                value={form.certificateNumber}
                onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Externe URL</Label>
            <Input
              value={form.externalUrl}
              onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/domain/products/declaration-edit-dialog.tsx
git commit -m "feat: add declaration edit dialog"
```

### Task 12: Update Declaration Detail Page

**Files:**
- Modify: `app/(dashboard)/mdr/declarations/[id]/page.tsx`

- [ ] **Step 1: Add edit, delete, and status-change dialogs**

Import the new components at the top:

```typescript
import { DeclarationEditDialog } from "@/components/domain/products/declaration-edit-dialog";
import { DeclarationStatusDialog } from "@/components/domain/products/declaration-status-dialog";
import { Pencil, Trash2 } from "lucide-react";
```

Add state variables after existing state:

```typescript
const [editOpen, setEditOpen] = useState(false);
const [statusDialogOpen, setStatusDialogOpen] = useState(false);
const [targetStatus, setTargetStatus] = useState("");
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);

const archiveDeclaration = useMutation(api.declarations.archive);
const permanentDeleteDeclaration = useMutation(api.declarations.permanentDelete);
```

Replace the status transition buttons (lines 197-207) with buttons that open the status dialog:

```tsx
{can("declarations:review") &&
  allowedTransitions.map((target) => (
    <Button
      key={target}
      variant={target === "REJECTED" || target === "WITHDRAWN" ? "destructive" : "outline"}
      size="sm"
      onClick={() => {
        setTargetStatus(target);
        setStatusDialogOpen(true);
      }}
    >
      → {STATUS_LABELS[target] ?? target}
    </Button>
  ))}
```

Add edit and delete buttons after the status buttons (still inside the flex wrapper):

```tsx
{can("declarations:upload") && declaration.status !== "WITHDRAWN" && declaration.status !== "SUPERSEDED" && (
  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
    <Pencil className="mr-1.5 h-4 w-4" />
    Bearbeiten
  </Button>
)}
{can("declarations:upload") && (
  <Button
    variant="outline"
    size="sm"
    className="text-red-600 hover:text-red-700"
    onClick={() => setDeleteConfirmOpen(true)}
  >
    <Trash2 className="mr-1.5 h-4 w-4" />
    Löschen
  </Button>
)}
```

Display the review comment if present (after the date grid, before action buttons):

```tsx
{declaration.reviewComment && (
  <div className="rounded-md border bg-muted/30 p-3">
    <p className="text-xs font-medium text-muted-foreground mb-1">Prüfkommentar</p>
    <p className="text-sm">{declaration.reviewComment}</p>
    {declaration.reviewedAt && (
      <p className="text-xs text-muted-foreground mt-1">
        {formatDate(declaration.reviewedAt)}
      </p>
    )}
  </div>
)}
```

Add the dialogs at the end of the component (before the closing `</div>`):

```tsx
{/* Status Change Dialog */}
{statusDialogOpen && (
  <DeclarationStatusDialog
    open={statusDialogOpen}
    onOpenChange={setStatusDialogOpen}
    declarationId={declaration._id}
    currentStatus={declaration.status}
    targetStatus={targetStatus}
  />
)}

{/* Edit Dialog */}
{editOpen && (
  <DeclarationEditDialog
    open={editOpen}
    onOpenChange={setEditOpen}
    declaration={declaration}
  />
)}

{/* Delete Confirmation Dialog */}
<Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Konformitätserklärung löschen?</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      Diese Aktion kann nicht rückgängig gemacht werden. Die Konformitätserklärung
      (Version {declaration.version}) wird {can("declarations:delete") ? "endgültig gelöscht" : "archiviert"}.
    </p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
        Abbrechen
      </Button>
      <Button
        variant="destructive"
        disabled={deleteLoading}
        onClick={async () => {
          setDeleteLoading(true);
          try {
            if (can("declarations:delete")) {
              await permanentDeleteDeclaration({ id: declaration._id as any });
              toast.success("Konformitätserklärung endgültig gelöscht");
            } else {
              await archiveDeclaration({ id: declaration._id as any });
              toast.success("Konformitätserklärung archiviert");
            }
            router.push("/mdr/declarations");
          } catch (err: any) {
            toast.error(err.message ?? "Fehler");
          } finally {
            setDeleteLoading(false);
          }
        }}
      >
        {deleteLoading ? "Wird gelöscht..." : "Löschen"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Note: Add `import { useRouter } from "next/navigation";` and `const router = useRouter();` if not already present.

Also add `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` to existing imports from `@/components/ui/dialog`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Deploy Convex**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/mdr/declarations/[id]/page.tsx
git commit -m "feat: add edit, delete, status-with-comment to declaration detail page"
```

---

## Chunk 4: Feature 3 — PDF Analysis with MDR Checklist

*Server-side PDF text extraction and MDR compliance verification.*

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/analyze-pdf/route.ts` | API route: fetch PDF, extract text with pdf-parse, run MDR checks |
| Create | `lib/pdf/mdr-checklist.ts` | MDR DoC compliance checklist logic |
| Modify | `lib/hmv/api-client.ts` | Add `analyzePdf()` client function |
| Create | `components/domain/products/pdf-analysis-card.tsx` | UI card showing extracted data + checklist |
| Modify | `app/(dashboard)/mdr/declarations/[id]/page.tsx` | Add analysis tab/card |

### Task 13: Install pdf-parse

**Files:** None (package.json)

- [ ] **Step 1: Install pdf-parse**

Run: `npm install pdf-parse`
Run: `npm install -D @types/pdf-parse` (if types exist, otherwise skip)

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf-parse for PDF text extraction"
```

### Task 14: MDR Compliance Checklist

**Files:**
- Create: `lib/pdf/mdr-checklist.ts`

- [ ] **Step 1: Create the MDR checklist module**

```typescript
// lib/pdf/mdr-checklist.ts

export interface MdrCheckItem {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  /** Extracted value if found */
  extractedValue?: string;
}

export interface PdfAnalysisResult {
  /** Extracted text (truncated for display) */
  textPreview: string;
  /** Total character count */
  textLength: number;
  /** Number of pages */
  pageCount: number;
  /** Extracted structured fields */
  extracted: {
    manufacturer?: string;
    productName?: string;
    udi?: string;
    notifiedBody?: string;
    certificateNumber?: string;
    regulatoryBasis?: string;
    issueDate?: string;
    signatory?: string;
  };
  /** MDR compliance checklist results */
  checklist: MdrCheckItem[];
  /** Overall compliance score (0-100) */
  complianceScore: number;
}

// Patterns for extracting fields from DoC text
const PATTERNS = {
  manufacturer: [
    /(?:hersteller|manufacturer|fabricant)[:\s]*([^\n]{3,80})/i,
    /(?:hergestellt von|manufactured by|fabriqué par)[:\s]*([^\n]{3,80})/i,
  ],
  productName: [
    /(?:produkt(?:name|bezeichnung)?|product(?:\s*name)?|produit)[:\s]*([^\n]{3,80})/i,
    /(?:medizinprodukt|medical device|dispositif médical)[:\s]*([^\n]{3,80})/i,
  ],
  udi: [
    /(?:UDI(?:-DI)?|Unique Device Identifier)[:\s]*([A-Z0-9()]{8,})/i,
    /(?:Basic UDI-DI|Basis-UDI-DI)[:\s]*([A-Z0-9()]{8,})/i,
  ],
  notifiedBody: [
    /(?:benannte stelle|notified body|organisme notifié)[:\s]*([^\n]{3,80})/i,
    /(?:NB[:\s]*\d{4})/i,
  ],
  certificateNumber: [
    /(?:zertifikat(?:s)?(?:nummer|nr\.?)|certificate\s*(?:number|no\.?))[:\s]*([A-Z0-9\-/.]{4,30})/i,
  ],
  regulatoryBasis: [
    /((?:EU\s*)?2017\/745|MDR)/i,
    /(93\/42\/(?:EWG|EEC)|MDD)/i,
  ],
  issueDate: [
    /(?:datum|date|ausgestellt am|issued on)[:\s]*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    /(\d{1,2}\.\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*\d{4})/i,
  ],
  signatory: [
    /(?:unterschrift|signature|unterzeichnet|signed by)[:\s]*([^\n]{3,60})/i,
  ],
};

function extractField(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return (match[1] ?? match[0]).trim();
    }
  }
  return undefined;
}

/**
 * MDR Article 19 & Annex IV checklist for Declarations of Conformity.
 * Reference: EU Regulation 2017/745 (MDR)
 */
function buildChecklist(text: string, extracted: PdfAnalysisResult["extracted"]): MdrCheckItem[] {
  const textLower = text.toLowerCase();

  return [
    {
      id: "manufacturer_name",
      label: "Herstellerangabe",
      description: "Name und Anschrift des Herstellers (Anhang IV Nr. 1)",
      passed: !!extracted.manufacturer,
      extractedValue: extracted.manufacturer,
    },
    {
      id: "product_identification",
      label: "Produktidentifikation",
      description: "Produktname oder -bezeichnung, Handelsname (Anhang IV Nr. 3)",
      passed: !!extracted.productName,
      extractedValue: extracted.productName,
    },
    {
      id: "udi",
      label: "UDI / Basic UDI-DI",
      description: "Einmalige Produktkennung gemäß Art. 27 (Anhang IV Nr. 4)",
      passed: !!extracted.udi,
      extractedValue: extracted.udi,
    },
    {
      id: "regulatory_reference",
      label: "Regulatorische Grundlage",
      description: "Verweis auf EU 2017/745 (MDR) (Anhang IV Nr. 2)",
      passed: textLower.includes("2017/745") || textLower.includes("mdr"),
      extractedValue: extracted.regulatoryBasis,
    },
    {
      id: "product_class",
      label: "Risikoklasse",
      description: "Klassifizierung gemäß Anhang VIII (Anhang IV Nr. 5)",
      passed:
        /(?:klasse|class)\s*(I{1,3}[ab]?|1|2[ab]?|3)/i.test(text) ||
        /(?:risk\s*class|risikoklasse)/i.test(text),
      extractedValue: text.match(/(?:klasse|class)\s*(I{1,3}[ab]?)/i)?.[1],
    },
    {
      id: "conformity_statement",
      label: "Konformitätsaussage",
      description: "Erklärung, dass das Produkt den Anforderungen der MDR entspricht (Anhang IV Nr. 6)",
      passed:
        textLower.includes("konformität") ||
        textLower.includes("conformity") ||
        textLower.includes("conformité") ||
        textLower.includes("entspricht den anforderungen"),
    },
    {
      id: "applicable_gspr",
      label: "Angewandte GSPR / Normen",
      description: "Verweis auf angewandte gemeinsame Spezifikationen oder harmonisierte Normen (Anhang IV Nr. 7)",
      passed:
        textLower.includes("harmonisierte norm") ||
        textLower.includes("harmonized standard") ||
        /(?:EN|ISO)\s*\d{4,5}/i.test(text) ||
        textLower.includes("gspr") ||
        textLower.includes("annex i"),
    },
    {
      id: "notified_body",
      label: "Benannte Stelle",
      description: "Name und Kennnummer der benannten Stelle (falls zutreffend) (Anhang IV Nr. 8)",
      passed:
        !!extracted.notifiedBody ||
        /NB\s*\d{4}/i.test(text) ||
        textLower.includes("benannte stelle") ||
        textLower.includes("notified body"),
      extractedValue: extracted.notifiedBody,
    },
    {
      id: "date_and_signature",
      label: "Datum und Unterschrift",
      description: "Ort, Datum und Unterschrift des Verantwortlichen (Anhang IV Nr. 9/10)",
      passed: !!extracted.issueDate || !!extracted.signatory,
      extractedValue: extracted.issueDate
        ? `Datum: ${extracted.issueDate}${extracted.signatory ? `, Unterzeichner: ${extracted.signatory}` : ""}`
        : extracted.signatory,
    },
    {
      id: "ce_marking",
      label: "CE-Kennzeichnung",
      description: "Verweis auf CE-Kennzeichnung gemäß Art. 20",
      passed: /\bce\b/i.test(text) || textLower.includes("ce-kennzeichnung") || textLower.includes("ce marking"),
    },
  ];
}

export function analyzePdfText(text: string, pageCount: number): PdfAnalysisResult {
  const extracted: PdfAnalysisResult["extracted"] = {
    manufacturer: extractField(text, PATTERNS.manufacturer),
    productName: extractField(text, PATTERNS.productName),
    udi: extractField(text, PATTERNS.udi),
    notifiedBody: extractField(text, PATTERNS.notifiedBody),
    certificateNumber: extractField(text, PATTERNS.certificateNumber),
    regulatoryBasis: extractField(text, PATTERNS.regulatoryBasis),
    issueDate: extractField(text, PATTERNS.issueDate),
    signatory: extractField(text, PATTERNS.signatory),
  };

  const checklist = buildChecklist(text, extracted);
  const passedCount = checklist.filter((item) => item.passed).length;
  const complianceScore = Math.round((passedCount / checklist.length) * 100);

  return {
    textPreview: text.slice(0, 2000),
    textLength: text.length,
    pageCount,
    extracted,
    checklist,
    complianceScore,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pdf/mdr-checklist.ts
git commit -m "feat: add MDR DoC compliance checklist with field extraction"
```

### Task 15: PDF Analysis API Route

**Files:**
- Create: `app/api/analyze-pdf/route.ts`

- [ ] **Step 1: Create the analysis API route**

```typescript
// app/api/analyze-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { analyzePdfText } from "@/lib/pdf/mdr-checklist";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pdfUrl = searchParams.get("url");

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "Parameter 'url' ist erforderlich" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      const parsed = new URL(pdfUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    // Fetch the PDF
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QMS-Bot/1.0)",
        "Accept": "application/pdf,*/*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `PDF nicht erreichbar: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !pdfUrl.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Die URL liefert keine PDF-Datei" },
        { status: 400 }
      );
    }

    // Read PDF buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Limit: don't process PDFs > 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF zu groß (max. 10 MB)" },
        { status: 413 }
      );
    }

    // Dynamic import to avoid issues with pdf-parse in edge runtime
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);

    const result = analyzePdfText(parsed.text, parsed.numpages);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return NextResponse.json(
        { error: "Zeitüberschreitung beim Laden der PDF" },
        { status: 504 }
      );
    }
    console.error("PDF Analysis Fehler:", error);
    return NextResponse.json(
      { error: "Fehler bei der PDF-Analyse" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add client function**

Add to `lib/hmv/api-client.ts`:

```typescript
import type { PdfAnalysisResult } from "@/lib/pdf/mdr-checklist";

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
```

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze-pdf/route.ts lib/hmv/api-client.ts
git commit -m "feat: add PDF analysis API route with pdf-parse"
```

### Task 16: PDF Analysis Card Component

**Files:**
- Create: `components/domain/products/pdf-analysis-card.tsx`

- [ ] **Step 1: Create the analysis card**

```typescript
// components/domain/products/pdf-analysis-card.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/domain/products/pdf-analysis-card.tsx
git commit -m "feat: add PDF analysis card with MDR checklist UI"
```

### Task 17: Integrate Analysis into Declaration Detail Page

**Files:**
- Modify: `app/(dashboard)/mdr/declarations/[id]/page.tsx`

- [ ] **Step 1: Add analysis card to the declaration page**

Import the component:

```typescript
import { PdfAnalysisCard } from "@/components/domain/products/pdf-analysis-card";
```

Add a new tab for analysis (extend the existing Tabs component at lines 234-244):

```tsx
<Tabs defaultValue="analysis">
  <TabsList>
    <TabsTrigger value="analysis">MDR-Prüfung</TabsTrigger>
    <TabsTrigger value="preview">Vorschau</TabsTrigger>
    <TabsTrigger value="history">Verlauf</TabsTrigger>
  </TabsList>
  <TabsContent value="analysis" className="mt-4">
    {pdfSource ? (
      <PdfAnalysisCard pdfUrl={pdfSource} />
    ) : (
      <p className="text-sm text-muted-foreground py-4">
        Kein PDF hinterlegt — bitte laden Sie eine Datei hoch oder fügen Sie eine externe URL hinzu.
      </p>
    )}
  </TabsContent>
  <TabsContent value="preview" className="mt-4">
    {pdfSource ? (
      <Card>
        <CardContent className="pt-4">
          <div className="rounded-md border overflow-hidden bg-muted/20">
            <iframe
              src={pdfSource}
              className="w-full h-[700px]"
              title={`PDF Vorschau: ${declaration.fileName ?? "Konformitätserklärung"}`}
            />
          </div>
        </CardContent>
      </Card>
    ) : (
      <p className="text-sm text-muted-foreground py-4">
        Kein Dokument zum Anzeigen vorhanden.
      </p>
    )}
  </TabsContent>
  <TabsContent value="history" className="mt-4">
    <AuditHistory
      entityType="declarationsOfConformity"
      entityId={declaration._id}
    />
  </TabsContent>
</Tabs>
```

This replaces the old standalone PDF preview section (lines 212-231) and the old Tabs (lines 233-244). Remove the `showPdfPreview` state and the preview toggle button from the action buttons section since preview is now in a tab.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Deploy Convex**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/mdr/declarations/[id]/page.tsx
git commit -m "feat: integrate PDF analysis with MDR checklist into declaration detail page"
```

---

## Chunk 5: Pre-fill Manufacturer in Conformity Search

*Quick fix: the conformity search dialog should pre-fill the manufacturer name from the product's assigned manufacturer.*

### Task 18: Auto-fill Manufacturer Name

**Files:**
- Modify: `components/domain/products/conformity-search-dialog.tsx`

- [ ] **Step 1: Verify manufacturer prop is passed correctly**

Check that `app/(dashboard)/mdr/products/[id]/page.tsx` passes `manufacturerName={manufacturer?.name ?? ""}` to `ConformitySearchDialog`. The code at line 630 already does this — but the issue in the screenshot shows "Herstellername" as placeholder, meaning the manufacturer name is empty string.

Debug: The manufacturer query at line 94-97 of the product detail page needs to resolve the manufacturer name. Check that `manufacturer` is not undefined. If the product has `manufacturerId` set, the query should return the manufacturer.

The root cause: if the user just created a product via HMV auto-fill and the manufacturer wasn't matched (unmatchedHersteller warning), then `manufacturerId` is empty → manufacturer query returns null → name is "".

This is actually expected behavior for unmatched manufacturers. The fix: pass the HMV-known manufacturer name as a fallback. But since this info isn't persisted, the pragmatic fix is to ensure the Hersteller field in the search dialog is editable (it already is) and the user can type it.

No code change needed here — just confirm the existing behavior is correct.

- [ ] **Step 2: Commit (if changes were needed)**

No commit needed — existing implementation is correct.

---

## Final Verification

### Task 19: Full Build Check

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Deploy Convex**

Run: `npx convex dev --once --typecheck=disable`
Expected: "Convex functions ready!"

- [ ] **Step 3: Start dev server and smoke test**

Run: `npm run dev`

Manual test checklist:
1. Open conformity search dialog → balance shows "XXXX Credits verbleibend"
2. Search finds PDFs → results show with green PDF badge
3. Scraper finds PDFs from manufacturer website → "PDFs auf Herstellerwebsite gefunden" section appears
4. Declaration detail page → new tabs (MDR-Prüfung, Vorschau, Verlauf)
5. Click "PDF analysieren" → checklist with green/red items appears
6. Click status transition button → comment dialog opens, comment required for REJECTED/WITHDRAWN
7. Click "Bearbeiten" → edit dialog with all fields, saves correctly
8. Click "Löschen" → confirmation dialog, deletes/archives
9. New statuses (REJECTED, WITHDRAWN, SUPERSEDED) display correct badges

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete DoC workflow, scraper, PDF analysis, and Serper balance features"
```
