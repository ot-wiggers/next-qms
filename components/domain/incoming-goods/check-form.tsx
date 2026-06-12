"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { YesNoField } from "./yes-no-field";
import { SignaturePad } from "./signature-pad";
import {
  PRODUCT_AREAS, MDR_DUTY_QUESTIONS, STORAGE_FLAGS,
  INCOMING_RESULT_LABELS, type MdrDutyKey, type StorageFlagKey,
} from "@/lib/types/enums";
import { toast } from "sonner";

type Check = Doc<"incomingGoodsChecks">;

function toDateInput(ts: number | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : "";
}

function emptyForm() {
  return {
    locationId: "" as string,
    checkDate: new Date().toISOString().slice(0, 10),
    inspectorName: "",
    manufacturer: "",
    productArea: "" as string,
    deliveryDate: "",
    duties: {} as Partial<Record<MdrDutyKey, boolean | undefined>>,
    labeling: {
      produktName: "", ceKennzeichnung: undefined as boolean | undefined,
      herstellerName: "", haendlerName: "", importeursName: "", bevollmaechtigten: "",
    },
    identification: {
      hasRef: undefined as boolean | undefined, ref: "",
      hasLot: undefined as boolean | undefined, lot: "",
      hasSn: undefined as boolean | undefined, sn: "",
      hasUdiTraeger: undefined as boolean | undefined, udiTraeger: "",
      haltbarkeitsdatum: "", herstelldatum: "",
    },
    storageFlags: {} as Partial<Record<StorageFlagKey, boolean | undefined>>,
    storageNotes: {
      warnhinweise: "", gebrauchshinweise: "", patientHinweise: "",
      aufbereitungszyklen: "", beschraenkungZyklen: "",
    },
    custom: {
      isSonderanfertigung: undefined as boolean | undefined,
      mdKennzeichnung: undefined as boolean | undefined,
      nurKlinischePruefung: undefined as boolean | undefined,
      sichereEntsorgung: "",
    },
    result: "" as "" | "PASSED" | "FAILED",
    failureReason: "",
    remarks: "",
  };
}

function formFromCheck(check: Check) {
  const f = emptyForm();
  f.locationId = check.locationId;
  f.checkDate = toDateInput(check.checkDate);
  f.inspectorName = check.inspectorName ?? "";
  f.manufacturer = check.manufacturer;
  f.productArea = check.productArea;
  f.deliveryDate = toDateInput(check.deliveryDate);
  f.duties = { ...check.duties };
  f.labeling = {
    produktName: check.labeling.produktName ?? "",
    ceKennzeichnung: check.labeling.ceKennzeichnung,
    herstellerName: check.labeling.herstellerName ?? "",
    haendlerName: check.labeling.haendlerName ?? "",
    importeursName: check.labeling.importeursName ?? "",
    bevollmaechtigten: check.labeling.bevollmaechtigten ?? "",
  };
  f.identification = {
    hasRef: check.identification.hasRef, ref: check.identification.ref ?? "",
    hasLot: check.identification.hasLot, lot: check.identification.lot ?? "",
    hasSn: check.identification.hasSn, sn: check.identification.sn ?? "",
    hasUdiTraeger: check.identification.hasUdiTraeger, udiTraeger: check.identification.udiTraeger ?? "",
    haltbarkeitsdatum: check.identification.haltbarkeitsdatum ?? "",
    herstelldatum: check.identification.herstelldatum ?? "",
  };
  f.storageFlags = {
    trockenLagern: check.storage.trockenLagern,
    sonnenlichtSchutz: check.storage.sonnenlichtSchutz,
    zerbrechlich: check.storage.zerbrechlich,
    temperaturbegrenzung: check.storage.temperaturbegrenzung,
    luftfeuchte: check.storage.luftfeuchte,
  };
  f.storageNotes = {
    warnhinweise: check.storage.warnhinweise ?? "",
    gebrauchshinweise: check.storage.gebrauchshinweise ?? "",
    patientHinweise: check.storage.patientHinweise ?? "",
    aufbereitungszyklen: check.storage.aufbereitungszyklen ?? "",
    beschraenkungZyklen: check.storage.beschraenkungZyklen ?? "",
  };
  f.custom = {
    isSonderanfertigung: check.custom.isSonderanfertigung,
    mdKennzeichnung: check.custom.mdKennzeichnung,
    nurKlinischePruefung: check.custom.nurKlinischePruefung,
    sichereEntsorgung: check.custom.sichereEntsorgung ?? "",
  };
  f.result = check.result;
  f.failureReason = check.failureReason ?? "";
  f.remarks = check.remarks ?? "";
  return f;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export function CheckForm({ initial }: { initial?: Check }) {
  const router = useRouter();
  const locations = useQuery(api.incomingGoods.locations, {}) ?? [];
  const createCheck = useMutation(api.incomingGoods.create);
  const updateCheck = useMutation(api.incomingGoods.update);
  const generateUploadUrl = useMutation(api.incomingGoods.generateUploadUrl);

  const [form, setForm] = useState(() => (initial ? formFromCheck(initial) : emptyForm()));
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);


  async function uploadBlob(blob: Blob, contentType: string): Promise<Id<"_storage">> {
    const postUrl = await generateUploadUrl();
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!res.ok) throw new Error("Datei-Upload fehlgeschlagen");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  async function handleSave() {
    if (saving) return;
    if (!form.locationId) { toast.error("Filiale ist erforderlich"); return; }
    if (!form.checkDate) { toast.error("Prüfdatum ist erforderlich"); return; }
    if (!form.manufacturer.trim()) { toast.error("Hersteller ist erforderlich"); return; }
    if (!form.productArea) { toast.error("Produktbereich ist erforderlich"); return; }
    if (!form.result) { toast.error("Ergebnis der Stichproben-Kontrolle ist erforderlich"); return; }
    if (form.result === "FAILED" && !form.failureReason.trim()) {
      toast.error("Bei „nicht erfüllt“ ist eine Begründung erforderlich");
      return;
    }

    setSaving(true);
    try {
      // Unterschrift + neue Anhänge erst jetzt hochladen
      let signatureFileId = initial?.signatureFileId;
      if (signatureDataUrl) {
        signatureFileId = await uploadBlob(await dataUrlToBlob(signatureDataUrl), "image/png");
      }
      const attachmentFileIds = [...(initial?.attachmentFileIds ?? [])];
      for (const file of newFiles) {
        attachmentFileIds.push(await uploadBlob(file, file.type || "application/octet-stream"));
      }

      const trimmedOrUndefined = (s: string) => s.trim() || undefined;
      const payload = {
        locationId: form.locationId as Id<"organizations">,
        checkDate: new Date(form.checkDate).getTime(),
        inspectorName: trimmedOrUndefined(form.inspectorName),
        manufacturer: form.manufacturer,
        productArea: form.productArea,
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).getTime() : undefined,
        duties: { ...form.duties },
        labeling: {
          produktName: trimmedOrUndefined(form.labeling.produktName),
          ceKennzeichnung: form.labeling.ceKennzeichnung,
          herstellerName: trimmedOrUndefined(form.labeling.herstellerName),
          haendlerName: trimmedOrUndefined(form.labeling.haendlerName),
          importeursName: trimmedOrUndefined(form.labeling.importeursName),
          bevollmaechtigten: trimmedOrUndefined(form.labeling.bevollmaechtigten),
        },
        identification: {
          hasRef: form.identification.hasRef, ref: trimmedOrUndefined(form.identification.ref),
          hasLot: form.identification.hasLot, lot: trimmedOrUndefined(form.identification.lot),
          hasSn: form.identification.hasSn, sn: trimmedOrUndefined(form.identification.sn),
          hasUdiTraeger: form.identification.hasUdiTraeger,
          udiTraeger: trimmedOrUndefined(form.identification.udiTraeger),
          haltbarkeitsdatum: trimmedOrUndefined(form.identification.haltbarkeitsdatum),
          herstelldatum: trimmedOrUndefined(form.identification.herstelldatum),
        },
        storage: {
          ...form.storageFlags,
          warnhinweise: trimmedOrUndefined(form.storageNotes.warnhinweise),
          gebrauchshinweise: trimmedOrUndefined(form.storageNotes.gebrauchshinweise),
          patientHinweise: trimmedOrUndefined(form.storageNotes.patientHinweise),
          aufbereitungszyklen: trimmedOrUndefined(form.storageNotes.aufbereitungszyklen),
          beschraenkungZyklen: trimmedOrUndefined(form.storageNotes.beschraenkungZyklen),
        },
        custom: {
          isSonderanfertigung: form.custom.isSonderanfertigung,
          mdKennzeichnung: form.custom.mdKennzeichnung,
          nurKlinischePruefung: form.custom.nurKlinischePruefung,
          sichereEntsorgung: trimmedOrUndefined(form.custom.sichereEntsorgung),
        },
        result: form.result,
        failureReason: form.result === "FAILED" ? trimmedOrUndefined(form.failureReason) : undefined,
        remarks: trimmedOrUndefined(form.remarks),
        signatureFileId,
        attachmentFileIds: attachmentFileIds.length > 0 ? attachmentFileIds : undefined,
      };

      if (initial) {
        await updateCheck({ id: initial._id, ...payload });
        toast.success("Prüfung gespeichert");
        router.push(`/incoming-goods/${initial._id}`);
      } else {
        const id = await createCheck(payload);
        toast.success("Wareneingangsprüfung erfasst");
        router.push(`/incoming-goods/${id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Stammdaten */}
      <Card>
        <CardHeader><CardTitle>1. Stammdaten</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Filiale *</Label>
            <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Filiale wählen…" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ig-checkdate">Prüfdatum *</Label>
            <Input id="ig-checkdate" type="date" value={form.checkDate}
              onChange={(e) => setForm({ ...form, checkDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ig-manufacturer">Hersteller *</Label>
            <Input id="ig-manufacturer" value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div>
            <Label>Produktbereich *</Label>
            <Select value={form.productArea} onValueChange={(v) => setForm({ ...form, productArea: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Bereich wählen…" /></SelectTrigger>
              <SelectContent>
                {PRODUCT_AREAS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ig-delivery">Lieferdatum</Label>
            <Input id="ig-delivery" type="date" value={form.deliveryDate}
              onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ig-inspector">Prüfer/in</Label>
            <Input id="ig-inspector" value={form.inspectorName}
              onChange={(e) => setForm({ ...form, inspectorName: e.target.value })}
              placeholder="leer = angemeldeter Nutzer" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Prüfpflichten MDR Art. 14 */}
      <Card>
        <CardHeader><CardTitle>2. Allgemeine Prüfpflichten des Händlers nach Art. 14 MDR</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {MDR_DUTY_QUESTIONS.map((q) => (
            <YesNoField
              key={q.key}
              label={q.question}
              value={form.duties[q.key]}
              onChange={(v) => setForm({ ...form, duties: { ...form.duties, [q.key]: v } })}
            />
          ))}
        </CardContent>
      </Card>

      {/* 3. Kennzeichnung */}
      <Card>
        <CardHeader><CardTitle>3. Angaben zur Kennzeichnung nach Anhang I 23.2 MDR</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <YesNoField
            label="CE-Kennzeichnung auf dem Produkt vorhanden"
            value={form.labeling.ceKennzeichnung}
            onChange={(v) => setForm({ ...form, labeling: { ...form.labeling, ceKennzeichnung: v } })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ig-productname">Name / Handelsname des Produkts</Label>
              <Input id="ig-productname" value={form.labeling.produktName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, produktName: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-herstellername">Name und Anschrift des Herstellers</Label>
              <Input id="ig-herstellername" value={form.labeling.herstellerName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, herstellerName: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-haendler">Händler</Label>
              <Input id="ig-haendler" value={form.labeling.haendlerName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, haendlerName: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-importeur">Importeur</Label>
              <Input id="ig-importeur" value={form.labeling.importeursName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, importeursName: e.target.value } })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ig-bevoll">Bevollmächtigter</Label>
              <Input id="ig-bevoll" value={form.labeling.bevollmaechtigten}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, bevollmaechtigten: e.target.value } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Produktidentifikation */}
      <Card>
        <CardHeader><CardTitle>4. Produktidentifikation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["hasRef", "ref", "REF (Artikelnummer)"],
              ["hasLot", "lot", "LOT (Chargennummer)"],
              ["hasSn", "sn", "SN (Seriennummer)"],
              ["hasUdiTraeger", "udiTraeger", "UDI-Träger"],
            ] as const
          ).map(([flagKey, valueKey, label]) => (
            <div key={flagKey} className="grid items-end gap-2 sm:grid-cols-2">
              <YesNoField
                label={`${label} vorhanden?`}
                value={form.identification[flagKey]}
                onChange={(v) =>
                  setForm({ ...form, identification: { ...form.identification, [flagKey]: v } })
                }
              />
              <Input
                value={form.identification[valueKey]}
                placeholder={label}
                onChange={(e) =>
                  setForm({ ...form, identification: { ...form.identification, [valueKey]: e.target.value } })
                }
              />
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ig-mhd">Haltbarkeitsdatum</Label>
              <Input id="ig-mhd" value={form.identification.haltbarkeitsdatum}
                placeholder="z. B. 05/2028"
                onChange={(e) => setForm({ ...form, identification: { ...form.identification, haltbarkeitsdatum: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-mfg">Herstelldatum</Label>
              <Input id="ig-mfg" value={form.identification.herstelldatum}
                placeholder="z. B. 03/2026"
                onChange={(e) => setForm({ ...form, identification: { ...form.identification, herstelldatum: e.target.value } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Lagerung / Handhabung */}
      <Card>
        <CardHeader><CardTitle>5. Lagerungs- / Handhabungsbedingungen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {STORAGE_FLAGS.map((f) => (
              <YesNoField
                key={f.key}
                label={f.label}
                value={form.storageFlags[f.key]}
                onChange={(v) => setForm({ ...form, storageFlags: { ...form.storageFlags, [f.key]: v } })}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["warnhinweise", "Warnhinweise"],
                ["gebrauchshinweise", "Gebrauchshinweise"],
                ["patientHinweise", "Hinweise für Patienten"],
                ["aufbereitungszyklen", "Aufbereitungszyklen (Anzahl/Verfahren)"],
                ["beschraenkungZyklen", "Beschränkung der Wiederverwendung"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={key === "beschraenkungZyklen" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`ig-${key}`}>{label}</Label>
                <Textarea id={`ig-${key}`} rows={2} value={form.storageNotes[key]}
                  onChange={(e) => setForm({ ...form, storageNotes: { ...form.storageNotes, [key]: e.target.value } })} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 6. Sonderanfertigung */}
      <Card>
        <CardHeader><CardTitle>6. Sonderanfertigung</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <YesNoField
            label="Produkt ist eine Sonderanfertigung"
            value={form.custom.isSonderanfertigung}
            onChange={(v) => setForm({ ...form, custom: { ...form.custom, isSonderanfertigung: v } })}
          />
          <YesNoField
            label="Kennzeichnung „MD“ (Sonderanfertigung) vorhanden"
            value={form.custom.mdKennzeichnung}
            onChange={(v) => setForm({ ...form, custom: { ...form.custom, mdKennzeichnung: v } })}
          />
          <YesNoField
            label="Nur für klinische Prüfung bestimmt"
            value={form.custom.nurKlinischePruefung}
            onChange={(v) => setForm({ ...form, custom: { ...form.custom, nurKlinischePruefung: v } })}
          />
          <div>
            <Label htmlFor="ig-entsorgung">Hinweise zur sicheren Entsorgung</Label>
            <Textarea id="ig-entsorgung" rows={2} value={form.custom.sichereEntsorgung}
              onChange={(e) => setForm({ ...form, custom: { ...form.custom, sichereEntsorgung: e.target.value } })} />
          </div>
        </CardContent>
      </Card>

      {/* 7. Stichproben-Kontrolle + Nachweise */}
      <Card>
        <CardHeader><CardTitle>7. Stichproben-Kontrolle</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Ergebnis *</Label>
            <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as "PASSED" | "FAILED" })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Ergebnis wählen…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSED">{INCOMING_RESULT_LABELS.PASSED}</SelectItem>
                <SelectItem value="FAILED">{INCOMING_RESULT_LABELS.FAILED}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.result === "FAILED" && (
            <div>
              <Label htmlFor="ig-reason">Begründung (nicht erfüllt) *</Label>
              <Textarea id="ig-reason" rows={3} value={form.failureReason}
                onChange={(e) => setForm({ ...form, failureReason: e.target.value })} />
            </div>
          )}
          <div>
            <Label htmlFor="ig-remarks">Zusätzliche Bemerkungen</Label>
            <Textarea id="ig-remarks" rows={2} value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
          <SignaturePad
            value={signatureDataUrl || (initial?.signatureFileId ? "vorhanden" : "")}
            onChange={setSignatureDataUrl}
          />
          {initial?.signatureFileId && !signatureDataUrl && (
            <p className="text-xs text-muted-foreground">
              Vorhandene Unterschrift bleibt erhalten — neue Unterschrift ersetzt sie.
            </p>
          )}
          <div>
            <Label htmlFor="ig-files">Fotos / Anhänge</Label>
            <Input
              id="ig-files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
            />
            {(initial?.attachmentFileIds?.length ?? 0) > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {initial!.attachmentFileIds!.length} vorhandene(r) Anhang/Anhänge bleiben erhalten.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Abbrechen
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
