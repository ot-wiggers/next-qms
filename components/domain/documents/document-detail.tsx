"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { ReadConfirmationButton } from "./read-confirmation-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { getAllowedTransitions } from "../../../convex/lib/stateMachine";
import { Pencil, SquarePen } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { DocumentEditor } from "@/components/editor/DocumentEditor";

interface DocumentDetailProps {
  documentId: string;
}

interface DocumentRecord {
  _id: string;
  title?: string;
  documentCode: string;
  documentType: string;
  version: string;
  status: string;
  content?: string;
  richContent?: any;
  validFrom?: number;
  validUntil?: number;
  createdAt: number;
  updatedAt: number;
}

interface ReadConfirmation {
  _id: string;
  userId: string;
  documentVersion: string;
  confirmedAt: number;
}

export function DocumentDetail({ documentId }: DocumentDetailProps) {
  const { can } = usePermissions();
  const document = useQuery(api.documents.getById, {
    id: documentId as any,
  }) as DocumentRecord | null | undefined;

  const confirmations = useQuery(api.documents.listReadConfirmations, {
    documentRecordId: documentId as any,
  }) as ReadConfirmation[] | undefined;

  const updateStatus = useMutation(api.documents.updateStatus);
  const updateDocument = useMutation(api.documents.update);

  const [contentEditOpen, setContentEditOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState("");

  if (document === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Dokument...</div>;
  }

  if (!document) {
    return <div className="text-sm text-red-600">Dokument nicht gefunden</div>;
  }

  const allowedTransitions = getAllowedTransitions("documentStatus", document.status);

  const openContentEdit = () => {
    setContentDraft(document.content ?? "");
    setContentEditOpen(true);
  };

  const handleContentSave = async () => {
    try {
      await updateDocument({
        id: documentId as any,
        content: contentDraft,
      });
      toast.success("Inhalt aktualisiert");
      setContentEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Speichern");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus({ id: documentId as any, status: newStatus });
      toast.success(`Status geändert zu "${STATUS_LABELS[newStatus] ?? newStatus}"`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Ändern des Status");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{document.title ?? document.documentCode}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[document.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? document.documentType}
                {" · "}
                <code>{document.documentCode}</code>
                {" · Version "}
                {document.version}
              </p>
            </div>
            <StatusBadge status={document.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erstellt</p>
              <p className="text-sm">{formatDate(document.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Aktualisiert</p>
              <p className="text-sm">{formatDate(document.updatedAt)}</p>
            </div>
            {document.validFrom && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Gültig ab</p>
                <p className="text-sm">{formatDate(document.validFrom)}</p>
              </div>
            )}
            {document.validUntil && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Gültig bis</p>
                <p className="text-sm">{formatDate(document.validUntil)}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Edit button */}
            {can("documents:create") && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/documents/${document._id}/edit`}>
                  <SquarePen className="mr-1 h-3.5 w-3.5" />
                  Bearbeiten
                </Link>
              </Button>
            )}

            {/* Status transition buttons */}
            {allowedTransitions.map((target) => (
              (can("documents:review") || can("documents:approve")) && (
                <Button
                  key={target}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(target)}
                >
                  → {STATUS_LABELS[target] ?? target}
                </Button>
              )
            ))}
          </div>

          {/* Rich content (Tiptap editor, read-only) */}
          {document.richContent && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Inhalt</p>
              <DocumentEditor content={document.richContent} editable={false} />
            </div>
          )}

          {/* Fallback: plain text content */}
          {!document.richContent && document.content && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Inhalt</p>
                {can("documents:create") && (
                  <Button variant="outline" size="sm" onClick={openContentEdit}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Inhalt bearbeiten
                  </Button>
                )}
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {document.content}
                </pre>
              </div>
            </div>
          )}

          {/* No content yet */}
          {!document.richContent && !document.content && can("documents:create") && (
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/documents/${document._id}/edit`}>
                  <Pencil className="mr-1 h-3 w-3" />
                  Inhalt hinzufügen
                </Link>
              </Button>
            </div>
          )}

          {/* Read confirmation button (only for APPROVED docs) */}
          {document.status === "APPROVED" && (
            <div className="mt-4">
              <ReadConfirmationButton documentRecordId={document._id} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Edit Dialog */}
      <Dialog open={contentEditOpen} onOpenChange={setContentEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumentinhalt bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Inhalt (Markdown)</Label>
              <Textarea
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                rows={16}
                className="font-mono text-sm"
                placeholder="Dokumentinhalt hier eingeben..."
              />
            </div>
            <Button className="w-full" onClick={handleContentSave}>
              Änderungen speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="confirmations">
        <TabsList>
          <TabsTrigger value="confirmations">
            Lesebestätigungen ({confirmations?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="history">Verlauf</TabsTrigger>
        </TabsList>
        <TabsContent value="confirmations" className="mt-4">
          {(confirmations?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Lesebestätigungen vorhanden
            </p>
          ) : (
            <div className="space-y-2">
              {confirmations!.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>Version {c.documentVersion}</span>
                  <span className="text-muted-foreground">
                    {formatDate(c.confirmedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <AuditHistory
            entityType="documentRecords"
            entityId={document._id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
