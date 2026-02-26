"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
} from "@/lib/types/enums";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function DocumentEditPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const document = useQuery(api.documents.getById, { id: documentId as any });
  const updateDocument = useMutation(api.documents.update);
  const users = useQuery(api.users.list) as Array<{
    _id: string;
    firstName: string;
    lastName: string;
  }> | undefined;

  const [title, setTitle] = useState("");
  const [documentCode, setDocumentCode] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [category, setCategory] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [reviewIntervalDays, setReviewIntervalDays] = useState("365");
  const [richContent, setRichContent] = useState<any>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save debounce ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize form from document data
  useEffect(() => {
    if (document && !hasInitialized) {
      setTitle(document.title ?? "");
      setDocumentCode(document.documentCode ?? "");
      setDocumentType(document.documentType ?? "");
      setCategory((document as any).category ?? "");
      setResponsibleUserId(document.responsibleUserId ?? "");
      setReviewIntervalDays(String((document as any).reviewIntervalDays ?? 365));
      setRichContent((document as any).richContent ?? null);
      setHasInitialized(true);
    }
  }, [document, hasInitialized]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateDocument({
        id: documentId as any,
        title: title || undefined,
        documentCode,
        documentType,
        category: category || undefined,
        responsibleUserId: responsibleUserId as any,
        reviewIntervalDays: reviewIntervalDays ? parseInt(reviewIntervalDays) : undefined,
        richContent,
      });
      toast.success("Dokument gespeichert");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }, [
    documentId,
    title,
    documentCode,
    documentType,
    category,
    responsibleUserId,
    reviewIntervalDays,
    richContent,
    updateDocument,
    isSaving,
  ]);

  const handleEditorChange = useCallback(
    (json: any) => {
      setRichContent(json);
      // Auto-save with debounce
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await updateDocument({
            id: documentId as any,
            richContent: json,
          });
        } catch {
          // Silent auto-save failure — user can manually save
        }
      }, 2000);
    },
    [documentId, updateDocument],
  );

  if (document === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Dokument...</div>;
  }

  if (!document) {
    return <div className="text-sm text-red-600">Dokument nicht gefunden</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/documents/${documentId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader title="Dokument bearbeiten" />
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />
          {isSaving ? "Speichert..." : "Speichern"}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Dokumenttitel"
              />
            </div>
            <div className="space-y-2">
              <Label>Dokumentcode</Label>
              <Input
                value={documentCode}
                onChange={(e) => setDocumentCode(e.target.value)}
                placeholder="z.B. QMH-001"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Dokumenttyp</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
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
              <Select value={category} onValueChange={setCategory}>
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
              <Label>Verantwortlicher</Label>
              <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Überprüfungsintervall (Tage)</Label>
              <Input
                type="number"
                value={reviewIntervalDays}
                onChange={(e) => setReviewIntervalDays(e.target.value)}
                min={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label className="text-base font-medium">Inhalt</Label>
        {hasInitialized && (
          <DocumentEditor
            content={richContent}
            onChange={handleEditorChange}
            editable={true}
          />
        )}
      </div>
    </div>
  );
}
