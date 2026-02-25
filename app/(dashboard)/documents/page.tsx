"use client";

import { PageHeader } from "@/components/layout/page-header";
import { DocumentList } from "@/components/domain/documents/document-list";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/types/enums";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DocumentsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { can } = usePermissions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dokumente"
        description="QM-Dokumente, Arbeitsanweisungen und Formblätter"
        actions={
          can("documents:create") ? (
            <Button size="sm" asChild>
              <Link href="/documents/new">
                <Plus className="mr-1 h-4 w-4" />
                Neues Dokument
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
            {DOCUMENT_STATUSES.map((s) => (
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
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DocumentList statusFilter={statusFilter} typeFilter={typeFilter} />
    </div>
  );
}
