"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export function ReadConfirmationWidget() {
  const data = useQuery(api.dashboard.readConfirmationRates);

  const chartData = (data?.documents ?? [])
    .slice(0, 8)
    .map((d) => ({
      name: d.documentCode,
      rate: d.rate,
      title: d.title,
    }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Lesebestätigungen
          {data && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Durchschnitt: {data.averageRate}%
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="flex h-[200px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Keine freigegebenen Dokumente vorhanden
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Bestätigt"]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.name === label);
                  return item?.title ?? label;
                }}
              />
              <Bar dataKey="rate" fill="oklch(0.7 0.18 150)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
