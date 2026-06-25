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
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  DEVICE_AMPEL_LABELS, DEVICE_STATUS_LABELS,
  type DeviceAmpel, type DeviceStatus,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { DeviceFormDialog } from "@/components/domain/devices/device-form-dialog";
import { Plus } from "lucide-react";

interface DeviceRow {
  _id: string;
  inventoryNumber: string;
  name: string;
  location?: string;
  responsible?: string;
  calibrationIntervalMonths: number;
  lastCalibrationDate?: number;
  nextDueDate?: number;
  status: DeviceStatus;
  ampel: DeviceAmpel;
}

const AMPEL_BADGE: Record<DeviceAmpel, string> = {
  OK: "bg-green-100 text-green-800",
  DUE: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  UNSCHEDULED: "bg-blue-100 text-blue-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-600",
};

export default function DevicesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const devices = useQuery(api.devices.list, {});
  const summary = useQuery(api.devices.summary, {});

  const [createOpen, setCreateOpen] = useState(false);
  const [filterAmpel, setFilterAmpel] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = ((devices ?? []) as DeviceRow[]).filter((d) => {
    if (filterAmpel !== "ALL" && d.ampel !== filterAmpel) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${d.inventoryNumber} ${d.name} ${d.location ?? ""} ${d.responsible ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const columns: Column<DeviceRow>[] = [
    { key: "inv", header: "Prüfmittel-Nr.", cell: (r) => <span className="font-mono text-sm">{r.inventoryNumber}</span> },
    { key: "name", header: "Bezeichnung", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "location", header: "Standort", cell: (r) => r.location ?? "—" },
    { key: "interval", header: "Intervall", cell: (r) => `${r.calibrationIntervalMonths} Mon.` },
    { key: "last", header: "Letzte Kal.", cell: (r) => (r.lastCalibrationDate ? formatDate(r.lastCalibrationDate) : "—") },
    { key: "next", header: "Soll-Termin", cell: (r) => (r.nextDueDate ? formatDate(r.nextDueDate) : "—") },
    {
      key: "ampel", header: "Status",
      cell: (r) => (
        <Badge className={AMPEL_BADGE[r.ampel]} variant="secondary">
          {DEVICE_AMPEL_LABELS[r.ampel]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prüfmittel"
        description="Lenkung von Überwachungs- und Messmitteln (ISO 13485 §7.6, FB 7.6.0) — Kalibrierintervalle & Fälligkeiten"
        actions={
          can("devices:manage") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Prüfmittel anlegen
            </Button>
          ) : undefined
        }
      />

      {/* Ampel-Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-red-50 p-3">
            <p className="text-2xl font-semibold text-red-800">{summary.overdue}</p>
            <p className="text-xs text-red-700">überfällig</p>
          </div>
          <div className="rounded-md border bg-amber-50 p-3">
            <p className="text-2xl font-semibold text-amber-800">{summary.due}</p>
            <p className="text-xs text-amber-700">fällig (±30 Tage)</p>
          </div>
          <div className="rounded-md border bg-green-50 p-3">
            <p className="text-2xl font-semibold text-green-800">{summary.ok}</p>
            <p className="text-xs text-green-700">im Intervall</p>
          </div>
          <div className="rounded-md border bg-muted p-3">
            <p className="text-2xl font-semibold">{summary.unscheduled + summary.decommissioned}</p>
            <p className="text-xs text-muted-foreground">ungeplant / außer Dienst</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterAmpel} onValueChange={setFilterAmpel}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            {(Object.keys(DEVICE_AMPEL_LABELS) as DeviceAmpel[]).map((a) => (
              <SelectItem key={a} value={a}>{DEVICE_AMPEL_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="w-[240px]" placeholder="Suchen (Nr., Bezeichnung, Standort…)"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/devices/${r._id}`)}
        emptyMessage="Noch keine Prüfmittel erfasst"
      />

      <DeviceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => router.push(`/devices/${id}`)}
      />
    </div>
  );
}
