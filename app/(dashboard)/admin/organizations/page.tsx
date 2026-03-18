"use client";

import { PageHeader } from "@/components/layout/page-header";
import { OrganizationsTab } from "@/components/domain/admin/organizations-tab";

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Organisationen" description="Übergeordnete Organisationen verwalten" />
      <OrganizationsTab />
    </div>
  );
}
