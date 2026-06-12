"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CheckForm } from "@/components/domain/incoming-goods/check-form";

export default function NewIncomingGoodsCheckPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Neue Wareneingangsprüfung"
        description="Prüfpflichten des Händlers nach Art. 14 MDR (AA 7.4.3)"
      />
      <CheckForm />
    </div>
  );
}
