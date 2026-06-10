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
import {
  MGMT_REVIEW_STATUS_LABELS,
  type MgmtReviewStatus,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ReviewRow {
  _id: string;
  year: number;
  reportingPeriod: string;
  status: string;
  approvedAt?: number;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
};

export default function MgmtReviewListPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const reviews = useQuery(api.managementReviews.list, {});
  const createDraft = useMutation(api.managementReviews.createDraft);

  const currentYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    year: String(currentYear),
    reportingPeriod: `01.01.${currentYear} – 31.12.${currentYear}`,
    participants: "",
    companyNote: "",
  });

  function handleYearChange(value: string) {
    const numVal = Number(value);
    setForm((f) => ({
      ...f,
      year: value,
      reportingPeriod: Number.isInteger(numVal) && numVal > 1900
        ? `01.01.${numVal} – 31.12.${numVal}`
        : f.reportingPeriod,
    }));
  }

  async function handleCreate() {
    const yearNum = Number(form.year);
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      toast.error("Bitte ein gültiges Jahr eingeben");
      return;
    }
    if (!form.reportingPeriod.trim()) {
      toast.error("Berichtszeitraum ist erforderlich");
      return;
    }
    try {
      const id = await createDraft({
        year: yearNum,
        reportingPeriod: form.reportingPeriod.trim(),
        participants: form.participants || undefined,
        companyNote: form.companyNote || undefined,
      });
      setOpen(false);
      router.push(`/management-review/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<ReviewRow>[] = [
    { key: "year", header: "Jahr", cell: (r) => <span className="font-mono font-medium">{r.year}</span> },
    { key: "reportingPeriod", header: "Berichtszeitraum", cell: (r) => r.reportingPeriod },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge className={STATUS_COLOR[r.status] ?? ""} variant="secondary">
          {MGMT_REVIEW_STATUS_LABELS[r.status as MgmtReviewStatus] ?? r.status}
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
        title="Managementbewertung"
        description="Bewertung durch die oberste Leitung (ISO 13485 Kap. 5.6)"
        actions={
          can("mgmtReview:manage") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Entwurf anlegen
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={(reviews ?? []) as ReviewRow[]}
        onRowClick={(r) => router.push(`/management-review/${r._id}`)}
        emptyMessage="Keine Managementbewertungen vorhanden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entwurf anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mr-year">Jahr</Label>
              <Input
                id="mr-year"
                type="number"
                value={form.year}
                onChange={(e) => handleYearChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mr-period">Berichtszeitraum</Label>
              <Input
                id="mr-period"
                value={form.reportingPeriod}
                onChange={(e) => setForm({ ...form, reportingPeriod: e.target.value })}
                placeholder="z.B. 01.01.2026 – 31.12.2026"
              />
            </div>
            <div>
              <Label htmlFor="mr-participants">Teilnehmer</Label>
              <Input
                id="mr-participants"
                value={form.participants}
                onChange={(e) => setForm({ ...form, participants: e.target.value })}
                placeholder="z.B. QMB, Geschäftsführung"
              />
            </div>
            <div>
              <Label htmlFor="mr-company">Unternehmen</Label>
              <Input
                id="mr-company"
                value={form.companyNote}
                onChange={(e) => setForm({ ...form, companyNote: e.target.value })}
              />
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
