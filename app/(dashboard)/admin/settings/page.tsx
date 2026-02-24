"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FeatureFlag {
  _id: string;
  key: string;
  enabled: boolean;
}

const FLAG_LABELS: Record<string, { title: string; description: string }> = {
  enforceDocForActiveProduct: {
    title: "DoC-Pflicht für aktive Produkte",
    description:
      "Wenn aktiviert, können Produkte nur als AKTIV gesetzt werden, wenn eine gültige Konformitätserklärung vorliegt.",
  },
  audits_enabled: {
    title: "Interne Audits",
    description: "Modul für interne Audits aktivieren (Phase 4).",
  },
  capa_enabled: {
    title: "CAPA",
    description: "CAPA-Modul aktivieren (Phase 4).",
  },
  complaints_enabled: {
    title: "Reklamationen",
    description: "Reklamationsmanagement aktivieren (Phase 4).",
  },
  incoming_goods_enabled: {
    title: "Wareneingang",
    description: "Wareneingangsmodul aktivieren (Phase 4).",
  },
  devices_enabled: {
    title: "Prüfmittel",
    description: "Prüfmittelverwaltung aktivieren (Phase 4).",
  },
  reports_enabled: {
    title: "Berichte",
    description: "Berichtsmodul aktivieren (Phase 4).",
  },
};

export default function AdminSettingsPage() {
  const flags = useQuery(api.featureFlags.list) as FeatureFlag[] | undefined;
  const updateFlag = useMutation(api.featureFlags.update);

  const handleToggle = async (key: string, enabled: boolean) => {
    try {
      await updateFlag({ key, enabled });
      toast.success(
        `${FLAG_LABELS[key]?.title ?? key}: ${enabled ? "Aktiviert" : "Deaktiviert"}`
      );
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  // Show all known flags, using DB state if available
  const allFlagKeys = Object.keys(FLAG_LABELS);
  const flagMap = new Map((flags ?? []).map((f) => [f.key, f]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einstellungen"
        description="System-Konfiguration und Feature Flags"
      />

      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Module und Funktionen aktivieren oder deaktivieren. Änderungen
            werden sofort wirksam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {allFlagKeys.map((key) => {
            const meta = FLAG_LABELS[key];
            const current = flagMap.get(key);
            const enabled = current?.enabled ?? false;

            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-md border p-4"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{meta.title}</Label>
                  <p className="text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
