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
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  MGMT_REVIEW_STATUS_LABELS, MGMT_REVIEW_SECTIONS,
  type MgmtReviewStatus,
} from "@/lib/types/enums";
import { downloadMgmtReview, mgmtReviewBlob } from "@/lib/export/mgmt-review-exporter";
import type { MgmtReviewData } from "@/lib/export/mgmt-review-exporter";
import { toast } from "sonner";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type EnrichedMeasure = {
  description: string;
  responsible?: string;
  dueText?: string;
  effectivenessCheck?: string;
  capaId?: Id<"capas">;
  capaNumber?: string;
};

// ── Status badge colors ───────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MgmtReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const reviewId = params.id as Id<"managementReviews">;
  const { can } = usePermissions();

  // ── Convex queries / mutations ────────────────────────────────────────────
  const review = useQuery(api.managementReviews.getById, { id: reviewId });
  const reportUrl = useQuery(api.managementReviews.getReportUrl, { id: reviewId });
  const approveMutation = useMutation(api.managementReviews.approve);
  const refreshAutoData = useMutation(api.managementReviews.refreshAutoData);
  const updateGeneral = useMutation(api.managementReviews.updateGeneral);
  const updateSection = useMutation(api.managementReviews.updateSection);
  const addMeasure = useMutation(api.managementReviews.addMeasure);
  const updateMeasure = useMutation(api.managementReviews.updateMeasure);
  const removeMeasure = useMutation(api.managementReviews.removeMeasure);
  const attachReport = useMutation(api.managementReviews.attachReport);
  const generateUploadUrl = useMutation(api.managementReviews.generateUploadUrl);
  const createCapa = useMutation(api.capas.create);

  // ── Draft state — keyed-draft pattern: drafts are keyed by reviewId ──────
  // General fields draft
  const [generalDraft, setGeneralDraft] = useState<{
    id: string;
    reportingPeriod: string;
    participants: string;
    companyNote: string;
  } | null>(null);

  const generalForm = generalDraft?.id === reviewId
    ? generalDraft
    : {
        id: reviewId,
        reportingPeriod: review?.reportingPeriod ?? "",
        participants: review?.participants ?? "",
        companyNote: review?.companyNote ?? "",
      };

  // Overall assessment draft
  const [overallDraft, setOverallDraft] = useState<{ id: string; text: string } | null>(null);
  const overallText = overallDraft?.id === reviewId ? overallDraft.text : null;

  // Improvements draft
  const [improvementsDraft, setImprovementsDraft] = useState<{ id: string; text: string } | null>(null);
  const improvementsText = improvementsDraft?.id === reviewId ? improvementsDraft.text : null;

  // Section assessment drafts: Record<sectionKey, string>
  const [sectionDrafts, setSectionDrafts] = useState<{ id: string; drafts: Record<string, string> } | null>(null);

  function getSectionDraft(key: string): string | null {
    if (sectionDrafts?.id !== reviewId) return null;
    return sectionDrafts.drafts[key] ?? null;
  }

  function setSectionDraft(key: string, value: string) {
    setSectionDrafts((prev) => ({
      id: reviewId,
      drafts: {
        ...(prev?.id === reviewId ? prev.drafts : {}),
        [key]: value,
      },
    }));
  }

  // Add measure dialog
  const [addMeasureOpen, setAddMeasureOpen] = useState(false);
  const [addMeasureForm, setAddMeasureForm] = useState({
    description: "", responsible: "", dueText: "", effectivenessCheck: "",
  });

  // Edit measure dialog
  const [editMeasureIndex, setEditMeasureIndex] = useState<number | null>(null);
  const [editMeasureForm, setEditMeasureForm] = useState({
    description: "", responsible: "", dueText: "", effectivenessCheck: "",
  });

  // Double-click protection for "Als CAPA anlegen"
  const [creatingCapaIndex, setCreatingCapaIndex] = useState<number | null>(null);

  // ── Loading / not found guards (hooks must be above these) ───────────────
  if (review === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (review === null) return <div className="p-8">Managementbewertung nicht gefunden.</div>;

  const isDraft = review.status === "DRAFT";
  const canManage = can("mgmtReview:manage");
  const canApprove = can("mgmtReview:approve");

  // ── reportData: builds export data, reads draft ?? server values ──────────
  // Download uses visible draft values; freeze uses SERVER data only (see comment below).
  function reportData(): MgmtReviewData {
    return {
      year: review!.year,
      reportingPeriod: generalDraft?.id === reviewId
        ? generalDraft.reportingPeriod
        : review!.reportingPeriod,
      participants: generalDraft?.id === reviewId
        ? (generalDraft.participants || undefined)
        : review!.participants,
      companyNote: generalDraft?.id === reviewId
        ? (generalDraft.companyNote || undefined)
        : review!.companyNote,
      sections: MGMT_REVIEW_SECTIONS.map((s) => {
        const serverSection = review!.sections.find((sec) => sec.key === s.key);
        const draft = getSectionDraft(s.key);
        return {
          key: s.key,
          autoData: serverSection?.autoData,
          assessment: draft !== null ? (draft || undefined) : serverSection?.assessment,
        };
      }),
      overallAssessment: overallText !== null ? (overallText || undefined) : review!.overallAssessment,
      measures: review!.measures as EnrichedMeasure[],
      improvements: improvementsText !== null ? (improvementsText || undefined) : review!.improvements,
    };
  }

  // ── PDF freeze flow ───────────────────────────────────────────────────────
  // IMPORTANT: The freeze generates the PDF from SERVER data (review.*), NOT from drafts.
  // Rationale: unsaved draft state is local-only and would produce a blob that does not
  // match what's persisted in the database. The user is informed via a hint text.
  async function freezeReport() {
    try {
      // Build blob from SERVER data (review.*, measures already enriched with capaNumber)
      const serverData: MgmtReviewData = {
        year: review!.year,
        reportingPeriod: review!.reportingPeriod,
        participants: review!.participants,
        companyNote: review!.companyNote,
        sections: MGMT_REVIEW_SECTIONS.map((s) => {
          const sec = review!.sections.find((x) => x.key === s.key);
          return { key: s.key, autoData: sec?.autoData, assessment: sec?.assessment };
        }),
        overallAssessment: review!.overallAssessment,
        measures: review!.measures as EnrichedMeasure[],
        improvements: review!.improvements,
      };

      const blob = mgmtReviewBlob(serverData);
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      const { storageId } = await res.json() as { storageId: Id<"_storage"> };
      await attachReport({ id: reviewId, reportFileId: storageId });
      toast.success("Bericht-PDF eingefroren");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Einfrieren");
    }
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove() {
    try {
      await approveMutation({ id: reviewId });
      toast.success("Managementbewertung freigegeben");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler bei der Freigabe");
    }
  }

  // ── Save handlers ─────────────────────────────────────────────────────────
  async function saveGeneral() {
    if (!generalDraft || generalDraft.id !== reviewId) return;
    if (!generalDraft.reportingPeriod.trim()) {
      toast.error("Berichtszeitraum ist erforderlich");
      return;
    }
    try {
      await updateGeneral({
        id: reviewId,
        reportingPeriod: generalDraft.reportingPeriod,
        participants: generalDraft.participants,
        companyNote: generalDraft.companyNote,
      });
      setGeneralDraft(null);
      toast.success("Allgemeine Angaben gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function saveSectionAssessment(key: string) {
    const draft = getSectionDraft(key);
    if (draft === null) return;
    try {
      await updateSection({ id: reviewId, key, assessment: draft });
      setSectionDrafts((prev) => {
        if (!prev || prev.id !== reviewId) return prev;
        const updated = { ...prev.drafts };
        delete updated[key];
        return { id: reviewId, drafts: updated };
      });
      toast.success("Bewertung gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function saveOverallAssessment() {
    if (overallText === null) return;
    try {
      await updateGeneral({ id: reviewId, overallAssessment: overallText });
      setOverallDraft(null);
      toast.success("Gesamtbewertung gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function saveImprovements() {
    if (improvementsText === null) return;
    try {
      await updateGeneral({ id: reviewId, improvements: improvementsText });
      setImprovementsDraft(null);
      toast.success("Verbesserungen gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function handleRefreshAutoData() {
    try {
      await refreshAutoData({ id: reviewId });
      toast.success("Automatische Daten aktualisiert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktualisieren");
    }
  }

  async function handleAddMeasure() {
    if (!addMeasureForm.description.trim()) {
      toast.error("Beschreibung ist erforderlich");
      return;
    }
    try {
      await addMeasure({
        id: reviewId,
        description: addMeasureForm.description,
        responsible: addMeasureForm.responsible || undefined,
        dueText: addMeasureForm.dueText || undefined,
        effectivenessCheck: addMeasureForm.effectivenessCheck || undefined,
      });
      setAddMeasureOpen(false);
      setAddMeasureForm({ description: "", responsible: "", dueText: "", effectivenessCheck: "" });
      toast.success("Maßnahme hinzugefügt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hinzufügen");
    }
  }

  function openEditMeasure(index: number) {
    const m = review!.measures[index] as EnrichedMeasure;
    setEditMeasureForm({
      description: m.description,
      responsible: m.responsible ?? "",
      dueText: m.dueText ?? "",
      effectivenessCheck: m.effectivenessCheck ?? "",
    });
    setEditMeasureIndex(index);
  }

  async function handleEditMeasure() {
    if (editMeasureIndex === null) return;
    if (!editMeasureForm.description.trim()) {
      toast.error("Beschreibung ist erforderlich");
      return;
    }
    try {
      await updateMeasure({
        id: reviewId,
        index: editMeasureIndex,
        description: editMeasureForm.description,
        responsible: editMeasureForm.responsible || undefined,
        dueText: editMeasureForm.dueText || undefined,
        effectivenessCheck: editMeasureForm.effectivenessCheck || undefined,
      });
      setEditMeasureIndex(null);
      toast.success("Maßnahme aktualisiert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function handleRemoveMeasure(index: number) {
    try {
      await removeMeasure({ id: reviewId, index });
      toast.success("Maßnahme entfernt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Entfernen");
    }
  }

  async function handleCreateCapaFromMeasure(index: number) {
    if (creatingCapaIndex !== null) return;
    setCreatingCapaIndex(index);
    const measure = review!.measures[index] as EnrichedMeasure;
    try {
      const capaId = await createCapa({
        title: measure.description.slice(0, 200),
        sourceType: "MGMT_REVIEW",
        sourceId: reviewId,
        capaType: "CORRECTIVE",
        responsible: measure.responsible,
      });
      await updateMeasure({ id: reviewId, index, capaId: capaId as Id<"capas"> });
      toast.success("CAPA angelegt und verknüpft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen der CAPA");
    } finally {
      setCreatingCapaIndex(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`Managementbewertung ${review.year}`}
        description="gemäß DIN EN ISO 13485 & MDR"
        actions={
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLOR[review.status] ?? ""} variant="secondary">
              {MGMT_REVIEW_STATUS_LABELS[review.status as MgmtReviewStatus] ?? review.status}
            </Badge>
            {isDraft && canApprove && (
              <Button
                disabled={!review.reportFileId}
                title={!review.reportFileId ? "Erst PDF einfrieren" : undefined}
                onClick={handleApprove}
              >
                Freigeben
              </Button>
            )}
          </div>
        }
      />

      {/* 1. Allgemeine Angaben */}
      <Card>
        <CardHeader><CardTitle>1. Allgemeine Angaben</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="mr-period">Berichtszeitraum</Label>
            <Input
              id="mr-period"
              value={generalForm.reportingPeriod}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, reportingPeriod: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="mr-participants">Teilnehmer</Label>
            <Input
              id="mr-participants"
              value={generalForm.participants}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, participants: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="mr-company">Unternehmen</Label>
            <Input
              id="mr-company"
              value={generalForm.companyNote}
              disabled={!isDraft || !canManage}
              onChange={(e) => setGeneralDraft({ ...generalForm, companyNote: e.target.value })}
            />
          </div>
          {isDraft && canManage && (
            <div className="flex justify-end">
              <Button onClick={saveGeneral} disabled={generalDraft === null || generalDraft.id !== reviewId}>Speichern</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Eingaben — "Daten aktualisieren" ONCE, above all section cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">2. Eingaben</h2>
        {isDraft && canManage && (
          <Button variant="outline" size="sm" onClick={handleRefreshAutoData}>
            Daten aktualisieren
          </Button>
        )}
      </div>

      {MGMT_REVIEW_SECTIONS.map((section) => {
        const serverSection = review.sections.find((s) => s.key === section.key);
        const draftValue = getSectionDraft(section.key);
        const assessmentValue = draftValue !== null ? draftValue : (serverSection?.assessment ?? "");

        return (
          <Card key={section.key}>
            <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Auto data block */}
              {serverSection?.autoData ? (
                <pre className="rounded bg-muted p-3 text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                  {serverSection.autoData}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Keine automatischen Daten (manueller Abschnitt)
                </p>
              )}
              {/* Assessment textarea */}
              <div>
                <Label htmlFor={`section-${section.key}`}>Bewertung</Label>
                <Textarea
                  id={`section-${section.key}`}
                  rows={4}
                  value={assessmentValue}
                  disabled={!isDraft || !canManage}
                  onChange={(e) => setSectionDraft(section.key, e.target.value)}
                />
              </div>
              {isDraft && canManage && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => saveSectionAssessment(section.key)}
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

      {/* 3. Gesamtbewertung */}
      <Card>
        <CardHeader><CardTitle>3. Gesamtbewertung</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="overall">Bewertung</Label>
            <Textarea
              id="overall"
              rows={5}
              value={overallText !== null ? overallText : (review.overallAssessment ?? "")}
              disabled={!isDraft || !canManage}
              onChange={(e) => setOverallDraft({ id: reviewId, text: e.target.value })}
            />
          </div>
          {isDraft && canManage && (
            <div className="flex justify-end">
              <Button onClick={saveOverallAssessment} disabled={overallText === null}>Speichern</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Maßnahmen */}
      <Card>
        <CardHeader>
          <CardTitle>4. Maßnahmen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {review.measures.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Maßnahmen erfasst.</p>
          )}
          {(review.measures as EnrichedMeasure[]).map((measure, index) => (
            <div key={index} className="rounded-md border p-3 space-y-1">
              <p className="font-medium text-sm">{measure.description}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  measure.responsible && `Verantwortlich: ${measure.responsible}`,
                  measure.dueText && `Termin: ${measure.dueText}`,
                  measure.effectivenessCheck && `Wirksamkeit: ${measure.effectivenessCheck}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {measure.capaId && measure.capaNumber && (
                  <>
                    {" · "}
                    <Link href={`/capa/${measure.capaId}`} className="text-blue-600 hover:underline">
                      {measure.capaNumber}
                    </Link>
                  </>
                )}
              </p>
              {isDraft && canManage && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEditMeasure(index)}>
                    Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveMeasure(index)}
                  >
                    Entfernen
                  </Button>
                  {!measure.capaId && can("capa:create") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateCapaFromMeasure(index)}
                      disabled={creatingCapaIndex !== null}
                    >
                      Als CAPA anlegen
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isDraft && canManage && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setAddMeasureOpen(true)}>
                Maßnahme hinzufügen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Verbesserungen */}
      <Card>
        <CardHeader><CardTitle>5. Verbesserungen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="improvements">Verbesserungen</Label>
            <Textarea
              id="improvements"
              rows={4}
              value={improvementsText !== null ? improvementsText : (review.improvements ?? "")}
              disabled={!isDraft || !canManage}
              onChange={(e) => setImprovementsDraft({ id: reviewId, text: e.target.value })}
            />
          </div>
          {isDraft && canManage && (
            <div className="flex justify-end">
              <Button onClick={saveImprovements} disabled={improvementsText === null}>Speichern</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bericht (PDF) */}
      <Card>
        <CardHeader><CardTitle>Bericht</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isDraft && canApprove && (
            <p className="text-sm text-muted-foreground">
              Hinweis: Ungespeicherte Texte werden nicht eingefroren — erst speichern, dann einfrieren.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {/* Download always available, uses visible draft values */}
            <Button
              variant="outline"
              onClick={() =>
                downloadMgmtReview(
                  reportData(),
                  `FB_5_6_0_Managementbewertung_${review.year}.pdf`
                )
              }
            >
              PDF herunterladen
            </Button>
            {/* Freeze uses SERVER data only — see comment in freezeReport() */}
            {isDraft && canApprove && (
              <Button onClick={freezeReport}>
                PDF einfrieren (Nachweis)
              </Button>
            )}
            {review.reportFileId && reportUrl && (
              <Button variant="outline" asChild>
                <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                  Eingefrorenes PDF (Nachweis)
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Measure Dialog */}
      <Dialog open={addMeasureOpen} onOpenChange={setAddMeasureOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Maßnahme hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="am-desc">Beschreibung</Label>
              <Textarea
                id="am-desc"
                rows={3}
                value={addMeasureForm.description}
                onChange={(e) => setAddMeasureForm({ ...addMeasureForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="am-resp">Verantwortlich</Label>
              <Input
                id="am-resp"
                value={addMeasureForm.responsible}
                onChange={(e) => setAddMeasureForm({ ...addMeasureForm, responsible: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="am-due">Termin</Label>
              <Input
                id="am-due"
                value={addMeasureForm.dueText}
                onChange={(e) => setAddMeasureForm({ ...addMeasureForm, dueText: e.target.value })}
                placeholder="z.B. Q3/2026"
              />
            </div>
            <div>
              <Label htmlFor="am-eff">Wirksamkeitsprüfung</Label>
              <Input
                id="am-eff"
                value={addMeasureForm.effectivenessCheck}
                onChange={(e) => setAddMeasureForm({ ...addMeasureForm, effectivenessCheck: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddMeasureOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAddMeasure}>Hinzufügen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Measure Dialog */}
      <Dialog open={editMeasureIndex !== null} onOpenChange={(o) => !o && setEditMeasureIndex(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Maßnahme bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="em-desc">Beschreibung</Label>
              <Textarea
                id="em-desc"
                rows={3}
                value={editMeasureForm.description}
                onChange={(e) => setEditMeasureForm({ ...editMeasureForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="em-resp">Verantwortlich</Label>
              <Input
                id="em-resp"
                value={editMeasureForm.responsible}
                onChange={(e) => setEditMeasureForm({ ...editMeasureForm, responsible: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="em-due">Termin</Label>
              <Input
                id="em-due"
                value={editMeasureForm.dueText}
                onChange={(e) => setEditMeasureForm({ ...editMeasureForm, dueText: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="em-eff">Wirksamkeitsprüfung</Label>
              <Input
                id="em-eff"
                value={editMeasureForm.effectivenessCheck}
                onChange={(e) => setEditMeasureForm({ ...editMeasureForm, effectivenessCheck: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditMeasureIndex(null)}>Abbrechen</Button>
              <Button onClick={handleEditMeasure}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
