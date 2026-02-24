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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Manufacturer {
  _id: string;
  name: string;
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
      });
      toast.success("Produkt erstellt");
      router.push(`/mdr/products/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Produktname *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Artikelnummer *</Label>
          <Input
            value={form.articleNumber}
            onChange={(e) => setForm({ ...form, articleNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>UDI</Label>
          <Input
            value={form.udi}
            onChange={(e) => setForm({ ...form, udi: e.target.value })}
            placeholder="Unique Device Identifier"
          />
        </div>
        <div className="space-y-2">
          <Label>Produktgruppe</Label>
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
          <Label>Hersteller</Label>
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
