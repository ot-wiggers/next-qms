"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_ASSESSMENT_LABELS,
  type ComplaintStatus,
  type ComplaintAssessment,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { toast } from "sonner";

const STATUS_COLOR: Record<ComplaintStatus, string> = {
  RECEIVED: "bg-red-100 text-red-800",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  CLOSED: "bg-green-100 text-green-800",
};

const ASSESSMENT_COLOR: Record<ComplaintAssessment, string> = {
  JUSTIFIED: "bg-amber-100 text-amber-800",
  UNJUSTIFIED: "bg-gray-100 text-gray-800",
  GOODWILL: "bg-blue-100 text-blue-800",
};

const NEXT: Partial<Record<ComplaintStatus, { to: string; label: string }[]>> = {
  RECEIVED: [{ to: "IN_REVIEW", label: "Prüfung starten" }],
  IN_REVIEW: [{ to: "IN_PROGRESS", label: "In Bearbeitung" }, { to: "CLOSED", label: "Abschließen" }],
  IN_PROGRESS: [{ to: "CLOSED", label: "Abschließen" }],
};

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const complaintId = params.id as Id<"complaints">;
  const { can } = usePermissions();

  const complaint = useQuery(api.complaints.getById, { id: complaintId });
  const products = useQuery(api.products.list, {});
  const update = useMutation(api.complaints.update);
  const assess = useMutation(api.complaints.assess);
  const recordVigilanceReport = useMutation(api.complaints.recordVigilanceReport);
  const setStatus = useMutation(api.complaints.setStatus);
  const createFromComplaint = useMutation(api.capas.createFromComplaint);

  // Keyed-draft pattern: Entwurfstext mit zugehöriger Complaint-ID versionieren
  const [correctionDraft, setCorrectionDraft] = useState<{ id: string; text: string } | null>(null);
  const correctionText = correctionDraft?.id === complaintId ? correctionDraft.text : null;
  const setCorrectionText = (text: string) => setCorrectionDraft({ id: complaintId, text });

  // Bewertungs-Dialog
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessForm, setAssessForm] = useState<{
    assessment: ComplaintAssessment;
    note: string;
    vigilance: boolean;
    deadline: string;
  }>({
    assessment: "JUSTIFIED",
    note: "",
    vigilance: false,
    deadline: "",
  });

  // Vigilanz-Meldungs-Dialog
  const [vigilanceOpen, setVigilanceOpen] = useState(false);
  const [vigilanceForm, setVigilanceForm] = useState({
    reportedAt: new Date().toISOString().slice(0, 10),
    reference: "",
    channel: "",
  });

  // Capture timestamp before render to avoid stale comparisons across re-renders
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  if (complaint === undefined) return <div className="p-8 text-muted-foreground">Lade&hellip;</div>;
  if (complaint === null) return <div className="p-8">Reklamation nicht gefunden.</div>;

  const canManage = can("complaints:manage");
  const canClose = can("complaints:close");
  const closed = complaint.status === "CLOSED";

  function openAssessDialog() {
    const defaultDeadline = new Date(complaint!.receivedAt + 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setAssessForm({
      assessment: (complaint!.assessment as ComplaintAssessment) ?? "JUSTIFIED",
      note: complaint!.assessmentNote ?? "",
      vigilance: complaint!.isVigilanceRelevant ?? false,
      deadline: complaint!.vigilanceDeadline
        ? new Date(complaint!.vigilanceDeadline).toISOString().slice(0, 10)
        : defaultDeadline,
    });
    setAssessOpen(true);
  }

  async function transition(to: string) {
    try {
      await setStatus({ id: complaintId, status: to });
      toast.success("Status geändert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleAssess() {
    try {
      await assess({
        id: complaintId,
        assessment: assessForm.assessment,
        assessmentNote: assessForm.note.trim() || undefined,
        isVigilanceRelevant: assessForm.vigilance,
        vigilanceDeadline: assessForm.vigilance && assessForm.deadline
          ? new Date(assessForm.deadline).getTime()
          : undefined,
      });
      setAssessOpen(false);
      toast.success("Bewertung gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleVigilanceReport() {
    try {
      await recordVigilanceReport({
        id: complaintId,
        vigilanceReportedAt: new Date(vigilanceForm.reportedAt).getTime(),
        vigilanceReportReference: vigilanceForm.reference.trim() || undefined,
        vigilanceReportChannel: vigilanceForm.channel.trim() || undefined,
      });
      setVigilanceOpen(false);
      toast.success("Vigilanz-Meldung dokumentiert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleCreateCapa() {
    try {
      await createFromComplaint({ complaintId, capaType: "CORRECTIVE" });
      toast.success("CAPA-Vorschlag angelegt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  const receivedViaText = complaint.receivedVia ? ` über ${complaint.receivedVia}` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${complaint.complaintNumber} — ${complaint.title}`}
        description={`Eingang ${formatDate(complaint.receivedAt)}${receivedViaText}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className={STATUS_COLOR[complaint.status as ComplaintStatus] ?? ""}
            >
              {COMPLAINT_STATUS_LABELS[complaint.status as ComplaintStatus] ?? complaint.status}
            </Badge>
            {canManage && (NEXT[complaint.status as ComplaintStatus] ?? []).map((t) => {
              const isClose = t.to === "CLOSED";
              if (isClose && !canClose) return null;
              const closeDisabled = isClose && (
                !complaint.assessment ||
                (complaint.isVigilanceRelevant && !complaint.vigilanceReportedAt)
              );
              return (
                <Button
                  key={t.to}
                  size="sm"
                  variant="default"
                  disabled={!!closeDisabled}
                  onClick={() => transition(t.to)}
                >
                  {t.label}
                </Button>
              );
            })}
          </div>
        }
      />

      {/* Stammdaten-Karte */}
      <Card>
        <CardHeader><CardTitle>Reklamation</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {complaint.description && (
            <p className="whitespace-pre-wrap">{complaint.description}</p>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <span className="text-muted-foreground">Kunde: </span>
              {complaint.customerName ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Fehlerkategorie: </span>
              {complaint.failureCategory ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">OTWin-Ref: </span>
              {complaint.otwinRef ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Produkt: </span>
              {complaint.productId
                ? (complaint.productName ?? "—")
                : (complaint.productText ?? "—")}
            </div>
          </div>

          {/* Produkt-Select (nur wenn nicht CLOSED und canManage) */}
          {!closed && canManage && (
            <div className="max-w-xs space-y-1">
              <Label htmlFor="product-select">Produkt zuordnen</Label>
              <Select
                value={complaint.productId ?? ""}
                onValueChange={async (val) => {
                  try {
                    await update({ id: complaintId, productId: val as Id<"products"> });
                    toast.success("Produkt gespeichert");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Fehler");
                  }
                }}
              >
                <SelectTrigger id="product-select">
                  <SelectValue placeholder="Produkt wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}{p.articleNumber ? ` (${p.articleNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sofortkorrektur-Textarea */}
          <div>
            <Label htmlFor="correction">Sofortkorrektur</Label>
            <Textarea
              id="correction"
              rows={3}
              value={correctionText ?? complaint.correctionNote ?? ""}
              onChange={(e) => setCorrectionText(e.target.value)}
              disabled={closed || !canManage}
            />
            {!closed && canManage && (
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await update({
                      id: complaintId,
                      correctionNote: correctionText ?? complaint.correctionNote ?? "",
                    });
                    toast.success("Sofortkorrektur gespeichert");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Fehler");
                  }
                }}
              >
                Speichern
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bewertungs-Karte */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bewertung (8.2.2)</CardTitle>
          {canManage && !closed && (
            <Button size="sm" onClick={openAssessDialog}>Bewerten</Button>
          )}
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {complaint.assessment ? (
            <>
              <Badge
                variant="secondary"
                className={ASSESSMENT_COLOR[complaint.assessment as ComplaintAssessment] ?? ""}
              >
                {COMPLAINT_ASSESSMENT_LABELS[complaint.assessment as ComplaintAssessment] ?? complaint.assessment}
              </Badge>
              {complaint.assessmentNote && (
                <p className="whitespace-pre-wrap">{complaint.assessmentNote}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Noch nicht bewertet &mdash; Abschluss erst nach dokumentierter Bewertung m&ouml;glich.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vigilanz-Karte (nur wenn vigilanzrelevant) */}
      {complaint.isVigilanceRelevant && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Vigilanz (MDR Art. 87)</CardTitle>
            {canManage && !complaint.vigilanceReportedAt && !closed && (
              <Button size="sm" onClick={() => {
                setVigilanceForm({
                  reportedAt: new Date().toISOString().slice(0, 10),
                  reference: "",
                  channel: "",
                });
                setVigilanceOpen(true);
              }}>
                Meldung dokumentieren
              </Button>
            )}
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {complaint.vigilanceDeadline && (
              <p>
                <span className="text-muted-foreground">Meldefrist: </span>
                {formatDate(complaint.vigilanceDeadline)}
              </p>
            )}
            {complaint.vigilanceDeadline &&
              complaint.vigilanceDeadline < now &&
              !complaint.vigilanceReportedAt && (
                <p className="text-red-600 font-medium">
                  Meldefrist &uuml;berschritten &mdash; unverz&uuml;glich melden!
                </p>
              )}
            {complaint.vigilanceReportedAt ? (
              <div className="space-y-1">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Gemeldet am {formatDate(complaint.vigilanceReportedAt)}
                  {complaint.vigilanceDeadline
                    ? complaint.vigilanceReportedAt <= complaint.vigilanceDeadline
                      ? " (fristgerecht)"
                      : " (verspätet)"
                    : ""}
                </Badge>
                {complaint.vigilanceReportReference && (
                  <p>
                    <span className="text-muted-foreground">Referenz: </span>
                    {complaint.vigilanceReportReference}
                  </p>
                )}
                {complaint.vigilanceReportChannel && (
                  <p>
                    <span className="text-muted-foreground">Meldeweg: </span>
                    {complaint.vigilanceReportChannel}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Noch keine Meldung dokumentiert.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* CAPA-Karte */}
      <Card>
        <CardHeader><CardTitle>CAPA</CardTitle></CardHeader>
        <CardContent>
          {complaint.capaId ? (
            <Button variant="outline" asChild>
              <Link href={`/capa/${complaint.capaId}`}>
                CAPA {complaint.capaNumber ?? complaint.capaId}
              </Link>
            </Button>
          ) : can("capa:create") && !closed ? (
            <Button onClick={handleCreateCapa}>CAPA anlegen</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Keine CAPA verkn&uuml;pft.</p>
          )}
        </CardContent>
      </Card>

      {/* Bewertungs-Dialog */}
      <Dialog open={assessOpen} onOpenChange={setAssessOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reklamation bewerten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bewertung</Label>
              <Select
                value={assessForm.assessment}
                onValueChange={(v) =>
                  setAssessForm({ ...assessForm, assessment: v as ComplaintAssessment })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JUSTIFIED">Berechtigt</SelectItem>
                  <SelectItem value="UNJUSTIFIED">Unberechtigt</SelectItem>
                  <SelectItem value="GOODWILL">Kulanz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="assess-note">Begr&uuml;ndung</Label>
              <Textarea
                id="assess-note"
                rows={3}
                value={assessForm.note}
                onChange={(e) => setAssessForm({ ...assessForm, note: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="vigilance-check"
                checked={assessForm.vigilance}
                onCheckedChange={(checked) =>
                  setAssessForm({ ...assessForm, vigilance: !!checked })
                }
              />
              <Label htmlFor="vigilance-check">Vigilanzrelevant (MDR Art. 87)</Label>
            </div>
            {assessForm.vigilance && (
              <div>
                <Label htmlFor="vigilance-deadline">Meldefrist</Label>
                <Input
                  id="vigilance-deadline"
                  type="date"
                  value={assessForm.deadline}
                  onChange={(e) => setAssessForm({ ...assessForm, deadline: e.target.value })}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssessOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAssess}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vigilanz-Meldungs-Dialog */}
      <Dialog open={vigilanceOpen} onOpenChange={setVigilanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vigilanz-Meldung dokumentieren</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="vig-date">Gemeldet am</Label>
              <Input
                id="vig-date"
                type="date"
                value={vigilanceForm.reportedAt}
                onChange={(e) => setVigilanceForm({ ...vigilanceForm, reportedAt: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="vig-ref">Referenz</Label>
              <Input
                id="vig-ref"
                value={vigilanceForm.reference}
                onChange={(e) => setVigilanceForm({ ...vigilanceForm, reference: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="vig-channel">Meldeweg</Label>
              <Input
                id="vig-channel"
                placeholder="BfArM-Portal, Hersteller …"
                value={vigilanceForm.channel}
                onChange={(e) => setVigilanceForm({ ...vigilanceForm, channel: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVigilanceOpen(false)}>Abbrechen</Button>
              <Button onClick={handleVigilanceReport}>Dokumentieren</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
