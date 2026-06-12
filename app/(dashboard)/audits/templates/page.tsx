"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { toast } from "sonner";

type TemplateItem = {
  _id: Id<"auditChecklistTemplateItems">;
  chapter: string;
  chapterTitle: string;
  requirements: string;
  sortOrder: number;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-green-100 text-green-800",
  SUPERSEDED: "bg-gray-100 text-gray-800",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  ACTIVE: "Aktiv",
  SUPERSEDED: "Abgelöst",
};

export default function AuditTemplatesPage() {
  const { can } = usePermissions();
  const canManage = can("audits:manage");

  const templates = useQuery(api.auditTemplates.list, {});
  const [selectedId, setSelectedId] = useState<string>("");
  // Standard-Auswahl: Entwurf falls vorhanden, sonst aktive Version
  const effectiveId = (selectedId ||
    templates?.find((t) => t.status === "DRAFT")?._id ||
    templates?.find((t) => t.status === "ACTIVE")?._id ||
    "") as string;
  const detail = useQuery(
    api.auditTemplates.getById,
    effectiveId ? { id: effectiveId as Id<"auditChecklistTemplates"> } : "skip",
  );

  const createDraft = useMutation(api.auditTemplates.createDraft);
  const addItem = useMutation(api.auditTemplates.addItem);
  const updateItem = useMutation(api.auditTemplates.updateItem);
  const removeItem = useMutation(api.auditTemplates.removeItem);
  const activate = useMutation(api.auditTemplates.activate);

  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: TemplateItem | null }>({
    open: false, item: null,
  });
  const [itemForm, setItemForm] = useState({ chapter: "", chapterTitle: "", requirements: "" });
  const [deleteTarget, setDeleteTarget] = useState<TemplateItem | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDraft = detail?.status === "DRAFT";

  async function handleCreateDraft() {
    if (saving) return;
    if (!draftName.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      const id = await createDraft({
        name: draftName.trim(),
        formNumber: "8.2.4",
        copyFromActive: true,
      });
      setSelectedId(id as string);
      setDraftDialogOpen(false);
      toast.success("Entwurf angelegt (Kopie der aktiven Vorlage)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveItem() {
    if (saving) return;
    if (!itemForm.chapter.trim() || !itemForm.chapterTitle.trim() || !itemForm.requirements.trim()) {
      toast.error("Kapitel, Überschrift und Prüfpunkte sind erforderlich");
      return;
    }
    setSaving(true);
    try {
      if (itemDialog.item) {
        await updateItem({
          id: itemDialog.item._id,
          chapter: itemForm.chapter.trim(),
          chapterTitle: itemForm.chapterTitle.trim(),
          requirements: itemForm.requirements.trim(),
        });
        toast.success("Prüfpunkt gespeichert");
      } else {
        await addItem({
          templateId: effectiveId as Id<"auditChecklistTemplates">,
          chapter: itemForm.chapter.trim(),
          chapterTitle: itemForm.chapterTitle.trim(),
          requirements: itemForm.requirements.trim(),
        });
        toast.success("Prüfpunkt hinzugefügt");
      }
      setItemDialog({ open: false, item: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklisten-Vorlage"
        description="Versionierte Audit-Checklisten-Vorlage (FB 8.2.4) — Entwurf bearbeiten, dann aktivieren. Bestehende Audits bleiben eingefroren."
        actions={
          <>
            {templates && templates.length > 0 && (
              <Select value={effectiveId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      v{t.version} — {t.name} ({STATUS_LABEL[t.status] ?? t.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canManage && !templates?.some((t) => t.status === "DRAFT") && (
              <Button onClick={() => {
                setDraftName(`Auditcheckliste ${new Date().getFullYear() + 1}`);
                setDraftDialogOpen(true);
              }}>
                Neue Version (Entwurf)
              </Button>
            )}
            {canManage && isDraft && (
              <Button onClick={() => setActivateOpen(true)}>Entwurf aktivieren</Button>
            )}
          </>
        }
      />

      {detail === undefined && effectiveId ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : !detail ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Vorlage vorhanden.
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              v{detail.version} — {detail.name}
              <Badge className={`ml-2 ${STATUS_BADGE[detail.status] ?? ""}`} variant="secondary">
                {STATUS_LABEL[detail.status] ?? detail.status}
              </Badge>
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {detail.items.length} Prüfpunkte
              </span>
            </CardTitle>
            {canManage && isDraft && (
              <Button size="sm" onClick={() => {
                setItemForm({ chapter: "", chapterTitle: "", requirements: "" });
                setItemDialog({ open: true, item: null });
              }}>
                Prüfpunkt hinzufügen
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!isDraft && (
              <p className="mb-3 text-sm text-muted-foreground">
                Nur Entwürfe sind bearbeitbar — für Änderungen „Neue Version (Entwurf)“ anlegen.
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Kap.</TableHead>
                  <TableHead className="w-64">Überschrift</TableHead>
                  <TableHead>Prüfpunkte / Anforderungen</TableHead>
                  {canManage && isDraft && <TableHead className="text-right">Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail.items as TemplateItem[]).map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-mono">{item.chapter}</TableCell>
                    <TableCell className="font-medium whitespace-normal">{item.chapterTitle}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      <span className="line-clamp-2">{item.requirements}</span>
                    </TableCell>
                    {canManage && isDraft && (
                      <TableCell className="space-x-1 text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => {
                          setItemForm({
                            chapter: item.chapter,
                            chapterTitle: item.chapterTitle,
                            requirements: item.requirements,
                          });
                          setItemDialog({ open: true, item });
                        }}>
                          Bearbeiten
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}>
                          Löschen
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Entwurf-anlegen-Dialog */}
      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Neue Vorlagen-Version (Entwurf)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="draft-name">Name</Label>
              <Input id="draft-name" value={draftName}
                onChange={(e) => setDraftName(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Die Prüfpunkte der aktiven Vorlage werden in den Entwurf kopiert.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraftDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreateDraft} disabled={saving}>Anlegen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prüfpunkt-Dialog (anlegen/bearbeiten) */}
      <Dialog open={itemDialog.open} onOpenChange={(o) => !o && setItemDialog({ open: false, item: null })}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{itemDialog.item ? "Prüfpunkt bearbeiten" : "Prüfpunkt hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="item-chapter">Kapitel</Label>
                <Input id="item-chapter" value={itemForm.chapter}
                  onChange={(e) => setItemForm({ ...itemForm, chapter: e.target.value })}
                  placeholder="z. B. 7.5.5" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="item-title">Überschrift</Label>
                <Input id="item-title" value={itemForm.chapterTitle}
                  onChange={(e) => setItemForm({ ...itemForm, chapterTitle: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="item-req">Prüfpunkte / Anforderungen</Label>
              <Textarea id="item-req" rows={4} value={itemForm.requirements}
                onChange={(e) => setItemForm({ ...itemForm, requirements: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setItemDialog({ open: false, item: null })}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveItem} disabled={saving}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfpunkt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Kap. {deleteTarget?.chapter} — „{deleteTarget?.chapterTitle}“ wird aus dem Entwurf
              entfernt. Bereits angelegte Audits sind nicht betroffen (eingefrorene Checklisten).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteTarget) return;
              try {
                await removeItem({ id: deleteTarget._id });
                toast.success("Prüfpunkt gelöscht");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler");
              } finally {
                setDeleteTarget(null);
              }
            }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aktivieren-Bestätigung */}
      <AlertDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entwurf aktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              v{detail?.version} wird die aktive Vorlage; die bisherige aktive Version wird
              abgelöst. Neue Audits frieren ab sofort diese Checkliste ein — bestehende Audits
              bleiben unverändert. Die Prüfpunkte werden dabei kapitelweise sortiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await activate({ id: effectiveId as Id<"auditChecklistTemplates"> });
                toast.success("Vorlage aktiviert");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler");
              } finally {
                setActivateOpen(false);
              }
            }}>
              Aktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
