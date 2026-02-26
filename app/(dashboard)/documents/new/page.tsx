"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
} from "@/lib/types/enums";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function NewDocumentPage() {
  const router = useRouter();
  const createDocument = useMutation(api.documents.create);
  const users = useQuery(api.users.list) as Array<{
    _id: string;
    firstName: string;
    lastName: string;
  }> | undefined;

  const [form, setForm] = useState({
    title: "",
    documentType: "" as string,
    documentCode: "",
    version: "1.0",
    category: "",
    validFrom: "",
    validUntil: "",
    responsibleUserId: "",
    reviewerId: "",
    reviewIntervalDays: "365",
  });

  const [richContent, setRichContent] = useState<any>(null);

  const handleCreate = async () => {
    if (!form.documentType || !form.documentCode || !form.responsibleUserId) {
      toast.error("Bitte Dokumenttyp, Dokumentcode und Verantwortlichen angeben");
      return;
    }
    try {
      const id = await createDocument({
        title: form.title || undefined,
        documentType: form.documentType,
        documentCode: form.documentCode,
        version: form.version,
        category: form.category || undefined,
        richContent: richContent || undefined,
        validFrom: form.validFrom ? new Date(form.validFrom).getTime() : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).getTime() : undefined,
        responsibleUserId: form.responsibleUserId as any,
        reviewerId: form.reviewerId ? (form.reviewerId as any) : undefined,
        reviewIntervalDays: form.reviewIntervalDays
          ? parseInt(form.reviewIntervalDays)
          : undefined,
      });
      toast.success("Dokument erstellt");
      router.push(`/documents/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/documents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Neues Dokument" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dokument anlegen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Dokumenttitel"
              />
            </div>
            <div className="space-y-2">
              <Label>Dokumentcode *</Label>
              <Input
                value={form.documentCode}
                onChange={(e) => setForm({ ...form, documentCode: e.target.value })}
                placeholder="z.B. QMH-001"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Dokumenttyp *</Label>
              <Select
                value={form.documentType}
                onValueChange={(v) => setForm({ ...form, documentType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {DOCUMENT_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Verantwortlicher *</Label>
              <Select
                value={form.responsibleUserId}
                onValueChange={(v) => setForm({ ...form, responsibleUserId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Benutzer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prüfer</Label>
              <Select
                value={form.reviewerId}
                onValueChange={(v) => setForm({ ...form, reviewerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Gültig ab</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Überprüfungsintervall (Tage)</Label>
              <Input
                type="number"
                value={form.reviewIntervalDays}
                onChange={(e) => setForm({ ...form, reviewIntervalDays: e.target.value })}
                min={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label className="text-base font-medium">Inhalt</Label>
        <DocumentEditor content={richContent} onChange={setRichContent} editable={true} />
      </div>

      <Button className="w-full" size="lg" onClick={handleCreate}>
        Dokument erstellen
      </Button>
    </div>
  );
}
