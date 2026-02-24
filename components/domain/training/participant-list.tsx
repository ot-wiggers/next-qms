"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useState } from "react";
import { Check, X, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Participant {
  _id: string;
  userId: string;
  status: string;
  attendedAt?: number;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ParticipantListProps {
  sessionId: string;
  sessionStatus: string;
}

export function ParticipantList({ sessionId, sessionStatus }: ParticipantListProps) {
  const { can } = usePermissions();
  const participants = useQuery(api.trainings.listParticipants, {
    sessionId: sessionId as any,
  }) as Participant[] | undefined;

  const users = useQuery(api.users.list) as User[] | undefined;
  const addParticipant = useMutation(api.trainings.addParticipant);
  const markAttendance = useMutation(api.trainings.markAttendance);
  const removeParticipant = useMutation(api.trainings.removeParticipant);

  const [selectedUserId, setSelectedUserId] = useState("");

  const participantUserIds = new Set(
    (participants ?? []).map((p: Participant) => p.userId)
  );
  const availableUsers = (users ?? []).filter(
    (u: User) => !participantUserIds.has(u._id)
  );

  const handleAdd = async () => {
    if (!selectedUserId) return;
    try {
      await addParticipant({
        sessionId: sessionId as any,
        userId: selectedUserId as any,
      });
      toast.success("Teilnehmer hinzugefügt");
      setSelectedUserId("");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const handleAttendance = async (participantId: string, attended: boolean) => {
    try {
      await markAttendance({
        participantId: participantId as any,
        attended,
      });
      toast.success(attended ? "Anwesenheit bestätigt" : "Als nicht erschienen markiert");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const handleRemove = async (participantId: string) => {
    try {
      await removeParticipant({ participantId: participantId as any });
      toast.success("Teilnehmer entfernt");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const getUserName = (userId: string) => {
    const user = (users ?? []).find((u: User) => u._id === userId);
    return user ? `${user.firstName} ${user.lastName}` : "Unbekannt";
  };

  return (
    <div className="space-y-4">
      {/* Add participant (only for PLANNED sessions) */}
      {can("trainings:manage") && sessionStatus === "PLANNED" && (
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Teilnehmer auswählen" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((u: User) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={!selectedUserId}>
            <UserPlus className="mr-1 h-4 w-4" />
            Hinzufügen
          </Button>
        </div>
      )}

      {/* Participant list */}
      {(participants?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Teilnehmer</p>
      ) : (
        <div className="space-y-2">
          {(participants ?? []).map((p: Participant) => (
            <div
              key={p._id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {getUserName(p.userId)}
                </span>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex gap-1">
                {/* Attendance buttons (PLANNED sessions, INVITED participants) */}
                {can("trainings:manage") &&
                  sessionStatus === "PLANNED" &&
                  p.status === "INVITED" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleAttendance(p._id, true)}
                        title="Anwesend"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleAttendance(p._id, false)}
                        title="Nicht erschienen"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemove(p._id)}
                        title="Entfernen"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
