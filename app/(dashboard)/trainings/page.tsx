"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate } from "@/lib/utils/dates";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";

interface TrainingRow {
  _id: string;
  title: string;
  status: string;
  category?: string;
  isRequired: boolean;
  createdAt: number;
}

export default function TrainingsPage() {
  const { can } = usePermissions();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");

  const trainings = useQuery(api.trainings.list, {
    status: statusFilter !== "all" ? statusFilter : undefined,
  }) as TrainingRow[] | undefined;

  const columns: Column<TrainingRow>[] = [
    {
      key: "title",
      header: "Schulung",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          {row.category && (
            <p className="text-xs text-muted-foreground">{row.category}</p>
          )}
        </div>
      ),
    },
    {
      key: "required",
      header: "Pflicht",
      className: "w-[80px]",
      cell: (row) =>
        row.isRequired ? (
          <span className="text-xs font-medium text-orange-600">Ja</span>
        ) : (
          <span className="text-xs text-muted-foreground">Nein</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[100px]",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created",
      header: "Erstellt",
      className: "w-[120px]",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schulungen"
        description="Schulungsverwaltung und Terminplanung"
        actions={
          can("trainings:create") ? (
            <Button size="sm" asChild>
              <Link href="/trainings/new">
                <Plus className="mr-1 h-4 w-4" />
                Neue Schulung
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="ARCHIVED">Archiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={trainings ?? []}
        onRowClick={(row) => router.push(`/trainings/${row._id}`)}
        emptyMessage="Keine Schulungen vorhanden"
      />
    </div>
  );
}
