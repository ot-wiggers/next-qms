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
import { Plus, Archive, RotateCcw, Trash2, FileUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DeleteConfirmationDialog } from "@/components/domain/documents/delete-confirmation-dialog";
import { ImportDialog } from "@/components/domain/documents/import-dialog";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "sonner";

export default function DocumentsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { can } = usePermissions();

  const archivedDocs = useQuery(api.documents.listArchived, typeFilter === "archive" ? {} : "skip");
  const restoreDoc = useMutation(api.documents.restore);
  const permanentDeleteDoc = useMutation(api.documents.permanentDelete);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dokumente"
        description="QM-Dokumente, Arbeitsanweisungen und Formblätter"
        actions={
          can("documents:create") ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="mr-1 h-4 w-4" />
                Importieren
              </Button>
              <Button size="sm" asChild>
                <Link href="/documents/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Neues Dokument
                </Link>
              </Button>
            </div>
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
          <TabsTrigger value="archive">Archiv</TabsTrigger>
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

      {typeFilter === "archive" ? (
        <div className="space-y-2">
          {archivedDocs === undefined && <p className="text-sm text-muted-foreground">Lade...</p>}
          {archivedDocs?.length === 0 && <p className="text-sm text-muted-foreground">Keine archivierten Dokumente</p>}
          {archivedDocs?.map((doc: any) => (
            <Card key={doc._id} className="p-4 opacity-70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{doc.title ?? doc.documentCode}</p>
                  <p className="text-xs text-muted-foreground">{doc.documentCode} · Version {doc.version}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={doc.status} />
                  {can("documents:archive") && (
                    <Button variant="outline" size="sm" onClick={async () => {
                      try { await restoreDoc({ id: doc._id }); toast.success("Wiederhergestellt"); } catch (e: any) { toast.error(e.message); }
                    }}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Wiederherstellen
                    </Button>
                  )}
                  {can("documents:delete") && (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ id: doc._id, code: doc.documentCode })}>
                      <Trash2 className="mr-1 h-3 w-3" /> Löschen
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {deleteTarget && (
            <DeleteConfirmationDialog
              open={!!deleteTarget}
              onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
              documentCode={deleteTarget.code}
              onConfirm={async () => {
                try { await permanentDeleteDoc({ id: deleteTarget.id as any }); toast.success("Endgültig gelöscht"); setDeleteTarget(null); } catch (e: any) { toast.error(e.message); }
              }}
            />
          )}
        </div>
      ) : (
        <DocumentList statusFilter={statusFilter} typeFilter={typeFilter} />
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
