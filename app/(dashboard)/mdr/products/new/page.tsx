"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/domain/products/product-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/mdr/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Neues Produkt anlegen" />
      </div>

      <ProductForm />
    </div>
  );
}
