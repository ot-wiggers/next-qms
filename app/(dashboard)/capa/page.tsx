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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  CAPA_STATUS_LABELS, CAPA_TYPE_LABELS, CAPA_SOURCE_TYPE_LABELS, CAPA_STATUSES,
  type CapaStatus, type CapaType, type CapaSourceType,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CapaRow {
  _id: string;
  capaNumber: string;
  title: string;
  capaType: string;
  sourceType: string;
  status: string;
  dueAt?: number;
}

const CAPA_STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-red-100 text-red-800",
  ANALYSIS: "bg-amber-100 text-amber-800",
  MEASURES_DEFINED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  EFFECTIVENESS_CHECK: "bg-purple-100 text-purple-800",
  CLOSED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function CapaPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const capas = useQuery(api.capas.list,
    statusFilter === "ALL" ? {} : { status: statusFilter });
  const createCapa = useMutation(api.capas.create);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", responsible: "", effectivenessCriterion: "",
    capaType: "CORRECTIVE" as CapaType,
    sourceType: "MANUAL" as CapaSourceType,
  });

  async function handleCreate() {
    if (!form.title.trim()) { toast.error("Titel ist erforderlich"); return; }
    try {
      const id = await createCapa({
        title: form.title.trim(),
        description: form.description || undefined,
        responsible: form.responsible || undefined,
        effectivenessCriterion: form.effectivenessCriterion || undefined,
        capaType: form.capaType,
        sourceType: form.sourceType,
      });
      setOpen(false);
      router.push(`/capa/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<CapaRow>[] = [
    { key: "number", header: "Nummer", cell: (r) => <span className="font-mono">{r.capaNumber}</span> },
    { key: "title", header: "Titel", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "type", header: "Typ", cell: (r) => CAPA_TYPE_LABELS[r.capaType as CapaType] ?? r.capaType },
    { key: "source", header: "Quelle", cell: (r) => CAPA_SOURCE_TYPE_LABELS[r.sourceType as CapaSourceType] ?? r.sourceType },
    {
      key: "status", header: "Status",
      cell: (r) => (
        <Badge className={CAPA_STATUS_COLOR[r.status] ?? ""} variant="secondary">
          {CAPA_STATUS_LABELS[r.status as CapaStatus] ?? r.status}
        </Badge>
      ),
    },
    { key: "due", header: "Fällig", cell: (r) => (r.dueAt ? formatDate(r.dueAt) : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="CAPA — Korrektur- & Vorbeugemaßnahmen"
        description="ISO 13485 Kap. 8.5.2 / 8.5.3 — Nummernkreis CAPA-Jahr-Nr."
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Status</SelectItem>
                {CAPA_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{CAPA_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("capa:create") && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> CAPA anlegen
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={(capas ?? []) as CapaRow[]}
        onRowClick={(r) => router.push(`/capa/${r._id}`)}
        emptyMessage="Keine CAPAs vorhanden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>CAPA anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ctitle">Titel</Label>
              <Input id="ctitle" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cdesc">Beschreibung</Label>
              <Textarea id="cdesc" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Typ</Label>
                <Select value={form.capaType}
                  onValueChange={(v) => setForm({ ...form, capaType: v as CapaType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAPA_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quelle</Label>
                <Select value={form.sourceType}
                  onValueChange={(v) => setForm({ ...form, sourceType: v as CapaSourceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAPA_SOURCE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="cresp">Verantwortlich (Rolle/Bereich)</Label>
              <Input id="cresp" value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                placeholder="z.B. BDL / IT" />
            </div>
            <div>
              <Label htmlFor="ccrit">Wirksamkeitskriterium (vorab definieren)</Label>
              <Textarea id="ccrit" rows={2} value={form.effectivenessCriterion}
                onChange={(e) => setForm({ ...form, effectivenessCriterion: e.target.value })}
                placeholder='z.B. "Q3/Q4-Auswertung &#8805; 95&#160;%"' />
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
