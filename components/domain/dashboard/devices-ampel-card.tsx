"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/hooks/usePermissions";

/** Kompakte §7.6-Prüfmittel-Ampel fürs Dashboard. Rendert nichts ohne devices:list. */
export function DevicesAmpelCard() {
  const { can } = usePermissions();
  const summary = useQuery(api.devices.summary, can("devices:list") ? {} : "skip");

  if (!can("devices:list") || !summary) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          <Link href="/devices" className="hover:underline">Prüfmittel (§7.6)</Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-2xl font-semibold text-red-700">{summary.overdue}</p>
            <p className="text-xs text-muted-foreground">überfällig</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-700">{summary.due}</p>
            <p className="text-xs text-muted-foreground">fällig</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-green-700">{summary.ok}</p>
            <p className="text-xs text-muted-foreground">im Intervall</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
