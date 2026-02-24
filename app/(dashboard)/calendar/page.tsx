"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, isOverdue, daysUntil } from "@/lib/utils/dates";
import { STATUS_LABELS } from "@/lib/types/enums";
import { CalendarDays, AlertTriangle, Clock } from "lucide-react";

interface TaskWithDate {
  _id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: number;
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

function groupByDate(tasks: TaskWithDate[]): Map<string, TaskWithDate[]> {
  const groups = new Map<string, TaskWithDate[]>();
  for (const task of tasks) {
    const key = formatDate(task.dueDate);
    const group = groups.get(key) ?? [];
    group.push(task);
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

  // Only tasks with due dates, exclude completed/cancelled
  const tasksWithDates = (tasks ?? [])
    .filter(
      (t) =>
        t.dueDate &&
        t.status !== "DONE" &&
        t.status !== "CANCELLED"
    )
    .map((t) => ({ ...t, dueDate: t.dueDate! }))
    .sort((a, b) => a.dueDate - b.dueDate);

  const overdueTasks = tasksWithDates.filter((t) => isOverdue(t.dueDate));
  const upcomingTasks = tasksWithDates.filter((t) => !isOverdue(t.dueDate));

  const groupedUpcoming = groupByDate(upcomingTasks);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender"
        description="Fällige Aufgaben und Termine"
      />

      {overdueTasks.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Überfällig ({overdueTasks.length})
          </h2>
          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <Card key={task._id} className="border-red-200 bg-red-50">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TASK_TYPE_LABELS[task.type] ?? task.type}
                      {" · Fällig: "}
                      {formatDate(task.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {groupedUpcoming.size > 0 ? (
        <div className="space-y-6">
          {Array.from(groupedUpcoming.entries()).map(([date, dateTasks]) => {
            const days = daysUntil(dateTasks[0].dueDate);
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
                  {dateTasks.map((task) => (
                    <Card key={task._id}>
                      <CardContent className="flex items-center justify-between p-3">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {TASK_TYPE_LABELS[task.type] ?? task.type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={task.priority} />
                          <StatusBadge status={task.status} />
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
        overdueTasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p>Keine anstehenden Termine</p>
          </div>
        )
      )}
    </div>
  );
}
