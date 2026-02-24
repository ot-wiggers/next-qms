"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { ArchiveConfirmDialog } from "@/components/shared/archive-confirm-dialog";
import { DeclarationUpload } from "@/components/domain/products/declaration-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate, daysUntil } from "@/lib/utils/dates";
import { STATUS_LABELS, RISK_CLASSES } from "@/lib/types/enums";
import { getAllowedTransitions } from "../../../../../convex/lib/stateMachine";
import { ArrowLeft, AlertTriangle, FileText, Pencil, Archive } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Product {
  _id: string;
  name: string;
  articleNumber: string;
  udi?: string;
  productGroup?: string;
  manufacturerId?: string;
  riskClass: string;
  status: string;
  notes?: string;
  createdAt: number;
}

interface Manufacturer {
  _id: string;
  name: string;
  country?: string;
}

interface Declaration {
  _id: string;
  productId: string;
  version: string;
  status: string;
  validFrom: number;
  validUntil: number;
  fileName: string;
  fileId: string;
  notifiedBody?: string;
  certificateNumber?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = usePermissions();
  const productId = params.id as string;

  const product = useQuery(api.products.getById, {
    id: productId as any,
  }) as Product | null | undefined;

  const declarations = useQuery(api.declarations.list, {
    productId: productId as any,
  }) as Declaration[] | undefined;

  const manufacturer = useQuery(
    product?.manufacturerId ? api.products.getManufacturer : api.products.getManufacturer,
    product?.manufacturerId ? { id: product.manufacturerId as any } : "skip" as any,
  ) as Manufacturer | null | undefined;

  const updateProduct = useMutation(api.products.update);
  const archiveProduct = useMutation(api.products.archive);
  const reviewDeclaration = useMutation(api.declarations.review);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    articleNumber: "",
    udi: "",
    productGroup: "",
    riskClass: "",
    notes: "",
  });

  // Archive state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  if (product === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Produkt...</div>;
  }

  if (!product) {
    return <div className="text-sm text-red-600">Produkt nicht gefunden</div>;
  }

  const openEdit = () => {
    setEditForm({
      name: product.name,
      articleNumber: product.articleNumber,
      udi: product.udi ?? "",
      productGroup: product.productGroup ?? "",
      riskClass: product.riskClass,
      notes: product.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await updateProduct({
        id: productId as any,
        name: editForm.name,
        articleNumber: editForm.articleNumber,
        udi: editForm.udi || undefined,
        productGroup: editForm.productGroup || undefined,
        riskClass: editForm.riskClass,
        notes: editForm.notes || undefined,
      });
      toast.success("Produkt aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const handleArchive = async () => {
    setArchiveLoading(true);
    try {
      await archiveProduct({ id: productId as any });
      toast.success("Produkt archiviert");
      router.push("/mdr/products");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Archivieren");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleReview = async (declarationId: string, currentStatus: string, newStatus: string) => {
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
          <Link href="/mdr/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={product.name} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{product.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Art.-Nr. {product.articleNumber}
                {product.udi && ` · UDI: ${product.udi}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {can("products:update") && (
                <>
                  <Button variant="outline" size="sm" onClick={openEdit}>
                    <Pencil className="mr-1 h-4 w-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive className="mr-1 h-4 w-4" />
                    Archivieren
                  </Button>
                </>
              )}
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                Klasse {product.riskClass}
              </span>
              <StatusBadge status={product.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {product.productGroup && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Produktgruppe</p>
                <p className="text-sm">{product.productGroup}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Hersteller</p>
              <p className="text-sm">{manufacturer?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erstellt</p>
              <p className="text-sm">{formatDate(product.createdAt)}</p>
            </div>
          </div>
          {product.notes && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Anmerkungen</p>
              <p className="text-sm">{product.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="declarations">
        <TabsList>
          <TabsTrigger value="declarations">
            Konformitätserklärungen ({declarations?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="upload">Neue DoC hochladen</TabsTrigger>
          <TabsTrigger value="history">Verlauf</TabsTrigger>
        </TabsList>

        <TabsContent value="declarations" className="mt-4 space-y-3">
          {(declarations?.length ?? 0) === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              Keine Konformitätserklärungen vorhanden
            </div>
          ) : (
            (declarations ?? []).map((doc: Declaration) => {
              const days = daysUntil(doc.validUntil);
              const allowedTransitions = getAllowedTransitions("docStatus", doc.status);
              return (
                <Card key={doc._id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Version {doc.version} — {doc.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Gültig: {formatDate(doc.validFrom)} bis{" "}
                          {formatDate(doc.validUntil)}
                          {doc.status === "VALID" && days <= 90 && days > 0 && (
                            <span className="ml-2 text-orange-600">
                              <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                              Noch {days} Tage
                            </span>
                          )}
                          {doc.notifiedBody && ` · ${doc.notifiedBody}`}
                          {doc.certificateNumber && ` · Nr. ${doc.certificateNumber}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc.status} />
                      {can("declarations:review") &&
                        allowedTransitions.map((target) => (
                          <Button
                            key={target}
                            variant="outline"
                            size="sm"
                            onClick={() => handleReview(doc._id, doc.status, target)}
                          >
                            → {STATUS_LABELS[target] ?? target}
                          </Button>
                        ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/mdr/declarations/${doc._id}`)}
                      >
                        Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          {can("declarations:upload") ? (
            <DeclarationUpload productId={productId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Berechtigung zum Hochladen
            </p>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <AuditHistory entityType="products" entityId={product._id} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produkt bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Art.-Nr.</Label>
                <Input
                  value={editForm.articleNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, articleNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>UDI</Label>
                <Input
                  value={editForm.udi}
                  onChange={(e) =>
                    setEditForm({ ...editForm, udi: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Produktgruppe</Label>
              <Input
                value={editForm.productGroup}
                onChange={(e) =>
                  setEditForm({ ...editForm, productGroup: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Risikoklasse</Label>
              <Select
                value={editForm.riskClass}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, riskClass: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_CLASSES.map((rc) => (
                    <SelectItem key={rc} value={rc}>
                      Klasse {rc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anmerkungen</Label>
              <Input
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </div>
            <Button className="w-full" onClick={handleEdit}>
              Änderungen speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <ArchiveConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onConfirm={handleArchive}
        entityName="Produkt"
        entityLabel={product.name}
        isLoading={archiveLoading}
      />
    </div>
  );
}
