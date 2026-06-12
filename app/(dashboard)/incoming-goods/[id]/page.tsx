"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  MDR_DUTY_QUESTIONS, STORAGE_FLAGS, INCOMING_RESULT_LABELS,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { downloadIncomingGoodsPdf } from "@/lib/export/incoming-goods-exporter";
import { toast } from "sonner";

function yesNo(v: boolean | undefined): string {
  return v === true ? "Ja" : v === false ? "Nein" : "—";
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-56 shrink-0 text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line">{value || "—"}</span>
    </div>
  );
}

export default function IncomingGoodsDetailPage() {
  const params = useParams<{ id: string }>();
  const checkId = params.id as Id<"incomingGoodsChecks">;
  const router = useRouter();
  const { can } = usePermissions();
  const check = useQuery(api.incomingGoods.getById, { id: checkId });
  const archiveCheck = useMutation(api.incomingGoods.archive);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (check === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (check === null) return <div className="p-8">Prüfung nicht gefunden.</div>;

  async function handlePdf() {
    try {
      await downloadIncomingGoodsPdf(check!, `Wareneingangspruefung_${formatDate(check!.checkDate).replaceAll(".", "-")}_${check!.locationName}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Wareneingangsprüfung ${formatDate(check.checkDate)}`}
        description={`${check.locationName} · ${check.manufacturer}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              className={check.result === "PASSED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
              variant="secondary"
            >
              {INCOMING_RESULT_LABELS[check.result]}
            </Badge>
            <Button variant="outline" onClick={handlePdf}>PDF herunterladen</Button>
            {can("incomingGoods:manage") && (
              <Button variant="outline" onClick={() => router.push(`/incoming-goods/${checkId}/edit`)}>
                Bearbeiten
              </Button>
            )}
            {can("incomingGoods:manage") && (
              <Button variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setArchiveOpen(true)}>
                Archivieren
              </Button>
            )}
          </div>
        }
      />

      {/* Archivieren-Bestätigung */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfung archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Prüfung vom {formatDate(check.checkDate)} ({check.locationName}) verschwindet
              aus Liste und Monats-Ampel. Der Datensatz bleibt in der Datenbank erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await archiveCheck({ id: checkId });
                toast.success("Prüfung archiviert");
                router.push("/incoming-goods");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler beim Archivieren");
              } finally {
                setArchiveOpen(false);
              }
            }}>
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader><CardTitle>1. Stammdaten</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Filiale" value={check.locationName} />
          <Row label="Prüfdatum" value={formatDate(check.checkDate)} />
          <Row label="Prüfer/in" value={check.inspectorName} />
          <Row label="Hersteller" value={check.manufacturer} />
          <Row label="Produktbereich" value={check.productArea} />
          <Row label="Lieferdatum" value={check.deliveryDate ? formatDate(check.deliveryDate) : undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Prüfpflichten nach Art. 14 MDR</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {MDR_DUTY_QUESTIONS.map((q) => (
            <div key={q.key} className="flex items-start justify-between gap-4 text-sm">
              <span className="flex-1">{q.question}</span>
              <Badge
                variant="secondary"
                className={
                  check.duties[q.key] === true
                    ? "bg-green-100 text-green-800"
                    : check.duties[q.key] === false
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-600"
                }
              >
                {yesNo(check.duties[q.key])}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Kennzeichnung (Anhang I 23.2 MDR)</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="CE-Kennzeichnung vorhanden" value={yesNo(check.labeling.ceKennzeichnung)} />
          <Row label="Name / Handelsname" value={check.labeling.produktName} />
          <Row label="Hersteller (Name/Anschrift)" value={check.labeling.herstellerName} />
          <Row label="Händler" value={check.labeling.haendlerName} />
          <Row label="Importeur" value={check.labeling.importeursName} />
          <Row label="Bevollmächtigter" value={check.labeling.bevollmaechtigten} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Produktidentifikation</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="REF vorhanden / Wert" value={`${yesNo(check.identification.hasRef)} ${check.identification.ref ?? ""}`.trim()} />
          <Row label="LOT vorhanden / Wert" value={`${yesNo(check.identification.hasLot)} ${check.identification.lot ?? ""}`.trim()} />
          <Row label="SN vorhanden / Wert" value={`${yesNo(check.identification.hasSn)} ${check.identification.sn ?? ""}`.trim()} />
          <Row label="UDI-Träger vorhanden / Wert" value={`${yesNo(check.identification.hasUdiTraeger)} ${check.identification.udiTraeger ?? ""}`.trim()} />
          <Row label="Haltbarkeitsdatum" value={check.identification.haltbarkeitsdatum} />
          <Row label="Herstelldatum" value={check.identification.herstelldatum} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5. Lagerung / Handhabung</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {STORAGE_FLAGS.map((f) => (
            <Row key={f.key} label={f.label} value={yesNo(check.storage[f.key])} />
          ))}
          <Row label="Warnhinweise" value={check.storage.warnhinweise} />
          <Row label="Gebrauchshinweise" value={check.storage.gebrauchshinweise} />
          <Row label="Hinweise für Patienten" value={check.storage.patientHinweise} />
          <Row label="Aufbereitungszyklen" value={check.storage.aufbereitungszyklen} />
          <Row label="Beschränkung der Wiederverwendung" value={check.storage.beschraenkungZyklen} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6. Sonderanfertigung</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Sonderanfertigung" value={yesNo(check.custom.isSonderanfertigung)} />
          <Row label="Kennzeichnung „MD“" value={yesNo(check.custom.mdKennzeichnung)} />
          <Row label="Nur für klinische Prüfung" value={yesNo(check.custom.nurKlinischePruefung)} />
          <Row label="Sichere Entsorgung" value={check.custom.sichereEntsorgung} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7. Stichproben-Kontrolle &amp; Nachweise</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Ergebnis" value={INCOMING_RESULT_LABELS[check.result]} />
          {check.failureReason && <Row label="Begründung" value={check.failureReason} />}
          {check.remarks && <Row label="Bemerkungen" value={check.remarks} />}
          {check.signatureUrl && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Unterschrift Prüfer/in</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={check.signatureUrl} alt="Unterschrift" className="h-24 rounded border bg-white" />
            </div>
          )}
          {check.attachments.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Anhänge ({check.attachments.length})</p>
              <div className="flex flex-wrap gap-2">
                {check.attachments.map((a, i) =>
                  a.url ? (
                    <Button key={a.fileId} variant="outline" size="sm" asChild>
                      <a href={a.url} target="_blank" rel="noopener noreferrer">Anhang {i + 1}</a>
                    </Button>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
