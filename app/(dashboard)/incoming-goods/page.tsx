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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { PRODUCT_AREAS, INCOMING_RESULT_LABELS } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";

interface CheckRow {
  _id: string;
  checkDate: number;
  locationId: string;
  locationName: string;
  manufacturer: string;
  productArea: string;
  result: "PASSED" | "FAILED";
  inspectorName?: string;
}

const RESULT_BADGE: Record<string, string> = {
  PASSED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function IncomingGoodsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const checks = useQuery(api.incomingGoods.list, {});

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const status = useQuery(api.incomingGoods.monthlyStatus, { year });

  const [filterLocation, setFilterLocation] = useState("ALL");
  const [filterArea, setFilterArea] = useState("ALL");
  const [search, setSearch] = useState("");

  const locations = Array.from(
    new Map(((checks ?? []) as CheckRow[]).map((c) => [c.locationId, c.locationName])).entries(),
  );

  const filtered = ((checks ?? []) as CheckRow[]).filter((c) => {
    if (filterLocation !== "ALL" && c.locationId !== filterLocation) return false;
    if (filterArea !== "ALL" && c.productArea !== filterArea) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${c.manufacturer} ${c.locationName} ${c.productArea} ${c.inspectorName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const columns: Column<CheckRow>[] = [
    { key: "date", header: "Prüfdatum", cell: (r) => formatDate(r.checkDate) },
    { key: "location", header: "Filiale", cell: (r) => <span className="font-medium">{r.locationName}</span> },
    { key: "manufacturer", header: "Hersteller", cell: (r) => r.manufacturer },
    { key: "area", header: "Produktbereich", cell: (r) => r.productArea },
    {
      key: "result", header: "Ergebnis",
      cell: (r) => (
        <Badge className={RESULT_BADGE[r.result]} variant="secondary">
          {r.result === "PASSED" ? "freigegeben" : "gesperrt"}
        </Badge>
      ),
    },
    { key: "inspector", header: "Prüfer/in", cell: (r) => r.inspectorName ?? "—" },
  ];

  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wareneingangsprüfung"
        description="Prüfpflichten des Händlers nach Art. 14 MDR (AA 7.4.3) — Stichprobe je Filiale, 1–2× monatlich"
        actions={
          can("incomingGoods:record") ? (
            <Button onClick={() => router.push("/incoming-goods/new")}>
              <Plus className="mr-2 h-4 w-4" /> Neue Prüfung
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="checks">
        <TabsList>
          <TabsTrigger value="checks">Prüfungen</TabsTrigger>
          <TabsTrigger value="status">Monats-Ampel</TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="space-y-4">
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Filialen</SelectItem>
                {locations.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Produktbereiche</SelectItem>
                {PRODUCT_AREAS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="w-[240px]" placeholder="Suchen (Hersteller, Filiale…)"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(r) => router.push(`/incoming-goods/${r._id}`)}
            emptyMessage="Noch keine Wareneingangsprüfungen erfasst"
          />
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="mt-2 flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Zahl = erfasste Prüfungen im Monat · ab dem 15. ohne Prüfung gehen wöchentliche Erinnerungen an die Filiale
            </p>
          </div>
          {status === undefined ? (
            <div className="p-8 text-muted-foreground">Lade…</div>
          ) : status.rows.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-muted-foreground">
              Keine Filialen angelegt — Standorte in der Verwaltung pflegen.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Filiale</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="w-12 px-2 py-2 text-center font-medium">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status.rows.map((row) => (
                    <tr key={row.locationId} className="border-b">
                      <td className="px-3 py-2 font-medium">
                        {row.name}
                        {!row.hasReminderEmails && (
                          <span className="ml-2 text-xs text-amber-600" title="Keine Erinnerungs-E-Mail hinterlegt (Verwaltung → Standorte)">
                            ohne E-Mail
                          </span>
                        )}
                      </td>
                      {row.months.map((count, idx) => {
                        const month = idx + 1;
                        const isPast = year < currentYear || (year === currentYear && month < currentMonth);
                        const isCurrent = year === currentYear && month === currentMonth;
                        const cls =
                          count > 0
                            ? "bg-green-100 text-green-800"
                            : isPast
                              ? "bg-red-100 text-red-800"
                              : isCurrent
                                ? "bg-amber-100 text-amber-800"
                                : "text-muted-foreground";
                        return (
                          <td key={month} className="px-1 py-1 text-center">
                            <span className={`inline-block w-8 rounded py-0.5 text-xs font-medium ${cls}`}>
                              {count > 0 ? count : isPast || isCurrent ? "0" : "—"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
