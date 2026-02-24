"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { USER_ROLES, USER_ROLE_LABELS } from "@/lib/types/enums";
import { fullName } from "@/lib/utils/formatting";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useState } from "react";
import { Plus, Archive, Pencil } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

export default function AdminUsersPage() {
  const { can } = usePermissions();
  const users = useQuery(api.users.list) as UserRow[] | undefined;
  const organizations = useQuery(api.organizations.list, {}) as Array<{
    _id: string;
    name: string;
    type: string;
  }> | undefined;
  const createUser = useMutation(api.users.create);
  const updateUser = useMutation(api.users.update);
  const archiveUser = useMutation(api.users.archive);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "employee" as string,
    organizationId: "",
  });

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    status: "",
  });

  // Archive state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<UserRow | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const orgs = (organizations ?? []).filter((o) => o.type === "organization");

  const handleCreate = async () => {
    if (!form.email || !form.firstName || !form.lastName || !form.organizationId) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    try {
      await createUser({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        organizationId: form.organizationId as any,
      });
      toast.success("Benutzer erstellt");
      setOpen(false);
      setForm({ email: "", firstName: "", lastName: "", role: "employee", organizationId: "" });
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  const openEdit = (row: UserRow) => {
    setEditForm({
      id: row._id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role,
      status: row.status ?? "active",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await updateUser({
        id: editForm.id as any,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      });
      toast.success("Benutzer aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const openArchive = (row: UserRow) => {
    setArchiveTarget(row);
    setArchiveOpen(true);
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await archiveUser({ id: archiveTarget._id as any });
      toast.success("Benutzer archiviert");
      setArchiveOpen(false);
      setArchiveTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Archivieren");
    } finally {
      setArchiveLoading(false);
    }
  };

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <div>
          <p className="font-medium">{fullName(row.firstName, row.lastName)}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rolle",
      className: "w-[160px]",
      cell: (row) => (
        <span>{USER_ROLE_LABELS[row.role as keyof typeof USER_ROLE_LABELS] ?? row.role}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[100px]",
      cell: (row) => <StatusBadge status={row.status?.toUpperCase() ?? "ACTIVE"} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-[100px]",
      cell: (row) => (
        <div className="flex gap-1">
          {can("users:update") && (
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
          )}
          {can("users:archive") && (
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
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benutzerverwaltung"
        description="Benutzer anlegen, Rollen zuweisen und verwalten"
        actions={
          can("users:create") ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Neuer Benutzer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vorname *</Label>
                      <Input
                        value={form.firstName}
                        onChange={(e) =>
                          setForm({ ...form, firstName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nachname *</Label>
                      <Input
                        value={form.lastName}
                        onChange={(e) =>
                          setForm({ ...form, lastName: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>E-Mail *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rolle *</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm({ ...form, role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {USER_ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Organisation *</Label>
                    <Select
                      value={form.organizationId}
                      onValueChange={(v) =>
                        setForm({ ...form, organizationId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Organisation wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgs.map((o) => (
                          <SelectItem key={o._id} value={o._id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleCreate}>
                    Benutzer erstellen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={users ?? []}
        emptyMessage="Keine Benutzer vorhanden"
      />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {USER_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
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
        entityName="Benutzer"
        entityLabel={
          archiveTarget
            ? fullName(archiveTarget.firstName, archiveTarget.lastName)
            : ""
        }
        isLoading={archiveLoading}
      />
    </div>
  );
}
