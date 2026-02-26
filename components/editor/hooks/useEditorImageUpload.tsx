"use client";

import { useRef, useCallback } from "react";
import { useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

export function useEditorImageUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const convex = useConvex();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editorRef.current) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Bitte wählen Sie eine Bilddatei aus");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Datei zu groß (max. 10 MB)");
        return;
      }

      try {
        toast.loading("Bild wird hochgeladen...", { id: "img-upload" });

        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();

        // Get public URL via Convex query
        const url = await convex.query(api.documents.getFileUrl, {
          fileId: storageId,
        });

        if (!url) throw new Error("URL konnte nicht abgerufen werden");

        editorRef.current
          .chain()
          .focus()
          .setImage({ src: url, alt: file.name })
          .run();

        toast.success("Bild eingefügt", { id: "img-upload" });
      } catch (err) {
        console.error("Image upload failed:", err);
        toast.error("Fehler beim Hochladen", { id: "img-upload" });
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [generateUploadUrl, convex]
  );

  const triggerUpload = useCallback((editor: Editor) => {
    editorRef.current = editor;
    fileInputRef.current?.click();
  }, []);

  const FileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      className="hidden"
      aria-hidden="true"
    />
  );

  return { triggerUpload, FileInput };
}
