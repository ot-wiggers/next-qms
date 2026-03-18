"use client";

import { PageHeader } from "@/components/layout/page-header";
import { LocationsTab } from "@/components/domain/admin/locations-tab";

export default function LocationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Standorte" description="Standorte der Organisation verwalten" />
      <LocationsTab />
    </div>
  );
}
