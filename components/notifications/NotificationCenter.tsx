"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCheck } from "lucide-react";
import { NotificationItem } from "./NotificationItem";

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_FILTERS: Record<string, string[]> = {
  documents: [
    "DOCUMENT_STATUS_CHANGED",
    "DOCUMENT_APPROVED",
    "DOCUMENT_REVIEW_REQUESTED",
    "DOCUMENT_REVIEW_DUE",
    "DOCUMENT_EXPIRING",
    "READ_CONFIRMATION_DUE",
    "READ_CONFIRMATION_RECEIVED",
    "REVIEW_COMPLETED",
  ],
  trainings: [
    "TRAINING_ASSIGNED",
    "TRAINING_COMPLETED",
    "TRAINING_FEEDBACK_DUE",
    "TRAINING_REQUEST_SUBMITTED",
    "TRAINING_REQUEST_APPROVED",
    "TRAINING_REQUEST_REJECTED",
  ],
  tasks: ["TASK_ASSIGNED", "TASK_OVERDUE"],
};

export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const notifications = useQuery(api.notifications.listAll, {}) as
    | Array<{
        _id: string;
        type: string;
        title: string;
        message: string;
        resourceType?: string;
        resourceId?: string;
        isRead: boolean;
        createdAt: number;
      }>
    | undefined;
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const [filter, setFilter] = useState("all");

  const filtered = (notifications ?? []).filter((n) => {
    if (filter === "all") return true;
    return CATEGORY_FILTERS[filter]?.includes(n.type);
  });

  const hasUnread = (notifications ?? []).some((n) => !n.isRead);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Benachrichtigungen</SheetTitle>
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => markAllAsRead({})}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Alle gelesen
              </Button>
            )}
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">Alle</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1">Dokumente</TabsTrigger>
              <TabsTrigger value="trainings" className="flex-1">Schulungen</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">Aufgaben</TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Keine Benachrichtigungen
              </div>
            ) : (
              filtered.map((n) => (
                <NotificationItem key={n._id} notification={n} />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
