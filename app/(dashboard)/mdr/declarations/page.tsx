"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_STATUSES, STATUS_LABELS } from "@/lib/types/enums";
import { formatDate, daysUntil } from "@/lib/utils/dates";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface DeclarationRow {
  _id: string;
  productId: string;
  version: string;
  status: string;
  fileName: string;
  validFrom: number;
  validUntil: number;
}

interface Product {
  _id: string;
  name: string;
  articleNumber: string;
}

export default function DeclarationsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");

  const declarations = useQuery(api.declarations.list, {
    status: statusFilter !== "all" ? statusFilter : undefined,
  }) as DeclarationRow[] | undefined;

  const products = useQuery(api.products.list, {}) as Product[] | undefined;

  const getProductName = (productId: string) => {
    const p = (products ?? []).find((p: Product) => p._id === productId);
    return p ? `${p.name} (${p.articleNumber})` : "—";
  };

  const columns: Column<DeclarationRow>[] = [
    {
      key: "product",
      header: "Produkt",
      cell: (row) => (
        <span className="font-medium">{getProductName(row.productId)}</span>
      ),
    },
    {
      key: "version",
      header: "Version",
      className: "w-[80px]",
      cell: (row) => <span className="text-sm">{row.version}</span>,
    },
    {
      key: "validity",
      header: "Gültigkeit",
      className: "w-[200px]",
      cell: (row) => {
        const days = daysUntil(row.validUntil);
        return (
          <div className="text-sm">
            <span>{formatDate(row.validFrom)} — {formatDate(row.validUntil)}</span>
            {row.status === "VALID" && days <= 90 && days > 0 && (
              <span className="ml-2 text-orange-600">
                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                {days}d
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      className: "w-[120px]",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konformitätserklärungen"
        description="Übersicht aller DoCs mit Ablaufwarnungen"
      />

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {DOC_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={declarations ?? []}
        onRowClick={(row) => router.push(`/mdr/declarations/${row._id}`)}
        emptyMessage="Keine Konformitätserklärungen vorhanden"
      />
    </div>
  );
}
