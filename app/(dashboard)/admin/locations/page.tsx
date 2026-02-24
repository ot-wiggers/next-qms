"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ArchiveConfirmDialog } from "@/components/shared/archive-confirm-dialog";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useState } from "react";
import { Plus, Archive, Pencil } from "lucide-react";
import { toast } from "sonner";

interface OrgRow {
  _id: string;
  name: string;
  code: string;
  type: string;
  parentId?: string;
}

export default function AdminLocationsPage() {
  const { can } = usePermissions();
  const organizations = useQuery(api.organizations.list, {}) as OrgRow[] | undefined;
  const createOrg = useMutation(api.organizations.create);
  const updateOrg = useMutation(api.organizations.update);
  const archiveOrg = useMutation(api.organizations.archive);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", parentId: "" });

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", name: "", code: "" });

  // Archive state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<OrgRow | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const parentOrgs = (organizations ?? []).filter((o) => o.type === "organization");
  const locations = (organizations ?? []).filter((o) => o.type === "location");

  const handleCreate = async () => {
    if (!form.name || !form.code) {
      toast.error("Bitte Name und Kürzel angeben");
      return;
    }
    try {
      await createOrg({
        name: form.name,
        code: form.code,
        type: "location",
        parentId: form.parentId ? (form.parentId as any) : undefined,
      });
      toast.success("Standort erstellt");
      setOpen(false);
      setForm({ name: "", code: "", parentId: "" });
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  const openEdit = (row: OrgRow) => {
    setEditForm({ id: row._id, name: row.name, code: row.code });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await updateOrg({
        id: editForm.id as any,
        name: editForm.name,
        code: editForm.code,
      });
      toast.success("Standort aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const openArchive = (row: OrgRow) => {
    setArchiveTarget(row);
    setArchiveOpen(true);
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await archiveOrg({ id: archiveTarget._id as any });
      toast.success("Standort archiviert");
      setArchiveOpen(false);
      setArchiveTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Archivieren");
    } finally {
      setArchiveLoading(false);
    }
  };

  const columns: Column<OrgRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "code",
      header: "Kürzel",
      className: "w-[100px]",
      cell: (row) => <code className="text-sm">{row.code}</code>,
    },
    {
      key: "parent",
      header: "Organisation",
      className: "w-[200px]",
      cell: (row) => {
        const parent = parentOrgs.find((o) => o._id === row.parentId);
        return <span>{parent?.name ?? "—"}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-[100px]",
      cell: (row) =>
        can("admin:settings") ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              title="Bearbeiten"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                openArchive(row);
              }}
              title="Archivieren"
            >
              <Archive className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standorte"
        description="Standorte der Organisation verwalten"
        actions={
          can("admin:settings") ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Neuer Standort
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen Standort anlegen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kürzel *</Label>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="z.B. LOC-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Übergeordnete Organisation</Label>
                    <Select
                      value={form.parentId}
                      onValueChange={(v) => setForm({ ...form, parentId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentOrgs.map((o) => (
                          <SelectItem key={o._id} value={o._id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleCreate}>
                    Standort erstellen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={locations}
        emptyMessage="Keine Standorte vorhanden"
      />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standort bearbeiten</DialogTitle>
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
            <div className="space-y-2">
              <Label>Kürzel</Label>
              <Input
                value={editForm.code}
                onChange={(e) =>
                  setEditForm({ ...editForm, code: e.target.value })
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
        entityName="Standort"
        entityLabel={archiveTarget?.name ?? ""}
        isLoading={archiveLoading}
      />
    </div>
  );
}
