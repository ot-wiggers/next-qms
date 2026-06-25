"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Device = Doc<"deviceRecords">;

function toDateInput(ts: number | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : "";
}

export function DeviceFormDialog({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Device;
  onSaved?: (id: Id<"deviceRecords">) => void;
}) {
  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);

  const [form, setForm] = useState({
    inventoryNumber: "", name: "", manufacturer: "", serialNumber: "",
    location: "", responsible: "", calibrationIntervalMonths: "12", nextDueDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Beim Öffnen (Bearbeiten) befüllen
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        inventoryNumber: initial.inventoryNumber,
        name: initial.name,
        manufacturer: initial.manufacturer ?? "",
        serialNumber: initial.serialNumber ?? "",
        location: initial.location ?? "",
        responsible: initial.responsible ?? "",
        calibrationIntervalMonths: String(initial.calibrationIntervalMonths),
        nextDueDate: toDateInput(initial.nextDueDate),
        notes: initial.notes ?? "",
      });
    } else {
      setForm({
        inventoryNumber: "", name: "", manufacturer: "", serialNumber: "",
        location: "", responsible: "", calibrationIntervalMonths: "12", nextDueDate: "", notes: "",
      });
    }
  }, [open, initial]);

  async function handleSave() {
    if (saving) return;
    if (!form.inventoryNumber.trim()) { toast.error("Prüfmittel-Nr. ist erforderlich"); return; }
    if (!form.name.trim()) { toast.error("Bezeichnung ist erforderlich"); return; }
    const interval = Number(form.calibrationIntervalMonths);
    if (!Number.isFinite(interval) || interval <= 0) { toast.error("Intervall (Monate) muss größer 0 sein"); return; }
    setSaving(true);
    try {
      const payload = {
        inventoryNumber: form.inventoryNumber,
        name: form.name,
        manufacturer: form.manufacturer.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        location: form.location.trim() || undefined,
        responsible: form.responsible.trim() || undefined,
        calibrationIntervalMonths: interval,
        nextDueDate: form.nextDueDate ? new Date(form.nextDueDate).getTime() : undefined,
        notes: form.notes.trim() || undefined,
      };
      if (initial) {
        await updateDevice({ id: initial._id, ...payload });
        toast.success("Prüfmittel gespeichert");
        onSaved?.(initial._id);
      } else {
        const id = await createDevice(payload);
        toast.success("Prüfmittel angelegt");
        onSaved?.(id as Id<"deviceRecords">);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Prüfmittel bearbeiten" : "Prüfmittel anlegen"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="dev-inv">Prüfmittel-Nr. *</Label>
            <Input id="dev-inv" value={form.inventoryNumber}
              onChange={(e) => setForm({ ...form, inventoryNumber: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-name">Bezeichnung *</Label>
            <Input id="dev-name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-mfg">Hersteller</Label>
            <Input id="dev-mfg" value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-sn">Seriennummer</Label>
            <Input id="dev-sn" value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-loc">Standort</Label>
            <Input id="dev-loc" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-resp">Verantwortlich</Label>
            <Input id="dev-resp" value={form.responsible}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-interval">Intervall (Monate) *</Label>
            <Input id="dev-interval" type="number" min="1" value={form.calibrationIntervalMonths}
              onChange={(e) => setForm({ ...form, calibrationIntervalMonths: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dev-due">Nächster Soll-Termin</Label>
            <Input id="dev-due" type="date" value={form.nextDueDate}
              onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">Optional — wird bei erfasster Kalibrierung automatisch neu berechnet.</p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="dev-notes">Bemerkungen</Label>
            <Textarea id="dev-notes" rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
