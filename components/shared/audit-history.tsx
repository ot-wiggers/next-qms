"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDateTime } from "@/lib/utils/dates";
import { STATUS_LABELS } from "@/lib/types/enums";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditHistoryProps {
  entityType: string;
  entityId: string;
}

export function AuditHistory({ entityType, entityId }: AuditHistoryProps) {
  const logs = useQuery(api.auditLog?.listByEntity, { entityType, entityId });

  if (!logs) {
    return <div className="text-sm text-muted-foreground">Lade Verlauf...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-sm text-muted-foreground">Kein Verlauf vorhanden</div>;
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-3">
        {logs.map((log: any) => (
          <div key={log._id} className="flex gap-3 text-sm border-l-2 border-muted pl-3">
            <div className="flex-1">
              <div className="font-medium">
                {getActionLabel(log.action)}
                {log.previousStatus && log.newStatus && (
                  <span className="text-muted-foreground">
                    {" "}({STATUS_LABELS[log.previousStatus] ?? log.previousStatus} →{" "}
                    {STATUS_LABELS[log.newStatus] ?? log.newStatus})
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateTime(log.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: "Erstellt",
    UPDATE: "Aktualisiert",
    STATUS_CHANGE: "Status geändert",
    ARCHIVE: "Archiviert",
    FILE_UPLOAD: "Datei hochgeladen",
    PERMISSION_CHANGE: "Berechtigung geändert",
    LOGIN: "Angemeldet",
    LOGOUT: "Abgemeldet",
  };
  return labels[action] ?? action;
}
