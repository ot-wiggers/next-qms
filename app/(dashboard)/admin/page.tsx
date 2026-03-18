"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "@/components/domain/admin/users-tab";
import { OrganizationsTab } from "@/components/domain/admin/organizations-tab";
import { LocationsTab } from "@/components/domain/admin/locations-tab";
import { DepartmentsTab } from "@/components/domain/admin/departments-tab";
import { Users, Building2, MapPin, Network } from "lucide-react";

export default function AdministrationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        description="Benutzer, Organisationen, Standorte und Abteilungen verwalten"
      />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Benutzer
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organisationen
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="h-4 w-4" />
            Standorte
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Network className="h-4 w-4" />
            Abteilungen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="organizations">
          <OrganizationsTab />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsTab />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
