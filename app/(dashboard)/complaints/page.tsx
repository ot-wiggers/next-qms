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
  COMPLAINT_STATUSES, COMPLAINT_STATUS_LABELS, type ComplaintStatus,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ComplaintRow {
  _id: string;
  complaintNumber: string;
  title: string;
  receivedAt: number;
  productText?: string;
  status: string;
  isVigilanceRelevant: boolean;
  vigilanceDeadline?: number;
  vigilanceReportedAt?: number;
}

const COMPLAINT_STATUS_COLOR: Record<string, string> = {
  RECEIVED: "bg-red-100 text-red-800",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  CLOSED: "bg-green-100 text-green-800",
};

export default function ComplaintsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const complaints = useQuery(api.complaints.list,
    statusFilter === "ALL" ? {} : { status: statusFilter });
  const createComplaint = useMutation(api.complaints.create);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "",
    description: "",
    receivedAt: today,
    receivedVia: "",
    customerName: "",
    productText: "",
    failureCategory: "",
    otwinRef: "",
  });

  async function handleCreate() {
    if (!form.title.trim()) { toast.error("Titel ist erforderlich"); return; }
    const receivedAtMs = new Date(form.receivedAt).getTime();
    if (receivedAtMs > Date.now()) { toast.error("Eingangsdatum liegt in der Zukunft"); return; }
    try {
      const id = await createComplaint({
        title: form.title.trim(),
        description: form.description || undefined,
        receivedAt: receivedAtMs,
        receivedVia: form.receivedVia || undefined,
        customerName: form.customerName || undefined,
        productText: form.productText || undefined,
        failureCategory: form.failureCategory || undefined,
        otwinRef: form.otwinRef || undefined,
      });
      setOpen(false);
      router.push(`/complaints/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    }
  }

  const columns: Column<ComplaintRow>[] = [
    {
      key: "number",
      header: "Nummer",
      cell: (r) => <span className="font-mono">{r.complaintNumber}</span>,
    },
    {
      key: "receivedAt",
      header: "Eingang",
      cell: (r) => formatDate(r.receivedAt),
    },
    {
      key: "title",
      header: "Titel",
      cell: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      key: "product",
      header: "Produkt",
      cell: (r) => r.productText ?? "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge className={COMPLAINT_STATUS_COLOR[r.status] ?? ""} variant="secondary">
          {COMPLAINT_STATUS_LABELS[r.status as ComplaintStatus] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "vigilance",
      header: "Vigilanz",
      cell: (r) => {
        if (!r.isVigilanceRelevant) return "—";
        const overdue =
          r.vigilanceDeadline !== undefined &&
          r.vigilanceDeadline < Date.now() &&
          !r.vigilanceReportedAt;
        if (overdue) {
          return (
            <Badge className="bg-red-100 text-red-800" variant="secondary">
              Frist {formatDate(r.vigilanceDeadline!)}!
            </Badge>
          );
        }
        if (r.vigilanceReportedAt) {
          return (
            <Badge className="bg-green-100 text-green-800" variant="secondary">
              Gemeldet
            </Badge>
          );
        }
        return (
          <Badge className="bg-purple-100 text-purple-800" variant="secondary">
            Frist {r.vigilanceDeadline !== undefined ? formatDate(r.vigilanceDeadline) : "—"}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reklamationen"
        description="ISO 13485 Kap. 8.2.2 / MDR Art. 87 — Nummernkreis REK-Jahr-Nr."
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Status</SelectItem>
                {COMPLAINT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{COMPLAINT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("complaints:create") && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Reklamation anlegen
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={(complaints ?? []) as ComplaintRow[]}
        onRowClick={(r) => router.push(`/complaints/${r._id}`)}
        emptyMessage="Keine Reklamationen vorhanden"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reklamation anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rtitle">Titel</Label>
              <Input
                id="rtitle"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rdesc">Beschreibung</Label>
              <Textarea
                id="rdesc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rreceivedAt">Eingangsdatum</Label>
              <Input
                id="rreceivedAt"
                type="date"
                value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rreceivedVia">Eingang über</Label>
              <Input
                id="rreceivedVia"
                value={form.receivedVia}
                onChange={(e) => setForm({ ...form, receivedVia: e.target.value })}
                placeholder="Filiale, Telefon, E-Mail …"
              />
            </div>
            <div>
              <Label htmlFor="rcustomer">Kunde</Label>
              <Input
                id="rcustomer"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rproduct">Produkt</Label>
              <Input
                id="rproduct"
                value={form.productText}
                onChange={(e) => setForm({ ...form, productText: e.target.value })}
                placeholder="Produktbezeichnung — Stammdaten-Verknüpfung im Detail"
              />
            </div>
            <div>
              <Label htmlFor="rfailure">Fehlerkategorie</Label>
              <Input
                id="rfailure"
                value={form.failureCategory}
                onChange={(e) => setForm({ ...form, failureCategory: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rotwin">OTWin-Referenz</Label>
              <Input
                id="rotwin"
                value={form.otwinRef}
                onChange={(e) => setForm({ ...form, otwinRef: e.target.value })}
                placeholder="OTWin-Vorgangsnummer (optional)"
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
