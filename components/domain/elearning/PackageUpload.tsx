"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Verwaltung: HTML-E-Learning-Paket hochladen und an ein Training anhängen (trainings:manage). */
export function PackageUpload({ trainingId }: { trainingId: Id<"trainings"> }) {
  const generateUrl = useMutation(api.elearning.generatePackageUploadUrl);
  const attach = useMutation(api.elearning.attachPackage);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const url = await generateUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/html" }, body: file });
      const { storageId } = await res.json();
      await attach({ trainingId, fileId: storageId });
      toast.success("Paket hochgeladen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Hochladen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label>
      <input
        type="file"
        accept=".html"
        hidden
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <Button asChild variant="outline" size="sm" disabled={busy}>
        <span>{busy ? "Lädt hoch …" : "HTML-Paket hochladen"}</span>
      </Button>
    </label>
  );
}
