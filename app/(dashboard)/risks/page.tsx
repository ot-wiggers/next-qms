"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  RPZ_ACCEPT_THRESHOLD,
  RISK_OCCURRENCE_BANDS,
  RISK_SEVERITY_BANDS,
  RISK_CONSEQUENCE_BANDS,
  riskBandLabel,
  type RiskLevelBand,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

// ============================================================
// Types (Shape von api.risks.list)
// ============================================================

type RiskCapa = {
  _id: Id<"capas">;
  capaNumber: string;
  title: string;
  status: string;
};

type Risk = {
  _id: Id<"risks">;
  riskNumber: string;
  seq: number;
  title: string;
  measures?: string;
  responsible?: string;
  sourceNote?: string;
  occurrenceProbability: number;
  severity: number;
  consequences: number;
  initialOccurrenceProbability?: number;
  initialSeverity?: number;
  initialConsequences?: number;
  capaIds?: Id<"capas">[];
  addedInRevision?: number;
  nextReviewAt?: number;
  rpz: number;
  acceptable: boolean;
  initialRpz?: number;
  capas: RiskCapa[];
};

// ============================================================
// Helpers
// ============================================================

const FACTOR_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/** Option-Label "2 — Fernliegend (< 10⁻⁵)" — Hinweis nur wenn Band einen hat */
function factorOptionLabel(bands: readonly RiskLevelBand[], n: number): string {
  const band = bands.find((b) => n >= b.min && n <= b.max);
  if (!band) return String(n);
  return band.hint ? `${n} — ${band.label} (${band.hint})` : `${n} — ${band.label}`;
}

function rpzBadgeClass(acceptable: boolean): string {
  return acceptable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
}

function emptyForm() {
  return {
    title: "",
    measures: "",
    responsible: "",
    occurrence: "1",
    severity: "1",
    consequences: "1",
    initialOccurrence: "none",
    initialSeverity: "none",
    initialConsequences: "none",
    capaIds: [] as Id<"capas">[],
    nextReview: "", // yyyy-MM-dd
  };
}

// ============================================================
// Page
// ============================================================

export default function RisksPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("risks:manage");

  const risks = useQuery(api.risks.list, {}) as Risk[] | undefined;
  const capas = useQuery(api.capas.list, {});

  const createRisk = useMutation(api.risks.create);
  const updateRisk = useMutation(api.risks.update);
  const archiveRisk = useMutation(api.risks.archive);

  // ---- Dialog state (create / edit) ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"risks"> | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showInitial, setShowInitial] = useState(false);
  const [saving, setSaving] = useState(false);

  function openCreateDialog() {
    setForm(emptyForm());
    setEditId(null);
    setShowInitial(false);
    setDialogOpen(true);
  }

  function openEditDialog(risk: Risk) {
    const hasInitial =
      risk.initialOccurrenceProbability !== undefined &&
      risk.initialSeverity !== undefined &&
      risk.initialConsequences !== undefined;
    setForm({
      title: risk.title,
      measures: risk.measures ?? "",
      responsible: risk.responsible ?? "",
      occurrence: String(risk.occurrenceProbability),
      severity: String(risk.severity),
      consequences: String(risk.consequences),
      initialOccurrence: risk.initialOccurrenceProbability !== undefined
        ? String(risk.initialOccurrenceProbability) : "none",
      initialSeverity: risk.initialSeverity !== undefined
        ? String(risk.initialSeverity) : "none",
      initialConsequences: risk.initialConsequences !== undefined
        ? String(risk.initialConsequences) : "none",
      capaIds: [...(risk.capaIds ?? [])],
      nextReview: risk.nextReviewAt !== undefined
        ? new Date(risk.nextReviewAt).toISOString().slice(0, 10)
        : "",
    });
    setEditId(risk._id);
    setShowInitial(hasInitial);
    setDialogOpen(true);
  }

  function toggleCapa(capaId: Id<"capas">, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      capaIds: checked
        ? [...prev.capaIds, capaId]
        : prev.capaIds.filter((id) => id !== capaId),
    }));
  }

  // Live-RPZ aus aktuellem Entwurf
  const draftRpz =
    Number(form.occurrence) * Number(form.severity) * Number(form.consequences);
  const draftAcceptable = draftRpz < RPZ_ACCEPT_THRESHOLD;

  async function handleSubmit() {
    if (saving) return;
    if (!form.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }

    // Vor-Maßnahme-Trio: alle drei oder keiner
    const initialValues = [
      form.initialOccurrence,
      form.initialSeverity,
      form.initialConsequences,
    ];
    const setCount = initialValues.filter((v) => v !== "none").length;
    if (setCount !== 0 && setCount !== 3) {
      toast.error("Werte vor Maßnahme: entweder alle drei Faktoren oder keiner");
      return;
    }
    const hasInitial = setCount === 3;

    // Datum → Timestamp (mit Finite-Guard)
    let nextReviewAt: number | undefined;
    if (form.nextReview !== "") {
      const ts = new Date(form.nextReview).getTime();
      if (!Number.isFinite(ts)) {
        toast.error("Ungültiges Datum für Neubewertung");
        return;
      }
      nextReviewAt = ts;
    }

    setSaving(true);
    try {
      if (editId === null) {
        await createRisk({
          title: form.title.trim(),
          measures: form.measures || undefined,
          responsible: form.responsible || undefined,
          occurrenceProbability: Number(form.occurrence),
          severity: Number(form.severity),
          consequences: Number(form.consequences),
          initialOccurrenceProbability: hasInitial
            ? Number(form.initialOccurrence) : undefined,
          initialSeverity: hasInitial ? Number(form.initialSeverity) : undefined,
          initialConsequences: hasInitial
            ? Number(form.initialConsequences) : undefined,
          capaIds: form.capaIds,
          nextReviewAt,
        });
        toast.success("Risiko angelegt");
      } else {
        await updateRisk({
          id: editId,
          title: form.title,
          measures: form.measures,
          responsible: form.responsible,
          occurrenceProbability: Number(form.occurrence),
          severity: Number(form.severity),
          consequences: Number(form.consequences),
          ...(hasInitial
            ? {
                initialOccurrenceProbability: Number(form.initialOccurrence),
                initialSeverity: Number(form.initialSeverity),
                initialConsequences: Number(form.initialConsequences),
              }
            : { clearInitial: true }),
          capaIds: form.capaIds,
          ...(nextReviewAt !== undefined
            ? { nextReviewAt }
            : { clearNextReview: true }),
        });
        toast.success("Risiko gespeichert");
      }
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (saving || editId === null) return;
    const risk = risks?.find((r) => r._id === editId);
    if (!risk) return;
    if (!window.confirm(`Risiko ${risk.riskNumber} wirklich archivieren?`)) return;
    setSaving(true);
    try {
      await archiveRisk({ id: editId });
      toast.success("Risiko archiviert");
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // Render
  // ============================================================

  if (risks === undefined) {
    return <div className="p-8 text-muted-foreground">Lade…</div>;
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risikoregister"
        description="Risiken mit RPZ-Bewertung — Auftretenswahrscheinlichkeit × Schweregrad × Folgen (ISO 13485 Kap. 7.1 — FB 7.1.0)"
        actions={
          canManage ? (
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Risiko anlegen
            </Button>
          ) : undefined
        }
      />

      {/* Info-Banner */}
      <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm">
        Risiken werden eingeschätzt durch Auswertungen von erkannten Fehlern,
        Rückrufen, klinischen Bewertungen, Erfahrungen der Mitarbeiter/-innen
        und der GF sowie aus den Quartalsauswertungen der Qualitätsziele
        (FB 5.4.1).{" "}
        <span className="font-semibold">RPZ &lt; {RPZ_ACCEPT_THRESHOLD} = akzeptabel.</span>
      </div>

      {/* Tabelle */}
      {risks.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-dashed p-8">
          <p className="text-sm text-muted-foreground">Keine Risiken erfasst.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr</TableHead>
                <TableHead>Risiko</TableHead>
                <TableHead>Maßnahmen</TableHead>
                <TableHead>Verantw.</TableHead>
                <TableHead className="text-center">A</TableHead>
                <TableHead className="text-center">S</TableHead>
                <TableHead className="text-center">F</TableHead>
                <TableHead className="text-center">RPZ</TableHead>
                <TableHead>CAPAs</TableHead>
                <TableHead>Neubewertung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((risk) => {
                const overdue =
                  risk.nextReviewAt !== undefined && risk.nextReviewAt < now;
                return (
                  <TableRow
                    key={risk._id}
                    className={canManage ? "cursor-pointer hover:bg-muted/50" : undefined}
                    onClick={canManage ? () => openEditDialog(risk) : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      {risk.riskNumber}
                      {risk.addedInRevision !== undefined && (
                        <span
                          className="ml-1.5 inline-block h-2 w-2 rounded-full bg-blue-500"
                          title="Neu in Rev. 1 (04.2026)"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{risk.title}</TableCell>
                    <TableCell>
                      {risk.measures ? (
                        <div
                          className="max-w-md line-clamp-2 text-muted-foreground"
                          title={risk.measures}
                        >
                          {risk.measures}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {risk.responsible ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-center"
                      title={riskBandLabel(RISK_OCCURRENCE_BANDS, risk.occurrenceProbability)}
                    >
                      {risk.occurrenceProbability}
                    </TableCell>
                    <TableCell
                      className="text-center"
                      title={riskBandLabel(RISK_SEVERITY_BANDS, risk.severity)}
                    >
                      {risk.severity}
                    </TableCell>
                    <TableCell
                      className="text-center"
                      title={riskBandLabel(RISK_CONSEQUENCE_BANDS, risk.consequences)}
                    >
                      {risk.consequences}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={rpzBadgeClass(risk.acceptable)}
                      >
                        {risk.initialRpz !== undefined
                          ? `${risk.initialRpz} → ${risk.rpz}`
                          : risk.rpz}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {risk.capas.map((capa) => (
                          <Badge
                            key={capa._id}
                            variant="secondary"
                            className="cursor-pointer bg-blue-100 text-blue-800"
                            title={capa.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/capa/${capa._id}`);
                            }}
                          >
                            {capa.capaNumber}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {risk.nextReviewAt !== undefined ? (
                        <span className={overdue ? "text-red-600" : undefined}>
                          {formatDate(risk.nextReviewAt)}
                          {overdue && " (überfällig)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Legende */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bewertungskriterien (FB 7.1.0)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <LegendColumn
              heading="Auftretenswahrscheinlichkeit"
              subtitle="Fehler kann vorkommen"
              bands={RISK_OCCURRENCE_BANDS}
            />
            <LegendColumn
              heading="Schweregrad"
              subtitle="Auswirkung auf den Patienten"
              bands={RISK_SEVERITY_BANDS}
            />
            <LegendColumn
              heading="Folgen"
              subtitle="Entdeckung vor Auslieferung an die Anwender"
              bands={RISK_CONSEQUENCE_BANDS}
            />
          </div>
        </CardContent>
      </Card>

      {/* ---- Create/Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editId === null ? "Risiko anlegen" : "Risiko bearbeiten"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="risk-title">Titel *</Label>
              <Input
                id="risk-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="risk-measures">Maßnahmen der Minimierung / Kontrolle</Label>
              <Textarea
                id="risk-measures"
                rows={3}
                value={form.measures}
                onChange={(e) => setForm({ ...form, measures: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="risk-responsible">Verantwortlich</Label>
              <Input
                id="risk-responsible"
                value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                placeholder="z. B. GF / MA"
              />
            </div>

            {/* Faktoren */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="risk-occurrence">Auftretenswahrscheinlichkeit *</Label>
                <Select
                  value={form.occurrence}
                  onValueChange={(v) => setForm({ ...form, occurrence: v })}
                >
                  <SelectTrigger id="risk-occurrence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FACTOR_VALUES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {factorOptionLabel(RISK_OCCURRENCE_BANDS, n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="risk-severity">Schweregrad *</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger id="risk-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FACTOR_VALUES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {factorOptionLabel(RISK_SEVERITY_BANDS, n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="risk-consequences">Folgen (Entdeckung vor Auslieferung) *</Label>
                <Select
                  value={form.consequences}
                  onValueChange={(v) => setForm({ ...form, consequences: v })}
                >
                  <SelectTrigger id="risk-consequences"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FACTOR_VALUES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {factorOptionLabel(RISK_CONSEQUENCE_BANDS, n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live-RPZ-Vorschau */}
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <span className="text-muted-foreground">RPZ:</span>
              <Badge variant="secondary" className={rpzBadgeClass(draftAcceptable)}>
                {draftRpz}
              </Badge>
              <span>
                {draftAcceptable
                  ? "akzeptabel"
                  : "NICHT akzeptabel — Maßnahmen erforderlich"}
              </span>
            </div>

            {/* Werte vor Maßnahme (optional) */}
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
                onClick={() => setShowInitial((s) => !s)}
              >
                {showInitial
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
                Werte vor Maßnahme (optional)
              </button>
              {showInitial && (
                <div className="grid gap-3 border-t p-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="risk-init-occurrence">Auftretenswahrscheinlichkeit (vorher)</Label>
                    <Select
                      value={form.initialOccurrence}
                      onValueChange={(v) => setForm({ ...form, initialOccurrence: v })}
                    >
                      <SelectTrigger id="risk-init-occurrence"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {FACTOR_VALUES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {factorOptionLabel(RISK_OCCURRENCE_BANDS, n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="risk-init-severity">Schweregrad (vorher)</Label>
                    <Select
                      value={form.initialSeverity}
                      onValueChange={(v) => setForm({ ...form, initialSeverity: v })}
                    >
                      <SelectTrigger id="risk-init-severity"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {FACTOR_VALUES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {factorOptionLabel(RISK_SEVERITY_BANDS, n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="risk-init-consequences">Folgen (vorher)</Label>
                    <Select
                      value={form.initialConsequences}
                      onValueChange={(v) => setForm({ ...form, initialConsequences: v })}
                    >
                      <SelectTrigger id="risk-init-consequences"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {FACTOR_VALUES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {factorOptionLabel(RISK_CONSEQUENCE_BANDS, n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* CAPA-Verknüpfung */}
            <div>
              <Label>CAPA-Verknüpfung</Label>
              {capas === undefined ? (
                <p className="mt-1 text-sm text-muted-foreground">Lade CAPAs…</p>
              ) : capas.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Keine CAPAs vorhanden.</p>
              ) : (
                <div className="mt-1 max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {capas.map((capa) => (
                    <div key={capa._id} className="flex items-center gap-2">
                      <Checkbox
                        id={`risk-capa-${capa._id}`}
                        checked={form.capaIds.includes(capa._id)}
                        onCheckedChange={(c) => toggleCapa(capa._id, !!c)}
                      />
                      <Label
                        htmlFor={`risk-capa-${capa._id}`}
                        className="text-sm font-normal"
                      >
                        {capa.capaNumber} — {capa.title}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Neubewertung */}
            <div>
              <Label htmlFor="risk-next-review">Neubewertung am</Label>
              <Input
                id="risk-next-review"
                type="date"
                value={form.nextReview}
                onChange={(e) => setForm({ ...form, nextReview: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              <div>
                {editId !== null && (
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={saving}
                    onClick={handleArchive}
                  >
                    Archivieren
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button disabled={saving} onClick={handleSubmit}>
                  {editId === null ? "Anlegen" : "Speichern"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// LegendColumn sub-component
// ============================================================

interface LegendColumnProps {
  heading: string;
  subtitle: string;
  bands: readonly RiskLevelBand[];
}

function LegendColumn({ heading, subtitle, bands }: LegendColumnProps) {
  return (
    <div>
      <p className="font-medium">{heading}</p>
      <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>
      <ul className="space-y-1 text-sm">
        {bands.map((band) => (
          <li key={band.min}>
            {band.label} = {band.min === band.max ? band.min : `${band.min}–${band.max}`}
            {band.hint && (
              <p className="text-xs text-muted-foreground">{band.hint}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
