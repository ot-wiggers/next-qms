"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function NewTrainingRequestPage() {
  const router = useRouter();
  const createRequest = useMutation(api.trainingRequests.create);

  const [form, setForm] = useState({
    topic: "",
    justification: "",
    urgency: "MEDIUM",
    externalLink: "",
    estimatedCost: "",
  });

  const handleSubmit = async () => {
    if (!form.topic || !form.justification) {
      toast.error("Bitte Thema und Begründung ausfüllen");
      return;
    }
    try {
      await createRequest({
        topic: form.topic,
        justification: form.justification,
        urgency: form.urgency,
        externalLink: form.externalLink || undefined,
        estimatedCost: form.estimatedCost
          ? parseFloat(form.estimatedCost)
          : undefined,
      });
      toast.success("Schulungsantrag eingereicht");
      router.push("/training-requests");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/training-requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Neuen Schulungsantrag stellen" />
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label>Thema *</Label>
          <Input
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="z.B. Fortbildung MDR-Klassifizierung"
          />
        </div>

        <div className="space-y-2">
          <Label>Begründung *</Label>
          <Textarea
            value={form.justification}
            onChange={(e) =>
              setForm({ ...form, justification: e.target.value })
            }
            rows={4}
            placeholder="Warum ist diese Schulung notwendig?"
          />
        </div>

        <div className="space-y-2">
          <Label>Dringlichkeit</Label>
          <Select
            value={form.urgency}
            onValueChange={(v) => setForm({ ...form, urgency: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Niedrig</SelectItem>
              <SelectItem value="MEDIUM">Mittel</SelectItem>
              <SelectItem value="HIGH">Hoch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Externer Link</Label>
          <Input
            type="url"
            value={form.externalLink}
            onChange={(e) =>
              setForm({ ...form, externalLink: e.target.value })
            }
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label>Geschätzte Kosten (EUR)</Label>
          <Input
            type="number"
            min={0}
            value={form.estimatedCost}
            onChange={(e) =>
              setForm({ ...form, estimatedCost: e.target.value })
            }
            placeholder="0.00"
          />
        </div>

        <Button onClick={handleSubmit}>Antrag einreichen</Button>
      </div>
    </div>
  );
}
