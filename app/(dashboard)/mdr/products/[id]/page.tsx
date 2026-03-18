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
import { ArrowLeft, AlertTriangle, FileText, Pencil, Archive, Search, Trash2 } from "lucide-react";
import { ConformitySearchDialog } from "@/components/domain/products/conformity-search-dialog";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
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
  hmvNummer?: string;
  ceMarkPresent?: boolean;
  instructionsPresent?: boolean;
  regulatoryBasis?: string;
  migrationRequired?: boolean;
}

interface Manufacturer {
  _id: string;
  name: string;
  country?: string;
  website?: string;
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
  const { user } = useCurrentUser();
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

  const manufacturers = useQuery(api.products.listManufacturers);

  const updateProduct = useMutation(api.products.update);
  const archiveProduct = useMutation(api.products.archive);
  const permanentDeleteProduct = useMutation(api.products.permanentDelete);
  const reviewDeclaration = useMutation(api.declarations.review);
  const createDeclaration = useMutation(api.declarations.create);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    articleNumber: "",
    udi: "",
    productGroup: "",
    manufacturerId: "",
    riskClass: "",
    notes: "",
    ceMarkPresent: false,
    instructionsPresent: false,
    regulatoryBasis: "MDR",
    hmvNummer: "",
  });

  // Conformity search state
  const [conformitySearchOpen, setConformitySearchOpen] = useState(false);

  // Archive state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      manufacturerId: product.manufacturerId ?? "",
      riskClass: product.riskClass,
      notes: product.notes ?? "",
      ceMarkPresent: product.ceMarkPresent ?? false,
      instructionsPresent: product.instructionsPresent ?? false,
      regulatoryBasis: product.regulatoryBasis ?? "MDR",
      hmvNummer: product.hmvNummer ?? "",
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
        manufacturerId: (editForm.manufacturerId || undefined) as any,
        riskClass: editForm.riskClass,
        notes: editForm.notes || undefined,
        ceMarkPresent: editForm.ceMarkPresent,
        instructionsPresent: editForm.instructionsPresent,
        regulatoryBasis: editForm.regulatoryBasis,
        hmvNummer: editForm.hmvNummer || undefined,
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
              {can("products:delete") && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Löschen
                </Button>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regulatorische Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">CE-Zeichen:</span>{" "}
              <span>{product.ceMarkPresent ? "Vorhanden" : "Fehlt"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Gebrauchsanweisung:</span>{" "}
              <span>{product.instructionsPresent ? "Vorhanden" : "Fehlt"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Grundlage:</span>{" "}
              <StatusBadge status={product.regulatoryBasis ?? "MDR"} />
            </div>
            {product.hmvNummer && (
              <div>
                <span className="text-muted-foreground">HMV-Nr.:</span>{" "}
                <Link
                  href={`/mdr/hilfsmittelverzeichnis?highlight=${product.hmvNummer}`}
                  className="text-blue-600 hover:underline"
                >
                  {product.hmvNummer}
                </Link>
              </div>
            )}
          </div>
          {product.migrationRequired && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Migration erforderlich: Dieses Produkt basiert auf der alten Richtlinie (MDD) und muss auf die MDR (EU 2017/745) migriert werden.
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
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConformitySearchOpen(true)}
            >
              <Search className="mr-1 h-4 w-4" />
              Konformitätserklärung suchen
            </Button>
          </div>
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
              <Label>Hersteller</Label>
              <Select
                value={editForm.manufacturerId}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, manufacturerId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Hersteller wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(manufacturers ?? []).map((m: any) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Regulatorische Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-ceMarkPresent"
                    checked={editForm.ceMarkPresent}
                    onChange={(e) =>
                      setEditForm({ ...editForm, ceMarkPresent: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="edit-ceMarkPresent">CE-Zeichen vorhanden</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-instructionsPresent"
                    checked={editForm.instructionsPresent}
                    onChange={(e) =>
                      setEditForm({ ...editForm, instructionsPresent: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="edit-instructionsPresent">Gebrauchsanweisung vorhanden</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Grundlage</Label>
                  <Select
                    value={editForm.regulatoryBasis}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, regulatoryBasis: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MDR">MDR (EU 2017/745)</SelectItem>
                      <SelectItem value="DIRECTIVE">Richtlinie (93/42/EWG)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>HMV-Nummer</Label>
                  <Input
                    value={editForm.hmvNummer}
                    onChange={(e) =>
                      setEditForm({ ...editForm, hmvNummer: e.target.value })
                    }
                    placeholder="z.B. 18.46.02.1003"
                  />
                </div>
              </div>
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

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produkt endgültig löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Das Produkt <strong>{product.name}</strong> und alle zugehörigen
            Konformitätserklärungen werden unwiderruflich gelöscht.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true);
                try {
                  await permanentDeleteProduct({ id: productId as any });
                  toast.success("Produkt gelöscht");
                  router.push("/mdr/products");
                } catch (err: any) {
                  toast.error(err.message ?? "Fehler beim Löschen");
                } finally {
                  setDeleteLoading(false);
                }
              }}
            >
              {deleteLoading ? "Wird gelöscht..." : "Endgültig löschen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conformity Search Dialog */}
      {user?.organizationId && (
        <ConformitySearchDialog
          open={conformitySearchOpen}
          onOpenChange={setConformitySearchOpen}
          productId={productId}
          productName={product.name}
          manufacturerName={manufacturer?.name ?? ""}
          manufacturerWebsite={manufacturer?.website}
          organizationId={user.organizationId}
          onSelected={async (url) => {
            try {
              await createDeclaration({
                productId: productId as any,
                externalUrl: url,
                version: "1.0",
                issuedAt: Date.now(),
                validFrom: Date.now(),
                validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
              });
              toast.success("Konformitätserklärung aus externer URL erstellt");
            } catch (err: any) {
              toast.error(err.message ?? "Fehler beim Erstellen");
            }
          }}
        />
      )}
    </div>
  );
}
