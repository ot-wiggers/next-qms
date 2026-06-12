"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { CheckForm } from "@/components/domain/incoming-goods/check-form";
import { usePermissions } from "@/lib/hooks/usePermissions";

export default function EditIncomingGoodsCheckPage() {
  const params = useParams<{ id: string }>();
  const checkId = params.id as Id<"incomingGoodsChecks">;
  const { can } = usePermissions();
  const check = useQuery(api.incomingGoods.getById, { id: checkId });

  if (check === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (check === null) return <div className="p-8">Prüfung nicht gefunden.</div>;
  if (!can("incomingGoods:manage")) return <div className="p-8">Keine Berechtigung.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wareneingangsprüfung bearbeiten"
        description={`${check.locationName} · ${check.manufacturer}`}
      />
      <CheckForm initial={check as unknown as Doc<"incomingGoodsChecks">} />
    </div>
  );
}
