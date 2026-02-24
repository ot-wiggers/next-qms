"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ReadConfirmationButtonProps {
  documentRecordId: string;
}

export function ReadConfirmationButton({ documentRecordId }: ReadConfirmationButtonProps) {
  const hasConfirmed = useQuery(api.documents.hasUserConfirmed, {
    documentRecordId: documentRecordId as any,
  }) as boolean | undefined;
  const confirmRead = useMutation(api.documents.confirmRead);
  const [loading, setLoading] = useState(false);

  if (hasConfirmed === undefined) return null;

  if (hasConfirmed) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Lesebestätigung erteilt
      </div>
    );
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmRead({ documentRecordId: documentRecordId as any });
      toast.success("Lesebestätigung erfolgreich abgegeben");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler bei der Lesebestätigung");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConfirm} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="mr-1 h-4 w-4" />
      )}
      Gelesen bestätigen
    </Button>
  );
}
