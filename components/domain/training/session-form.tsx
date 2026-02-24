"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

interface SessionFormProps {
  trainingId: string;
  onCreated?: () => void;
}

export function SessionForm({ trainingId, onCreated }: SessionFormProps) {
  const createSession = useMutation(api.trainings.createSession);

  const [form, setForm] = useState({
    scheduledDate: "",
    location: "",
    trainerName: "",
    maxParticipants: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.scheduledDate) {
      toast.error("Bitte Datum angeben");
      return;
    }
    try {
      await createSession({
        trainingId: trainingId as any,
        scheduledDate: new Date(form.scheduledDate).getTime(),
        location: form.location || undefined,
        trainerName: form.trainerName || undefined,
        maxParticipants: form.maxParticipants
          ? parseInt(form.maxParticipants)
          : undefined,
        notes: form.notes || undefined,
      });
      toast.success("Termin erstellt");
      setForm({ scheduledDate: "", location: "", trainerName: "", maxParticipants: "", notes: "" });
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Datum *</Label>
          <Input
            type="datetime-local"
            value={form.scheduledDate}
            onChange={(e) =>
              setForm({ ...form, scheduledDate: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Ort</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="z.B. Raum 201"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trainer</Label>
          <Input
            value={form.trainerName}
            onChange={(e) => setForm({ ...form, trainerName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Max. Teilnehmer</Label>
          <Input
            type="number"
            min={1}
            value={form.maxParticipants}
            onChange={(e) =>
              setForm({ ...form, maxParticipants: e.target.value })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Anmerkungen</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />
      </div>
      <Button onClick={handleSubmit} size="sm">
        Termin erstellen
      </Button>
    </div>
  );
}
