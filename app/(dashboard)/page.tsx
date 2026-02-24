"use client";

import { PageHeader } from "@/components/layout/page-header";
import { TaskListWidget } from "@/components/domain/tasks/task-list-widget";
import { RecentDocumentsWidget } from "@/components/domain/documents/recent-documents-widget";
import { TrainingStatusWidget } from "@/components/domain/training/training-status-widget";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { USER_ROLE_LABELS } from "@/lib/types/enums";

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { can, role } = usePermissions();

  const greeting = user
    ? `Willkommen, ${user.firstName}`
    : "Willkommen";

  const roleLabel = role ? USER_ROLE_LABELS[role] : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting}
        description={roleLabel ? `Angemeldet als ${roleLabel}` : undefined}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Task widget — visible to all roles */}
        <TaskListWidget />

        {/* Document widget — visible to roles with documents:read */}
        {can("documents:read") && <RecentDocumentsWidget />}

        {/* Training widget — visible to roles with trainings:list */}
        {can("trainings:list") && <TrainingStatusWidget />}
      </div>
    </div>
  );
}
