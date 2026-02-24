"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { formatDate, isOverdue } from "@/lib/utils/dates";
import {
  TASK_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
  STATUS_LABELS,
} from "@/lib/types/enums";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";

interface TaskRow {
  _id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate?: number;
  isOverdue?: boolean;
  description?: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  READ_DOCUMENT: "Dokument lesen",
  TRAINING_FEEDBACK: "Schulungs-Feedback",
  TRAINING_EFFECTIVENESS: "Wirksamkeitsprüfung",
  DOC_EXPIRY_WARNING: "DoC-Ablaufwarnung",
  TRAINING_REQUEST_REVIEW: "Schulungsantrag prüfen",
  GENERAL: "Allgemein",
  FOLLOW_UP: "Folgemaßnahme",
};

export default function TasksPage() {
  const { can } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Role-based query selection
  const myTasks = useQuery(api.tasks.myTasks) as TaskRow[] | undefined;
  const allTasks = useQuery(
    can("tasks:all") ? api.tasks.listAll : api.tasks.myTasks
  ) as TaskRow[] | undefined;

  const updateStatus = useMutation(api.tasks.updateStatus);
  const updateTask = useMutation(api.tasks.update);

  const tasks = (can("tasks:all") ? allTasks : myTasks) ?? [];

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    title: "",
    description: "",
    priority: "",
    dueDate: "",
  });

  const filteredTasks = tasks.filter((t: TaskRow) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus({ id: id as any, status: newStatus });
      toast.success(`Aufgabe als "${STATUS_LABELS[newStatus]}" markiert`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const openEdit = (row: TaskRow) => {
    setEditForm({
      id: row._id,
      title: row.title,
      description: row.description ?? "",
      priority: row.priority,
      dueDate: row.dueDate
        ? new Date(row.dueDate).toISOString().slice(0, 10)
        : "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await updateTask({
        id: editForm.id as any,
        title: editForm.title,
        description: editForm.description || undefined,
        priority: editForm.priority,
        dueDate: editForm.dueDate
          ? new Date(editForm.dueDate).getTime()
          : undefined,
      });
      toast.success("Aufgabe aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const columns: Column<TaskRow>[] = [
    {
      key: "priority",
      header: "Priorität",
      className: "w-[100px]",
      cell: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: "title",
      header: "Aufgabe",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          <p className="text-xs text-muted-foreground">
            {TASK_TYPE_LABELS[row.type] ?? row.type}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[130px]",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "dueDate",
      header: "Fällig",
      className: "w-[130px]",
      cell: (row) => {
        if (!row.dueDate) return <span className="text-muted-foreground">—</span>;
        const overdue = isOverdue(row.dueDate);
        return (
          <span className={overdue ? "flex items-center gap-1 text-red-600 font-medium" : ""}>
            {overdue && <AlertTriangle className="h-3 w-3" />}
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-[120px]",
      cell: (row) => {
        if (row.status === "DONE" || row.status === "CANCELLED") return null;
        return (
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
                handleStatusChange(row._id, "DONE");
              }}
              title="Erledigen"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(row._id, "CANCELLED");
              }}
              title="Abbrechen"
            >
              <XCircle className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aufgaben"
        description="Übersicht über alle Ihre Aufgaben"
      />

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {TASK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TASK_TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {STATUS_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredTasks}
        emptyMessage="Keine Aufgaben gefunden"
      />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aufgabe bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select
                value={editForm.priority}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, priority: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {STATUS_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fälligkeitsdatum</Label>
              <Input
                type="date"
                value={editForm.dueDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, dueDate: e.target.value })
                }
              />
            </div>
            <Button className="w-full" onClick={handleEdit}>
              Änderungen speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
