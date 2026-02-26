"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { VersionDiff } from "@/components/domain/documents/version-diff";
import { StatusBadge } from "@/components/shared/status-badge";
import { ArrowLeft, GitCompare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/utils/dates";

export default function DocumentVersionsPage() {
  const { id } = useParams<{ id: string }>();
  const document = useQuery(api.documents.getById, { id: id as any }) as
    | { _id: string; documentCode: string; title?: string }
    | null
    | undefined;
  const versions = useQuery(api.documentVersions.listByDocument, {
    documentId: id as any,
  }) as
    | Array<{
        _id: string;
        version: number;
        contentPlaintext: string;
        changedBy: string;
        changedByName: string;
        changedAt: number;
        changeDescription?: string;
        status: string;
      }>
    | undefined;

  const [diffOpen, setDiffOpen] = useState(false);
  const [versionA, setVersionA] = useState<string>("");
  const [versionB, setVersionB] = useState<string>("");

  const versionMap = new Map(
    (versions ?? []).map((v) => [String(v.version), v])
  );

  const openDiff = (a?: number, b?: number) => {
    const sorted = (versions ?? []).sort((x, y) => y.version - x.version);
    if (a !== undefined && b !== undefined) {
      setVersionA(String(a));
      setVersionB(String(b));
    } else if (sorted.length >= 2) {
      setVersionA(String(sorted[1].version));
      setVersionB(String(sorted[0].version));
    }
    setDiffOpen(true);
  };

  if (document === undefined) {
    return <p className="text-sm text-muted-foreground">Laden...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/documents/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={`Versionen — ${document?.title ?? document?.documentCode ?? ""}`}
        />
      </div>

      {(versions ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Versionen vorhanden. Versionen werden automatisch beim
          Freigeben erstellt.
        </p>
      ) : (
        <>
          {(versions ?? []).length >= 2 && (
            <Button variant="outline" onClick={() => openDiff()}>
              <GitCompare className="mr-2 h-4 w-4" />
              Versionen vergleichen
            </Button>
          )}

          <div className="space-y-2">
            {(versions ?? []).map((v) => (
              <Card key={v._id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold tabular-nums">
                      v{v.version}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {v.changeDescription ?? `Version ${v.version}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.changedByName} · {formatDate(v.changedAt)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Versionsvergleich</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Von</label>
              <Select value={versionA} onValueChange={setVersionA}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(versions ?? []).map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      Version {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Bis</label>
              <Select value={versionB} onValueChange={setVersionB}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(versions ?? []).map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      Version {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {versionA && versionB && versionMap.get(versionA) && versionMap.get(versionB) && (
            <VersionDiff
              oldText={versionMap.get(versionA)!.contentPlaintext}
              newText={versionMap.get(versionB)!.contentPlaintext}
              oldLabel={`Version ${versionA}`}
              newLabel={`Version ${versionB}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
