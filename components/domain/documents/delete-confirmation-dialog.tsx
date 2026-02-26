"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentCode: string;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  documentCode,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const [typedCode, setTypedCode] = useState("");
  const [understood, setUnderstood] = useState(false);

  const canDelete = typedCode === documentCode && understood;

  const handleConfirm = () => {
    if (!canDelete) return;
    onConfirm();
    setTypedCode("");
    setUnderstood(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setTypedCode(""); setUnderstood(false); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Dokument endgültig löschen
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden. Das Dokument, alle
            Versionen, Lesebestätigungen und Reviews werden unwiderruflich gelöscht.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>
              Bitte geben Sie <code className="font-bold">{documentCode}</code> zur Bestätigung ein:
            </Label>
            <Input
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
              placeholder={documentCode}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(c) => setUnderstood(c === true)}
            />
            <label htmlFor="understood" className="text-sm leading-none pt-0.5">
              Ich verstehe, dass alle Versionen und Lesebestätigungen ebenfalls gelöscht werden
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!canDelete}>
              Endgültig löschen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
