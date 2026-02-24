"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { ReadConfirmationButton } from "./read-confirmation-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { getAllowedTransitions } from "../../../convex/lib/stateMachine";
import { toast } from "sonner";

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
  sanityDocumentId: string;
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

  if (document === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Dokument...</div>;
  }

  if (!document) {
    return <div className="text-sm text-red-600">Dokument nicht gefunden</div>;
  }

  const allowedTransitions = getAllowedTransitions("documentStatus", document.status);

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

          {/* Status transition buttons */}
          {allowedTransitions.length > 0 && (can("documents:review") || can("documents:approve")) && (
            <div className="mt-4 flex gap-2">
              {allowedTransitions.map((target) => (
                <Button
                  key={target}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(target)}
                >
                  → {STATUS_LABELS[target] ?? target}
                </Button>
              ))}
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
