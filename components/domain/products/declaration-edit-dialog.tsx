"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DeclarationData {
  _id: string;
  version: string;
  issuedAt: number;
  validFrom: number;
  validUntil: number;
  notifiedBody?: string;
  certificateNumber?: string;
  externalUrl?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declaration: DeclarationData;
}

function toDateInput(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

export function DeclarationEditDialog({ open, onOpenChange, declaration }: Props) {
  const updateDeclaration = useMutation(api.declarations.update);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    version: "",
    issuedAt: "",
    validFrom: "",
    validUntil: "",
    notifiedBody: "",
    certificateNumber: "",
    externalUrl: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        version: declaration.version,
        issuedAt: toDateInput(declaration.issuedAt),
        validFrom: toDateInput(declaration.validFrom),
        validUntil: toDateInput(declaration.validUntil),
        notifiedBody: declaration.notifiedBody ?? "",
        certificateNumber: declaration.certificateNumber ?? "",
        externalUrl: declaration.externalUrl ?? "",
      });
    }
  }, [open, declaration]);

  const handleSubmit = async () => {
    if (!form.version || !form.issuedAt || !form.validFrom || !form.validUntil) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    setLoading(true);
    try {
      await updateDeclaration({
        id: declaration._id as any,
        version: form.version,
        issuedAt: new Date(form.issuedAt).getTime(),
        validFrom: new Date(form.validFrom).getTime(),
        validUntil: new Date(form.validUntil).getTime(),
        notifiedBody: form.notifiedBody || undefined,
        certificateNumber: form.certificateNumber || undefined,
        externalUrl: form.externalUrl || undefined,
      });
      toast.success("Konformitätserklärung aktualisiert");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konformitätserklärung bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Version *</Label>
              <Input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ausstellungsdatum *</Label>
              <Input
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gültig ab *</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis *</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Benannte Stelle</Label>
              <Input
                value={form.notifiedBody}
                onChange={(e) => setForm({ ...form, notifiedBody: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Zertifikatsnummer</Label>
              <Input
                value={form.certificateNumber}
                onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Externe URL</Label>
            <Input
              value={form.externalUrl}
              onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
