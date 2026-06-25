"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { TaskListWidget } from "@/components/domain/tasks/task-list-widget";
import { RecentDocumentsWidget } from "@/components/domain/documents/recent-documents-widget";
import { TrainingStatusWidget } from "@/components/domain/training/training-status-widget";
import { KpiCard } from "@/components/domain/dashboard/kpi-card";
import { DocumentStatusChart } from "@/components/domain/dashboard/document-status-chart";
import { UpcomingReviewsWidget } from "@/components/domain/dashboard/upcoming-reviews-widget";
import { ReadConfirmationWidget } from "@/components/domain/dashboard/read-confirmation-widget";
import { DevicesAmpelCard } from "@/components/domain/dashboard/devices-ampel-card";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { USER_ROLE_LABELS } from "@/lib/types/enums";
import {
  FileSearch,
  AlertTriangle,
  GraduationCap,
  BookCheck,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { can, role } = usePermissions();

  const viewAll = can("dashboard:view_all");

  const openReviews = useQuery(api.dashboard.openReviews);
  const overdueTasks = useQuery(api.dashboard.overdueTasks);
  const trainingQuota = useQuery(api.dashboard.trainingQuota);
  // org-weite Lesequote nur für view_all; sonst persönliche „offene Bestätigungen"
  const readRates = useQuery(
    api.dashboard.readConfirmationRates,
    viewAll ? {} : "skip",
  );
  const myConfirmations = useQuery(
    api.dashboard.myOpenConfirmations,
    viewAll ? "skip" : {},
  );

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

      <p className="-mt-2 text-sm text-muted-foreground">
        {viewAll
          ? "Org-weite Sicht — alle Bereiche."
          : can("tasks:team")
            ? "Sicht auf Ihr Team."
            : "Ihre persönliche Sicht — nur Ihre eigenen Daten."}
      </p>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Offene Prüfungen"
          value={openReviews?.count ?? "–"}
          icon={FileSearch}
          loading={!openReviews}
          description="Dokumente in Prüfung"
        />
        <KpiCard
          title="Überfällige Aufgaben"
          value={overdueTasks?.count ?? "–"}
          icon={AlertTriangle}
          trend={overdueTasks && overdueTasks.count > 0 ? "up" : undefined}
          loading={!overdueTasks}
        />
        <KpiCard
          title="Schulungsquote"
          value={trainingQuota ? `${trainingQuota.percentage}%` : "–"}
          icon={GraduationCap}
          loading={!trainingQuota}
          description={
            trainingQuota
              ? `${trainingQuota.completed} / ${trainingQuota.total}`
              : undefined
          }
        />
        {viewAll ? (
          <KpiCard
            title="Lesebestätigungen"
            value={readRates ? `${readRates.averageRate}%` : "–"}
            icon={BookCheck}
            loading={!readRates}
            description="Durchschnittliche Rate (org-weit)"
          />
        ) : (
          <KpiCard
            title="Offene Bestätigungen"
            value={myConfirmations?.count ?? "–"}
            icon={BookCheck}
            trend={myConfirmations && myConfirmations.count > 0 ? "up" : undefined}
            loading={!myConfirmations}
            description="Dokumente, die Sie noch bestätigen müssen"
          />
        )}
      </div>

      {/* Charts row — Statusverteilung nur org-weit, Überprüfungen immer (gescopt) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {viewAll && <DocumentStatusChart />}
        <UpcomingReviewsWidget />
      </div>

      {/* Org-weite Lesebestätigungsraten nur für view_all */}
      {viewAll && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ReadConfirmationWidget />
        </div>
      )}

      {/* Existing detail widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TaskListWidget />
        {can("documents:read") && <RecentDocumentsWidget />}
        {can("trainings:list") && <TrainingStatusWidget />}
        <DevicesAmpelCard />
      </div>
    </div>
  );
}
