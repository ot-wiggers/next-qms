"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { convertToTiptapJSON, type ConversionResult } from "@/lib/import/document-converter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { toast } from "sonner";
import { FileUp, Loader2, AlertTriangle } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [converting, setConverting] = useState(false);
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [fileName, setFileName] = useState("");

  const [title, setTitle] = useState("");
  const [documentCode, setDocumentCode] = useState("");
  const [documentType, setDocumentType] = useState("work_instruction");
  const [version, setVersion] = useState("1.0");

  const me = useQuery(api.users.me);
  const createDocument = useMutation(api.documents.create);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConverting(true);
    setFileName(file.name);

    try {
      const result = await convertToTiptapJSON(file);
      setConversion(result);
      setTitle(result.title || file.name.replace(/\.[^/.]+$/, ""));
      setDocumentCode(
        file.name
          .replace(/\.[^/.]+$/, "")
          .toUpperCase()
          .replace(/\s+/g, "-")
          .replace(/[^A-Z0-9-]/g, "")
      );
      setStep("preview");

      if (result.warnings.length > 0) {
        toast.warning(`Import-Hinweise: ${result.warnings.join("; ")}`);
      }
    } catch (err: any) {
      toast.error(`Konvertierung fehlgeschlagen: ${err.message}`);
    } finally {
      setConverting(false);
    }
  }, []);

  const handleImport = async () => {
    if (!conversion || !me) return;

    try {
      await createDocument({
        title,
        documentCode,
        documentType,
        version,
        richContent: conversion.json,
        responsibleUserId: me._id as any,
      });
      toast.success("Dokument importiert");
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Importieren");
    }
  };

  const resetState = () => {
    setStep("upload");
    setConversion(null);
    setFileName("");
    setTitle("");
    setDocumentCode("");
    setDocumentType("work_instruction");
    setVersion("1.0");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" ? "Dokument importieren" : `Vorschau: ${fileName}`}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileUp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Word, PDF, Excel oder PowerPoint Datei auswählen
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Unterstützte Formate: .docx, .pdf, .xlsx, .xls, .pptx
              </p>
              <Button variant="outline" onClick={() => {
                const input = window.document.createElement("input");
                input.type = "file";
                input.accept = ".docx,.pdf,.xlsx,.xls,.pptx";
                input.onchange = (ev) => handleFileSelect(ev as unknown as React.ChangeEvent<HTMLInputElement>);
                input.click();
              }} disabled={converting}>
                {converting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Konvertiere...
                  </>
                ) : (
                  "Datei auswählen"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && conversion && (
          <div className="space-y-4 py-2">
            {conversion.warnings.length > 0 && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    {conversion.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titel *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dokumenten-Code *</Label>
                <Input value={documentCode} onChange={(e) => setDocumentCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Dokumententyp *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vorschau</Label>
              <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                <DocumentEditor content={conversion.json} editable={false} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setConversion(null); }}>
                Andere Datei
              </Button>
              <Button onClick={handleImport} disabled={!title || !documentCode}>
                Importieren
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
