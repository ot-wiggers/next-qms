# Berichtsarchiv — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Platzhalter-Modul „Berichte" wird zum zentralen Berichtsarchiv — eine gefilterte (Jahr/Typ) Gesamtsicht auf alle bereits in den Modulen erzeugten Nachweis-PDFs (Auditberichte, Managementbewertungen, PMS-Berichte, Konformitätserklärungen, Kalibrierzertifikate, Wareneingangsprüfungen) mit Direkt-Download bzw. Sprung ins Modul.

**Architecture:** Reiner **Lese-Aggregator** — KEIN neues Schema, kein Storage, kein Cron, keine Duplizierung. Eine Convex-Query `reports.archive` sammelt aus 6 Bestandstabellen alle Datensätze mit Nachweis-Datei, mappt sie auf eine gemeinsame Form `{ type, title, date, year, downloadUrl, href }`, löst die Storage-URLs auf und sortiert nach Datum absteigend. Die Seite ersetzt den Platzhalter durch eine Tabelle mit Typ- und Jahres-Filter; jede Zeile hat „PDF öffnen" (wo eine eingefrorene Datei existiert) und führt per Klick ins Quell-Modul. Wareneingangsprüfungen haben kein gespeichertes PDF (client-seitig erzeugt) → nur Modul-Link.

**Tech Stack:** Next.js 15 (App Router), Convex (read-only query, Storage-getUrl), Tailwind v4 + shadcn/ui.

**Verifikation:** Kein Test-Framework — Hauskonvention: `npx tsc --noEmit` (+ `npx convex dev --once` bei Convex-Tasks), Commit pro Task; am Ende Browser-Walkthrough (Memory „Runtime-Verifikation Pflicht").

**Beschluss-Referenz:** Grill-me 2026-06-12, Punkt 8 (Memory `qm-backlog-beschluesse-2026-06`): „zentrales Berichtsarchiv (alle eingefrorenen PDFs, Filter Jahr/Typ) zuerst; KPI-Auswertungen spätere Ausbaustufe." Die KPI-Auswertungen sind **bewusst nicht** Teil dieses Plans.

**Verifizierte Fakten (2026-06-25):**
- Nachweis-Dateifelder im Schema: `audits.reportFileId` (753), `managementReviews.reportFileId` (910), `pmsReports.reportFileId` (1004), `declarationsOfConformity.fileId` (638), `deviceCalibrations.certFileId` (1130). `incomingGoodsChecks` hat nur `signatureFileId`/`attachmentFileIds` — KEIN eingefrorenes Report-PDF (der Wareneingangs-Prüfbericht wird client-seitig per `downloadIncomingGoodsPdf` erzeugt).
- Jahres-/Datumsfelder: `audits.auditYear` (number) + `auditDate?`/`closedAt?`; `managementReviews.year` + `approvedAt?`; `pmsReports.year` + `approvedAt?`; `declarationsOfConformity.issuedAt` (number, Datum) + `version`; `deviceCalibrations.calibrationDate` (number) + `deviceId`; `incomingGoodsChecks.checkDate` (number) + `manufacturer`/`productArea`/`locationId`.
- Detail-Routen je Quelle: `/audits/[id]`, `/management-review/[id]`, `/pms-reports/[id]`, `/mdr/declarations/[id]`, `/devices/[id]` (Kalibrierung hängt am Gerät → `deviceId`), `/incoming-goods/[id]`.
- Joins nötig: declarations→`products` (Name), deviceCalibrations→`deviceRecords` (Name), incomingGoodsChecks→`organizations` (Filialname). Alles kleine Tabellen (Volltabellen-collect ok bei 30-MA-Organisation).
- Storage-URL-Muster: `await ctx.storage.getUrl(fileId)` (declarations.getFileUrl, audits.getReportUrl).
- Reports-Platzhalter unter `app/(dashboard)/reports/page.tsx` (PlaceholderPage); Feature-Flag `REPORTS` aktiv (admin/settings:63); Sidebar-Eintrag „Berichte" mit Badge „IN PLANUNG" (sidebar.tsx:71, Gruppe „Dokumente").
- PermissionAction-Union endet in `lib/types/domain.ts` mit `| "admin:settings" | "admin:featureFlags"`; RBAC-Matrix in `convex/lib/permissions.ts`. `formatDate` in `lib/utils/dates`.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `lib/types/enums.ts` | Modify | REPORT_TYPES + REPORT_TYPE_LABELS |
| `lib/types/domain.ts` + `convex/lib/permissions.ts` | Modify | `reports:list` + RBAC |
| `convex/reports.ts` | Create | `archive`-Aggregator-Query über 6 Quellen |
| `app/(dashboard)/reports/page.tsx` | Replace | Archiv-Tabelle + Typ-/Jahres-Filter |
| `components/layout/sidebar.tsx` | Modify | Badge entfernen + permission |

**Ausführungskontext:** Branch: `git checkout -b feature/berichtsarchiv` (vor Task 1). Convex-Push nach jedem Convex-Task: `npx convex dev --once`.

---

### Task 1: Enums + Permission

**Files:**
- Modify: `lib/types/enums.ts` (ans Dateiende)
- Modify: `lib/types/domain.ts` (PermissionAction-Union)
- Modify: `convex/lib/permissions.ts` (RBAC-Matrix)

- [ ] **Step 1: Enums anfügen** — ans Ende von `lib/types/enums.ts`:

```ts
// ============================================================
// Berichtsarchiv — Typen der eingefrorenen Nachweise (Aggregation, kein eigenes Schema)
// ============================================================
export const REPORT_TYPES = [
  "AUDIT", "MGMT_REVIEW", "PMS_REPORT", "DECLARATION", "CALIBRATION", "INCOMING_GOODS",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  AUDIT: "Auditbericht",
  MGMT_REVIEW: "Managementbewertung",
  PMS_REPORT: "PMS-Bericht",
  DECLARATION: "Konformitätserklärung",
  CALIBRATION: "Kalibrierzertifikat",
  INCOMING_GOODS: "Wareneingangsprüfung",
};
```

- [ ] **Step 2: PermissionAction erweitern** — in `lib/types/domain.ts` in der Union vor `| "admin:settings"` einfügen:

```ts
  | "reports:list"
```

- [ ] **Step 3: RBAC erweitern** — in `convex/lib/permissions.ts` (`reports:list` an die lese-breiten Rollen; employee bekommt es NICHT, da Audit-/Mgmt-/PMS-Berichte Governance-Nachweise sind, die employee in den Einzelmodulen ebenfalls nicht sieht):

In `qmb` (vor `"tasks:all",`):

```ts
    "reports:list",
```

In `department_lead` (vor `"tasks:team",`):

```ts
    "reports:list",
```

In `auditor` (vor `"tasks:own",`):

```ts
    "reports:list",
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add lib/types/enums.ts lib/types/domain.ts convex/lib/permissions.ts
git commit -m "feat(berichte): Report-Typen + reports:list-Permission"
```

---

### Task 2: Convex — `reports.archive`-Aggregator

**Files:**
- Create: `convex/reports.ts`

- [ ] **Step 1: Datei anlegen** — `convex/reports.ts`:

```ts
import { query } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";

type ReportType =
  | "AUDIT" | "MGMT_REVIEW" | "PMS_REPORT" | "DECLARATION" | "CALIBRATION" | "INCOMING_GOODS";

interface ArchiveEntry {
  key: string;            // eindeutig: type + id
  type: ReportType;
  title: string;
  date: number;           // Sortier-/Anzeigedatum
  year: number;
  downloadUrl: string | null; // direktes Storage-PDF, null wenn client-generiert
  href: string;           // Route ins Quell-Modul
}

function yearOf(ts: number): number {
  return new Date(ts).getUTCFullYear();
}

// ============================================================
// archive — aggregiert alle eingefrorenen Nachweise aus den Modulen.
// Read-only, keine Duplizierung. Volltabellen-Scan ok (30-MA-Organisation).
// ponytail: keine Pagination — falls das Archiv > einige hundert Einträge
// wächst, hier Jahres-/Typ-Filter serverseitig nachziehen.
// ============================================================
export const archive = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports:list");

    const entries: ArchiveEntry[] = [];

    // 1. Auditberichte
    const audits = await ctx.db
      .query("audits")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    for (const a of audits) {
      if (!a.reportFileId) continue;
      entries.push({
        key: `AUDIT-${a._id}`,
        type: "AUDIT",
        title: a.title,
        date: a.auditDate ?? a.closedAt ?? a._creationTime,
        year: a.auditYear,
        downloadUrl: await ctx.storage.getUrl(a.reportFileId),
        href: `/audits/${a._id}`,
      });
    }

    // 2. Managementbewertungen
    const reviews = await ctx.db
      .query("managementReviews")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    for (const r of reviews) {
      if (!r.reportFileId) continue;
      entries.push({
        key: `MGMT_REVIEW-${r._id}`,
        type: "MGMT_REVIEW",
        title: `Managementbewertung ${r.year}`,
        date: r.approvedAt ?? r._creationTime,
        year: r.year,
        downloadUrl: await ctx.storage.getUrl(r.reportFileId),
        href: `/management-review/${r._id}`,
      });
    }

    // 3. PMS-Berichte
    const pms = await ctx.db
      .query("pmsReports")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    for (const p of pms) {
      if (!p.reportFileId) continue;
      entries.push({
        key: `PMS_REPORT-${p._id}`,
        type: "PMS_REPORT",
        title: `PMS-Bericht ${p.year}`,
        date: p.approvedAt ?? p._creationTime,
        year: p.year,
        downloadUrl: await ctx.storage.getUrl(p.reportFileId),
        href: `/pms-reports/${p._id}`,
      });
    }

    // 4. Konformitätserklärungen (hochgeladene DoC-PDFs)
    const decls = await ctx.db
      .query("declarationsOfConformity")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const products = await ctx.db.query("products").collect();
    const productName = new Map(products.map((p) => [p._id, p.name]));
    for (const d of decls) {
      if (!d.fileId) continue;
      entries.push({
        key: `DECLARATION-${d._id}`,
        type: "DECLARATION",
        title: `${productName.get(d.productId) ?? "Produkt"} — Konformitätserklärung v${d.version}`,
        date: d.issuedAt,
        year: yearOf(d.issuedAt),
        downloadUrl: await ctx.storage.getUrl(d.fileId),
        href: `/mdr/declarations/${d._id}`,
      });
    }

    // 5. Kalibrierzertifikate
    const cals = await ctx.db
      .query("deviceCalibrations")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const devices = await ctx.db.query("deviceRecords").collect();
    const deviceName = new Map(devices.map((d) => [d._id, `${d.name} (${d.inventoryNumber})`]));
    for (const c of cals) {
      if (!c.certFileId) continue;
      entries.push({
        key: `CALIBRATION-${c._id}`,
        type: "CALIBRATION",
        title: `Kalibrierzertifikat — ${deviceName.get(c.deviceId) ?? "Prüfmittel"}`,
        date: c.calibrationDate,
        year: yearOf(c.calibrationDate),
        downloadUrl: await ctx.storage.getUrl(c.certFileId),
        href: `/devices/${c.deviceId}`,
      });
    }

    // 6. Wareneingangsprüfungen (PDF wird client-seitig erzeugt → kein Storage-Link)
    const checks = await ctx.db
      .query("incomingGoodsChecks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgName = new Map(orgs.map((o) => [o._id, o.name]));
    for (const c of checks) {
      entries.push({
        key: `INCOMING_GOODS-${c._id}`,
        type: "INCOMING_GOODS",
        title: `Wareneingang ${orgName.get(c.locationId) ?? ""} — ${c.manufacturer} (${c.productArea})`,
        date: c.checkDate,
        year: yearOf(c.checkDate),
        downloadUrl: null,
        href: `/incoming-goods/${c._id}`,
      });
    }

    entries.sort((a, b) => b.date - a.date);
    return entries;
  },
});
```

- [ ] **Step 2: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add convex/reports.ts
git commit -m "feat(berichte): reports.archive — Lese-Aggregator über 6 Nachweis-Quellen"
```

---

### Task 3: Archiv-Seite + Sidebar

**Files:**
- Replace: `app/(dashboard)/reports/page.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Seite ersetzen** — `app/(dashboard)/reports/page.tsx` komplett:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { REPORT_TYPES, REPORT_TYPE_LABELS, type ReportType } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { FileDown, ExternalLink } from "lucide-react";

interface ArchiveEntry {
  key: string;
  type: ReportType;
  title: string;
  date: number;
  year: number;
  downloadUrl: string | null;
  href: string;
}

const TYPE_BADGE: Record<ReportType, string> = {
  AUDIT: "bg-blue-100 text-blue-800",
  MGMT_REVIEW: "bg-purple-100 text-purple-800",
  PMS_REPORT: "bg-green-100 text-green-800",
  DECLARATION: "bg-amber-100 text-amber-800",
  CALIBRATION: "bg-orange-100 text-orange-800",
  INCOMING_GOODS: "bg-gray-100 text-gray-800",
};

export default function ReportsPage() {
  const router = useRouter();
  const entries = useQuery(api.reports.archive, {});

  const [filterType, setFilterType] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");
  const [search, setSearch] = useState("");

  const all = (entries ?? []) as ArchiveEntry[];
  const years = Array.from(new Set(all.map((e) => e.year))).sort((a, b) => b - a);

  const filtered = all.filter((e) => {
    if (filterType !== "ALL" && e.type !== filterType) return false;
    if (filterYear !== "ALL" && String(e.year) !== filterYear) return false;
    if (search.trim() && !e.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const columns: Column<ArchiveEntry>[] = [
    { key: "date", header: "Datum", cell: (r) => formatDate(r.date) },
    {
      key: "type", header: "Typ",
      cell: (r) => (
        <Badge className={TYPE_BADGE[r.type]} variant="secondary">
          {REPORT_TYPE_LABELS[r.type]}
        </Badge>
      ),
    },
    { key: "title", header: "Bezeichnung", cell: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: "actions", header: "",
      className: "text-right",
      cell: (r) =>
        r.downloadUrl ? (
          <Button variant="outline" size="sm" asChild onClick={(e) => e.stopPropagation()}>
            <a href={r.downloadUrl} target="_blank" rel="noopener noreferrer">
              <FileDown className="mr-1 h-4 w-4" /> PDF
            </a>
          </Button>
        ) : (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <ExternalLink className="mr-1 h-3 w-3" /> im Modul
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Berichtsarchiv"
        description="Zentrale Sicht auf alle eingefrorenen Nachweise — Auditberichte, Managementbewertungen, PMS-Berichte, Konformitätserklärungen, Kalibrierzertifikate, Wareneingangsprüfungen"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Typen</SelectItem>
            {REPORT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{REPORT_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Jahre</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="w-[240px]" placeholder="Suchen (Bezeichnung)…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {entries !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">{filtered.length} Nachweis(e)</span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(r.href)}
        emptyMessage="Keine Nachweise vorhanden"
      />
    </div>
  );
}
```

- [ ] **Step 2: Sidebar-Badge entfernen** — in `components/layout/sidebar.tsx` den Berichte-Eintrag ändern von:

```tsx
      { label: "Berichte", href: "/reports", icon: BarChart3, featureFlag: "REPORTS", badge: "IN PLANUNG" },
```

zu:

```tsx
      { label: "Berichte", href: "/reports", icon: BarChart3, featureFlag: "REPORTS", permission: "reports:list" },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/reports/page.tsx" components/layout/sidebar.tsx
git commit -m "feat(berichte): Archiv-Seite (Typ-/Jahres-Filter, Direkt-Download) + Sidebar live"
```

---

### Task 4: Runtime-Verifikation (Pflicht)

**Files:** keine Code-Änderungen (nur Fixes aus dem Walkthrough)

- [ ] **Step 1: Dev-Server frisch starten** (Stale-Server-Memory: alten Prozess beenden, `.next/dev/lock` entfernen)

- [ ] **Step 2: Archiv prüfen** (Login als QMB — `claude-test@`-Registrierung + `npx convex run bootstrap:setUserRoleByEmail '{"email":"…","role":"qmb"}'`)

1. Sidebar: „Berichte" ohne Badge (Gruppe „Dokumente") → Seite lädt.
2. Erwartete Bestands-Nachweise (aus den importierten Echtdaten dieser Session): **Auditbericht** „Internes Audit 2026" (eingefrorenes PDF), **Managementbewertung 2025** (Original-PDF), ggf. **PMS-Bericht** falls eingefroren. Jede Zeile mit korrektem Typ-Badge, Datum, „PDF"-Button → öffnet das Storage-PDF in neuem Tab.
3. Zähler oben („N Nachweis(e)") stimmt mit der Zeilenzahl.

- [ ] **Step 3: Filter + Sprung ins Modul prüfen**

4. Typ-Filter „Auditbericht" → nur Audits; „Managementbewertung" → nur die MgmtReview-Zeile. Jahres-Filter 2026 / 2025. Freitextsuche grenzt nach Bezeichnung ein.
5. Klick auf eine Zeile (nicht den PDF-Button) → Navigation in das Quell-Modul (z. B. `/management-review/[id]`).
6. „PDF"-Button stoppt die Zeilen-Navigation (öffnet nur das PDF) — Klick öffnet das Dokument, ohne zusätzlich zu navigieren.
7. Wareneingang-Eintrag (falls eine Prüfung existiert) zeigt „im Modul" statt PDF-Button und führt per Zeilenklick auf `/incoming-goods/[id]`. Konsole ohne Fehler.

- [ ] **Step 4: Befunde fixen + Commit**

```bash
git add -A
git commit -m "fix(berichte): Findings aus Runtime-Walkthrough"
```

(Entfällt, wenn der Walkthrough sauber durchläuft.)

---

## Bewusst NICHT in diesem Plan

- **KPI-/Kennzahlen-Auswertungen & Trendanalysen** — Beschluss: „spätere Ausbaustufe". Das Archiv liefert zuerst nur die Dokumentensicht.
- **Eigene Storage-Kopien / Re-Generierung** — das Archiv verlinkt die in den Modulen bereits eingefrorenen Dateien, dupliziert nichts.
- **Serverseitige Pagination/Filter** — bei der Datenmenge einer 30-MA-Organisation unnötig (YAGNI); im Aggregator als bekannte Decke kommentiert.
- **PDF für Wareneingang im Archiv** — wird client-seitig erzeugt, daher Modul-Link statt Storage-Download (kein neues Einfrieren nur fürs Archiv).
