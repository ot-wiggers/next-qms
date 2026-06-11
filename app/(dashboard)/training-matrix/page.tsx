"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  REQUIREMENT_LEVEL_SYMBOLS,
  REQUIREMENT_LEVEL_LABELS,
  REQUIREMENT_LEVELS,
  MANDATORY_LEVELS,
  STAFFING_STATUS_LABELS,
  TOPIC_CLUSTERS,
  type RequirementLevel,
  type StaffingStatus,
} from "@/lib/types/enums";
import { toast } from "sonner";

// ============================================================
// Types inferred from query return shapes
// ============================================================

type OverviewItem = {
  _id: Id<"jobFunctions">;
  name: string;
  holder?: string;
  staffingStatus: StaffingStatus;
  sortOrder: number;
  userId?: Id<"users">;
  notes?: string;
  successionPath?: string;
  successionState?: string;
  successionNextSteps?: string;
  successionResponsible?: string;
  successionDueText?: string;
  successionStatus?: string;
  mandatoryTotal: number;
  mandatoryFulfilled: number;
  percent: number | null;
  ampel: "GREEN" | "YELLOW" | "RED" | null;
};

type DetailItem = {
  topicId: Id<"trainingTopics">;
  level: RequirementLevel;
  cluster: string;
  topicTitle: string;
  topicSortOrder: number;
  frequency?: string;
  provider?: string;
  fulfilled: boolean;
  validUntil?: number;
  note?: string;
  expired: boolean;
};

type FunctionDetail = {
  _id: Id<"jobFunctions">;
  name: string;
  holder?: string;
  staffingStatus: StaffingStatus;
  sortOrder: number;
  userId?: Id<"users">;
  notes?: string;
  successionPath?: string;
  successionState?: string;
  successionNextSteps?: string;
  successionResponsible?: string;
  successionDueText?: string;
  successionStatus?: string;
  items: DetailItem[];
};

type MatrixTopic = {
  _id: Id<"trainingTopics">;
  cluster: string;
  title: string;
  frequency?: string;
  provider?: string;
  sortOrder: number;
};

type MatrixFunction = {
  _id: Id<"jobFunctions">;
  name: string;
  holder?: string;
  sortOrder: number;
};

type MatrixRequirement = {
  topicId: Id<"trainingTopics">;
  functionId: Id<"jobFunctions">;
  level: RequirementLevel;
};

type PlanDraftRow = {
  functionId: Id<"jobFunctions">;
  functionName: string;
  holder?: string;
  topicId: Id<"trainingTopics">;
  topicTitle: string;
  cluster: string;
  level: RequirementLevel;
  frequency?: string;
  provider?: string;
};

// ============================================================
// Helpers
// ============================================================

const STAFFING_BADGE: Record<StaffingStatus, string> = {
  FILLED: "bg-green-100 text-green-800",
  INTERNAL_DEVELOP: "bg-amber-100 text-amber-800",
  EXTERNAL_HIRE: "bg-red-100 text-red-800",
  IN_CLARIFICATION: "bg-blue-100 text-blue-800",
};

const AMPEL_BADGE: Record<"GREEN" | "YELLOW" | "RED", string> = {
  GREEN: "bg-green-100 text-green-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("de-DE");
}

// ============================================================
// Empty succession draft
// ============================================================

function emptySuccessionDraft(fn: OverviewItem | FunctionDetail) {
  return {
    holder: fn.holder ?? "",
    notes: fn.notes ?? "",
    successionPath: fn.successionPath ?? "",
    successionState: fn.successionState ?? "",
    successionNextSteps: fn.successionNextSteps ?? "",
    successionResponsible: fn.successionResponsible ?? "",
    successionDueText: fn.successionDueText ?? "",
    successionStatus: fn.successionStatus ?? "",
  };
}

// ============================================================
// Page
// ============================================================

export default function TrainingMatrixPage() {
  const { can } = usePermissions();
  const canManage = can("trainingMatrix:manage");
  const canCreateTraining = can("trainings:create");

  // ---- Queries ----
  const overview = useQuery(api.trainingMatrix.overview, {});
  const matrixData = useQuery(api.trainingMatrix.matrix, {});
  const planDraft = useQuery(api.trainingMatrix.planDraft, {});

  // ---- Lazy detail (skip pattern) ----
  const [openFunctionId, setOpenFunctionId] = useState<Id<"jobFunctions"> | null>(null);
  const detail = useQuery(
    api.trainingMatrix.functionDetail,
    openFunctionId ? { functionId: openFunctionId } : "skip",
  );

  // ---- Mutations ----
  const setFulfillment = useMutation(api.trainingMatrix.setFulfillment);
  const updateFunction = useMutation(api.trainingMatrix.updateFunction);
  const setRequirement = useMutation(api.trainingMatrix.setRequirement);
  const createTraining = useMutation(api.trainings.create);

  // ---- Details dialog (Soll-Ist) ----
  const [detailOpen, setDetailOpen] = useState(false);

  function openDetail(fnId: Id<"jobFunctions">) {
    setOpenFunctionId(fnId);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    setOpenFunctionId(null);
    setSuccessionDraft(null);
    setSavingSuccession(false);
  }

  // ---- Succession draft (keyed per function, like qualityObjectives pattern) ----
  const [successionDraft, setSuccessionDraft] = useState<ReturnType<typeof emptySuccessionDraft> | null>(null);
  const [savingSuccession, setSavingSuccession] = useState(false);

  // Initialise draft when detail loads (keyed on detail._id to reset on function switch)
  useEffect(() => {
    if (detail && successionDraft === null) {
      setSuccessionDraft(emptySuccessionDraft(detail as FunctionDetail));
    }
  }, [detail?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveSuccession() {
    if (!openFunctionId || !successionDraft) return;
    if (savingSuccession) return;
    setSavingSuccession(true);
    try {
      // Pass raw strings so the server's per-field trim||undefined handles clearing on empty string
      await updateFunction({
        id: openFunctionId,
        holder: successionDraft.holder,
        notes: successionDraft.notes,
        successionPath: successionDraft.successionPath,
        successionState: successionDraft.successionState,
        successionNextSteps: successionDraft.successionNextSteps,
        successionResponsible: successionDraft.successionResponsible,
        successionDueText: successionDraft.successionDueText,
        successionStatus: successionDraft.successionStatus,
      });
      toast.success("Nachfolge-Daten gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSavingSuccession(false);
    }
  }

  // ---- Matrix cell edit dialog ----
  const [cellDialog, setCellDialog] = useState<{
    open: boolean;
    functionId?: Id<"jobFunctions">;
    topicId?: Id<"trainingTopics">;
    functionName?: string;
    topicTitle?: string;
    currentLevel?: RequirementLevel;
  }>({ open: false });
  const [cellLevel, setCellLevel] = useState<string>("");

  function openCellDialog(
    fn: MatrixFunction,
    topic: MatrixTopic,
    currentLevel: RequirementLevel | undefined,
  ) {
    if (!canManage) return;
    setCellDialog({
      open: true,
      functionId: fn._id,
      topicId: topic._id,
      functionName: fn.name,
      topicTitle: topic.title,
      currentLevel,
    });
    setCellLevel(currentLevel ?? "");
  }

  async function handleCellSave() {
    if (!cellDialog.functionId || !cellDialog.topicId) return;
    try {
      if (cellLevel === "REMOVE" || cellLevel === "") {
        await setRequirement({
          functionId: cellDialog.functionId,
          topicId: cellDialog.topicId,
          remove: true,
        });
        toast.success("Zuordnung entfernt");
      } else {
        await setRequirement({
          functionId: cellDialog.functionId,
          topicId: cellDialog.topicId,
          level: cellLevel as RequirementLevel,
        });
        toast.success("Einstufung gespeichert");
      }
      setCellDialog({ open: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  // ---- Plan-Entwurf: in-flight Set for double-click protection ----
  const [creatingTrainings, setCreatingTrainings] = useState<Set<string>>(new Set());

  async function handleCreateTraining(row: PlanDraftRow) {
    const key = `${row.functionId}-${row.topicId}`;
    if (creatingTrainings.has(key)) return;
    setCreatingTrainings((prev) => new Set(prev).add(key));
    try {
      const levelLabel = REQUIREMENT_LEVEL_LABELS[row.level];
      await createTraining({
        title: row.topicTitle,
        description: `Aus Schulungsbedarfsmatrix: ${row.functionName} — Einstufung ${levelLabel}, Frequenz ${row.frequency ?? "—"}`,
        isRequired: true,
        effectivenessCheckAfterDays: 90,
        category: TOPIC_CLUSTERS.find((c) => c.key === row.cluster)?.title ?? row.cluster,
      });
      toast.success(`Training „${row.topicTitle}“ angelegt`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen");
    } finally {
      setCreatingTrainings((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schulungsbedarfsmatrix"
        description="Funktionsbasierte Schulungsbedarfe mit Soll-Ist (ISO 13485 Kap. 6.2 — FB 6.2.0 Anhang)"
      />

      {/* Amber Hinweis-Banner */}
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Hinweis:</strong> Die Einstufungen der Matrix sind laut Formblatt Rev. 1 noch{" "}
        <strong>ENTWURF</strong> — Freigabe durch GF + BDL ausstehend.
      </div>

      <Tabs defaultValue="soll-ist">
        <TabsList>
          <TabsTrigger value="soll-ist">Soll-Ist</TabsTrigger>
          <TabsTrigger value="matrix">Matrix</TabsTrigger>
          <TabsTrigger value="plan-entwurf">Plan-Entwurf</TabsTrigger>
        </TabsList>

        {/* ======================================================
            Tab 1: Soll-Ist
        ====================================================== */}
        <TabsContent value="soll-ist">
          {overview === undefined ? (
            <div className="p-8 text-muted-foreground">Lade…</div>
          ) : overview.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-muted-foreground">
              Keine Funktionen vorhanden.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(overview as OverviewItem[]).map((fn) => (
                <Card key={fn._id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium leading-tight truncate">{fn.name}</p>
                        {fn.holder && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {fn.holder}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={STAFFING_BADGE[fn.staffingStatus]}
                        variant="secondary"
                      >
                        {STAFFING_STATUS_LABELS[fn.staffingStatus]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {fn.mandatoryFulfilled}/{fn.mandatoryTotal} Pflichtschulungen
                      </span>
                      {fn.percent !== null && fn.ampel ? (
                        <Badge
                          className={AMPEL_BADGE[fn.ampel]}
                          variant="secondary"
                        >
                          {fn.percent} %
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500" variant="secondary">
                          —
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openDetail(fn._id)}
                    >
                      Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ======================================================
            Tab 2: Matrix Grid
        ====================================================== */}
        <TabsContent value="matrix">
          {matrixData === undefined ? (
            <div className="p-8 text-muted-foreground">Lade…</div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium min-w-[200px]">
                        Thema
                      </th>
                      {(matrixData.functions as MatrixFunction[]).map((fn) => (
                        <th
                          key={fn._id}
                          title={fn.name + (fn.holder ? ` (${fn.holder})` : "")}
                          className="px-2 py-2 text-center font-medium max-w-[80px] whitespace-nowrap overflow-hidden text-ellipsis"
                        >
                          <span
                            className="block max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap"
                            title={fn.name}
                          >
                            {fn.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const topics = matrixData.topics as MatrixTopic[];
                      const functions = matrixData.functions as MatrixFunction[];
                      const requirements = matrixData.requirements as MatrixRequirement[];

                      // Build lookup: topicId -> functionId -> level
                      const reqLookup = new Map<string, RequirementLevel>();
                      for (const r of requirements) {
                        reqLookup.set(`${r.topicId}-${r.functionId}`, r.level);
                      }

                      const rows: React.ReactNode[] = [];
                      let lastCluster = "";

                      for (const topic of topics) {
                        // Cluster header row
                        if (topic.cluster !== lastCluster) {
                          lastCluster = topic.cluster;
                          const clusterMeta = TOPIC_CLUSTERS.find((c) => c.key === topic.cluster);
                          rows.push(
                            <tr key={`cluster-${topic.cluster}`} className="bg-muted/30">
                              <td
                                colSpan={functions.length + 1}
                                className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                              >
                                {clusterMeta?.title ?? topic.cluster}
                              </td>
                            </tr>,
                          );
                        }

                        rows.push(
                          <tr
                            key={topic._id}
                            className="border-t hover:bg-muted/20 transition-colors"
                          >
                            <td className="sticky left-0 z-10 bg-background px-3 py-2 min-w-[200px]">
                              <span className="font-medium">{topic.title}</span>
                              {topic.frequency && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  · {topic.frequency}
                                </span>
                              )}
                            </td>
                            {functions.map((fn) => {
                              const level = reqLookup.get(`${topic._id}-${fn._id}`);
                              return (
                                <td
                                  key={fn._id}
                                  className={[
                                    "px-2 py-2 text-center",
                                    canManage
                                      ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                      : "",
                                  ].join(" ")}
                                  title={
                                    level
                                      ? `${fn.name}: ${REQUIREMENT_LEVEL_LABELS[level]}`
                                      : `${fn.name}: nicht relevant`
                                  }
                                  onClick={() => openCellDialog(fn, topic, level)}
                                >
                                  {level ? (
                                    <span className="font-mono text-base">
                                      {REQUIREMENT_LEVEL_SYMBOLS[level]}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>,
                        );
                      }

                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Legende */}
              <div className="flex flex-wrap gap-4 text-sm">
                {REQUIREMENT_LEVELS.map((level) => (
                  <div key={level} className="flex items-center gap-1.5">
                    <span className="font-mono">{REQUIREMENT_LEVEL_SYMBOLS[level]}</span>
                    <span className="text-muted-foreground">{REQUIREMENT_LEVEL_LABELS[level]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">—</span>
                  <span className="text-muted-foreground">nicht relevant</span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ======================================================
            Tab 3: Plan-Entwurf
        ====================================================== */}
        <TabsContent value="plan-entwurf">
          {planDraft === undefined ? (
            <div className="p-8 text-muted-foreground">Lade…</div>
          ) : planDraft.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-muted-foreground">
              Keine offenen Pflichtschulungen — alle Funktionen vollständig.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Unerfüllte Pflichtschulungen — Vorschlag für den Schulungsplan. Übernahme erzeugt ein
                Training im bestehenden Schulungsmodul.
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Funktion</th>
                      <th className="px-3 py-2 text-left font-medium">Thema</th>
                      <th className="px-3 py-2 text-left font-medium">Einstufung</th>
                      <th className="px-3 py-2 text-left font-medium">Frequenz</th>
                      <th className="px-3 py-2 text-left font-medium">Anbieter</th>
                      <th className="px-3 py-2 text-right font-medium">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(planDraft as PlanDraftRow[]).map((row) => {
                      const key = `${row.functionId}-${row.topicId}`;
                      const inFlight = creatingTrainings.has(key);
                      return (
                        <tr key={key} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2">
                            <span className="font-medium">{row.functionName}</span>
                            {row.holder && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({row.holder})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">{row.topicTitle}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="font-mono mr-1">
                              {REQUIREMENT_LEVEL_SYMBOLS[row.level]}
                            </span>
                            <span className="text-muted-foreground">
                              {REQUIREMENT_LEVEL_LABELS[row.level]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.frequency ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.provider ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {canCreateTraining ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={inFlight}
                                onClick={() => handleCreateTraining(row)}
                              >
                                {inFlight ? "Anlegen…" : "Training anlegen"}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================================
          Details Dialog (Soll-Ist per function)
      ============================================================ */}
      <Dialog open={detailOpen} onOpenChange={(o) => { if (!o) closeDetail(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detail ? detail.name : "Lade…"}
              {detail?.holder && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {detail.holder}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detail === undefined || detail === null ? (
            <div className="py-8 text-center text-muted-foreground">Lade…</div>
          ) : (
            <>
              {/* ---- Themen-Liste ---- */}
              <div className="space-y-1">
                <h3 className="text-sm font-semibold mb-2">Schulungsthemen</h3>
                {detail.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Themen zugeordnet.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Pflicht zuerst */}
                    {[...detail.items]
                      .sort((a, b) => {
                        const aM = (MANDATORY_LEVELS as readonly string[]).includes(a.level) ? 0 : 1;
                        const bM = (MANDATORY_LEVELS as readonly string[]).includes(b.level) ? 0 : 1;
                        if (aM !== bM) return aM - bM;
                        return a.cluster.localeCompare(b.cluster) || a.topicSortOrder - b.topicSortOrder;
                      })
                      .map((item) => {
                        const isMandatory = (MANDATORY_LEVELS as readonly string[]).includes(item.level);
                        return (
                          <div
                            key={item.topicId}
                            className="flex flex-wrap items-start gap-2 rounded-md border p-2"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Checkbox
                                id={`fulfill-${item.topicId}`}
                                checked={item.fulfilled}
                                disabled={!canManage}
                                onCheckedChange={async (checked) => {
                                  if (!openFunctionId) return;
                                  try {
                                    // Preserve validUntil and note to avoid data loss on toggle
                                    await setFulfillment({
                                      functionId: openFunctionId,
                                      topicId: item.topicId,
                                      fulfilled: !!checked,
                                      validUntil: item.validUntil,
                                      note: item.note,
                                    });
                                    toast.success(
                                      checked ? "Als erfüllt markiert" : "Als nicht erfüllt markiert",
                                    );
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Fehler");
                                  }
                                }}
                              />
                              <div className="min-w-0">
                                <Label
                                  htmlFor={`fulfill-${item.topicId}`}
                                  className="cursor-pointer"
                                >
                                  <span className="font-mono mr-1">
                                    {REQUIREMENT_LEVEL_SYMBOLS[item.level]}
                                  </span>
                                  <span className={isMandatory ? "font-medium" : ""}>
                                    {item.topicTitle}
                                  </span>
                                </Label>
                                {item.frequency && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {item.frequency}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.expired && (
                                <span className="text-xs text-red-700 font-medium">
                                  Nachweis abgelaufen
                                </span>
                              )}
                              {item.validUntil && !item.expired && (
                                <span className="text-xs text-muted-foreground">
                                  bis {formatDate(item.validUntil)}
                                </span>
                              )}
                              {canManage && (
                                <div className="flex items-center gap-1">
                                  <Label
                                    htmlFor={`valid-until-${item.topicId}`}
                                    className="text-xs text-muted-foreground whitespace-nowrap"
                                  >
                                    Gültig bis
                                  </Label>
                                  <Input
                                    id={`valid-until-${item.topicId}`}
                                    type="date"
                                    className="h-7 w-[130px] text-xs"
                                    defaultValue={
                                      item.validUntil
                                        ? new Date(item.validUntil).toISOString().slice(0, 10)
                                        : ""
                                    }
                                    onChange={async (e) => {
                                      if (!openFunctionId) return;
                                      const val = e.target.value;
                                      // Clearing the date intentionally removes validUntil; note is always preserved
                                      const validUntil = val
                                        ? new Date(val).getTime()
                                        : undefined;
                                      try {
                                        await setFulfillment({
                                          functionId: openFunctionId,
                                          topicId: item.topicId,
                                          fulfilled: true,
                                          validUntil,
                                          note: item.note,
                                        });
                                        toast.success("Gültigkeitsdatum gespeichert");
                                      } catch (e) {
                                        toast.error(e instanceof Error ? e.message : "Fehler");
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* ---- Nachfolge & Besetzung ---- */}
              <div className="mt-4 space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Nachfolge &amp; Besetzung</h3>

                {successionDraft && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="succ-holder">Stelleninhaber/in</Label>
                      <Input
                        id="succ-holder"
                        value={successionDraft.holder}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({ ...successionDraft, holder: e.target.value })
                        }
                        placeholder="Name oder Rolle"
                      />
                    </div>
                    <div>
                      <Label htmlFor="succ-status">Besetzungsstatus (Text)</Label>
                      <Input
                        id="succ-status"
                        value={successionDraft.successionStatus}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({
                            ...successionDraft,
                            successionStatus: e.target.value,
                          })
                        }
                        placeholder="z. B. Übergabe geplant Q3"
                      />
                    </div>
                    <div>
                      <Label htmlFor="succ-path">Nachfolge-Pfad</Label>
                      <Input
                        id="succ-path"
                        value={successionDraft.successionPath}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({
                            ...successionDraft,
                            successionPath: e.target.value,
                          })
                        }
                        placeholder="z. B. Intern / Extern"
                      />
                    </div>
                    <div>
                      <Label htmlFor="succ-state">Aktueller Stand</Label>
                      <Input
                        id="succ-state"
                        value={successionDraft.successionState}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({
                            ...successionDraft,
                            successionState: e.target.value,
                          })
                        }
                        placeholder="z. B. in Einarbeitung"
                      />
                    </div>
                    <div>
                      <Label htmlFor="succ-responsible">Verantwortlich</Label>
                      <Input
                        id="succ-responsible"
                        value={successionDraft.successionResponsible}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({
                            ...successionDraft,
                            successionResponsible: e.target.value,
                          })
                        }
                        placeholder="Name oder Rolle"
                      />
                    </div>
                    <div>
                      <Label htmlFor="succ-due">Zieldatum (Text)</Label>
                      <Input
                        id="succ-due"
                        value={successionDraft.successionDueText}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({
                            ...successionDraft,
                            successionDueText: e.target.value,
                          })
                        }
                        placeholder="z. B. bis Q2/2027"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="succ-nextsteps">Nächste Schritte</Label>
                      <Textarea
                        id="succ-nextsteps"
                        rows={2}
                        value={successionDraft.successionNextSteps}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({
                            ...successionDraft,
                            successionNextSteps: e.target.value,
                          })
                        }
                        placeholder="Konkrete Maßnahmen…"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="succ-notes">Notizen</Label>
                      <Textarea
                        id="succ-notes"
                        rows={2}
                        value={successionDraft.notes}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSuccessionDraft({ ...successionDraft, notes: e.target.value })
                        }
                        placeholder="Allgemeine Hinweise…"
                      />
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveSuccession}
                      disabled={savingSuccession || !successionDraft}
                    >
                      {savingSuccession ? "Speichern…" : "Speichern"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={closeDetail}>
                  Schließen
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================
          Matrix Cell Edit Dialog
      ============================================================ */}
      <Dialog
        open={cellDialog.open}
        onOpenChange={(o) => { if (!o) setCellDialog({ open: false }); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Einstufung bearbeiten
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{cellDialog.functionName}</strong> ·{" "}
              {cellDialog.topicTitle}
            </p>
            <div>
              <Label htmlFor="cell-level">Einstufung</Label>
              <Select value={cellLevel} onValueChange={setCellLevel}>
                <SelectTrigger id="cell-level">
                  <SelectValue placeholder="Auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {REQUIREMENT_LEVEL_SYMBOLS[lvl]} {REQUIREMENT_LEVEL_LABELS[lvl]}
                    </SelectItem>
                  ))}
                  <SelectItem value="REMOVE">— nicht relevant (entfernen)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCellDialog({ open: false })}>
                Abbrechen
              </Button>
              <Button onClick={handleCellSave}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
