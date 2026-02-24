"use client";

import { PageHeader } from "@/components/layout/page-header";
import { TrainingForm } from "@/components/domain/training/training-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewTrainingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/trainings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Neue Schulung erstellen" />
      </div>

      <TrainingForm />
    </div>
  );
}
