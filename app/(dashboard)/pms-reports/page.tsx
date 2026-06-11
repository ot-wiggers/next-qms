"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface PmsReportRow {
  _id: string;
  year: number;
  reportingPeriod: string;
  productGroup: string;
  revision: number;
  status: string;
  approvedAt?: number;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  APPROVED: "Freigegeben",
};

export default function PmsReportListPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const reports = useQuery(api.pmsReports.list, {});
  const createDraft = useMutation(api.pmsReports.createDraft);

  // PMS ist retrospektiv: Default = Vorjahr
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));

  async function handleCreate() {
    const yearNum = Number(year);
    if (!Number.isInteger(yearNum) || yearNum < 2020 || yearNum > 2100) {
      toast.error("Bitte ein gültiges Jahr eingeben");
      return;
    }
    try {
      const id = await createDraft({ year: yearNum });
      setOpen(false);
      toast.success("PMS-Bericht angelegt");
      router.push(`/pms-reports/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<PmsReportRow>[] = [
    { key: "year", header: "Jahr", cell: (r) => <span className="font-mono font-medium">{r.year}</span> },
    { key: "reportingPeriod", header: "Berichtszeitraum", cell: (r) => r.reportingPeriod },
    {
      key: "productGroup", header: "Produktgruppe",
      cell: (r) => (
        <span className="block max-w-xs truncate" title={r.productGroup}>
          {r.productGroup}
        </span>
      ),
    },
    { key: "revision", header: "Revision", cell: (r) => <span className="font-mono">{r.revision}</span> },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge className={STATUS_COLOR[r.status] ?? ""} variant="secondary">
          {STATUS_LABEL[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "approvedAt", header: "Freigegeben am",
      cell: (r) => (r.approvedAt ? formatDate(r.approvedAt) : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="PMS-Berichte"
        description="Überwachung nach dem Inverkehrbringen gemäß MDR Art. 85 (FB 7 1)"
        actions={
          can("pmsReports:manage") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Bericht anlegen
            </Button>
          ) : undefined
        }
      />

      {reports === undefined ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : (
        <DataTable
          columns={columns}
          data={reports as PmsReportRow[]}
          onRowClick={(r) => router.push(`/pms-reports/${r._id}`)}
          emptyMessage="Keine PMS-Berichte vorhanden."
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PMS-Bericht anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pms-year">Berichtsjahr</Label>
              <Input
                id="pms-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Der PMS-Bericht blickt zurück — Standard ist das Vorjahr.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate}>Anlegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
