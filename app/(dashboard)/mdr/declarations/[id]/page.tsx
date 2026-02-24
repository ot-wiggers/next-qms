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
import { ArrowLeft, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Declaration {
  _id: string;
  productId: string;
  version: string;
  status: string;
  fileName: string;
  fileId: string;
  issuedAt: number;
  validFrom: number;
  validUntil: number;
  notifiedBody?: string;
  certificateNumber?: string;
  reviewedAt?: number;
  createdAt: number;
}

interface Product {
  _id: string;
  name: string;
  articleNumber: string;
}

export default function DeclarationDetailPage() {
  const params = useParams();
  const { can } = usePermissions();
  const declarationId = params.id as string;

  const declaration = useQuery(api.declarations.getById, {
    id: declarationId as any,
  }) as Declaration | null | undefined;

  const product = useQuery(
    declaration?.productId ? api.products.getById : api.products.getById,
    declaration?.productId ? { id: declaration.productId as any } : "skip" as any,
  ) as Product | null | undefined;

  const fileUrl = useQuery(
    declaration?.fileId ? api.declarations.getFileUrl : api.declarations.getFileUrl,
    declaration?.fileId ? { fileId: declaration.fileId as any } : "skip" as any,
  ) as string | null | undefined;

  const reviewDeclaration = useMutation(api.declarations.review);

  if (declaration === undefined) {
    return <div className="text-sm text-muted-foreground">Lade DoC...</div>;
  }

  if (!declaration) {
    return <div className="text-sm text-red-600">Konformitätserklärung nicht gefunden</div>;
  }

  const days = daysUntil(declaration.validUntil);
  const allowedTransitions = getAllowedTransitions("docStatus", declaration.status);

  const handleReview = async (newStatus: string) => {
    try {
      await reviewDeclaration({ id: declarationId as any, status: newStatus });
      toast.success(`Status geändert zu "${STATUS_LABELS[newStatus] ?? newStatus}"`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/mdr/declarations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Konformitätserklärung" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>
                {product?.name ?? "Produkt"} — Version {declaration.version}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {declaration.fileName}
                {product && ` · ${product.articleNumber}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {days <= 90 && days > 0 && declaration.status === "VALID" && (
                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  <AlertTriangle className="h-3 w-3" />
                  {days} Tage
                </span>
              )}
              <StatusBadge status={declaration.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              <p className="text-sm">{formatDate(declaration.validUntil)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erstellt</p>
              <p className="text-sm">{formatDate(declaration.createdAt)}</p>
            </div>
          </div>

          {(declaration.notifiedBody || declaration.certificateNumber) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {declaration.notifiedBody && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Benannte Stelle
                  </p>
                  <p className="text-sm">{declaration.notifiedBody}</p>
                </div>
              )}
              {declaration.certificateNumber && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Zertifikatsnummer
                  </p>
                  <p className="text-sm">{declaration.certificateNumber}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {/* Download button */}
            {fileUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1 h-4 w-4" />
                  PDF herunterladen
                </a>
              </Button>
            )}

            {/* Review buttons */}
            {can("declarations:review") &&
              allowedTransitions.map((target) => (
                <Button
                  key={target}
                  variant="outline"
                  size="sm"
                  onClick={() => handleReview(target)}
                >
                  → {STATUS_LABELS[target] ?? target}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
