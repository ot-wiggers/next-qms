"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PlayerFrame } from "@/components/domain/elearning/PlayerFrame";
import { Button } from "@/components/ui/button";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LernenPage() {
  const params = useParams();
  const trainingId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/trainings/${trainingId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Schulung absolvieren" />
      </div>

      <PlayerFrame trainingId={trainingId as Id<"trainings">} />
    </div>
  );
}
