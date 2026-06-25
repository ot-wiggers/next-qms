"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  DEVICE_AMPEL_LABELS, DEVICE_STATUS_LABELS, CALIBRATION_RESULT_LABELS,
  type DeviceAmpel, type CalibrationResult,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { DeviceFormDialog } from "@/components/domain/devices/device-form-dialog";
import { CalibrationDialog } from "@/components/domain/devices/calibration-dialog";
import { toast } from "sonner";

const AMPEL_BADGE: Record<DeviceAmpel, string> = {
  OK: "bg-green-100 text-green-800",
  DUE: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  UNSCHEDULED: "bg-blue-100 text-blue-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-600",
};

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line">{value || "—"}</span>
    </div>
  );
}

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const deviceId = params.id as Id<"deviceRecords">;
  const router = useRouter();
  const { can } = usePermissions();
  const device = useQuery(api.devices.getById, { id: deviceId });
  const setStatus = useMutation(api.devices.setStatus);
  const archive = useMutation(api.devices.archive);

  const [editOpen, setEditOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (device === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (device === null) return <div className="p-8">Prüfmittel nicht gefunden.</div>;

  const canManage = can("devices:manage");
  const ampel = device.ampel as DeviceAmpel;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${device.name}`}
        description={`Prüfmittel-Nr. ${device.inventoryNumber} · ${DEVICE_STATUS_LABELS[device.status]}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={AMPEL_BADGE[ampel]} variant="secondary">{DEVICE_AMPEL_LABELS[ampel]}</Badge>
            {canManage && (
              <>
                <Button onClick={() => setCalOpen(true)}>Kalibrierung erfassen</Button>
                <Button variant="outline" onClick={() => setEditOpen(true)}>Bearbeiten</Button>
                {device.status === "ACTIVE" ? (
                  <Button variant="outline"
                    onClick={async () => {
                      try { await setStatus({ id: deviceId, status: "DECOMMISSIONED" }); toast.success("Außer Dienst gestellt"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                    }}>
                    Außer Dienst
                  </Button>
                ) : (
                  <Button variant="outline"
                    onClick={async () => {
                      try { await setStatus({ id: deviceId, status: "ACTIVE" }); toast.success("Wieder in Dienst"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
                    }}>
                    Wieder in Dienst
                  </Button>
                )}
                <Button variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setArchiveOpen(true)}>
                  Archivieren
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Stammdaten</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Prüfmittel-Nr." value={device.inventoryNumber} />
          <Row label="Bezeichnung" value={device.name} />
          <Row label="Hersteller" value={device.manufacturer} />
          <Row label="Seriennummer" value={device.serialNumber} />
          <Row label="Standort" value={device.location} />
          <Row label="Verantwortlich" value={device.responsible} />
          <Row label="Intervall" value={`${device.calibrationIntervalMonths} Monate`} />
          <Row label="Letzte Kalibrierung" value={device.lastCalibrationDate ? formatDate(device.lastCalibrationDate) : undefined} />
          <Row label="Nächster Soll-Termin" value={device.nextDueDate ? formatDate(device.nextDueDate) : undefined} />
          <Row label="Bemerkungen" value={device.notes} />
          {device.certUrl && (
            <div className="pt-1">
              <Button variant="outline" size="sm" asChild>
                <a href={device.certUrl} target="_blank" rel="noopener noreferrer">Jüngstes Zertifikat</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kalibrierhistorie ({device.history.length})</CardTitle></CardHeader>
        <CardContent>
          {device.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Kalibrierung erfasst.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Durchgeführt von</TableHead>
                  <TableHead>Nächster Soll-Termin</TableHead>
                  <TableHead>Zertifikat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(device.history as Array<{
                  _id: string; calibrationDate: number; result: CalibrationResult;
                  performedBy?: string; nextDueDate: number; notes?: string; certUrl: string | null;
                }>).map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>{formatDate(c.calibrationDate)}</TableCell>
                    <TableCell>{CALIBRATION_RESULT_LABELS[c.result]}</TableCell>
                    <TableCell className="text-muted-foreground">{c.performedBy ?? "—"}</TableCell>
                    <TableCell>{formatDate(c.nextDueDate)}</TableCell>
                    <TableCell>
                      {c.certUrl ? (
                        <a href={c.certUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">öffnen</a>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeviceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={device as unknown as Doc<"deviceRecords">}
      />
      <CalibrationDialog open={calOpen} onOpenChange={setCalOpen} deviceId={deviceId} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prüfmittel archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              „{device.name}" (Nr. {device.inventoryNumber}) verschwindet aus Liste und Ampel.
              Die Kalibrierhistorie bleibt in der Datenbank erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await archive({ id: deviceId });
                toast.success("Prüfmittel archiviert");
                router.push("/devices");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Fehler beim Archivieren");
              } finally {
                setArchiveOpen(false);
              }
            }}>Archivieren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
