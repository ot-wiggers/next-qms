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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface FeedbackFormProps {
  participantId: string;
  sessionId: string;
  trainingId: string;
}

const RATING_LABELS: Record<string, string> = {
  contentRelevance: "Inhaltliche Relevanz",
  trainerCompetence: "Trainerkompetenz",
  methodology: "Methodik",
  practicalApplicability: "Praxisanwendbarkeit",
  organizationQuality: "Organisationsqualität",
  overallSatisfaction: "Gesamtzufriedenheit",
};

const SCALE_LABELS = [
  "1 — Sehr gut",
  "2 — Gut",
  "3 — Befriedigend",
  "4 — Ausreichend",
  "5 — Mangelhaft",
  "6 — Ungenügend",
];

export function FeedbackForm({ participantId, sessionId, trainingId }: FeedbackFormProps) {
  const router = useRouter();
  const submitFeedback = useMutation(api.effectiveness.submitFeedback);

  const [ratings, setRatings] = useState<Record<string, string>>({
    contentRelevance: "",
    trainerCompetence: "",
    methodology: "",
    practicalApplicability: "",
    organizationQuality: "",
    overallSatisfaction: "",
  });
  const [comments, setComments] = useState("");
  const [improvementSuggestions, setImprovementSuggestions] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState(true);

  const handleSubmit = async () => {
    const ratingKeys = Object.keys(ratings);
    const missingRatings = ratingKeys.filter((k) => !ratings[k]);
    if (missingRatings.length > 0) {
      toast.error("Bitte alle Bewertungen ausfüllen");
      return;
    }

    try {
      await submitFeedback({
        participantId: participantId as any,
        sessionId: sessionId as any,
        ratings: {
          contentRelevance: parseInt(ratings.contentRelevance),
          trainerCompetence: parseInt(ratings.trainerCompetence),
          methodology: parseInt(ratings.methodology),
          practicalApplicability: parseInt(ratings.practicalApplicability),
          organizationQuality: parseInt(ratings.organizationQuality),
          overallSatisfaction: parseInt(ratings.overallSatisfaction),
        },
        comments: comments || undefined,
        improvementSuggestions: improvementSuggestions || undefined,
        wouldRecommend,
      });
      toast.success("Feedback erfolgreich abgegeben");
      router.push(`/trainings/${trainingId}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Absenden");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4">
        {Object.entries(RATING_LABELS).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label>{label} *</Label>
            <Select
              value={ratings[key]}
              onValueChange={(v) =>
                setRatings({ ...ratings, [key]: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Bewertung wählen" />
              </SelectTrigger>
              <SelectContent>
                {SCALE_LABELS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Kommentare</Label>
        <Textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label>Verbesserungsvorschläge</Label>
        <Textarea
          value={improvementSuggestions}
          onChange={(e) => setImprovementSuggestions(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <Label>Weiterempfehlung</Label>
          <p className="text-xs text-muted-foreground">
            Würden Sie diese Schulung weiterempfehlen?
          </p>
        </div>
        <Switch
          checked={wouldRecommend}
          onCheckedChange={setWouldRecommend}
        />
      </div>

      <Button onClick={handleSubmit}>Feedback absenden</Button>
    </div>
  );
}
