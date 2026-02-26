"use client";

import { PageHeader } from "@/components/layout/page-header";
import { DocumentGraph } from "@/components/domain/documents/document-graph";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DocumentGraphPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/documents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Dokumenten-Graph" />
      </div>
      <DocumentGraph />
    </div>
  );
}
