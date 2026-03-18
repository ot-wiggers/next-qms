"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Archive, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Manufacturer {
  _id: Id<"manufacturers">;
  name: string;
  country?: string;
  contactInfo?: string;
  website?: string;
}

interface Product {
  _id: Id<"products">;
  manufacturerId?: Id<"manufacturers">;
}

export default function ManufacturersPage() {
  const { can } = usePermissions();

  const manufacturers = useQuery(api.products.listManufacturers) as Manufacturer[] | undefined;
  const archivedManufacturers = useQuery(api.products.listArchivedManufacturers) as Manufacturer[] | undefined;
  const products = useQuery(api.products.list, {}) as Product[] | undefined;

  const createManufacturer = useMutation(api.products.createManufacturer);
  const updateManufacturer = useMutation(api.products.updateManufacturer);
  const archiveManufacturer = useMutation(api.products.archiveManufacturer);
  const restoreManufacturer = useMutation(api.products.restoreManufacturer);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"manufacturers"> | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<Id<"manufacturers"> | null>(null);

  const [formName, setFormName] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getProductCount = (manufacturerId: Id<"manufacturers">) => {
    if (!products) return 0;
    return products.filter((p) => p.manufacturerId === manufacturerId).length;
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormName("");
    setFormCountry("");
    setFormContact("");
    setFormWebsite("");
    setDialogOpen(true);
  };

  const openEditDialog = (m: Manufacturer) => {
    setEditingId(m._id);
    setFormName(m.name);
    setFormCountry(m.country ?? "");
    setFormContact(m.contactInfo ?? "");
    setFormWebsite(m.website ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Herstellername ist erforderlich.");
      return;
    }
    if (formName.length > 200) {
      toast.error("Herstellername darf maximal 200 Zeichen haben.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateManufacturer({
          id: editingId,
          name: formName.trim(),
          country: formCountry.trim() || undefined,
          contactInfo: formContact.trim() || undefined,
          website: formWebsite.trim() || undefined,
        });
        toast.success("Hersteller aktualisiert.");
      } else {
        await createManufacturer({
          name: formName.trim(),
          country: formCountry.trim() || undefined,
          contactInfo: formContact.trim() || undefined,
          website: formWebsite.trim() || undefined,
        });
        toast.success("Hersteller erstellt.");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Speichern."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveConfirmId) return;
    try {
      await archiveManufacturer({ id: archiveConfirmId });
      toast.success("Hersteller archiviert.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Archivieren."
      );
    } finally {
      setArchiveConfirmId(null);
    }
  };

  const handleRestore = async (id: Id<"manufacturers">) => {
    try {
      await restoreManufacturer({ id });
      toast.success("Hersteller wiederhergestellt.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Wiederherstellen."
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hersteller"
        description="Hersteller und Lieferanten verwalten"
        actions={
          can("products:create") ? (
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1 h-4 w-4" />
              Neuer Hersteller
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Aktiv ({manufacturers?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archiv ({archivedManufacturers?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Land</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead className="w-[100px] text-center">Produkte</TableHead>
                  {can("products:create") && (
                    <TableHead className="w-[120px] text-right">Aktionen</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!manufacturers || manufacturers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={can("products:create") ? 6 : 5}
                      className="text-center text-muted-foreground py-8"
                    >
                      Keine Hersteller vorhanden
                    </TableCell>
                  </TableRow>
                ) : (
                  manufacturers.map((m) => (
                    <TableRow key={m._id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm">
                        {m.country || "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.website ? (
                          <a
                            href={m.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {m.website.replace(/^https?:\/\//, "").split("/")[0]}
                          </a>
                        ) : (
                          "\u2014"
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">
                        {m.contactInfo || "\u2014"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {getProductCount(m._id)}
                      </TableCell>
                      {can("products:create") && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(m)}
                              title="Bearbeiten"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setArchiveConfirmId(m._id)}
                              title="Archivieren"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Land</TableHead>
                  <TableHead>Kontakt</TableHead>
                  {can("products:create") && (
                    <TableHead className="w-[100px] text-right">Aktionen</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!archivedManufacturers || archivedManufacturers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={can("products:create") ? 4 : 3}
                      className="text-center text-muted-foreground py-8"
                    >
                      Keine archivierten Hersteller
                    </TableCell>
                  </TableRow>
                ) : (
                  archivedManufacturers.map((m) => (
                    <TableRow key={m._id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm">
                        {m.country || "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">
                        {m.contactInfo || "\u2014"}
                      </TableCell>
                      {can("products:create") && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestore(m._id)}
                            title="Wiederherstellen"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Hersteller bearbeiten" : "Neuer Hersteller"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Herstellerdaten aktualisieren."
                : "Neuen Hersteller anlegen."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mf-name">Name *</Label>
              <Input
                id="mf-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Herstellername"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mf-country">Land</Label>
              <Input
                id="mf-country"
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                placeholder="z.B. Deutschland"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mf-contact">Kontaktinformationen</Label>
              <Input
                id="mf-contact"
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder="E-Mail, Telefon, Adresse..."
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mf-website">Website</Label>
              <Input
                id="mf-website"
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://www.example.com"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog
        open={!!archiveConfirmId}
        onOpenChange={(open) => {
          if (!open) setArchiveConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hersteller archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Hersteller wird archiviert und ist nicht mehr in der aktiven
              Liste sichtbar. Diese Aktion kann rueckgaengig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
