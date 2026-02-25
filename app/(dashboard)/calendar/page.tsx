"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, isOverdue, daysUntil } from "@/lib/utils/dates";
import { CalendarDays, AlertTriangle, Clock, GraduationCap, ClipboardList } from "lucide-react";

interface CalendarItem {
  _id: string;
  type: "task" | "session";
  date: number;
  title: string;
  subtitle: string;
  priority?: string;
  status: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  READ_DOCUMENT: "Dokument lesen",
  TRAINING_FEEDBACK: "Schulungs-Feedback",
  TRAINING_EFFECTIVENESS: "Wirksamkeitsprüfung",
  DOC_EXPIRY_WARNING: "DoC-Ablaufwarnung",
  TRAINING_REQUEST_REVIEW: "Schulungsantrag prüfen",
  GENERAL: "Allgemein",
  FOLLOW_UP: "Folgemaßnahme",
};

function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const groups = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = formatDate(item.date);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

export default function CalendarPage() {
  const tasks = useQuery(api.tasks.myTasks) as Array<{
    _id: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    dueDate?: number;
  }> | undefined;

  const sessions = useQuery(api.trainings.listUpcomingSessions) as Array<{
    _id: string;
    scheduledDate: number;
    endDate?: number;
    location?: string;
    trainerName?: string;
    status: string;
    trainingTitle: string;
  }> | undefined;

  // Convert tasks to CalendarItems
  const taskItems: CalendarItem[] = (tasks ?? [])
    .filter(
      (t) =>
        t.dueDate &&
        t.status !== "DONE" &&
        t.status !== "CANCELLED"
    )
    .map((t) => ({
      _id: t._id,
      type: "task" as const,
      date: t.dueDate!,
      title: t.title,
      subtitle: TASK_TYPE_LABELS[t.type] ?? t.type,
      priority: t.priority,
      status: t.status,
    }));

  // Convert sessions to CalendarItems
  const sessionItems: CalendarItem[] = (sessions ?? []).map((s) => {
    const parts: string[] = [];
    if (s.location) parts.push(s.location);
    if (s.trainerName) parts.push(`Trainer: ${s.trainerName}`);
    return {
      _id: s._id,
      type: "session" as const,
      date: s.scheduledDate,
      title: `Schulung: ${s.trainingTitle}`,
      subtitle: parts.join(" · ") || "Geplant",
      status: s.status,
    };
  });

  // Merge and sort all items
  const allItems = [...taskItems, ...sessionItems].sort((a, b) => a.date - b.date);

  const overdueItems = allItems.filter((i) => isOverdue(i.date));
  const upcomingItems = allItems.filter((i) => !isOverdue(i.date));

  const groupedUpcoming = groupByDate(upcomingItems);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender"
        description="Fällige Aufgaben und Schulungstermine"
      />

      {overdueItems.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Überfällig ({overdueItems.length})
          </h2>
          <div className="space-y-2">
            {overdueItems.map((item) => (
              <Card key={item._id} className="border-red-200 bg-red-50">
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    {item.type === "session" ? (
                      <GraduationCap className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <ClipboardList className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.subtitle}
                        {" · Fällig: "}
                        {formatDate(item.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.priority && <StatusBadge status={item.priority} />}
                    <StatusBadge status={item.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {groupedUpcoming.size > 0 ? (
        <div className="space-y-6">
          {Array.from(groupedUpcoming.entries()).map(([date, dateItems]) => {
            const days = daysUntil(dateItems[0].date);
            const label =
              days === 0
                ? "Heute"
                : days === 1
                  ? "Morgen"
                  : `in ${days} Tagen`;

            return (
              <div key={date}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                  {date}
                  <span className="font-normal text-muted-foreground">
                    ({label})
                  </span>
                </h2>
                <div className="space-y-2">
                  {dateItems.map((item) => (
                    <Card
                      key={item._id}
                      className={
                        item.type === "session"
                          ? "border-blue-200 bg-blue-50/50"
                          : undefined
                      }
                    >
                      <CardContent className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          {item.type === "session" ? (
                            <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
                          ) : (
                            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.priority && <StatusBadge status={item.priority} />}
                          <StatusBadge status={item.status} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        overdueItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p>Keine anstehenden Termine</p>
          </div>
        )
      )}
    </div>
  );
}
