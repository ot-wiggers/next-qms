"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  CAPA_STATUS_LABELS, CAPA_TYPE_LABELS, CAPA_SOURCE_TYPE_LABELS,
  type CapaStatus, type CapaType, type CapaSourceType,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Measure = {
  _id: Id<"capaMeasures">;
  description: string; status: string; dueAt?: number; doneAt?: number;
};

// Teilmenge der capaStatus-State-Machine (convex/lib/stateMachine.ts):
// Abbruch ab ANALYSIS ist serverseitig erlaubt, in der UI bewusst (noch) nicht angeboten.
const NEXT: Partial<Record<CapaStatus, { to: string; label: string }[]>> = {
  OPEN: [{ to: "ANALYSIS", label: "Ursachenanalyse starten" }, { to: "CANCELLED", label: "Abbrechen" }],
  ANALYSIS: [{ to: "MEASURES_DEFINED", label: "Maßnahmen definiert" }],
  MEASURES_DEFINED: [{ to: "IN_PROGRESS", label: "Umsetzung starten" }],
  IN_PROGRESS: [{ to: "EFFECTIVENESS_CHECK", label: "Zur Wirksamkeitsprüfung" }],
  EFFECTIVENESS_CHECK: [
    { to: "CLOSED", label: "Abschließen" },
    { to: "IN_PROGRESS", label: "Zurück in Umsetzung" },
  ],
};

export default function CapaDetailPage() {
  const params = useParams<{ id: string }>();
  const capaId = params.id as Id<"capas">;
  const { can } = usePermissions();

  const capa = useQuery(api.capas.getById, { id: capaId });
  const update = useMutation(api.capas.update);
  const setStatus = useMutation(api.capas.setStatus);
  const recordEffectiveness = useMutation(api.capas.recordEffectiveness);
  const addMeasure = useMutation(api.capas.addMeasure);
  const completeMeasure = useMutation(api.capas.completeMeasure);

  // Entwurfstext mit zugehöriger CAPA-ID versionieren, damit er bei Navigation nicht übernommen wird
  const [rootCauseDraft, setRootCauseDraft] = useState<{ id: string; text: string } | null>(null);
  const rootCause = rootCauseDraft?.id === capaId ? rootCauseDraft.text : null;
  const setRootCause = (text: string) => setRootCauseDraft({ id: capaId, text });
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureDesc, setMeasureDesc] = useState("");
  const [effOpen, setEffOpen] = useState(false);
  const [effForm, setEffForm] = useState({ result: "EFFECTIVE" as "EFFECTIVE" | "INEFFECTIVE", note: "" });

  if (capa === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (capa === null) return <div className="p-8">CAPA nicht gefunden.</div>;

  const canManage = can("capa:manage");
  const closed = capa.status === "CLOSED" || capa.status === "CANCELLED";

  async function transition(to: string) {
    try {
      await setStatus({ id: capaId, status: to });
      toast.success("Status geändert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`${capa.capaNumber} — ${capa.title}`}
        description={`${CAPA_TYPE_LABELS[capa.capaType as CapaType]} · Quelle: ${CAPA_SOURCE_TYPE_LABELS[capa.sourceType as CapaSourceType]}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{CAPA_STATUS_LABELS[capa.status as CapaStatus] ?? capa.status}</Badge>
            {canManage && (NEXT[capa.status as CapaStatus] ?? []).map((t) => (
              <Button key={t.to} size="sm"
                variant={t.to === "CANCELLED" ? "outline" : "default"}
                disabled={t.to === "CLOSED" && capa.effectivenessResult !== "EFFECTIVE"}
                onClick={() => transition(t.to)}>
                {t.label}
              </Button>
            ))}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Beschreibung &amp; Ursachenanalyse</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{capa.description ?? "—"}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Verantwortlich (Rolle/Bereich): </span>
            {capa.responsible ?? capa.assigneeName ?? "—"}
            {capa.dueAt ? <span className="text-muted-foreground"> · Termin: {formatDate(capa.dueAt)}</span> : null}
          </p>
          <div>
            <Label htmlFor="rootcause">Ursachenanalyse (8.5.2 b)</Label>
            <Textarea id="rootcause" rows={4}
              value={rootCause ?? capa.rootCauseAnalysis ?? ""}
              onChange={(e) => setRootCause(e.target.value)}
              disabled={closed || !canManage} />
            {!closed && canManage && (
              <Button className="mt-2" size="sm" variant="outline"
                onClick={async () => {
                  try {
                    await update({ id: capaId, rootCauseAnalysis: rootCause ?? capa.rootCauseAnalysis ?? "" });
                    toast.success("Ursachenanalyse gespeichert");
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                }}>
                Speichern
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Maßnahmen ({capa.measures.filter((m: Measure) => m.status === "DONE").length}/{capa.measures.length} erledigt)
          </CardTitle>
          {!closed && canManage && (
            <Button size="sm" onClick={() => setMeasureOpen(true)}>Maßnahme hinzufügen</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {capa.measures.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Maßnahmen definiert.</p>
          )}
          {capa.measures.map((m: Measure) => (
            <div key={m._id} className="flex items-center gap-3 rounded-md border p-3">
              <span className={`flex-1 text-sm ${m.status === "DONE" ? "text-muted-foreground line-through" : ""}`}>
                {m.description}
              </span>
              <span className="text-xs text-muted-foreground">
                {m.status === "DONE" && m.doneAt ? `erledigt ${formatDate(m.doneAt)}` : m.dueAt ? `fällig ${formatDate(m.dueAt)}` : ""}
              </span>
              {m.status === "OPEN" && canManage && !closed && (
                <Button size="sm" variant="outline"
                  onClick={async () => {
                    try { await completeMeasure({ id: m._id }); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                  }}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Erledigt
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Wirksamkeitsprüfung (8.5.2 e)</CardTitle>
          {capa.status === "EFFECTIVENESS_CHECK" && canManage && (
            <Button size="sm" onClick={() => setEffOpen(true)}>Prüfung dokumentieren</Button>
          )}
        </CardHeader>
        <CardContent className="text-sm">
          {capa.effectivenessCriterion && (
            <p className="mb-2">
              <span className="text-muted-foreground">Kriterium (vorab definiert): </span>
              {capa.effectivenessCriterion}
            </p>
          )}
          {capa.effectivenessResult ? (
            <div className="space-y-1">
              <Badge variant="secondary"
                className={capa.effectivenessResult === "EFFECTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {capa.effectivenessResult === "EFFECTIVE" ? "Wirksam" : "Nicht wirksam"}
              </Badge>
              <p className="whitespace-pre-wrap">{capa.effectivenessNote}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Noch nicht dokumentiert. Abschluss der CAPA ist erst nach dokumentiert wirksamer Prüfung möglich.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Maßnahmen-Dialog */}
      <Dialog open={measureOpen} onOpenChange={setMeasureOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Maßnahme hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="mdesc">Beschreibung</Label>
              <Textarea id="mdesc" rows={3} value={measureDesc}
                onChange={(e) => setMeasureDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMeasureOpen(false)}>Abbrechen</Button>
              <Button onClick={async () => {
                if (!measureDesc.trim()) { toast.error("Beschreibung ist erforderlich"); return; }
                try {
                  await addMeasure({ capaId, description: measureDesc });
                  setMeasureDesc(""); setMeasureOpen(false);
                } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
              }}>
                Hinzufügen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wirksamkeits-Dialog */}
      <Dialog open={effOpen} onOpenChange={setEffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wirksamkeitsprüfung dokumentieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ergebnis</Label>
              <Select value={effForm.result}
                onValueChange={(v) => setEffForm({ ...effForm, result: v as "EFFECTIVE" | "INEFFECTIVE" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFFECTIVE">Wirksam</SelectItem>
                  <SelectItem value="INEFFECTIVE">Nicht wirksam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="effnote">Begründung / Nachweis</Label>
              <Textarea id="effnote" rows={4} value={effForm.note}
                onChange={(e) => setEffForm({ ...effForm, note: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEffOpen(false)}>Abbrechen</Button>
              <Button onClick={async () => {
                if (!effForm.note.trim()) { toast.error("Begründung ist erforderlich"); return; }
                try {
                  await recordEffectiveness({
                    id: capaId,
                    effectivenessResult: effForm.result,
                    effectivenessNote: effForm.note,
                  });
                  setEffOpen(false);
                } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
              }}>
                Dokumentieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
