"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
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
import { useState } from "react";
import { Plus, Archive } from "lucide-react";
import { toast } from "sonner";

interface OrgRow {
  _id: string;
  name: string;
  code: string;
  type: string;
  parentId?: string;
}

export default function AdminDepartmentsPage() {
  const organizations = useQuery(api.organizations.list, {}) as OrgRow[] | undefined;
  const createOrg = useMutation(api.organizations.create);
  const archiveOrg = useMutation(api.organizations.archive);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", parentId: "" });

  const locations = (organizations ?? []).filter((o) => o.type === "location");
  const departments = (organizations ?? []).filter((o) => o.type === "department");

  const handleCreate = async () => {
    if (!form.name || !form.code) {
      toast.error("Bitte Name und Kürzel angeben");
      return;
    }
    try {
      await createOrg({
        name: form.name,
        code: form.code,
        type: "department",
        parentId: form.parentId ? (form.parentId as any) : undefined,
      });
      toast.success("Abteilung erstellt");
      setOpen(false);
      setForm({ name: "", code: "", parentId: "" });
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveOrg({ id: id as any });
      toast.success("Abteilung archiviert");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Archivieren");
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
      header: "Standort",
      className: "w-[200px]",
      cell: (row) => {
        const parent = locations.find((o) => o._id === row.parentId);
        return <span>{parent?.name ?? "—"}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-[60px]",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            handleArchive(row._id);
          }}
          title="Archivieren"
        >
          <Archive className="h-4 w-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abteilungen"
        description="Abteilungen und Teams verwalten"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Neue Abteilung
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Abteilung anlegen</DialogTitle>
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
                    placeholder="z.B. ABT-01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Standort</Label>
                  <Select
                    value={form.parentId}
                    onValueChange={(v) => setForm({ ...form, parentId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((o) => (
                        <SelectItem key={o._id} value={o._id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate}>
                  Abteilung erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        columns={columns}
        data={departments}
        emptyMessage="Keine Abteilungen vorhanden"
      />
    </div>
  );
}
