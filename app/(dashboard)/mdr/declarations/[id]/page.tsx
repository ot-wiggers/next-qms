"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate, daysUntil } from "@/lib/utils/dates";
import { STATUS_LABELS } from "@/lib/types/enums";
import { getAllowedTransitions } from "../../../../../convex/lib/stateMachine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeclarationEditDialog } from "@/components/domain/products/declaration-edit-dialog";
import { DeclarationStatusDialog } from "@/components/domain/products/declaration-status-dialog";
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  ExternalLink,
  FileText,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

export default function DeclarationDetailPage() {
  const params = useParams();
  const { can } = usePermissions();
  const declarationId = params.id as string;
  const [showPdfPreview, setShowPdfPreview] = useState(true);
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const archiveDeclaration = useMutation(api.declarations.archive);
  const permanentDeleteDeclaration = useMutation(api.declarations.permanentDelete);

  const declaration = useQuery(api.declarations.getById, {
    id: declarationId as any,
  });

  const product = useQuery(
    api.products.getById,
    declaration?.productId ? { id: declaration.productId as any } : "skip" as any,
  );

  const fileUrl = useQuery(
    api.declarations.getFileUrl,
    declaration?.fileId ? { fileId: declaration.fileId as any } : "skip" as any,
  ) as string | null | undefined;

  if (declaration === undefined) {
    return <div className="text-sm text-muted-foreground">Lade DoC...</div>;
  }

  if (!declaration) {
    return <div className="text-sm text-red-600">Konformitätserklärung nicht gefunden</div>;
  }

  const days = daysUntil(declaration.validUntil);
  const allowedTransitions = getAllowedTransitions("docStatus", declaration.status);
  const pdfSource = fileUrl || declaration.externalUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/mdr/declarations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Konformitätserklärung" />
      </div>

      {/* Main info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>
                {product?.name ?? "Produkt"} — Version {declaration.version}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {declaration.fileName}
                {product && ` · ${(product as any).articleNumber}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {days <= 90 && days > 0 && (declaration.status === "VALID" || declaration.status === "EXPIRING") && (
                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  <AlertTriangle className="h-3 w-3" />
                  {days} Tage verbleibend
                </span>
              )}
              {days <= 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Abgelaufen
                </span>
              )}
              <StatusBadge status={declaration.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Ausgestellt</p>
              <p className="text-sm">{formatDate(declaration.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Gültig ab</p>
              <p className="text-sm">{formatDate(declaration.validFrom)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Gültig bis</p>
              <p className={`text-sm ${days <= 90 ? "font-medium text-orange-700" : ""} ${days <= 0 ? "font-medium text-red-700" : ""}`}>
                {formatDate(declaration.validUntil)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erstellt am</p>
              <p className="text-sm">{formatDate(declaration.createdAt)}</p>
            </div>
          </div>

          {/* Additional fields */}
          {(declaration.notifiedBody || declaration.certificateNumber) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {declaration.notifiedBody && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Benannte Stelle</p>
                  <p className="text-sm">{declaration.notifiedBody}</p>
                </div>
              )}
              {declaration.certificateNumber && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Zertifikatsnummer</p>
                  <p className="text-sm">{declaration.certificateNumber}</p>
                </div>
              )}
            </div>
          )}

          {/* External URL info */}
          {declaration.externalUrl && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Externe Quelle</p>
              <a
                href={declaration.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {declaration.externalUrl}
              </a>
            </div>
          )}

          {/* Review comment */}
          {declaration.reviewComment && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Prüfkommentar</p>
              <p className="text-sm">{declaration.reviewComment}</p>
              {declaration.reviewedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(declaration.reviewedAt)}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {pdfSource && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={pdfSource} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1.5 h-4 w-4" />
                    PDF herunterladen
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPdfPreview(!showPdfPreview)}
                >
                  <Eye className="mr-1.5 h-4 w-4" />
                  {showPdfPreview ? "Vorschau ausblenden" : "Vorschau anzeigen"}
                </Button>
              </>
            )}
            {!pdfSource && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Kein Dokument hinterlegt
              </div>
            )}

            {can("declarations:review") &&
              allowedTransitions.map((target) => (
                <Button
                  key={target}
                  variant={target === "REJECTED" || target === "WITHDRAWN" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTargetStatus(target);
                    setStatusDialogOpen(true);
                  }}
                >
                  → {STATUS_LABELS[target] ?? target}
                </Button>
              ))}

            {can("declarations:upload") && declaration.status !== "WITHDRAWN" && declaration.status !== "SUPERSEDED" && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Bearbeiten
              </Button>
            )}
            {can("declarations:upload") && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Löschen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PDF Preview */}
      {pdfSource && showPdfPreview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dokumentvorschau
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden bg-muted/20">
              <iframe
                src={pdfSource}
                className="w-full h-[700px]"
                title={`PDF Vorschau: ${declaration.fileName ?? "Konformitätserklärung"}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: History */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Verlauf</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4">
          <AuditHistory
            entityType="declarationsOfConformity"
            entityId={declaration._id}
          />
        </TabsContent>
      </Tabs>

      {/* Status Change Dialog */}
      {statusDialogOpen && (
        <DeclarationStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          declarationId={declaration._id}
          currentStatus={declaration.status}
          targetStatus={targetStatus}
        />
      )}

      {/* Edit Dialog */}
      {editOpen && (
        <DeclarationEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          declaration={declaration}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konformitätserklärung löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Diese Aktion kann nicht rückgängig gemacht werden. Die Konformitätserklärung
            (Version {declaration.version}) wird {can("declarations:delete") ? "endgültig gelöscht" : "archiviert"}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true);
                try {
                  if (can("declarations:delete")) {
                    await permanentDeleteDeclaration({ id: declaration._id as any });
                    toast.success("Konformitätserklärung endgültig gelöscht");
                  } else {
                    await archiveDeclaration({ id: declaration._id as any });
                    toast.success("Konformitätserklärung archiviert");
                  }
                  router.push("/mdr/declarations");
                } catch (err: any) {
                  toast.error(err.message ?? "Fehler");
                } finally {
                  setDeleteLoading(false);
                }
              }}
            >
              {deleteLoading ? "Wird gelöscht..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
