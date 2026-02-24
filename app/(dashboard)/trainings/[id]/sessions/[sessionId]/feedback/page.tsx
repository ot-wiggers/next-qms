"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FeedbackForm } from "@/components/domain/training/feedback-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function FeedbackPage() {
  const params = useParams();
  const trainingId = params.id as string;
  const sessionId = params.sessionId as string;

  // The participantId should be passed via query params or determined from current user
  // For now we use a search param approach
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const participantId = searchParams?.get("participantId") ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/trainings/${trainingId}/sessions/${sessionId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title="Schulungsfeedback"
          description="Bewerten Sie die Schulung (Skala 1-6, 1 = sehr gut)"
        />
      </div>

      {participantId ? (
        <FeedbackForm
          participantId={participantId}
          sessionId={sessionId}
          trainingId={trainingId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Teilnehmer-ID angegeben. Bitte über die Aufgabenliste auf das Feedback zugreifen.
        </p>
      )}
    </div>
  );
}
