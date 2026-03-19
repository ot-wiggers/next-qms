"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS } from "@/lib/types/enums";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declarationId: string;
  currentStatus: string;
  targetStatus: string;
}

const COMMENT_REQUIRED_STATUSES = ["REJECTED", "WITHDRAWN"];

export function DeclarationStatusDialog({
  open,
  onOpenChange,
  declarationId,
  currentStatus,
  targetStatus,
}: Props) {
  const reviewDeclaration = useMutation(api.declarations.review);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const requiresComment = COMMENT_REQUIRED_STATUSES.includes(targetStatus);

  const handleSubmit = async () => {
    if (requiresComment && !comment.trim()) {
      toast.error("Ein Kommentar ist für diesen Statuswechsel erforderlich");
      return;
    }

    setLoading(true);
    try {
      await reviewDeclaration({
        id: declarationId as any,
        status: targetStatus,
        comment: comment.trim() || undefined,
      });
      toast.success(`Status geändert zu "${STATUS_LABELS[targetStatus] ?? targetStatus}"`);
      onOpenChange(false);
      setComment("");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Statuswechsel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Status ändern</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Status wird geändert von{" "}
            <strong>{STATUS_LABELS[currentStatus] ?? currentStatus}</strong>
            {" → "}
            <strong>{STATUS_LABELS[targetStatus] ?? targetStatus}</strong>
          </p>

          <div className="space-y-2">
            <Label>
              Kommentar {requiresComment ? "*" : "(optional)"}
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                requiresComment
                  ? "Begründung für den Statuswechsel eingeben..."
                  : "Optionaler Kommentar zum Statuswechsel..."
              }
              rows={3}
            />
            {requiresComment && (
              <p className="text-xs text-muted-foreground">
                Ein Kommentar ist für diesen Statuswechsel erforderlich (Audit-Trail).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (requiresComment && !comment.trim())}
            variant={targetStatus === "REJECTED" || targetStatus === "WITHDRAWN" ? "destructive" : "default"}
          >
            {loading ? "Wird geändert..." : `→ ${STATUS_LABELS[targetStatus] ?? targetStatus}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
