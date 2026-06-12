"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  AUDIT_STATUS_LABELS, MONTH_LABELS_SHORT, type AuditStatus,
} from "@/lib/types/enums";
import {
  downloadAuditPlan, type AuditPlanData,
} from "@/lib/export/audit-plan-exporter";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const STATUS_VARIANT: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  REPORT_DRAFT: "bg-purple-100 text-purple-800",
  CLOSED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function AuditPlanPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [generating, setGenerating] = useState(false);
  const matrix = useQuery(api.audits.planMatrix, { year });
  const generatePlan = useMutation(api.yearCycle.generateAuditPlan);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const rows = matrix?.rows ?? [];

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await generatePlan({ year });
      toast.success(`${result.created} Themen-Audits erzeugt`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Erzeugen");
    } finally {
      setGenerating(false);
    }
  }

  function handleExport() {
    if (rows.length === 0) return;
    const data: AuditPlanData = {
      year,
      rows: rows.map((r) => ({
        area: r.area,
        auditTeam: r.auditTeam,
        affectedAreas: r.affectedAreas,
        plannedMonths: r.plannedMonths,
        istMonth: r.istMonth,
      })),
    };
    downloadAuditPlan(data, `Auditplan_${year}.pdf`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditplan"
        description="Jahresmatrix Thema × Monat mit SOLL/IST (ISO 13485 Kap. 8.2.4 — FB 8.2.4)"
        actions={
          <>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={rows.length === 0} onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" /> PDF exportieren
            </Button>
          </>
        }
      />

      {matrix === undefined ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8">
          <p className="text-sm text-muted-foreground">
            Keine Themen-Audits für {year}.
          </p>
          {can("audits:manage") && (
            <Button disabled={generating} onClick={handleGenerate}>
              Plan {year} aus Vorjahr erzeugen
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium min-w-[180px]">Thema</th>
                  <th className="px-3 py-2 text-left font-medium">Auditor/en</th>
                  <th className="px-3 py-2 text-left font-medium">betroffene Bereiche</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                    SOLL/IST
                  </th>
                  {MONTHS.map((m) => (
                    <th
                      key={m}
                      title={MONTH_LABELS_SHORT[m - 1]}
                      className="w-8 px-2 py-2 text-center font-medium"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r._id}>
                    <tr>
                      <td
                        rowSpan={2}
                        className="cursor-pointer px-3 py-2 align-middle font-medium hover:underline"
                        title={r.title}
                        onClick={() => router.push(`/audits/${r._id}`)}
                      >
                        {r.area}
                      </td>
                      <td rowSpan={2} className="px-3 py-2 align-middle">
                        {r.auditTeam ?? "—"}
                      </td>
                      <td rowSpan={2} className="px-3 py-2 align-middle text-muted-foreground">
                        {r.affectedAreas ?? "—"}
                      </td>
                      <td rowSpan={2} className="px-3 py-2 align-middle">
                        <Badge className={STATUS_VARIANT[r.status] ?? ""} variant="secondary">
                          {AUDIT_STATUS_LABELS[r.status as AuditStatus] ?? r.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">SOLL</td>
                      {MONTHS.map((m) => (
                        <td key={m} className="px-2 py-1 text-center">
                          {r.plannedMonths.includes(m) ? "x" : ""}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="px-2 py-1 text-xs text-muted-foreground">IST</td>
                      {MONTHS.map((m) => (
                        <td key={m} className="px-2 py-1 text-center">
                          {r.istMonth === m ? (
                            <span
                              className={
                                r.plannedMonths.includes(m)
                                  ? "font-semibold text-green-600"
                                  : "font-semibold text-amber-600"
                              }
                            >
                              x
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            IST wird aus dem tatsächlichen Auditdatum abgeleitet.
          </p>
        </>
      )}
    </div>
  );
}
