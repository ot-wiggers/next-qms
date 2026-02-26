"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { FileText } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DocumentReferenceNode({ node }: { node: any }) {
  const { documentCode, documentTitle, documentStatus, documentId } = node.attrs;

  return (
    <NodeViewWrapper as="span" className="inline">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="document-reference-chip"
              data-status={documentStatus}
              onClick={() => {
                if (documentId) {
                  window.location.href = `/documents/${documentId}`;
                }
              }}
            >
              <FileText className="size-3.5" />
              {documentCode} {documentTitle}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Status: {documentStatus} · Klicken zum Öffnen
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </NodeViewWrapper>
  );
}
