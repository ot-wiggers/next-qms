"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { ArchiveConfirmDialog } from "@/components/shared/archive-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { getAllowedTransitions } from "../../../../convex/lib/stateMachine";
import { ArrowLeft, Calendar, Plus, Pencil, Archive } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  endDate?: number;
  location?: string;
  trainerId?: string;
  trainerName?: string;
  status: string;
  maxParticipants?: number;
  notes?: string;
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

  const updateTraining = useMutation(api.trainings.update);
  const archiveTraining = useMutation(api.trainings.archive);
  const updateSession = useMutation(api.trainings.updateSession);
  const updateSessionStatus = useMutation(api.trainings.updateSessionStatus);

  // Training edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    isRequired: false,
    effectivenessCheckAfterDays: 0,
  });

  // Training archive state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Session edit state
  const [sessionEditOpen, setSessionEditOpen] = useState(false);
  const [sessionEditForm, setSessionEditForm] = useState({
    id: "",
    scheduledDate: "",
    location: "",
    trainerName: "",
    maxParticipants: "",
    notes: "",
  });

  if (training === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Schulung...</div>;
  }

  if (!training) {
    return <div className="text-sm text-red-600">Schulung nicht gefunden</div>;
  }

  const openTrainingEdit = () => {
    setEditForm({
      title: training.title,
      description: training.description ?? "",
      category: training.category ?? "",
      isRequired: training.isRequired,
      effectivenessCheckAfterDays: training.effectivenessCheckAfterDays,
    });
    setEditOpen(true);
  };

  const handleTrainingEdit = async () => {
    try {
      await updateTraining({
        id: trainingId as any,
        title: editForm.title,
        description: editForm.description || undefined,
        category: editForm.category || undefined,
        isRequired: editForm.isRequired,
        effectivenessCheckAfterDays: editForm.effectivenessCheckAfterDays,
      });
      toast.success("Schulung aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const handleTrainingArchive = async () => {
    setArchiveLoading(true);
    try {
      await archiveTraining({ id: trainingId as any });
      toast.success("Schulung archiviert");
      router.push("/trainings");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Archivieren");
    } finally {
      setArchiveLoading(false);
    }
  };

  const openSessionEdit = (session: Session) => {
    setSessionEditForm({
      id: session._id,
      scheduledDate: new Date(session.scheduledDate).toISOString().slice(0, 16),
      location: session.location ?? "",
      trainerName: session.trainerName ?? "",
      maxParticipants: session.maxParticipants?.toString() ?? "",
      notes: session.notes ?? "",
    });
    setSessionEditOpen(true);
  };

  const handleSessionEdit = async () => {
    try {
      await updateSession({
        id: sessionEditForm.id as any,
        scheduledDate: new Date(sessionEditForm.scheduledDate).getTime(),
        location: sessionEditForm.location || undefined,
        trainerName: sessionEditForm.trainerName || undefined,
        maxParticipants: sessionEditForm.maxParticipants
          ? parseInt(sessionEditForm.maxParticipants)
          : undefined,
        notes: sessionEditForm.notes || undefined,
      });
      toast.success("Termin aktualisiert");
      setSessionEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

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
              {can("trainings:manage") && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openTrainingEdit}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive className="mr-1 h-4 w-4" />
                    Archivieren
                  </Button>
                </>
              )}
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
                        {can("trainings:manage") && session.status === "PLANNED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openSessionEdit(session)}
                            title="Termin bearbeiten"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
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

      {/* Training Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schulung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Input
                value={editForm.category}
                onChange={(e) =>
                  setEditForm({ ...editForm, category: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editForm.isRequired}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isRequired: checked })
                }
              />
              <Label>Pflichtschulung</Label>
            </div>
            <div className="space-y-2">
              <Label>Wirksamkeitsprüfung nach (Tage)</Label>
              <Input
                type="number"
                value={editForm.effectivenessCheckAfterDays}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    effectivenessCheckAfterDays: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <Button className="w-full" onClick={handleTrainingEdit}>
              Änderungen speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Edit Dialog */}
      <Dialog open={sessionEditOpen} onOpenChange={setSessionEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Datum & Uhrzeit</Label>
              <Input
                type="datetime-local"
                value={sessionEditForm.scheduledDate}
                onChange={(e) =>
                  setSessionEditForm({
                    ...sessionEditForm,
                    scheduledDate: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ort</Label>
              <Input
                value={sessionEditForm.location}
                onChange={(e) =>
                  setSessionEditForm({
                    ...sessionEditForm,
                    location: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Trainer</Label>
              <Input
                value={sessionEditForm.trainerName}
                onChange={(e) =>
                  setSessionEditForm({
                    ...sessionEditForm,
                    trainerName: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max. Teilnehmer</Label>
              <Input
                type="number"
                value={sessionEditForm.maxParticipants}
                onChange={(e) =>
                  setSessionEditForm({
                    ...sessionEditForm,
                    maxParticipants: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Anmerkungen</Label>
              <Input
                value={sessionEditForm.notes}
                onChange={(e) =>
                  setSessionEditForm({
                    ...sessionEditForm,
                    notes: e.target.value,
                  })
                }
              />
            </div>
            <Button className="w-full" onClick={handleSessionEdit}>
              Änderungen speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <ArchiveConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onConfirm={handleTrainingArchive}
        entityName="Schulung"
        entityLabel={training.title}
        isLoading={archiveLoading}
      />
    </div>
  );
}
