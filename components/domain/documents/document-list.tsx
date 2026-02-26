"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { SquarePen } from "lucide-react";

interface DocumentRow {
  _id: string;
  title: string;
  documentType: string;
  documentCode: string;
  version: string;
  status: string;
  category?: string;
  updatedAt: number;
}

interface DocumentListProps {
  statusFilter?: string;
  typeFilter?: string;
}

export function DocumentList({ statusFilter, typeFilter }: DocumentListProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const documents = useQuery(api.documents.list, {
    status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
    documentType: typeFilter && typeFilter !== "all" ? typeFilter : undefined,
  }) as DocumentRow[] | undefined;

  const columns: Column<DocumentRow>[] = [
    {
      key: "code",
      header: "Code",
      className: "w-[100px]",
      cell: (row) => <code className="text-sm">{row.documentCode}</code>,
    },
    {
      key: "title",
      header: "Titel",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.title ?? row.documentCode}</p>
          <p className="text-xs text-muted-foreground">
            {DOCUMENT_TYPE_LABELS[row.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? row.documentType}
            {" · v"}
            {row.version}
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
      key: "updated",
      header: "Aktualisiert",
      className: "w-[120px]",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.updatedAt)}
        </span>
      ),
    },
    ...(can("documents:create")
      ? [
          {
            key: "actions" as const,
            header: "",
            className: "w-[50px]",
            cell: (row: DocumentRow) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/documents/${row._id}/edit`);
                }}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <SquarePen className="size-4" />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={documents ?? []}
      onRowClick={(row) => router.push(`/documents/${row._id}`)}
      emptyMessage="Keine Dokumente vorhanden"
    />
  );
}
