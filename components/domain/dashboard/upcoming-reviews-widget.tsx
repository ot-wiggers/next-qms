"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function UpcomingReviewsWidget() {
  const data = useQuery(api.dashboard.upcomingReviews);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Anstehende Überprüfungen
        </CardTitle>
        <Link
          href="/documents"
          className="text-xs text-muted-foreground hover:underline"
        >
          Alle anzeigen
        </Link>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            Keine anstehenden Überprüfungen
          </div>
        ) : (
          <ul className="space-y-2">
            {data.slice(0, 6).map((doc) => (
              <li
                key={doc._id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.documentCode}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-2 shrink-0",
                    doc.daysUntil <= 14
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                      : doc.daysUntil <= 30
                        ? "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400"
                        : ""
                  )}
                >
                  {doc.daysUntil} Tage
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
