"use client";

import { PageHeader } from "@/components/layout/page-header";
import { DocumentList } from "@/components/domain/documents/document-list";
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
import { useState } from "react";

export default function DocumentsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dokumente"
        description="QM-Dokumente, Arbeitsanweisungen und Formblätter"
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
