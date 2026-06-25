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
  _id: string; // ponytail: DataTable keyt/constraint auf _id — aus key abgeleitet
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

  const all = (entries ?? []).map((e) => ({ ...e, _id: e.key })) as ArchiveEntry[];
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
