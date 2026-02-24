"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Calendar, Users } from "lucide-react";
import Link from "next/link";

interface Training {
  _id: string;
  title: string;
  status: string;
  isRequired: boolean;
}

export function TrainingStatusWidget() {
  const trainings = useQuery(api.trainings.list, {}) as Training[] | undefined;

  const activeTrainings = (trainings ?? []).filter(
    (t: Training) => t.status === "ACTIVE"
  );
  const requiredTrainings = activeTrainings.filter((t: Training) => t.isRequired);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Schulungen</CardTitle>
        <Link
          href="/trainings"
          className="text-xs text-muted-foreground hover:underline"
        >
          Alle anzeigen
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center rounded-md border p-3">
            <GraduationCap className="mb-1 h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold">{activeTrainings.length}</span>
            <span className="text-xs text-muted-foreground">Aktiv</span>
          </div>
          <div className="flex flex-col items-center rounded-md border p-3">
            <Users className="mb-1 h-5 w-5 text-orange-500" />
            <span className="text-2xl font-bold">
              {requiredTrainings.length}
            </span>
            <span className="text-xs text-muted-foreground">Pflicht</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
