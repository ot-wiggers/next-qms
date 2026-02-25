"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditHistory } from "@/components/shared/audit-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { formatDate } from "@/lib/utils/dates";
import { formatCurrency } from "@/lib/utils/formatting";
import { STATUS_LABELS, URGENCY_LEVELS } from "@/lib/types/enums";
import { ArrowLeft, CheckCircle2, XCircle, Pencil } from "lucide-react";
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
  const { user: currentUser } = useCurrentUser();
  const requestId = params.id as string;

  const request = useQuery(api.trainingRequests.getById, {
    id: requestId as any,
  }) as TrainingRequest | null | undefined;

  const approveRequest = useMutation(api.trainingRequests.approve);
  const rejectRequest = useMutation(api.trainingRequests.reject);
  const updateRequest = useMutation(api.trainingRequests.update);

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    topic: "",
    justification: "",
    urgency: "",
    externalLink: "",
    estimatedCost: "",
  });

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

  const openEdit = () => {
    if (!request) return;
    setEditForm({
      topic: request.topic,
      justification: request.justification,
      urgency: request.urgency,
      externalLink: request.externalLink ?? "",
      estimatedCost: request.estimatedCost != null ? String(request.estimatedCost) : "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await updateRequest({
        id: requestId as any,
        topic: editForm.topic,
        justification: editForm.justification,
        urgency: editForm.urgency,
        externalLink: editForm.externalLink || undefined,
        estimatedCost: editForm.estimatedCost ? Number(editForm.estimatedCost) : undefined,
      });
      toast.success("Antrag aktualisiert");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  const canReview = can("trainingRequests:review") && request.status === "REQUESTED";

  // Edit permission: reviewer (unless COMPLETED/REJECTED) or creator (when REQUESTED)
  const canEdit =
    (can("trainingRequests:review") && request.status !== "COMPLETED" && request.status !== "REJECTED") ||
    (currentUser && request.requesterId === currentUser._id && request.status === "REQUESTED");

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
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="mr-1 h-4 w-4" />
                  Bearbeiten
                </Button>
              )}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schulungsantrag bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Thema</Label>
              <Input
                value={editForm.topic}
                onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Begründung</Label>
              <Textarea
                value={editForm.justification}
                onChange={(e) => setEditForm({ ...editForm, justification: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Dringlichkeit</Label>
              <Select
                value={editForm.urgency}
                onValueChange={(v) => setEditForm({ ...editForm, urgency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_LEVELS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {STATUS_LABELS[u] ?? u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Externer Link</Label>
              <Input
                value={editForm.externalLink}
                onChange={(e) => setEditForm({ ...editForm, externalLink: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Geschätzte Kosten</Label>
              <Input
                type="number"
                value={editForm.estimatedCost}
                onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })}
                placeholder="0"
              />
            </div>
            <Button className="w-full" onClick={handleEdit}>
              Änderungen speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
