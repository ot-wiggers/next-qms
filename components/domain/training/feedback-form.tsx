"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUpload } from "@/components/shared/file-upload";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, FileText, Loader2, X } from "lucide-react";

interface FeedbackFormProps {
  participantId: string;
  sessionId: string;
  trainingId: string;
}

// ----------------------------------------------------------------
// Rating scale — German school grades 1-6
// ----------------------------------------------------------------
const SCALE_OPTIONS = [
  { value: "1", label: "1 — Sehr gut" },
  { value: "2", label: "2 — Gut" },
  { value: "3", label: "3 — Befriedigend" },
  { value: "4", label: "4 — Ausreichend" },
  { value: "5", label: "5 — Mangelhaft" },
  { value: "6", label: "6 — Ungenügend" },
];

// ----------------------------------------------------------------
// Organisation ratings config
// ----------------------------------------------------------------
const ORGANIZATION_ITEMS: { key: string; label: string }[] = [
  { key: "venueAccessibility", label: "Erreichbarkeit des Veranstaltungsortes" },
  { key: "conferenceRooms", label: "Konferenzräume" },
  { key: "catering", label: "Verpflegung" },
  { key: "staffSupport", label: "Betreuung durch Personal" },
];

// ----------------------------------------------------------------
// Event ratings config
// ----------------------------------------------------------------
const EVENT_ITEMS: { key: string; label: string }[] = [
  { key: "overallEvent", label: "Veranstaltung insgesamt" },
  { key: "knowledgeUsefulness", label: "Verwertbarkeit der Kenntnisse" },
  { key: "structurePresentation", label: "Aufbau und Darstellung" },
  { key: "seminarContent", label: "Seminarinhalt" },
  { key: "questionOpportunity", label: "Fragemöglichkeit" },
  { key: "seminarMaterials", label: "Seminarunterlagen" },
  { key: "speakerExpertise", label: "Fachkompetenz des Referenten" },
  { key: "presentationQuality", label: "Qualität des Vortrags" },
];

const MIN_SHORT_REPORT_LENGTH = 30;

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function FeedbackForm({ participantId, sessionId, trainingId }: FeedbackFormProps) {
  const router = useRouter();
  const submitFeedback = useMutation(api.effectiveness.submitFeedback);

  // Short report
  const [shortReport, setShortReport] = useState("");

  // Organization ratings
  const [orgRatings, setOrgRatings] = useState<Record<string, string>>({
    venueAccessibility: "",
    conferenceRooms: "",
    catering: "",
    staffSupport: "",
  });

  // Event ratings
  const [eventRatings, setEventRatings] = useState<Record<string, string>>({
    overallEvent: "",
    knowledgeUsefulness: "",
    structurePresentation: "",
    seminarContent: "",
    questionOpportunity: "",
    seminarMaterials: "",
    speakerExpertise: "",
    presentationQuality: "",
  });

  // Bad rating reason
  const [badRatingReason, setBadRatingReason] = useState("");

  // Certificate upload
  const [certificateFileId, setCertificateFileId] = useState("");
  const [certificateFileName, setCertificateFileName] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detect whether any rating is 5 or 6
  const hasBadRating = useMemo(() => {
    const allValues = [...Object.values(orgRatings), ...Object.values(eventRatings)];
    return allValues.some((v) => v === "5" || v === "6");
  }, [orgRatings, eventRatings]);

  // Validate completeness
  const allOrgFilled = Object.values(orgRatings).every((v) => v !== "");
  const allEventFilled = Object.values(eventRatings).every((v) => v !== "");
  const shortReportValid = shortReport.trim().length >= MIN_SHORT_REPORT_LENGTH;
  const badReasonValid = !hasBadRating || badRatingReason.trim().length > 0;
  const canSubmit = allOrgFilled && allEventFilled && shortReportValid && badReasonValid;

  const handleCertificateUpload = (fileId: string, fileName: string) => {
    setCertificateFileId(fileId);
    setCertificateFileName(fileName);
    toast.success(`Datei "${fileName}" hochgeladen`);
  };

  const handleRemoveCertificate = () => {
    setCertificateFileId("");
    setCertificateFileName("");
  };

  const handleSubmit = async () => {
    if (!allOrgFilled || !allEventFilled) {
      toast.error("Bitte alle Bewertungen ausfüllen");
      return;
    }
    if (!shortReportValid) {
      toast.error(`Der Kurzbericht muss mindestens ${MIN_SHORT_REPORT_LENGTH} Zeichen lang sein`);
      return;
    }
    if (!badReasonValid) {
      toast.error("Bei einer Bewertung von 5 oder 6 muss eine Begründung angegeben werden");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({
        participantId: participantId as any,
        sessionId: sessionId as any,
        shortReport: shortReport.trim(),
        organizationRatings: {
          venueAccessibility: parseInt(orgRatings.venueAccessibility),
          conferenceRooms: parseInt(orgRatings.conferenceRooms),
          catering: parseInt(orgRatings.catering),
          staffSupport: parseInt(orgRatings.staffSupport),
        },
        eventRatings: {
          overallEvent: parseInt(eventRatings.overallEvent),
          knowledgeUsefulness: parseInt(eventRatings.knowledgeUsefulness),
          structurePresentation: parseInt(eventRatings.structurePresentation),
          seminarContent: parseInt(eventRatings.seminarContent),
          questionOpportunity: parseInt(eventRatings.questionOpportunity),
          seminarMaterials: parseInt(eventRatings.seminarMaterials),
          speakerExpertise: parseInt(eventRatings.speakerExpertise),
          presentationQuality: parseInt(eventRatings.presentationQuality),
        },
        badRatingReason: hasBadRating ? badRatingReason.trim() : undefined,
        certificateFileId: certificateFileId ? (certificateFileId as any) : undefined,
        certificateFileName: certificateFileName || undefined,
      });
      toast.success("Schulungsbewertung erfolgreich abgegeben");
      router.push(`/trainings/${trainingId}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Absenden");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* -------------------------------------------------------- */}
      {/* Kurzbericht                                              */}
      {/* -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kurzbericht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="shortReport">
            Kurze Zusammenfassung der Schulung *
          </Label>
          <Textarea
            id="shortReport"
            value={shortReport}
            onChange={(e) => setShortReport(e.target.value)}
            rows={4}
            placeholder="Beschreiben Sie kurz Inhalt und Ablauf der Schulung..."
          />
          <p
            className={`text-xs ${
              shortReport.trim().length >= MIN_SHORT_REPORT_LENGTH
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {shortReport.trim().length} / {MIN_SHORT_REPORT_LENGTH} Zeichen (Minimum)
          </p>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------- */}
      {/* Organisation                                             */}
      {/* -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ORGANIZATION_ITEMS.map(({ key, label }) => (
              <RatingSelect
                key={key}
                id={`org-${key}`}
                label={label}
                value={orgRatings[key]}
                onChange={(v) => setOrgRatings((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------- */}
      {/* Veranstaltung                                            */}
      {/* -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Veranstaltung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {EVENT_ITEMS.map(({ key, label }) => (
              <RatingSelect
                key={key}
                id={`evt-${key}`}
                label={label}
                value={eventRatings[key]}
                onChange={(v) => setEventRatings((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------- */}
      {/* Bad-rating reason (conditional)                          */}
      {/* -------------------------------------------------------- */}
      {hasBadRating && (
        <Card className="border-orange-300 dark:border-orange-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-4 w-4" />
              Begründung erforderlich
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="badRatingReason">
              Ich habe eine 5/6 vergeben, weil: *
            </Label>
            <Textarea
              id="badRatingReason"
              value={badRatingReason}
              onChange={(e) => setBadRatingReason(e.target.value)}
              rows={3}
              placeholder="Bitte begründen Sie Ihre Bewertung..."
            />
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------------- */}
      {/* Certificate / Teilnehmerliste upload                     */}
      {/* -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zertifikat / Teilnehmerliste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Optional: Laden Sie ein Zertifikat oder eine Teilnehmerliste hoch.
          </p>
          {certificateFileName ? (
            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{certificateFileName}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRemoveCertificate}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <FileUpload
              onUploadComplete={handleCertificateUpload}
              accept=".pdf,.jpg,.jpeg,.png"
              label="Datei hochladen"
              uploadUrlSource="effectiveness"
            />
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------------- */}
      {/* Submit                                                   */}
      {/* -------------------------------------------------------- */}
      <div className="flex items-center gap-4 pt-2">
        <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Bewertung absenden
        </Button>
        {!canSubmit && (
          <p className="text-xs text-muted-foreground">
            Bitte füllen Sie alle Pflichtfelder aus.
          </p>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Reusable rating select row
// ----------------------------------------------------------------
function RatingSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Label htmlFor={id} className="text-sm font-normal sm:flex-1">
        {label} *
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full sm:w-[220px]">
          <SelectValue placeholder="Bewertung wählen" />
        </SelectTrigger>
        <SelectContent>
          {SCALE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
