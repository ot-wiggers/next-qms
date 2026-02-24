"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

interface EffectivenessFormProps {
  participantId: string;
  sessionId: string;
  userId: string;
  onSubmitted?: () => void;
}

export function EffectivenessForm({
  participantId,
  sessionId,
  userId,
  onSubmitted,
}: EffectivenessFormProps) {
  const submitCheck = useMutation(api.effectiveness.submitEffectivenessCheck);

  const [goalAchieved, setGoalAchieved] = useState(false);
  const [applicationVisible, setApplicationVisible] = useState(false);
  const [errorRateReduced, setErrorRateReduced] = useState(false);
  const [decision, setDecision] = useState("");
  const [justification, setJustification] = useState("");

  const handleSubmit = async () => {
    if (!decision) {
      toast.error("Bitte Entscheidung wählen");
      return;
    }
    if (!justification) {
      toast.error("Bitte Begründung angeben");
      return;
    }
    try {
      await submitCheck({
        participantId: participantId as any,
        sessionId: sessionId as any,
        userId: userId as any,
        goalAchieved,
        applicationVisible,
        errorRateReduced,
        decision,
        justification,
      });
      toast.success("Wirksamkeitsprüfung abgeschlossen");
      onSubmitted?.();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Absenden");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <Label>Lernziel erreicht</Label>
            <p className="text-xs text-muted-foreground">
              Hat der Teilnehmer das Lernziel der Schulung erreicht?
            </p>
          </div>
          <Switch checked={goalAchieved} onCheckedChange={setGoalAchieved} />
        </div>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <Label>Anwendung sichtbar</Label>
            <p className="text-xs text-muted-foreground">
              Ist die Umsetzung der Schulungsinhalte im Arbeitsalltag erkennbar?
            </p>
          </div>
          <Switch
            checked={applicationVisible}
            onCheckedChange={setApplicationVisible}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <Label>Fehlerquote reduziert</Label>
            <p className="text-xs text-muted-foreground">
              Konnte eine Reduzierung der Fehlerquote festgestellt werden?
            </p>
          </div>
          <Switch
            checked={errorRateReduced}
            onCheckedChange={setErrorRateReduced}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Entscheidung *</Label>
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger>
            <SelectValue placeholder="Entscheidung wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EFFECTIVE">Wirksam</SelectItem>
            <SelectItem value="INEFFECTIVE">Nicht wirksam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Begründung *</Label>
        <Textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={4}
          placeholder="Bitte Begründung für die Entscheidung angeben"
        />
      </div>

      <Button onClick={handleSubmit}>Wirksamkeitsprüfung absenden</Button>
    </div>
  );
}
