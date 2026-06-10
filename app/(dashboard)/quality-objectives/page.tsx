"use client";

import { useState } from "react";
import Link from "next/link";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  OBJECTIVE_STATUS_LABELS,
  OBJECTIVE_TARGET_TYPE_LABELS,
  KPI_KEYS,
  KPI_KEY_LABELS,
  type ObjectiveStatus,
  type ObjectiveTargetType,
  type KpiKey,
} from "@/lib/types/enums";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

type Reading = {
  _id: Id<"qualityObjectiveReadings">;
  quarter: number;
  targetValue: number;
  actualValue?: number;
  percent?: number;
  status?: "GREEN" | "YELLOW" | "RED";
  note?: string;
};

type Objective = {
  _id: Id<"qualityObjectives">;
  seq: number;
  area: string;
  title: string;
  kpiDefinition?: string;
  dataSource?: string;
  responsible?: string;
  targetType: "MIN" | "MAX";
  targetValue: number;
  unit?: string;
  isPhaseModel: boolean;
  kpiKey?: string;
  comment?: string;
  capaId?: Id<"capas">;
  capaNumber?: string | null;
  currentStatus: ObjectiveStatus | null;
  needsCapa: boolean;
  readings: Reading[];
};

// ============================================================
// Ampel helpers
// ============================================================

const STATUS_BG: Record<ObjectiveStatus, string> = {
  GREEN: "bg-green-100 text-green-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
};

const QUARTER_DOT: Record<ObjectiveStatus, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-amber-500",
  RED: "bg-red-500",
};

/** 999 = Sentinel für IST 0 bei max-Ziel — FB zeigt 100 % */
function displayPercent(percent: number): string {
  return percent === 999 ? "100 %" : `${percent} %`;
}

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

// ============================================================
// Empty objective form
// ============================================================

function emptyObjectiveForm() {
  return {
    area: "",
    title: "",
    kpiDefinition: "",
    dataSource: "",
    responsible: "",
    targetType: "MIN" as ObjectiveTargetType,
    targetValue: "",
    unit: "",
    isPhaseModel: false,
    kpiKey: "none",
    comment: "",
  };
}

// ============================================================
// Page
// ============================================================

export default function QualityObjectivesPage() {
  const { can } = usePermissions();
  const canManage = can("qualityObjectives:manage");

  const [year, setYear] = useState(currentYear);
  const objectives = useQuery(api.qualityObjectives.listByYear, { year });
  const kpis = useQuery(api.kpis.compute, { year });

  const createObjective = useMutation(api.qualityObjectives.create);
  const updateObjective = useMutation(api.qualityObjectives.update);
  const setQuarterTargets = useMutation(api.qualityObjectives.setQuarterTargets);
  const recordReading = useMutation(api.qualityObjectives.recordReading);
  const createCapa = useMutation(api.capas.create);
  const linkCapa = useMutation(api.qualityObjectives.linkCapa);

  // ---- Objective dialog (create / edit) ----
  const [objDialog, setObjDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    id?: Id<"qualityObjectives">;
  }>({ open: false, mode: "create" });
  const [objForm, setObjForm] = useState(emptyObjectiveForm());

  function openCreateDialog() {
    setObjForm(emptyObjectiveForm());
    setObjDialog({ open: true, mode: "create" });
  }

  function openEditDialog(obj: Objective) {
    setObjForm({
      area: obj.area,
      title: obj.title,
      kpiDefinition: obj.kpiDefinition ?? "",
      dataSource: obj.dataSource ?? "",
      responsible: obj.responsible ?? "",
      targetType: obj.targetType,
      targetValue: String(obj.targetValue),
      unit: obj.unit ?? "",
      isPhaseModel: obj.isPhaseModel,
      kpiKey: obj.kpiKey ?? "none",
      comment: obj.comment ?? "",
    });
    setObjDialog({ open: true, mode: "edit", id: obj._id });
  }

  async function handleObjectiveSubmit() {
    if (objForm.targetValue.trim() === "") { toast.error("Zielwert ist erforderlich"); return; }
    const tv = Number(objForm.targetValue);
    if (!Number.isFinite(tv)) {
      toast.error("Ungültiger Zielwert");
      return;
    }
    if (!objForm.area.trim()) { toast.error("Bereich ist erforderlich"); return; }
    if (!objForm.title.trim()) { toast.error("Titel ist erforderlich"); return; }

    const kpiKeyValue = objForm.kpiKey === "none" ? undefined : objForm.kpiKey;

    try {
      if (objDialog.mode === "create") {
        await createObjective({
          year,
          area: objForm.area.trim(),
          title: objForm.title.trim(),
          kpiDefinition: objForm.kpiDefinition || undefined,
          dataSource: objForm.dataSource || undefined,
          responsible: objForm.responsible || undefined,
          targetType: objForm.targetType,
          targetValue: tv,
          unit: objForm.unit || undefined,
          isPhaseModel: objForm.isPhaseModel,
          kpiKey: kpiKeyValue,
          comment: objForm.comment || undefined,
        });
        toast.success("Qualitätsziel angelegt");
      } else if (objDialog.id) {
        await updateObjective({
          id: objDialog.id,
          area: objForm.area,
          title: objForm.title,
          kpiDefinition: objForm.kpiDefinition,
          dataSource: objForm.dataSource,
          responsible: objForm.responsible,
          targetType: objForm.targetType,
          targetValue: tv,
          unit: objForm.unit,
          isPhaseModel: objForm.isPhaseModel,
          kpiKey: kpiKeyValue ?? "",
          comment: objForm.comment,
        });
        toast.success("Qualitätsziel aktualisiert");
      }
      setObjDialog({ open: false, mode: "create" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  // ---- Quarter-SOLL dialog ----
  const [sollDialog, setSollDialog] = useState<{
    open: boolean;
    objective?: Objective;
  }>({ open: false });
  const [sollValues, setSollValues] = useState<Record<number, string>>({});

  function openSollDialog(obj: Objective) {
    const init: Record<number, string> = {};
    for (let q = 1; q <= 4; q++) {
      const r = obj.readings.find((x) => x.quarter === q);
      init[q] = r ? String(r.targetValue) : "";
    }
    setSollValues(init);
    setSollDialog({ open: true, objective: obj });
  }

  async function handleSollSubmit() {
    if (!sollDialog.objective) return;
    const targets: { quarter: number; targetValue: number }[] = [];
    for (let q = 1; q <= 4; q++) {
      if (sollValues[q].trim() === "") continue;
      const v = Number(sollValues[q]);
      if (Number.isFinite(v)) targets.push({ quarter: q, targetValue: v });
    }
    if (targets.length === 0) { toast.error("Mindestens ein SOLL-Wert erforderlich"); return; }
    try {
      await setQuarterTargets({ objectiveId: sollDialog.objective._id, targets });
      toast.success("Quartals-SOLL gespeichert");
      setSollDialog({ open: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  // ---- IST-Erfassen dialog ----
  const [istDialog, setIstDialog] = useState<{
    open: boolean;
    objective?: Objective;
    quarter?: number;
    reading?: Reading;
  }>({ open: false });
  const [istValue, setIstValue] = useState("");
  const [istNote, setIstNote] = useState("");

  function openIstDialog(obj: Objective, quarter: number) {
    const reading = obj.readings.find((r) => r.quarter === quarter);
    setIstValue(reading?.actualValue !== undefined ? String(reading.actualValue) : "");
    setIstNote(reading?.note ?? "");
    setIstDialog({ open: true, objective: obj, quarter, reading });
  }

  async function handleIstSubmit() {
    if (!istDialog.objective || !istDialog.quarter) return;
    if (istValue.trim() === "") { toast.error("IST-Wert ist erforderlich"); return; }
    const av = Number(istValue);
    if (!Number.isFinite(av)) { toast.error("Ungültiger IST-Wert"); return; }
    try {
      const result = await recordReading({
        objectiveId: istDialog.objective._id,
        quarter: istDialog.quarter,
        actualValue: av,
        note: istNote || undefined,
      });
      setIstDialog({ open: false });
      if (result.needsCapa) {
        toast.warning(
          "Ziel steht auf Gelb/Rot — bitte CAPA verknüpfen (Pflicht laut FB 5.4.1)"
        );
      } else {
        toast.success("IST-Wert erfasst");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  // ---- CAPA anlegen dialog ----
  const [capaCreating, setCapaCreating] = useState<Set<string>>(new Set());

  async function handleCreateCapa(obj: Objective) {
    if (capaCreating.has(obj._id)) return;
    setCapaCreating((prev) => new Set(prev).add(obj._id));
    try {
      const capaTitle = `Q-Ziel ${obj.seq}: ${obj.title}`.slice(0, 200);
      const capaId = await createCapa({
        title: capaTitle,
        sourceType: "QUALITY_OBJECTIVE",
        sourceId: obj._id as string,
        capaType: "CORRECTIVE",
      });
      await linkCapa({ objectiveId: obj._id, capaId });
      toast.success("CAPA angelegt und verknüpft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setCapaCreating((prev) => {
        const next = new Set(prev);
        next.delete(obj._id);
        return next;
      });
    }
  }

  // ============================================================
  // Render
  // ============================================================

  if (objectives === undefined) {
    return <div className="p-8 text-muted-foreground">Lade…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qualitätsziele"
        description="Quartalsweise KPI-Ziele (ISO 13485 Kap. 5.4.1) — Ampel: ≥100 % grün, ≥70 % gelb, <70 % rot"
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> Ziel anlegen
              </Button>
            )}
          </div>
        }
      />

      {objectives.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Qualitätsziele für {year}
        </div>
      ) : (
        <div className="space-y-4">
          {(objectives as Objective[]).map((obj) => (
            <ObjectiveCard
              key={obj._id}
              obj={obj}
              canManage={canManage}
              canCapaCreate={can("capa:create")}
              capaCreating={capaCreating.has(obj._id)}
              onEdit={() => openEditDialog(obj)}
              onQuarterClick={(q) => openIstDialog(obj, q)}
              onSollClick={() => openSollDialog(obj)}
              onCreateCapa={() => handleCreateCapa(obj)}
            />
          ))}
        </div>
      )}

      {/* ---- Objective Create/Edit Dialog ---- */}
      <Dialog open={objDialog.open} onOpenChange={(o) => setObjDialog((prev) => ({ ...prev, open: o }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {objDialog.mode === "create" ? "Ziel anlegen" : "Ziel bearbeiten"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="obj-area">Bereich *</Label>
              <Input
                id="obj-area"
                value={objForm.area}
                onChange={(e) => setObjForm({ ...objForm, area: e.target.value })}
                placeholder="z. B. QM / Vertrieb"
              />
            </div>
            <div>
              <Label htmlFor="obj-title">Titel *</Label>
              <Input
                id="obj-title"
                value={objForm.title}
                onChange={(e) => setObjForm({ ...objForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="obj-kpidef">KPI-Definition</Label>
              <Textarea
                id="obj-kpidef"
                rows={2}
                value={objForm.kpiDefinition}
                onChange={(e) => setObjForm({ ...objForm, kpiDefinition: e.target.value })}
                placeholder="Messgröße / Berechnungsformel"
              />
            </div>
            <div>
              <Label htmlFor="obj-datasource">Datenquelle</Label>
              <Input
                id="obj-datasource"
                value={objForm.dataSource}
                onChange={(e) => setObjForm({ ...objForm, dataSource: e.target.value })}
                placeholder="z. B. OTWin, App-Register"
              />
            </div>
            <div>
              <Label htmlFor="obj-responsible">Verantwortlich</Label>
              <Input
                id="obj-responsible"
                value={objForm.responsible}
                onChange={(e) => setObjForm({ ...objForm, responsible: e.target.value })}
                placeholder="Rolle oder Name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="obj-type">Typ *</Label>
                <Select
                  value={objForm.targetType}
                  onValueChange={(v) => setObjForm({ ...objForm, targetType: v as ObjectiveTargetType })}
                >
                  <SelectTrigger id="obj-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OBJECTIVE_TARGET_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="obj-targetvalue">Zielwert *</Label>
                <Input
                  id="obj-targetvalue"
                  type="number"
                  value={objForm.targetValue}
                  onChange={(e) => setObjForm({ ...objForm, targetValue: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="obj-unit">Einheit</Label>
              <Input
                id="obj-unit"
                value={objForm.unit}
                onChange={(e) => setObjForm({ ...objForm, unit: e.target.value })}
                placeholder="z. B. %, Stk, Tage"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="obj-phase"
                checked={objForm.isPhaseModel}
                onCheckedChange={(c) => setObjForm({ ...objForm, isPhaseModel: !!c })}
              />
              <Label htmlFor="obj-phase">Phasenmodell (SOLL je Quartal variabel)</Label>
            </div>
            <div>
              <Label htmlFor="obj-kpikey">App-KPI-Vorschlag</Label>
              <Select
                value={objForm.kpiKey}
                onValueChange={(v) => setObjForm({ ...objForm, kpiKey: v })}
              >
                <SelectTrigger id="obj-kpikey"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manuell (kein Auto-Vorschlag)</SelectItem>
                  {KPI_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{KPI_KEY_LABELS[k as KpiKey]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="obj-comment">Kommentar</Label>
              <Textarea
                id="obj-comment"
                rows={2}
                value={objForm.comment}
                onChange={(e) => setObjForm({ ...objForm, comment: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setObjDialog((prev) => ({ ...prev, open: false }))}>
                Abbrechen
              </Button>
              <Button onClick={handleObjectiveSubmit}>
                {objDialog.mode === "create" ? "Anlegen" : "Speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Quartals-SOLL Dialog ---- */}
      <Dialog open={sollDialog.open} onOpenChange={(o) => setSollDialog((prev) => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Quartals-SOLL festlegen
              {sollDialog.objective ? ` — Nr. ${sollDialog.objective.seq}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((q) => (
                <div key={q}>
                  <Label htmlFor={`soll-q${q}`}>Q{q} SOLL</Label>
                  <Input
                    id={`soll-q${q}`}
                    type="number"
                    value={sollValues[q] ?? ""}
                    onChange={(e) => setSollValues({ ...sollValues, [q]: e.target.value })}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSollDialog({ open: false })}>
                Abbrechen
              </Button>
              <Button onClick={handleSollSubmit}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- IST Erfassen Dialog ---- */}
      <Dialog open={istDialog.open} onOpenChange={(o) => setIstDialog((prev) => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              IST erfassen
              {istDialog.quarter
                ? ` — Q${istDialog.quarter}`
                : ""}
              {istDialog.reading
                ? ` — SOLL ${istDialog.reading.targetValue}${istDialog.objective?.unit ? " " + istDialog.objective.unit : ""}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* App-KPI-Vorschlag — NIE automatisch übernehmen */}
            {istDialog.objective?.kpiKey && kpis && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="text-muted-foreground">App-Wert ({KPI_KEY_LABELS[istDialog.objective.kpiKey as KpiKey]}): </span>
                <span className="font-medium">
                  {kpis[istDialog.objective.kpiKey as KpiKey]}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3"
                  onClick={() => setIstValue(String(kpis![istDialog.objective!.kpiKey as KpiKey]))}
                >
                  übernehmen
                </Button>
              </div>
            )}
            <div>
              <Label htmlFor="ist-value">IST-Wert *</Label>
              <Input
                id="ist-value"
                type="number"
                value={istValue}
                onChange={(e) => setIstValue(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="ist-note">Notiz</Label>
              <Textarea
                id="ist-note"
                rows={2}
                value={istNote}
                onChange={(e) => setIstNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIstDialog({ open: false })}>
                Abbrechen
              </Button>
              <Button onClick={handleIstSubmit}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// ObjectiveCard sub-component
// ============================================================

interface ObjectiveCardProps {
  obj: Objective;
  canManage: boolean;
  canCapaCreate: boolean;
  capaCreating: boolean;
  onEdit: () => void;
  onQuarterClick: (quarter: number) => void;
  onSollClick: () => void;
  onCreateCapa: () => void;
}

function ObjectiveCard({
  obj,
  canManage,
  canCapaCreate,
  capaCreating,
  onEdit,
  onQuarterClick,
  onSollClick,
  onCreateCapa,
}: ObjectiveCardProps) {
  const typeShort = obj.targetType === "MIN" ? "min" : "max";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start gap-2">
          {/* Number + area + title */}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">
              Nr. {obj.seq} · {obj.area}
            </span>
            <p className="font-medium leading-tight">{obj.title}</p>
          </div>

          {/* Ampel Badge */}
          {obj.currentStatus ? (
            <Badge
              className={STATUS_BG[obj.currentStatus]}
              variant="secondary"
            >
              {OBJECTIVE_STATUS_LABELS[obj.currentStatus]}
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600" variant="secondary">
              ohne Messung
            </Badge>
          )}

          {/* needsCapa indicator */}
          {obj.needsCapa && (
            <>
              <Badge className="bg-red-100 text-red-800" variant="secondary">
                CAPA erforderlich!
              </Badge>
              {canCapaCreate && canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={capaCreating}
                  onClick={onCreateCapa}
                >
                  CAPA anlegen
                </Button>
              )}
            </>
          )}

          {/* CAPA-Link wenn vorhanden */}
          {obj.capaId && obj.capaNumber && (
            <Link href={`/capa/${obj.capaId}`}>
              <Badge className="bg-blue-100 text-blue-800 cursor-pointer" variant="secondary">
                {obj.capaNumber}
              </Badge>
            </Link>
          )}

          {/* Edit button */}
          {canManage && (
            <Button size="sm" variant="ghost" onClick={onEdit} title="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Subline */}
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {obj.kpiDefinition && <>{obj.kpiDefinition} · </>}
          Typ {typeShort} · Zielwert {obj.targetValue}{obj.unit ? ` ${obj.unit}` : ""}
          {obj.responsible && <> · Verantwortlich: {obj.responsible}</>}
          {obj.dataSource && <> · Quelle: {obj.dataSource}</>}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Quarter grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((q) => {
            const reading = obj.readings.find((r) => r.quarter === q);
            return (
              <QuarterBox
                key={q}
                quarter={q}
                reading={reading}
                unit={obj.unit}
                canManage={canManage}
                onClick={() => {
                  if (!canManage) return;
                  if (!reading) {
                    // No reading yet — open SOLL dialog first
                    onSollClick();
                  } else {
                    onQuarterClick(q);
                  }
                }}
              />
            );
          })}
        </div>

        {/* SOLL festlegen button when no readings exist */}
        {canManage && obj.readings.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onSollClick}
          >
            Quartals-SOLL festlegen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// QuarterBox sub-component
// ============================================================

interface QuarterBoxProps {
  quarter: number;
  reading: Reading | undefined;
  unit: string | undefined;
  canManage: boolean;
  onClick: () => void;
}

function QuarterBox({ quarter, reading, unit, canManage, onClick }: QuarterBoxProps) {
  const unitSuffix = unit ? ` ${unit}` : "";

  return (
    <button
      type="button"
      disabled={!canManage}
      onClick={onClick}
      className={[
        "rounded-md border p-2 text-left text-xs transition-colors",
        canManage
          ? "cursor-pointer hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
          : "cursor-default",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm">Q{quarter}</span>
        {reading?.status && (
          <span
            className={`h-2 w-2 rounded-full ${QUARTER_DOT[reading.status]}`}
            aria-label={OBJECTIVE_STATUS_LABELS[reading.status]}
          />
        )}
      </div>
      {reading ? (
        <>
          <div className="text-muted-foreground">
            SOLL {reading.targetValue}{unitSuffix}
          </div>
          <div>
            IST {reading.actualValue !== undefined
              ? `${reading.actualValue}${unitSuffix}`
              : <span className="text-muted-foreground">—</span>}
          </div>
          {reading.percent !== undefined && (
            <div className={reading.status ? `font-medium ${reading.status === "GREEN" ? "text-green-700" : reading.status === "YELLOW" ? "text-amber-700" : "text-red-700"}` : ""}>
              {displayPercent(reading.percent)}
            </div>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </button>
  );
}
