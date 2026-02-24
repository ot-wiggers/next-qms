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
import { TRAINING_REQUEST_STATUSES, STATUS_LABELS } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";

interface RequestRow {
  _id: string;
  topic: string;
  urgency: string;
  status: string;
  createdAt: number;
  requesterId: string;
}

export default function TrainingRequestsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");

  const requests = useQuery(api.trainingRequests.list, {
    status: statusFilter !== "all" ? statusFilter : undefined,
  }) as RequestRow[] | undefined;

  const columns: Column<RequestRow>[] = [
    {
      key: "topic",
      header: "Thema",
      cell: (row) => <span className="font-medium">{row.topic}</span>,
    },
    {
      key: "urgency",
      header: "Dringlichkeit",
      className: "w-[120px]",
      cell: (row) => <StatusBadge status={row.urgency} />,
    },
    {
      key: "status",
      header: "Status",
      className: "w-[130px]",
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
        title="Schulungsanträge"
        description="Schulungsbedarf beantragen und genehmigen"
        actions={
          <Button size="sm" asChild>
            <Link href="/training-requests/new">
              <Plus className="mr-1 h-4 w-4" />
              Neuer Antrag
            </Link>
          </Button>
        }
      />

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {TRAINING_REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={requests ?? []}
        onRowClick={(row) => router.push(`/training-requests/${row._id}`)}
        emptyMessage="Keine Schulungsanträge vorhanden"
      />
    </div>
  );
}
