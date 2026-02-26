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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DOCUMENT_STATUSES,
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

      <Tabs defaultValue="all" onValueChange={setTypeFilter}>
        <TabsList>
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="qm_handbook">QM-Handbuch</TabsTrigger>
          <TabsTrigger value="work_instruction">Arbeitsanweisungen</TabsTrigger>
          <TabsTrigger value="form_template">Formblätter</TabsTrigger>
          <TabsTrigger value="process_description">Prozessbeschreibungen</TabsTrigger>
        </TabsList>
      </Tabs>

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
      </div>

      <DocumentList statusFilter={statusFilter} typeFilter={typeFilter} />
    </div>
  );
}
