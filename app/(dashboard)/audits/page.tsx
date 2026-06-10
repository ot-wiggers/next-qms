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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  AUDIT_STATUS_LABELS, AUDIT_TYPE_LABELS, type AuditStatus, type AuditType,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AuditRow {
  _id: string;
  title: string;
  auditYear: number;
  auditType: string;
  status: string;
  auditDate?: number;
  templateVersion?: number;
}

const STATUS_VARIANT: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  REPORT_DRAFT: "bg-purple-100 text-purple-800",
  CLOSED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function AuditsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const audits = useQuery(api.audits.list, {});
  const createAudit = useMutation(api.audits.create);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    auditYear: new Date().getFullYear(),
    auditType: "INTERNAL" as AuditType,
    auditTeam: "",
    location: "",
    reportingPeriod: "",
    plannedFor: "",
  });

  async function handleCreate() {
    if (!form.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    if (!Number.isInteger(form.auditYear) || form.auditYear < 2000 || form.auditYear > 2100) {
      toast.error("Ungültiges Jahr");
      return;
    }
    try {
      const id = await createAudit({
        title: form.title.trim(),
        auditYear: form.auditYear,
        auditType: form.auditType,
        auditTeam: form.auditTeam || undefined,
        location: form.location || undefined,
        reportingPeriod: form.reportingPeriod || undefined,
        plannedFor: form.plannedFor || undefined,
      });
      setOpen(false);
      toast.success("Audit angelegt — Checkliste wurde eingefroren");
      router.push(`/audits/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<AuditRow>[] = [
    { key: "title", header: "Titel", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "year", header: "Jahr", cell: (r) => r.auditYear },
    { key: "type", header: "Typ", cell: (r) => AUDIT_TYPE_LABELS[r.auditType as AuditType] ?? r.auditType },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge className={STATUS_VARIANT[r.status] ?? ""} variant="secondary">
          {AUDIT_STATUS_LABELS[r.status as AuditStatus] ?? r.status}
        </Badge>
      ),
    },
    { key: "date", header: "Auditdatum", cell: (r) => (r.auditDate ? formatDate(r.auditDate) : "—") },
    { key: "tpl", header: "Checkliste", cell: (r) => (r.templateVersion ? `v${r.templateVersion}` : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interne Audits"
        description="Planung, Durchführung und Nachverfolgung interner Audits (ISO 13485 Kap. 8.2.4)"
        actions={
          can("audits:manage") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Audit anlegen
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={(audits ?? []) as AuditRow[]}
        onRowClick={(r) => router.push(`/audits/${r._id}`)}
        emptyMessage="Noch keine Audits vorhanden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Audit anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titel</Label>
              <Input id="title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={`Internes Audit ${form.auditYear}`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Jahr</Label>
                <Input id="year" type="number" value={form.auditYear}
                  onChange={(e) => setForm({ ...form, auditYear: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={form.auditType}
                  onValueChange={(v) => setForm({ ...form, auditType: v as AuditType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="team">Auditteam</Label>
              <Input id="team" value={form.auditTeam}
                onChange={(e) => setForm({ ...form, auditTeam: e.target.value })}
                placeholder="Leitender Auditor, Fachexperten …" />
            </div>
            <div>
              <Label htmlFor="loc">Standort</Label>
              <Input id="loc" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="period">Berichtszeitraum</Label>
                <Input id="period" value={form.reportingPeriod}
                  onChange={(e) => setForm({ ...form, reportingPeriod: e.target.value })}
                  placeholder="01.01.2025 – 31.12.2025" />
              </div>
              <div>
                <Label htmlFor="planned">Geplant für</Label>
                <Input id="planned" value={form.plannedFor}
                  onChange={(e) => setForm({ ...form, plannedFor: e.target.value })}
                  placeholder="05/2026" />
              </div>
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
