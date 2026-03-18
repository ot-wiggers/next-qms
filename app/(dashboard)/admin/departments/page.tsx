"use client";

import { PageHeader } from "@/components/layout/page-header";
import { DepartmentsTab } from "@/components/domain/admin/departments-tab";

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Abteilungen" description="Abteilungen und Teams verwalten" />
      <DepartmentsTab />
    </div>
  );
}
