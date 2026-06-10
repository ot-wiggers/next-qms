"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  AUDIT_STATUS_LABELS, AUDIT_RATING_LABELS, AUDIT_RATING_DESCRIPTIONS,
  FINDING_CLASSIFICATION_LABELS, AUDIT_RATINGS, FINDING_CLASSIFICATIONS,
  type AuditStatus, type AuditRating, type FindingClassification,
} from "@/lib/types/enums";
import { downloadAuditReport, auditReportBlob } from "@/lib/export/audit-report-exporter";
import { toast } from "sonner";

type Answer = {
  _id: Id<"auditChecklistAnswers">;
  chapter: string; chapterTitle: string; requirements: string;
  rating?: string; evidence?: string; sample?: string;
  interviewedWith?: string; comments?: string;
};
type Finding = {
  _id: Id<"auditFindings">;
  chapter?: string; classification: string; description: string;
  capaId?: Id<"capas">; status: string;
};

const RATING_COLOR: Record<string, string> = {
  KONFORM: "bg-green-100 text-green-800",
  ABWEICHUNG: "bg-red-100 text-red-800",
  FESTSTELLUNG: "bg-amber-100 text-amber-800",
  EMPFEHLUNG: "bg-blue-100 text-blue-800",
  NICHT_ANWENDBAR: "bg-gray-100 text-gray-600",
};

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const auditId = params.id as Id<"audits">;
  const { can } = usePermissions();

  const audit = useQuery(api.audits.getById, { id: auditId });
  const setStatus = useMutation(api.audits.setStatus);
  const updateAnswer = useMutation(api.audits.updateAnswer);
  const updateSummary = useMutation(api.audits.updateSummary);
  const generateUploadUrl = useMutation(api.audits.generateUploadUrl);
  const attachReport = useMutation(api.audits.attachReport);
  const createFinding = useMutation(api.auditFindings.create);
  const createCapaFromFinding = useMutation(api.capas.createFromFinding);

  const [editAnswer, setEditAnswer] = useState<Answer | null>(null);
  const [answerForm, setAnswerForm] = useState({
    rating: "" as string, evidence: "", sample: "", interviewedWith: "", comments: "",
  });
  const [findingFor, setFindingFor] = useState<Answer | null>(null);
  const [findingForm, setFindingForm] = useState({
    classification: "FESTSTELLUNG" as FindingClassification, description: "",
  });
  const [summary, setSummary] = useState<string | null>(null);

  if (audit === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (audit === null) return <div className="p-8">Audit nicht gefunden.</div>;

  const canManage = can("audits:manage");
  const canReport = can("audits:report");
  const editable = audit.status === "IN_PROGRESS";

  function openAnswer(a: Answer) {
    setAnswerForm({
      rating: a.rating ?? "", evidence: a.evidence ?? "", sample: a.sample ?? "",
      interviewedWith: a.interviewedWith ?? "", comments: a.comments ?? "",
    });
    setEditAnswer(a);
  }

  async function saveAnswer() {
    if (!editAnswer) return;
    try {
      await updateAnswer({
        id: editAnswer._id,
        // (A) Clearable fields: send raw strings so empty string clears the field server-side
        rating: (answerForm.rating || undefined) as AuditRating | undefined,
        evidence: answerForm.evidence,
        sample: answerForm.sample,
        interviewedWith: answerForm.interviewedWith,
        comments: answerForm.comments,
      });
      setEditAnswer(null);
      toast.success("Prüfpunkt gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function saveFinding() {
    if (!findingFor || !findingForm.description.trim()) {
      toast.error("Beschreibung ist erforderlich");
      return;
    }
    try {
      await createFinding({
        auditId, answerId: findingFor._id,
        classification: findingForm.classification,
        description: findingForm.description,
      });
      setFindingFor(null);
      setFindingForm({ classification: "FESTSTELLUNG", description: "" });
      toast.success("Finding erfasst");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleCapa(finding: Finding) {
    try {
      await createCapaFromFinding({ findingId: finding._id, capaType: "CORRECTIVE" });
      toast.success("CAPA-Vorschlag angelegt — unter CAPA weiter bearbeiten");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  function reportData() {
    return {
      title: audit!.title,
      formNumber: "8.2.4",
      revision: "Rev. 1 (App)",
      auditTeam: audit!.auditTeam,
      leadAuditorName: audit!.leadAuditorName,
      basis: audit!.basis,
      location: audit!.location,
      reportingPeriod: audit!.reportingPeriod,
      auditDate: audit!.auditDate,
      templateVersion: audit!.templateVersion,
      summaryResult: audit!.summaryResult,
      chapterSummaries: audit!.chapterSummaries,
      answers: audit!.answers,
      findings: audit!.findings.map((f: Finding) => ({
        chapter: f.chapter, classification: f.classification, description: f.description,
      })),
    };
  }

  async function freezeReport() {
    try {
      const blob = auditReportBlob(reportData());
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      const { storageId } = await res.json();
      await attachReport({ id: auditId, reportFileId: storageId });
      toast.success("Bericht-PDF am Audit eingefroren");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Einfrieren");
    }
  }

  const transitions: Partial<Record<AuditStatus, { to: string; label: string }[]>> = {
    PLANNED: [{ to: "IN_PROGRESS", label: "Audit starten" }, { to: "CANCELLED", label: "Abbrechen" }],
    IN_PROGRESS: [{ to: "REPORT_DRAFT", label: "Zum Berichtsentwurf" }],
    REPORT_DRAFT: [
      { to: "CLOSED", label: "Audit abschließen" },
      { to: "IN_PROGRESS", label: "Zurück zur Durchführung" },
    ],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={audit.title}
        description={`Audit ${audit.auditYear} · Checkliste v${audit.templateVersion ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {AUDIT_STATUS_LABELS[audit.status as AuditStatus] ?? audit.status}
            </Badge>
            {canManage && (transitions[audit.status as AuditStatus] ?? []).map((t) => (
              <Button key={t.to} variant={t.to === "CANCELLED" ? "outline" : "default"} size="sm"
                onClick={async () => {
                  try { await setStatus({ id: auditId, status: t.to }); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                }}>
                {t.label}
              </Button>
            ))}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Kopfdaten</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Leitender Auditor: </span>{audit.leadAuditorName ?? "—"}</div>
          <div><span className="text-muted-foreground">Auditteam: </span>{audit.auditTeam ?? "—"}</div>
          <div><span className="text-muted-foreground">Standort: </span>{audit.location ?? "—"}</div>
          <div><span className="text-muted-foreground">Berichtszeitraum: </span>{audit.reportingPeriod ?? "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Basis: </span>{audit.basis ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Checkliste ({audit.answers.filter((a: Answer) => a.rating).length}/{audit.answers.length} bewertet)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {audit.answers.map((a: Answer) => (
            <button key={a._id} type="button"
              onClick={() => (editable && canManage ? openAnswer(a) : undefined)}
              className="flex w-full items-start gap-3 rounded-md border p-3 text-left hover:bg-muted/50 disabled:cursor-default"
              disabled={!editable || !canManage}>
              <span className="w-14 shrink-0 font-mono text-sm">{a.chapter}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{a.chapterTitle}</span>
                <span className="block text-xs text-muted-foreground line-clamp-2">{a.requirements}</span>
              </span>
              <Badge className={RATING_COLOR[a.rating ?? ""] ?? "bg-gray-50 text-gray-400"} variant="secondary">
                {a.rating ? AUDIT_RATING_LABELS[a.rating as AuditRating] : "offen"}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Findings ({audit.findings.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {audit.findings.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Keine Findings. Findings werden aus bewerteten Prüfpunkten heraus erfasst (Dialog → &bdquo;Finding erfassen&ldquo;).
            </p>
          )}
          {audit.findings.map((f: Finding) => (
            <div key={f._id} className="flex items-start gap-3 rounded-md border p-3">
              <Badge className={RATING_COLOR[f.classification] ?? ""} variant="secondary">
                {FINDING_CLASSIFICATION_LABELS[f.classification as FindingClassification]}
              </Badge>
              <div className="flex-1 text-sm">
                {f.chapter && <span className="mr-2 font-mono text-xs">Kap. {f.chapter}</span>}
                {f.description}
              </div>
              {f.capaId ? (
                <Badge variant="outline">CAPA verknüpft</Badge>
              ) : (
                can("capa:create") && f.classification !== "EMPFEHLUNG" && (
                  <Button size="sm" variant="outline" onClick={() => handleCapa(f)}>CAPA anlegen</Button>
                )
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {(audit.status === "REPORT_DRAFT" || audit.status === "CLOSED") && (
        <Card>
          <CardHeader><CardTitle>Auditbericht</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="summary">Zusammenfassendes Ergebnis</Label>
              <Textarea id="summary" rows={6}
                value={summary ?? audit.summaryResult ?? ""}
                onChange={(e) => setSummary(e.target.value)}
                disabled={audit.status === "CLOSED" || !canReport} />
            </div>
            <div className="flex gap-2">
              {audit.status === "REPORT_DRAFT" && canReport && (
                <Button variant="outline"
                  onClick={async () => {
                    try {
                      // (B) Send current textarea value even when unchanged
                      await updateSummary({ id: auditId, summaryResult: summary ?? audit.summaryResult ?? "" });
                      toast.success("Berichtstext gespeichert");
                    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                  }}>
                  Text speichern
                </Button>
              )}
              <Button variant="outline" onClick={() => downloadAuditReport(reportData(), `FB_8_2_4_Auditbericht_${audit.auditYear}.pdf`)}>
                PDF herunterladen
              </Button>
              {audit.status === "REPORT_DRAFT" && canReport && (
                <Button onClick={freezeReport}>PDF einfrieren (Nachweis)</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prüfpunkt-Dialog */}
      <Dialog open={!!editAnswer} onOpenChange={(o) => !o && setEditAnswer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editAnswer?.chapter} — {editAnswer?.chapterTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{editAnswer?.requirements}</p>
          <div className="space-y-3">
            <div>
              <Label>Bewertung</Label>
              <Select value={answerForm.rating}
                onValueChange={(v) => setAnswerForm({ ...answerForm, rating: v })}>
                <SelectTrigger><SelectValue placeholder="Bewertung wählen" /></SelectTrigger>
                <SelectContent>
                  {AUDIT_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {AUDIT_RATING_LABELS[r]} — {AUDIT_RATING_DESCRIPTIONS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="evidence">Nachweis (PA/AA/FB/QMH inkl. Revisionsstand)</Label>
              <Textarea id="evidence" rows={2} value={answerForm.evidence}
                onChange={(e) => setAnswerForm({ ...answerForm, evidence: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sample">Stichprobe (konkrete Aufzeichnung)</Label>
              <Textarea id="sample" rows={2} value={answerForm.sample}
                onChange={(e) => setAnswerForm({ ...answerForm, sample: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="interview">Gespräch mit</Label>
              <Input id="interview" value={answerForm.interviewedWith}
                onChange={(e) => setAnswerForm({ ...answerForm, interviewedWith: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="comments">Bemerkungen</Label>
              <Textarea id="comments" rows={2} value={answerForm.comments}
                onChange={(e) => setAnswerForm({ ...answerForm, comments: e.target.value })} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline"
                disabled={!["ABWEICHUNG", "FESTSTELLUNG", "EMPFEHLUNG"].includes(answerForm.rating)}
                onClick={() => {
                  setFindingFor(editAnswer);
                  setFindingForm({
                    classification: answerForm.rating as FindingClassification,
                    description: answerForm.comments || "",
                  });
                }}>
                Finding erfassen
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditAnswer(null)}>Abbrechen</Button>
                <Button onClick={saveAnswer}>Speichern</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finding-Dialog */}
      <Dialog open={!!findingFor} onOpenChange={(o) => !o && setFindingFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finding erfassen — Kap. {findingFor?.chapter}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Klassifizierung</Label>
              <Select value={findingForm.classification}
                onValueChange={(v) => setFindingForm({ ...findingForm, classification: v as FindingClassification })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>{FINDING_CLASSIFICATION_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fdesc">Beschreibung</Label>
              <Textarea id="fdesc" rows={4} value={findingForm.description}
                onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFindingFor(null)}>Abbrechen</Button>
              <Button onClick={saveFinding}>Erfassen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
