"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
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
import { PRODUCT_STATUSES, RISK_CLASSES, STATUS_LABELS } from "@/lib/types/enums";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";

interface ProductRow {
  _id: string;
  name: string;
  articleNumber: string;
  riskClass: string;
  status: string;
  manufacturerId?: string;
}

interface Manufacturer {
  _id: string;
  name: string;
}

export default function ProductsPage() {
  const { can } = usePermissions();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskClassFilter, setRiskClassFilter] = useState("all");

  const products = useQuery(api.products.list, {
    status: statusFilter !== "all" ? statusFilter : undefined,
    riskClass: statusFilter !== "all" ? undefined : (riskClassFilter !== "all" ? riskClassFilter : undefined),
  }) as ProductRow[] | undefined;

  const manufacturers = useQuery(api.products.listManufacturers) as Manufacturer[] | undefined;

  const getManufacturerName = (id?: string) => {
    if (!id) return "—";
    const m = (manufacturers ?? []).find((m: Manufacturer) => m._id === id);
    return m?.name ?? "—";
  };

  // Client-side risk class filter (since API only supports one filter at a time)
  const filteredProducts = (products ?? []).filter((p: ProductRow) => {
    if (riskClassFilter !== "all" && p.riskClass !== riskClassFilter) return false;
    return true;
  });

  const columns: Column<ProductRow>[] = [
    {
      key: "article",
      header: "Art.-Nr.",
      className: "w-[100px]",
      cell: (row) => <code className="text-sm">{row.articleNumber}</code>,
    },
    {
      key: "name",
      header: "Produkt",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {getManufacturerName(row.manufacturerId)}
          </p>
        </div>
      ),
    },
    {
      key: "riskClass",
      header: "Klasse",
      className: "w-[80px]",
      cell: (row) => (
        <span className="text-sm font-medium">{row.riskClass}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[100px]",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produkte"
        description="Medizinprodukte und Risikoklassifizierung"
        actions={
          can("products:create") ? (
            <Button size="sm" asChild>
              <Link href="/mdr/products/new">
                <Plus className="mr-1 h-4 w-4" />
                Neues Produkt
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {PRODUCT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={riskClassFilter} onValueChange={setRiskClassFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Risikoklasse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Klassen</SelectItem>
            {RISK_CLASSES.map((rc) => (
              <SelectItem key={rc} value={rc}>
                Klasse {rc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredProducts}
        onRowClick={(row) => router.push(`/mdr/products/${row._id}`)}
        emptyMessage="Keine Produkte vorhanden"
      />
    </div>
  );
}
