"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  STAFFING_STATUSES,
  STAFFING_STATUS_LABELS,
  type StaffingStatus,
} from "@/lib/types/enums";
import { toast } from "sonner";

type AdminFunction = {
  _id: Id<"jobFunctions">;
  name: string;
  holder?: string;
  staffingStatus: StaffingStatus;
  sortOrder: number;
  isArchived: boolean;
  linkCount: number;
};

export function FunctionsAdminTab({ canManage }: { canManage: boolean }) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const functions = useQuery(api.trainingMatrix.functionsAdminList, { includeArchived }) as
    | AdminFunction[]
    | undefined;

  const updateFunction = useMutation(api.trainingMatrix.updateFunction);
  const setFunctionArchived = useMutation(api.trainingMatrix.setFunctionArchived);
  const deleteFunctionPermanent = useMutation(api.trainingMatrix.deleteFunctionPermanent);

  const [editTarget, setEditTarget] = useState<AdminFunction | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    holder: string;
    staffingStatus: StaffingStatus;
  }>({ name: "", holder: "", staffingStatus: "FILLED" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminFunction | null>(null);

  function openEdit(fn: AdminFunction) {
    setEditForm({
      name: fn.name,
      holder: fn.holder ?? "",
      staffingStatus: fn.staffingStatus,
    });
    setEditTarget(fn);
  }

  async function handleSaveEdit() {
    if (!editTarget || saving) return;
    if (!editForm.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      await updateFunction({
        id: editTarget._id,
        name: editForm.name,
        holder: editForm.holder,
        staffingStatus: editForm.staffingStatus,
      });
      toast.success("Funktion gespeichert");
      setEditTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive(fn: AdminFunction) {
    try {
      await setFunctionArchived({ id: fn._id, archived: !fn.isArchived });
      toast.success(fn.isArchived ? "Funktion wiederhergestellt" : "Funktion archiviert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteFunctionPermanent({ id: deleteTarget._id });
      toast.success("Funktion endgültig gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="functions-show-archived" className="text-sm text-muted-foreground">
          Archivierte anzeigen
        </Label>
        <Switch
          id="functions-show-archived"
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
        />
      </div>

      {functions === undefined ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : functions.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Funktionen vorhanden.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funktion</TableHead>
              <TableHead>Stelleninhaber/in</TableHead>
              <TableHead>Besetzungsstatus</TableHead>
              <TableHead className="text-right">Verknüpfungen</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {functions.map((fn) => (
              <TableRow key={fn._id} className={fn.isArchived ? "opacity-60" : ""}>
                <TableCell className="font-medium">{fn.name}</TableCell>
                <TableCell className="text-muted-foreground">{fn.holder ?? "—"}</TableCell>
                <TableCell>{STAFFING_STATUS_LABELS[fn.staffingStatus]}</TableCell>
                <TableCell className="text-right">{fn.linkCount}</TableCell>
                <TableCell>
                  {fn.isArchived ? (
                    <Badge variant="outline">Archiviert</Badge>
                  ) : (
                    <Badge variant="secondary">Aktiv</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    {!fn.isArchived && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(fn)}>
                        Bearbeiten
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleToggleArchive(fn)}>
                      {fn.isArchived ? "Wiederherstellen" : "Archivieren"}
                    </Button>
                    {fn.linkCount === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(fn)}
                      >
                        Löschen
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit-Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Funktion bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-fn-name">Funktionsbezeichnung</Label>
              <Input
                id="edit-fn-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-fn-holder">Stelleninhaber/in (optional)</Label>
              <Input
                id="edit-fn-holder"
                value={editForm.holder}
                onChange={(e) => setEditForm({ ...editForm, holder: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-fn-status">Besetzungsstatus</Label>
              <Select
                value={editForm.staffingStatus}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, staffingStatus: v as StaffingStatus })
                }
              >
                <SelectTrigger id="edit-fn-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFFING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAFFING_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Endgültig-löschen-Bestätigung */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Funktion endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}" wird unwiderruflich gelöscht. Das ist nur für
              versehentlich angelegte Funktionen ohne Verknüpfungen gedacht — für alles
              andere bitte Archivieren verwenden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Endgültig löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
