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
import { TOPIC_CLUSTERS } from "@/lib/types/enums";
import { toast } from "sonner";

type AdminTopic = {
  _id: Id<"trainingTopics">;
  cluster: string;
  title: string;
  frequency?: string;
  provider?: string;
  sortOrder: number;
  isArchived: boolean;
  linkCount: number;
};

export function TopicsAdminTab({ canManage }: { canManage: boolean }) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const topics = useQuery(api.trainingMatrix.topicsAdminList, { includeArchived }) as
    | AdminTopic[]
    | undefined;

  const updateTopic = useMutation(api.trainingMatrix.updateTopic);
  const setTopicArchived = useMutation(api.trainingMatrix.setTopicArchived);
  const deleteTopicPermanent = useMutation(api.trainingMatrix.deleteTopicPermanent);

  const [editTarget, setEditTarget] = useState<AdminTopic | null>(null);
  const [editForm, setEditForm] = useState({
    cluster: "A",
    title: "",
    frequency: "",
    provider: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminTopic | null>(null);

  function openEdit(topic: AdminTopic) {
    setEditForm({
      cluster: topic.cluster,
      title: topic.title,
      frequency: topic.frequency ?? "",
      provider: topic.provider ?? "",
    });
    setEditTarget(topic);
  }

  async function handleSaveEdit() {
    if (!editTarget || saving) return;
    if (!editForm.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      // Rohstrings übergeben — Server-trim||undefined leert optionale Felder
      await updateTopic({
        id: editTarget._id,
        cluster: editForm.cluster,
        title: editForm.title,
        frequency: editForm.frequency,
        provider: editForm.provider,
      });
      toast.success("Thema gespeichert");
      setEditTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive(topic: AdminTopic) {
    try {
      await setTopicArchived({ id: topic._id, archived: !topic.isArchived });
      toast.success(topic.isArchived ? "Thema wiederhergestellt" : "Thema archiviert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTopicPermanent({ id: deleteTarget._id });
      toast.success("Thema endgültig gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="topics-show-archived" className="text-sm text-muted-foreground">
          Archivierte anzeigen
        </Label>
        <Switch
          id="topics-show-archived"
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
        />
      </div>

      {topics === undefined ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : topics.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Themen vorhanden.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cluster</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Frequenz</TableHead>
              <TableHead>Quelle/Anbieter</TableHead>
              <TableHead className="text-right">Verknüpfungen</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow key={topic._id} className={topic.isArchived ? "opacity-60" : ""}>
                <TableCell>
                  {TOPIC_CLUSTERS.find((c) => c.key === topic.cluster)?.title ?? topic.cluster}
                </TableCell>
                <TableCell className="font-medium">{topic.title}</TableCell>
                <TableCell className="text-muted-foreground">{topic.frequency ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{topic.provider ?? "—"}</TableCell>
                <TableCell className="text-right">{topic.linkCount}</TableCell>
                <TableCell>
                  {topic.isArchived ? (
                    <Badge variant="outline">Archiviert</Badge>
                  ) : (
                    <Badge variant="secondary">Aktiv</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    {!topic.isArchived && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(topic)}>
                        Bearbeiten
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleArchive(topic)}
                    >
                      {topic.isArchived ? "Wiederherstellen" : "Archivieren"}
                    </Button>
                    {topic.linkCount === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(topic)}
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
            <DialogTitle>Thema bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-topic-cluster">Cluster</Label>
              <Select
                value={editForm.cluster}
                onValueChange={(v) => setEditForm({ ...editForm, cluster: v })}
              >
                <SelectTrigger id="edit-topic-cluster"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOPIC_CLUSTERS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-topic-title">Titel</Label>
              <Input
                id="edit-topic-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-topic-frequency">Frequenz (optional)</Label>
              <Input
                id="edit-topic-frequency"
                value={editForm.frequency}
                onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-topic-provider">Quelle/Anbieter (optional)</Label>
              <Input
                id="edit-topic-provider"
                value={editForm.provider}
                onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })}
              />
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
            <AlertDialogTitle>Thema endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.title}" wird unwiderruflich gelöscht. Das ist nur für
              versehentlich angelegte Themen ohne Verknüpfungen gedacht — für alles
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
