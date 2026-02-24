"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { getAllowedTransitions } from "../../../../convex/lib/stateMachine";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Training {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  isRequired: boolean;
  effectivenessCheckAfterDays: number;
  createdAt: number;
}

interface Session {
  _id: string;
  trainingId: string;
  scheduledDate: number;
  location?: string;
  trainerName?: string;
  status: string;
  maxParticipants?: number;
}

export default function TrainingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = usePermissions();
  const trainingId = params.id as string;

  const training = useQuery(api.trainings.getById, {
    id: trainingId as any,
  }) as Training | null | undefined;

  const sessions = useQuery(api.trainings.listSessions, {
    trainingId: trainingId as any,
  }) as Session[] | undefined;

  const updateSessionStatus = useMutation(api.trainings.updateSessionStatus);

  if (training === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Schulung...</div>;
  }

  if (!training) {
    return <div className="text-sm text-red-600">Schulung nicht gefunden</div>;
  }

  const handleSessionStatusChange = async (sessionId: string, newStatus: string) => {
    try {
      await updateSessionStatus({ id: sessionId as any, status: newStatus });
      toast.success(`Termin-Status geändert`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/trainings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={training.title} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{training.title}</CardTitle>
              {training.category && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Kategorie: {training.category}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {training.isRequired && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  Pflicht
                </span>
              )}
              <StatusBadge status={training.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {training.description && (
            <p className="mb-4 text-sm">{training.description}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erstellt</p>
              <p className="text-sm">{formatDate(training.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Wirksamkeitsprüfung nach
              </p>
              <p className="text-sm">{training.effectivenessCheckAfterDays} Tagen</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Termine</p>
              <p className="text-sm">{sessions?.length ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            Termine ({sessions?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="history">Verlauf</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4 space-y-4">
          {can("trainings:manage") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/trainings/${trainingId}/sessions`)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Termin verwalten
            </Button>
          )}

          {(sessions?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Termine vorhanden</p>
          ) : (
            <div className="space-y-3">
              {(sessions ?? []).map((session: Session) => {
                const allowedTransitions = getAllowedTransitions(
                  "sessionStatus",
                  session.status
                );
                return (
                  <Card key={session._id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {formatDateTime(session.scheduledDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.location && `${session.location} · `}
                            {session.trainerName && `Trainer: ${session.trainerName}`}
                            {session.maxParticipants &&
                              ` · Max. ${session.maxParticipants} TN`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={session.status} />
                        {can("trainings:manage") &&
                          allowedTransitions.map((target) => (
                            <Button
                              key={target}
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleSessionStatusChange(session._id, target)
                              }
                            >
                              → {target === "HELD"
                                ? "Durchgeführt"
                                : target === "CLOSED"
                                  ? "Abschließen"
                                  : "Absagen"}
                            </Button>
                          ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/trainings/${trainingId}/sessions/${session._id}`
                            )
                          }
                        >
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <AuditHistory entityType="trainings" entityId={training._id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
