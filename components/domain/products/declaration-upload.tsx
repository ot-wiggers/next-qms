"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface DeclarationUploadProps {
  productId: string;
  onCreated?: () => void;
}

export function DeclarationUpload({ productId, onCreated }: DeclarationUploadProps) {
  const createDeclaration = useMutation(api.declarations.create);

  const [form, setForm] = useState({
    version: "",
    issuedAt: "",
    validFrom: "",
    validUntil: "",
    notifiedBody: "",
    certificateNumber: "",
  });
  const [fileId, setFileId] = useState("");
  const [fileName, setFileName] = useState("");

  const handleFileUploaded = (id: string, name: string) => {
    setFileId(id);
    setFileName(name);
    toast.success(`Datei "${name}" hochgeladen`);
  };

  const handleSubmit = async () => {
    if (!fileId || !form.version || !form.issuedAt || !form.validFrom || !form.validUntil) {
      toast.error("Bitte alle Pflichtfelder ausfüllen und Datei hochladen");
      return;
    }
    try {
      await createDeclaration({
        productId: productId as any,
        fileId: fileId as any,
        fileName,
        version: form.version,
        issuedAt: new Date(form.issuedAt).getTime(),
        validFrom: new Date(form.validFrom).getTime(),
        validUntil: new Date(form.validUntil).getTime(),
        notifiedBody: form.notifiedBody || undefined,
        certificateNumber: form.certificateNumber || undefined,
      });
      toast.success("Konformitätserklärung erstellt");
      setForm({ version: "", issuedAt: "", validFrom: "", validUntil: "", notifiedBody: "", certificateNumber: "" });
      setFileId("");
      setFileName("");
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Dokument hochladen *</Label>
        <FileUpload
          onUploadComplete={handleFileUploaded}
          accept=".pdf"
          label={fileName ? `Datei: ${fileName}` : "PDF hochladen"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Version *</Label>
          <Input
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            placeholder="z.B. 1.0"
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

      <Button onClick={handleSubmit} disabled={!fileId}>
        Konformitätserklärung einreichen
      </Button>
    </div>
  );
}
