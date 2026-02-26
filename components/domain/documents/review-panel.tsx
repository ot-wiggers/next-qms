"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, X, CheckCircle, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate } from "@/lib/utils/dates";
import { initials } from "@/lib/utils/formatting";

interface ReviewPanelProps {
  documentId: string;
  documentStatus: string;
}

export function ReviewPanel({ documentId, documentStatus }: ReviewPanelProps) {
  const { user } = useCurrentUser();
  const { can } = usePermissions();
  const reviews = useQuery(api.documentReviews.listByDocument, {
    documentId: documentId as any,
  }) as
    | Array<{
        _id: string;
        reviewerId: string;
        reviewerName: string;
        status: string;
        comments?: string;
        reviewedAt?: number;
        createdAt: number;
      }>
    | undefined;
  const myReview = useQuery(api.documentReviews.getMyReview, {
    documentId: documentId as any,
  }) as { _id: string; status: string } | null | undefined;
  const users = useQuery(api.users.list) as
    | Array<{ _id: string; firstName: string; lastName: string }>
    | undefined;

  const assignReviewers = useMutation(api.documentReviews.assignReviewers);
  const submitReview = useMutation(api.documentReviews.submitReview);
  const removeReviewer = useMutation(api.documentReviews.removeReviewer);

  const [showAddReviewer, setShowAddReviewer] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewComments, setReviewComments] = useState("");

  const canManageReviewers = can("documents:review");
  const hasPendingReview = myReview?.status === "PENDING";
  const existingReviewerIds = new Set(
    (reviews ?? []).map((r) => r.reviewerId)
  );

  const handleAddReviewer = async () => {
    if (!selectedReviewerId) return;
    try {
      const currentReviewerIds = (reviews ?? [])
        .filter((r) => r.status === "PENDING")
        .map((r) => r.reviewerId as any);
      await assignReviewers({
        documentId: documentId as any,
        reviewerIds: [...currentReviewerIds, selectedReviewerId as any],
      });
      setSelectedReviewerId("");
      setShowAddReviewer(false);
      toast.success("Prüfer hinzugefügt");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewStatus) {
      toast.error("Bitte Status wählen");
      return;
    }
    try {
      await submitReview({
        documentId: documentId as any,
        status: reviewStatus,
        comments: reviewComments || undefined,
      });
      setReviewStatus("");
      setReviewComments("");
      toast.success("Prüfung abgegeben");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const handleRemoveReviewer = async (reviewId: string) => {
    try {
      await removeReviewer({ reviewId: reviewId as any });
      toast.success("Prüfer entfernt");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Prüfungen</CardTitle>
          {canManageReviewers && documentStatus === "IN_REVIEW" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddReviewer(!showAddReviewer)}
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Prüfer hinzufügen
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddReviewer && (
          <div className="flex items-end gap-2 pb-3 border-b">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Neuer Prüfer</Label>
              <Select
                value={selectedReviewerId}
                onValueChange={setSelectedReviewerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Benutzer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? [])
                    .filter((u) => !existingReviewerIds.has(u._id))
                    .map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.firstName} {u.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAddReviewer}>
              Hinzufügen
            </Button>
          </div>
        )}

        {(reviews ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Prüfer zugewiesen
          </p>
        ) : (
          <div className="space-y-3">
            {(reviews ?? []).map((review) => (
              <div
                key={review._id}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {initials(
                      review.reviewerName.split(" ")[0],
                      review.reviewerName.split(" ")[1]
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {review.reviewerName}
                    </span>
                    <StatusBadge status={review.status} />
                  </div>
                  {review.comments && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {review.comments}
                    </p>
                  )}
                  {review.reviewedAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Geprüft am {formatDate(review.reviewedAt)}
                    </p>
                  )}
                </div>
                {canManageReviewers && review.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveReviewer(review._id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {hasPendingReview && documentStatus === "IN_REVIEW" && (
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">Ihre Prüfung</Label>
            <div className="flex gap-2">
              <Button
                variant={reviewStatus === "APPROVED" ? "default" : "outline"}
                size="sm"
                onClick={() => setReviewStatus("APPROVED")}
              >
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                Freigeben
              </Button>
              <Button
                variant={
                  reviewStatus === "CHANGES_REQUESTED" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setReviewStatus("CHANGES_REQUESTED")}
              >
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                Änderungen anfordern
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kommentar (optional)</Label>
              <Textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Anmerkungen zur Prüfung..."
                rows={3}
              />
            </div>
            <Button onClick={handleSubmitReview} disabled={!reviewStatus}>
              Prüfung abschicken
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
