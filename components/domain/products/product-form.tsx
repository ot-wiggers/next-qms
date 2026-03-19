"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RISK_CLASSES } from "@/lib/types/enums";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HmvSearch } from "./hmv-search";
import type { HmvSelectionData } from "./hmv-search";
import { CheckCircle2, Info } from "lucide-react";

interface Manufacturer {
  _id: string;
  name: string;
}

/**
 * Try to match a REHADAT manufacturer name against existing manufacturers.
 * Returns the matched manufacturer ID or null.
 */
function findMatchingManufacturer(
  herstellerName: string,
  manufacturers: Manufacturer[]
): Manufacturer | null {
  const needle = herstellerName.toLowerCase().trim();

  // 1. Exact match
  const exact = manufacturers.find(
    (m) => m.name.toLowerCase().trim() === needle
  );
  if (exact) return exact;

  // 2. One contains the other (handles "Drive Medical" vs "Drive Medical GmbH & Co. KG")
  const partial = manufacturers.find((m) => {
    const mLower = m.name.toLowerCase().trim();
    return needle.includes(mLower) || mLower.includes(needle);
  });
  if (partial) return partial;

  // 3. First word match (e.g. "Bischoff" matches "Bischoff & Bischoff Medizin...")
  const firstWord = needle.split(/[\s&,]/)[0];
  if (firstWord.length >= 4) {
    const wordMatch = manufacturers.find((m) =>
      m.name.toLowerCase().startsWith(firstWord)
    );
    if (wordMatch) return wordMatch;
  }

  return null;
}

export function ProductForm() {
  const router = useRouter();
  const createProduct = useMutation(api.products.create);
  const manufacturers = useQuery(api.products.listManufacturers) as Manufacturer[] | undefined;

  const [form, setForm] = useState({
    name: "",
    articleNumber: "",
    udi: "",
    productGroup: "",
    manufacturerId: "",
    riskClass: "I" as string,
    notes: "",
  });

  const [ceMarkPresent, setCeMarkPresent] = useState(false);
  const [instructionsPresent, setInstructionsPresent] = useState(false);
  const [regulatoryBasis, setRegulatoryBasis] = useState<string>("MDR");
  const [hmvNummer, setHmvNummer] = useState("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [unmatchedHersteller, setUnmatchedHersteller] = useState<string | null>(null);

  const handleHmvChange = useCallback(
    (data: HmvSelectionData) => {
      setHmvNummer(data.hmvNummer);
      setUnmatchedHersteller(null);

      // Only auto-fill on explicit selection (when we have displayName)
      if (!data.displayName) return;

      const updates: Partial<typeof form> = {};
      const newAutoFilled = new Set<string>();

      // Auto-fill product name
      if (data.displayName) {
        // For products from keywords, displayName might be "Rollator Migo 2G 723 600 000 Drive Medical GmbH"
        // If we have full product data, use the clean name from there
        const productName = data.product?.name ?? data.displayName;
        updates.name = productName;
        newAutoFilled.add("name");
      }

      // Product group from first 2 digits
      if (data.productGroup) {
        updates.productGroup = data.productGroup;
        newAutoFilled.add("productGroup");
      }

      // If full product data available, fill additional fields
      if (data.product) {
        // UDI
        if (data.product.basisUDIDI) {
          updates.udi = data.product.basisUDIDI.trim();
          newAutoFilled.add("udi");
        }

        // Article number(s)
        if (data.product.artikelnummern && data.product.artikelnummern.length > 0) {
          updates.articleNumber = data.product.artikelnummern.join(", ");
          newAutoFilled.add("articleNumber");
        }

        // Match manufacturer
        if (data.product.herstellerName && manufacturers) {
          const match = findMatchingManufacturer(data.product.herstellerName, manufacturers);
          if (match) {
            updates.manufacturerId = match._id;
            newAutoFilled.add("manufacturerId");
            setUnmatchedHersteller(null);
          } else {
            setUnmatchedHersteller(data.product.herstellerName);
          }
        }
      }

      setForm((prev) => ({ ...prev, ...updates }));
      setAutoFilledFields(newAutoFilled);

      // Clear auto-filled indicators after a few seconds
      setTimeout(() => setAutoFilledFields(new Set()), 4000);
    },
    [manufacturers]
  );

  const handleSubmit = async () => {
    if (!form.name || !form.articleNumber) {
      toast.error("Bitte Produktname und Artikelnummer ausfüllen");
      return;
    }
    try {
      const id = await createProduct({
        name: form.name,
        articleNumber: form.articleNumber,
        udi: form.udi || undefined,
        productGroup: form.productGroup || undefined,
        manufacturerId: form.manufacturerId ? (form.manufacturerId as any) : undefined,
        riskClass: form.riskClass,
        notes: form.notes || undefined,
        ceMarkPresent,
        instructionsPresent,
        regulatoryBasis,
        hmvNummer: hmvNummer || undefined,
      });
      toast.success("Produkt erstellt");
      router.push(`/mdr/products/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* HMV Search — separated at the top */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <Label className="text-base font-medium">HMV-Suche</Label>
        <p className="text-sm text-muted-foreground">
          Suche nach HMV-Nummer oder Produktname. Bei Auswahl werden die Felder automatisch befüllt.
        </p>
        <HmvSearch
          value={hmvNummer}
          onChange={handleHmvChange}
        />
        {unmatchedHersteller && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-sm text-amber-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Hersteller <strong>&quot;{unmatchedHersteller}&quot;</strong> wurde nicht in der Datenbank gefunden.
              Bitte manuell zuordnen oder zuerst unter Hersteller anlegen.
            </span>
          </div>
        )}
      </div>

      {/* Product details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            Produktname *
            {autoFilledFields.has("name") && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            Artikelnummer *
            {autoFilledFields.has("articleNumber") && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </Label>
          <Input
            value={form.articleNumber}
            onChange={(e) => setForm({ ...form, articleNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            UDI
            {autoFilledFields.has("udi") && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </Label>
          <Input
            value={form.udi}
            onChange={(e) => setForm({ ...form, udi: e.target.value })}
            placeholder="Unique Device Identifier"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            Produktgruppe
            {autoFilledFields.has("productGroup") && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </Label>
          <Input
            value={form.productGroup}
            onChange={(e) => setForm({ ...form, productGroup: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Risikoklasse *</Label>
          <Select
            value={form.riskClass}
            onValueChange={(v) => setForm({ ...form, riskClass: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_CLASSES.map((rc) => (
                <SelectItem key={rc} value={rc}>
                  Klasse {rc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            Hersteller
            {autoFilledFields.has("manufacturerId") && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            )}
          </Label>
          <Select
            value={form.manufacturerId}
            onValueChange={(v) => setForm({ ...form, manufacturerId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Hersteller wählen" />
            </SelectTrigger>
            <SelectContent>
              {(manufacturers ?? []).map((m: Manufacturer) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Regulatorische Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ceMarkPresent"
              checked={ceMarkPresent}
              onChange={(e) => setCeMarkPresent(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="ceMarkPresent">CE-Zeichen vorhanden</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="instructionsPresent"
              checked={instructionsPresent}
              onChange={(e) => setInstructionsPresent(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="instructionsPresent">Gebrauchsanweisung vorhanden</Label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="regulatoryBasis">Grundlage</Label>
            <Select value={regulatoryBasis} onValueChange={setRegulatoryBasis}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MDR">MDR (EU 2017/745)</SelectItem>
                <SelectItem value="DIRECTIVE">Richtlinie (93/42/EWG)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>HMV-Nummer</Label>
            <Input
              value={hmvNummer}
              onChange={(e) => setHmvNummer(e.target.value)}
              placeholder="Wird durch HMV-Suche befüllt"
              readOnly
              className="bg-muted/50"
            />
          </div>
        </div>
        {regulatoryBasis === "DIRECTIVE" && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Dieses Produkt basiert auf der alten Richtlinie (MDD). Eine Migration auf die MDR ist erforderlich.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Anmerkungen</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />
      </div>

      <Button onClick={handleSubmit}>Produkt erstellen</Button>
    </div>
  );
}
