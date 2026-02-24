"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ParticipantList } from "@/components/domain/training/participant-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils/dates";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Session {
  _id: string;
  trainingId: string;
  scheduledDate: number;
  endDate?: number;
  location?: string;
  trainerName?: string;
  status: string;
  maxParticipants?: number;
  notes?: string;
}

export default function SessionDetailPage() {
  const params = useParams();
  const trainingId = params.id as string;
  const sessionId = params.sessionId as string;

  const session = useQuery(api.trainings.getSession, {
    id: sessionId as any,
  }) as Session | null | undefined;

  if (session === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Termin...</div>;
  }

  if (!session) {
    return <div className="text-sm text-red-600">Termin nicht gefunden</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/trainings/${trainingId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Schulungstermin" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>{formatDateTime(session.scheduledDate)}</CardTitle>
            <StatusBadge status={session.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {session.location && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ort</p>
                <p className="text-sm">{session.location}</p>
              </div>
            )}
            {session.trainerName && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Trainer</p>
                <p className="text-sm">{session.trainerName}</p>
              </div>
            )}
            {session.maxParticipants && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Max. Teilnehmer
                </p>
                <p className="text-sm">{session.maxParticipants}</p>
              </div>
            )}
          </div>
          {session.notes && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Anmerkungen</p>
              <p className="text-sm">{session.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="participants">
        <TabsList>
          <TabsTrigger value="participants">Teilnehmer</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        <TabsContent value="participants" className="mt-4">
          <ParticipantList
            sessionId={sessionId}
            sessionStatus={session.status}
          />
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          <FeedbackSummary sessionId={sessionId} trainingId={trainingId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeedbackSummary({ sessionId, trainingId }: { sessionId: string; trainingId: string }) {
  const feedback = useQuery(api.effectiveness.listFeedback, {
    sessionId: sessionId as any,
  }) as Array<{
    _id: string;
    userId: string;
    ratings: Record<string, number>;
    wouldRecommend: boolean;
    comments?: string;
  }> | undefined;

  if (!feedback || feedback.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch kein Feedback abgegeben
      </p>
    );
  }

  const RATING_LABELS: Record<string, string> = {
    contentRelevance: "Inhaltliche Relevanz",
    trainerCompetence: "Trainerkompetenz",
    methodology: "Methodik",
    practicalApplicability: "Praxisanwendbarkeit",
    organizationQuality: "Organisationsqualität",
    overallSatisfaction: "Gesamtzufriedenheit",
  };

  // Calculate averages
  const ratingKeys = Object.keys(RATING_LABELS);
  const averages: Record<string, number> = {};
  for (const key of ratingKeys) {
    const values = feedback.map((f) => f.ratings[key]).filter(Boolean);
    averages[key] = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }

  const recommendCount = feedback.filter((f) => f.wouldRecommend).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {feedback.length} Feedback-Bögen eingegangen
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {ratingKeys.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm">{RATING_LABELS[key]}</span>
            <span className="text-sm font-medium">
              Ø {averages[key].toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm">
        Weiterempfehlung: {recommendCount}/{feedback.length} (
        {Math.round((recommendCount / feedback.length) * 100)}%)
      </p>
    </div>
  );
}
