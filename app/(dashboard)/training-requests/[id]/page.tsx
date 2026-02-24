"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatDate } from "@/lib/utils/dates";
import { formatCurrency } from "@/lib/utils/formatting";
import { STATUS_LABELS } from "@/lib/types/enums";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

interface TrainingRequest {
  _id: string;
  topic: string;
  justification: string;
  urgency: string;
  status: string;
  externalLink?: string;
  estimatedCost?: number;
  rejectionReason?: string;
  requesterId: string;
  reviewedAt?: number;
  createdAt: number;
}

export default function TrainingRequestDetailPage() {
  const params = useParams();
  const { can } = usePermissions();
  const requestId = params.id as string;

  const request = useQuery(api.trainingRequests.getById, {
    id: requestId as any,
  }) as TrainingRequest | null | undefined;

  const approveRequest = useMutation(api.trainingRequests.approve);
  const rejectRequest = useMutation(api.trainingRequests.reject);

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (request === undefined) {
    return <div className="text-sm text-muted-foreground">Lade Antrag...</div>;
  }

  if (!request) {
    return <div className="text-sm text-red-600">Antrag nicht gefunden</div>;
  }

  const handleApprove = async () => {
    try {
      await approveRequest({ id: requestId as any });
      toast.success("Antrag genehmigt");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason) {
      toast.error("Bitte Ablehnungsgrund angeben");
      return;
    }
    try {
      await rejectRequest({
        id: requestId as any,
        rejectionReason,
      });
      toast.success("Antrag abgelehnt");
      setShowRejectForm(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    }
  };

  const canReview = can("trainingRequests:review") && request.status === "REQUESTED";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/training-requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Schulungsantrag" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>{request.topic}</CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge status={request.urgency} />
              <StatusBadge status={request.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Begründung</p>
            <p className="text-sm whitespace-pre-wrap">{request.justification}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erstellt</p>
              <p className="text-sm">{formatDate(request.createdAt)}</p>
            </div>
            {request.estimatedCost != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Geschätzte Kosten
                </p>
                <p className="text-sm">{formatCurrency(request.estimatedCost)}</p>
              </div>
            )}
            {request.externalLink && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Externer Link
                </p>
                <a
                  href={request.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Link öffnen
                </a>
              </div>
            )}
          </div>

          {request.rejectionReason && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700">Ablehnungsgrund</p>
              <p className="text-sm text-red-800">{request.rejectionReason}</p>
            </div>
          )}

          {request.reviewedAt && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Geprüft am
              </p>
              <p className="text-sm">{formatDate(request.reviewedAt)}</p>
            </div>
          )}

          {/* Approval / Rejection buttons */}
          {canReview && (
            <div className="flex gap-2 pt-2">
              <Button onClick={handleApprove} size="sm">
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Genehmigen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectForm(!showRejectForm)}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Ablehnen
              </Button>
            </div>
          )}

          {showRejectForm && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="space-y-2">
                <Label>Ablehnungsgrund *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Bitte begründen Sie die Ablehnung"
                />
              </div>
              <Button variant="destructive" size="sm" onClick={handleReject}>
                Ablehnung bestätigen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Verlauf</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4">
          <AuditHistory
            entityType="trainingRequests"
            entityId={request._id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
