"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function TrainingForm() {
  const router = useRouter();
  const createTraining = useMutation(api.trainings.create);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    isRequired: false,
    effectivenessCheckAfterDays: 30,
  });

  const handleSubmit = async () => {
    if (!form.title) {
      toast.error("Bitte Titel angeben");
      return;
    }
    try {
      const id = await createTraining({
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        isRequired: form.isRequired,
        effectivenessCheckAfterDays: form.effectivenessCheckAfterDays,
      });
      toast.success("Schulung erstellt");
      router.push(`/trainings/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label>Titel *</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="z.B. MDR-Grundlagenschulung"
        />
      </div>

      <div className="space-y-2">
        <Label>Beschreibung</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Kategorie</Label>
        <Input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="z.B. Regulatorik, QM, Produkt"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <Label>Pflichtschulung</Label>
          <p className="text-xs text-muted-foreground">
            Pflichtschulungen werden allen zugewiesenen Mitarbeitern angezeigt
          </p>
        </div>
        <Switch
          checked={form.isRequired}
          onCheckedChange={(checked) => setForm({ ...form, isRequired: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>Wirksamkeitsprüfung nach (Tage)</Label>
        <Input
          type="number"
          min={1}
          max={365}
          value={form.effectivenessCheckAfterDays}
          onChange={(e) =>
            setForm({
              ...form,
              effectivenessCheckAfterDays: parseInt(e.target.value) || 30,
            })
          }
        />
      </div>

      <Button onClick={handleSubmit}>Schulung erstellen</Button>
    </div>
  );
}
