"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileText } from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";

interface DocumentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (doc: {
    documentId: string;
    documentCode: string;
    documentTitle: string;
    documentStatus: string;
  }) => void;
}

export function DocumentPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: DocumentPickerDialogProps) {
  const documents = useQuery(api.documents.list, {}) as
    | Array<{
        _id: string;
        title?: string;
        documentCode: string;
        documentType: string;
        version: string;
        status: string;
      }>
    | undefined;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dokument verlinken"
      description="Suchen Sie ein Dokument, um eine Referenz einzufügen"
    >
      <CommandInput placeholder="Dokument suchen..." />
      <CommandList>
        <CommandEmpty>Keine Dokumente gefunden.</CommandEmpty>
        <CommandGroup heading="Dokumente">
          {(documents ?? []).map((doc) => (
            <CommandItem
              key={doc._id}
              value={`${doc.documentCode} ${doc.title ?? ""}`}
              onSelect={() => {
                onSelect({
                  documentId: doc._id,
                  documentCode: doc.documentCode,
                  documentTitle: doc.title ?? doc.documentCode,
                  documentStatus: doc.status,
                });
                onOpenChange(false);
              }}
            >
              <FileText className="text-muted-foreground" />
              <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <span className="font-medium">{doc.documentCode}</span>
                  {doc.title && (
                    <span className="ml-2 text-muted-foreground truncate">
                      {doc.title}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.documentType}
                    {" · v"}
                    {doc.version}
                  </span>
                </div>
                <StatusBadge status={doc.status} />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
