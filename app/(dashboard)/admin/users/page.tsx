"use client";

import { PageHeader } from "@/components/layout/page-header";
import { UsersTab } from "@/components/domain/admin/users-tab";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Benutzerverwaltung" description="Benutzer anlegen, Rollen zuweisen und verwalten" />
      <UsersTab />
    </div>
  );
}
