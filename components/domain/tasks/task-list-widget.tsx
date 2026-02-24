"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, isOverdue } from "@/lib/utils/dates";
import { STATUS_LABELS } from "@/lib/types/enums";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Task {
  _id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate?: number;
  isOverdue?: boolean;
}

export function TaskListWidget() {
  const tasks = useQuery(api.tasks.myTasks) as Task[] | undefined;

  const openTasks = tasks?.filter(
    (t: Task) => t.status === "OPEN" || t.status === "IN_PROGRESS"
  ) ?? [];

  const overdueTasks = openTasks.filter(
    (t: Task) => t.dueDate && isOverdue(t.dueDate)
  );

  const upcomingTasks = openTasks
    .filter((t: Task) => !t.dueDate || !isOverdue(t.dueDate))
    .sort((a: Task, b: Task) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Meine Aufgaben</CardTitle>
        <Link
          href="/tasks"
          className="text-xs text-muted-foreground hover:underline"
        >
          Alle anzeigen
        </Link>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-500" />
            <span>{openTasks.length} offen</span>
          </div>
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{overdueTasks.length} überfällig</span>
            </div>
          )}
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Keine offenen Aufgaben
          </div>
        ) : (
          <ul className="space-y-2">
            {upcomingTasks.map((task) => (
              <li
                key={task._id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      Fällig: {formatDate(task.dueDate)}
                    </p>
                  )}
                </div>
                <StatusBadge status={task.status} className="ml-2 shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
