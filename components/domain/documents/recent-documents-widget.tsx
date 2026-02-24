"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRelative } from "@/lib/utils/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";
import { FileText } from "lucide-react";
import Link from "next/link";

export function RecentDocumentsWidget() {
  const documents = useQuery(api.documents.list, {});

  const recentDocs = ([...(documents ?? [])] as Array<{ _id: string; title: string; documentType: string; status: string; updatedAt: number }>)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Aktuelle Dokumente
        </CardTitle>
        <Link
          href="/documents"
          className="text-xs text-muted-foreground hover:underline"
        >
          Alle anzeigen
        </Link>
      </CardHeader>
      <CardContent>
        {recentDocs.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Keine Dokumente vorhanden
          </div>
        ) : (
          <ul className="space-y-2">
            {recentDocs.map((doc) => (
              <li
                key={doc._id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.documentType}
                    {" · "}
                    {formatRelative(doc.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={doc.status} className="ml-2 shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
