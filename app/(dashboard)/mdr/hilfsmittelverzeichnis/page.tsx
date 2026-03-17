"use client";

import { PageHeader } from "@/components/layout/page-header";
import { HmvTreeBrowser } from "@/components/domain/products/hmv-tree-browser";

export default function HilfsmittelverzeichnisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hilfsmittelverzeichnis"
        description="GKV-Hilfsmittelverzeichnis durchsuchen und Versorgungsbereiche markieren"
      />
      <HmvTreeBrowser />
    </div>
  );
}
