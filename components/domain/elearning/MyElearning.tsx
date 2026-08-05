"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

/** Sinnvolle Verdichtung der participantStatus-Werte auf drei UI-Zustände. */
function statusBadge(status: string) {
  if (status === "FEEDBACK_PENDING")
    return { label: "Bogen ausstehend", className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400" };
  if (status === "OFFEN" || status === "INVITED" || status === "ATTENDED" || status === "NO_SHOW")
    return { label: "Offen", className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400" };
  // FEEDBACK_DONE, EFFECTIVENESS_PENDING, EFFECTIVE, INEFFECTIVE, REQUIRES_ACTION
  return { label: "Abgeschlossen", className: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400" };
}

export function MyElearning() {
  const data = useQuery(api.elearning.myElearning);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Meine Schulungen</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            Keine E-Learning-Schulungen zugewiesen
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((item) => {
              const badge = statusBadge(item.status);
              return (
                <li
                  key={item.trainingId}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link href={`/trainings/${item.trainingId}`} className="truncate font-medium hover:underline">
                      {item.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {item.completedAt && <span>Abgeschlossen am {formatDate(item.completedAt)}</span>}
                      {item.validUntil && (
                        <span className={cn(item.completedAt && "ml-2", item.overdue && "text-red-600 dark:text-red-400 font-medium")}>
                          Auffrischung bis {formatDate(item.validUntil)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", badge.className)}>
                    {badge.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
