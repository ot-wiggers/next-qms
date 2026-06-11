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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { PMS_SECTIONS } from "@/lib/types/enums";
import { downloadPmsReport, pmsReportBlob } from "@/lib/export/pms-report-exporter";
import type { PmsReportData } from "@/lib/export/pms-report-exporter";
import { toast } from "sonner";

// ── Status badge colors ───────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  APPROVED: "Freigegeben",
};

// ── reportInvalidated-Hinweis (Mutations entfernen reportFileId) ──────────────

function warnIfInvalidated(result: { reportInvalidated: boolean }) {
  if (result.reportInvalidated) {
    toast.warning("Eingefrorenes PDF wurde ungültig — bitte neu einfrieren");
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PmsReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id as Id<"pmsReports">;
  const { can } = usePermissions();

  // ── Convex queries / mutations ────────────────────────────────────────────
  const report = useQuery(api.pmsReports.getById, { id: reportId });
  const reportUrl = useQuery(api.pmsReports.getReportUrl, { id: reportId });
  const refreshAutoData = useMutation(api.pmsReports.refreshAutoData);
  const updateGeneral = useMutation(api.pmsReports.updateGeneral);
  const updateSection = useMutation(api.pmsReports.updateSection);
  const generateUploadUrl = useMutation(api.pmsReports.generateUploadUrl);
  const attachReport = useMutation(api.pmsReports.attachReport);
  const approveMutation = useMutation(api.pmsReports.approve);

  // ── Draft state — keyed-draft pattern: drafts sind an reportId gebunden ──
  // Kopfdaten-Draft (revision als String, wird beim Speichern validiert)
  const [generalDraft, setGeneralDraft] = useState<{
    id: string;
    reportingPeriod: string;
    revision: string;
    standText: string;
    productGroup: string;
  } | null>(null);

  const generalForm = generalDraft?.id === reportId
    ? generalDraft
    : {
        id: reportId,
        reportingPeriod: report?.reportingPeriod ?? "",
        revision: report ? String(report.revision) : "",
        standText: report?.standText ?? "",
        productGroup: report?.productGroup ?? "",
      };

  // Abschnitts-Drafts: Record<sectionKey, string>
  const [sectionDrafts, setSectionDrafts] = useState<{ id: string; drafts: Record<string, string> } | null>(null);

  function getSectionDraft(key: string): string | null {
    if (sectionDrafts?.id !== reportId) return null;
    return sectionDrafts.drafts[key] ?? null;
  }

  function setSectionDraft(key: string, value: string) {
    setSectionDrafts((prev) => ({
      id: reportId,
      drafts: {
        ...(prev?.id === reportId ? prev.drafts : {}),
        [key]: value,
      },
    }));
  }

  // Doppelklick-Schutz für Einfrieren und Freigeben
  const [freezing, setFreezing] = useState(false);
  const [approving, setApproving] = useState(false);

  // ── Loading guard (Hooks müssen darüber stehen) ───────────────────────────
  // getById WIRFT bei unbekannter id (kein null-Fall wie bei managementReviews):
  // der Fehler landet im Convex-Error-Boundary, hier reicht der undefined-Guard.
  if (report === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;

  const isDraft = report.status === "DRAFT";
  const canManage = can("pmsReports:manage");
  const canApprove = can("pmsReports:approve");

  // ── reportData: Export-Daten für den Download — sichtbare Draft-Werte ─────
  // Download nutzt Draft ?? Server; das Einfrieren nutzt NUR Server-Daten (s.u.).
  function reportData(): PmsReportData {
    const general = generalDraft?.id === reportId ? generalDraft : null;
    const draftRevision = general ? Number(general.revision) : NaN;
    return {
      reportingPeriod: general ? general.reportingPeriod : report!.reportingPeriod,
      revision: Number.isInteger(draftRevision) && draftRevision >= 1
        ? draftRevision
        : report!.revision,
      standText: general ? (general.standText.trim() || undefined) : report!.standText,
      productGroup: general ? general.productGroup : report!.productGroup,
      status: report!.status,
      approvedAt: report!.approvedAt,
      sections: PMS_SECTIONS.map((s) => {
        const serverSection = report!.sections.find((sec) => sec.key === s.key);
        const draft = getSectionDraft(s.key);
        return {
          key: s.key,
          title: s.title,
          autoData: serverSection?.autoData,
          text: draft !== null ? (draft || undefined) : serverSection?.text,
        };
      }),
    };
  }

  // ── PDF freeze flow ───────────────────────────────────────────────────────
  // WICHTIG: Das Einfrieren erzeugt das PDF aus SERVER-Daten (report.*), NICHT
  // aus Drafts. Ungespeicherte lokale Texte würden sonst ein Blob erzeugen,
  // das nicht dem Datenbankstand entspricht (Haus-Muster managementReviews).
  async function freezeReport() {
    if (freezing) return;
    setFreezing(true);
    try {
      // Blob aus SERVER-Daten bauen
      const serverData: PmsReportData = {
        reportingPeriod: report!.reportingPeriod,
        revision: report!.revision,
        standText: report!.standText,
        productGroup: report!.productGroup,
        status: report!.status,
        approvedAt: report!.approvedAt,
        sections: PMS_SECTIONS.map((s) => {
          const sec = report!.sections.find((x) => x.key === s.key);
          return { key: s.key, title: s.title, autoData: sec?.autoData, text: sec?.text };
        }),
      };

      const blob = pmsReportBlob(serverData);
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      const { storageId } = await res.json() as { storageId: Id<"_storage"> };
      await attachReport({ id: reportId, reportFileId: storageId });
      toast.success("PDF eingefroren");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Einfrieren");
    } finally {
      setFreezing(false);
    }
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove() {
    if (approving) return;
    if (!window.confirm("Bericht freigeben? Danach sind keine Änderungen mehr möglich.")) {
      return;
    }
    setApproving(true);
    try {
      await approveMutation({ id: reportId });
      toast.success("PMS-Bericht freigegeben");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler bei der Freigabe");
    } finally {
      setApproving(false);
    }
  }

  // ── Save handlers ─────────────────────────────────────────────────────────
  async function saveGeneral() {
    if (!generalDraft || generalDraft.id !== reportId) return;
    if (!generalDraft.reportingPeriod.trim()) {
      toast.error("Berichtszeitraum ist erforderlich");
      return;
    }
    if (!generalDraft.productGroup.trim()) {
      toast.error("Produktgruppe ist erforderlich");
      return;
    }
    const revisionNum = Number(generalDraft.revision);
    if (!Number.isInteger(revisionNum) || revisionNum < 1) {
      toast.error("Revision muss eine ganze Zahl ≥ 1 sein");
      return;
    }
    try {
      const result = await updateGeneral({
        id: reportId,
        reportingPeriod: generalDraft.reportingPeriod,
        revision: revisionNum,
        standText: generalDraft.standText,
        productGroup: generalDraft.productGroup,
      });
      setGeneralDraft(null);
      toast.success("Kopfdaten gespeichert");
      warnIfInvalidated(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function saveSection(key: string) {
    const draft = getSectionDraft(key);
    if (draft === null) return;
    try {
      const result = await updateSection({ id: reportId, key, text: draft });
      setSectionDrafts((prev) => {
        if (!prev || prev.id !== reportId) return prev;
        const updated = { ...prev.drafts };
        delete updated[key];
        return { id: reportId, drafts: updated };
      });
      toast.success("Abschnitt gespeichert");
      warnIfInvalidated(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function handleRefreshAutoData() {
    try {
      const result = await refreshAutoData({ id: reportId });
      toast.success("Automatische Daten aktualisiert");
      warnIfInvalidated(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktualisieren");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`PMS-Bericht ${report.year}`}
        description="Überwachung nach dem Inverkehrbringen gemäß MDR Art. 85 (FB 7 1)"
        actions={
          <Badge className={STATUS_COLOR[report.status] ?? ""} variant="secondary">
            {STATUS_LABEL[report.status] ?? report.status}
          </Badge>
        }
      />

      {/* Kopfdaten */}
      <Card>
        <CardHeader><CardTitle>Kopfdaten</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pms-year">Berichtsjahr</Label>
            <Input id="pms-year" value={String(report.year)} disabled />
          </div>
          <div>
            <Label htmlFor="pms-period">Berichtszeitraum</Label>
            <Input
              id="pms-period"
              value={generalForm.reportingPeriod}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, reportingPeriod: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pms-revision">Revision</Label>
            <Input
              id="pms-revision"
              type="number"
              value={generalForm.revision}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, revision: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pms-stand">Stand</Label>
            <Input
              id="pms-stand"
              value={generalForm.standText}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, standText: e.target.value })}
              placeholder="z.B. 01.2026 (optional)"
            />
          </div>
          <div>
            <Label htmlFor="pms-productgroup">Produktgruppe</Label>
            <Input
              id="pms-productgroup"
              value={generalForm.productGroup}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, productGroup: e.target.value })}
            />
          </div>
          {isDraft && canManage && (
            <div className="flex justify-end">
              <Button
                onClick={saveGeneral}
                disabled={generalDraft === null || generalDraft.id !== reportId}
              >
                Kopfdaten speichern
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aktionsleiste */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          {isDraft && canManage && (
            <p className="text-sm text-muted-foreground">
              Hinweis: Ungespeicherte Texte werden nicht eingefroren — erst speichern, dann einfrieren.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {isDraft && canManage && (
              <Button variant="outline" onClick={handleRefreshAutoData}>
                Auto-Daten aktualisieren
              </Button>
            )}
            {/* Download immer verfügbar, nutzt sichtbare Draft-Werte */}
            <Button
              variant="outline"
              onClick={() => downloadPmsReport(reportData(), `PMS-Bericht_${report.year}.pdf`)}
            >
              PDF herunterladen
            </Button>
            {/* Einfrieren nutzt NUR Server-Daten — s. Kommentar in freezeReport() */}
            {isDraft && canManage && (
              <Button onClick={freezeReport} disabled={freezing}>
                PDF einfrieren
              </Button>
            )}
            {isDraft && canApprove && (
              <Button
                disabled={!report.reportFileId || approving}
                title={!report.reportFileId ? "Erst PDF einfrieren" : undefined}
                onClick={handleApprove}
              >
                Freigeben
              </Button>
            )}
            {report.reportFileId && reportUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(reportUrl, "_blank", "noopener,noreferrer")}
              >
                Eingefrorenes PDF öffnen
              </Button>
            )}
          </div>
          {report.status === "APPROVED" && !report.reportFileId && (
            <p className="rounded bg-muted/50 p-3 text-sm text-muted-foreground">
              Der Original-Bericht liegt als externes Dokument vor (Formblatt 7 1).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Abschnitte 1–8 */}
      {PMS_SECTIONS.map((section) => {
        const serverSection = report.sections.find((s) => s.key === section.key);
        const draftValue = getSectionDraft(section.key);
        const textValue = draftValue !== null ? draftValue : (serverSection?.text ?? "");

        return (
          <Card key={section.key}>
            <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {serverSection?.autoData && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Daten aus der App</p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-3 font-sans">
                    {serverSection.autoData}
                  </pre>
                </div>
              )}
              <div>
                <Label htmlFor={`pms-section-${section.key}`}>Text</Label>
                <Textarea
                  id={`pms-section-${section.key}`}
                  rows={4}
                  value={textValue}
                  disabled={!isDraft || !canManage}
                  onChange={(e) => setSectionDraft(section.key, e.target.value)}
                />
              </div>
              {isDraft && canManage && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => saveSection(section.key)}
                    disabled={draftValue === null}
                  >
                    Speichern
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
