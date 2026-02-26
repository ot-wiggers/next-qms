"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { FileIcon, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AttachmentBlockNode({
  node,
  deleteNode,
  editor,
}: {
  node: any;
  deleteNode: () => void;
  editor: any;
}) {
  const { fileName, fileSize, uploadedAt, fileUrl } = node.attrs;
  const isEditable = editor?.isEditable;

  return (
    <NodeViewWrapper>
      <div className="attachment-block">
        <FileIcon className="size-8 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || "Unbenannte Datei"}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(fileSize)}
            {uploadedAt ? ` · ${formatDate(uploadedAt)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {fileUrl && (
            <Button variant="ghost" size="icon-xs" asChild>
              <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                <Download className="size-3.5" />
              </a>
            </Button>
          )}
          {isEditable && (
            <Button variant="ghost" size="icon-xs" onClick={deleteNode}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
