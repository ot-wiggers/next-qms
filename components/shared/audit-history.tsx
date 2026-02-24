"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDateTime } from "@/lib/utils/dates";
import { STATUS_LABELS } from "@/lib/types/enums";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditLog {
  _id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousStatus?: string;
  newStatus?: string;
  timestamp: number;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
}

interface AuditHistoryProps {
  entityType: string;
  entityId: string;
}

export function AuditHistory({ entityType, entityId }: AuditHistoryProps) {
  const logs = useQuery(api.auditLog.listByEntity, {
    entityType,
    entityId,
  } as any) as AuditLog[] | undefined;

  const users = useQuery(api.users.list, {} as any) as User[] | undefined;

  const getUserName = (userId?: string) => {
    if (!userId || !users) return undefined;
    const u = users.find((user: User) => user._id === userId);
    return u ? `${u.firstName} ${u.lastName}` : undefined;
  };

  if (logs === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Verlauf...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-sm text-muted-foreground">Kein Verlauf vorhanden</div>;
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-3">
        {logs.map((log: AuditLog) => (
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
                {getUserName(log.userId) && (
                  <span className="mr-2">{getUserName(log.userId)}</span>
                )}
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
