"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CALIBRATION_RESULTS, CALIBRATION_RESULT_LABELS, type CalibrationResult } from "@/lib/types/enums";
import { toast } from "sonner";

export function CalibrationDialog({
  open, onOpenChange, deviceId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deviceId: Id<"deviceRecords">;
  onSaved?: () => void;
}) {
  const recordCalibration = useMutation(api.devices.recordCalibration);
  const generateUploadUrl = useMutation(api.devices.generateUploadUrl);

  const [form, setForm] = useState({
    calibrationDate: new Date().toISOString().slice(0, 10),
    performedBy: "",
    result: "PASSED" as CalibrationResult,
    notes: "",
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    if (!form.calibrationDate) { toast.error("Kalibrierdatum ist erforderlich"); return; }
    setSaving(true);
    try {
      let certFileId: Id<"_storage"> | undefined;
      if (certFile) {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": certFile.type || "application/octet-stream" },
          body: certFile,
        });
        if (!res.ok) throw new Error("Zertifikat-Upload fehlgeschlagen");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        certFileId = storageId;
      }
      await recordCalibration({
        deviceId,
        calibrationDate: new Date(form.calibrationDate).getTime(),
        performedBy: form.performedBy.trim() || undefined,
        result: form.result,
        certFileId,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Kalibrierung erfasst");
      setCertFile(null);
      setForm({ calibrationDate: new Date().toISOString().slice(0, 10), performedBy: "", result: "PASSED", notes: "" });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Kalibrierung erfassen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cal-date">Kalibrierdatum *</Label>
            <Input id="cal-date" type="date" value={form.calibrationDate}
              onChange={(e) => setForm({ ...form, calibrationDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cal-by">Durchgeführt von (Labor/Person)</Label>
            <Input id="cal-by" value={form.performedBy}
              onChange={(e) => setForm({ ...form, performedBy: e.target.value })} />
          </div>
          <div>
            <Label>Ergebnis *</Label>
            <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as CalibrationResult })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CALIBRATION_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{CALIBRATION_RESULT_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cal-cert">Kalibrierzertifikat (PDF/Bild)</Label>
            <Input id="cal-cert" type="file" accept="application/pdf,image/*"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label htmlFor="cal-notes">Bemerkungen</Label>
            <Textarea id="cal-notes" rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Der nächste Soll-Termin wird automatisch als Kalibrierdatum + Intervall gesetzt.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
