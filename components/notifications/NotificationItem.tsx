"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  FileText,
  GraduationCap,
  ClipboardList,
  MessageSquarePlus,
  Bell,
  CheckCircle,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  createdAt: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  DOCUMENT_STATUS_CHANGED: FileText,
  DOCUMENT_APPROVED: CheckCircle,
  DOCUMENT_REVIEW_REQUESTED: FileText,
  DOCUMENT_REVIEW_DUE: AlertTriangle,
  DOCUMENT_EXPIRING: AlertTriangle,
  TRAINING_ASSIGNED: GraduationCap,
  TRAINING_COMPLETED: GraduationCap,
  TRAINING_FEEDBACK_DUE: GraduationCap,
  TRAINING_REQUEST_SUBMITTED: MessageSquarePlus,
  TRAINING_REQUEST_APPROVED: MessageSquarePlus,
  TRAINING_REQUEST_REJECTED: MessageSquarePlus,
  TASK_ASSIGNED: ClipboardList,
  TASK_OVERDUE: AlertTriangle,
  READ_CONFIRMATION_DUE: FileText,
  READ_CONFIRMATION_RECEIVED: UserCheck,
  REVIEW_COMPLETED: CheckCircle,
};

function getResourceHref(resourceType?: string, resourceId?: string): string | null {
  if (!resourceType || !resourceId) return null;
  switch (resourceType) {
    case "documentRecords":
      return `/documents/${resourceId}`;
    case "trainings":
      return `/trainings/${resourceId}`;
    case "trainingRequests":
      return `/training-requests/${resourceId}`;
    case "tasks":
      return `/tasks`;
    default:
      return null;
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days > 1 ? "en" : ""}`;
  return new Date(timestamp).toLocaleDateString("de-DE");
}

export function NotificationItem({ notification }: { notification: Notification }) {
  const router = useRouter();
  const markAsRead = useMutation(api.notifications.markAsRead);

  const Icon = ICON_MAP[notification.type] ?? Bell;
  const href = getResourceHref(notification.resourceType, notification.resourceId);

  const handleClick = async () => {
    if (!notification.isRead) {
      await markAsRead({ id: notification._id as any });
    }
    if (href) {
      router.push(href);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted",
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("h-4 w-4", notification.isRead ? "text-muted-foreground" : "text-primary")} />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm truncate", !notification.isRead && "font-medium")}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </button>
  );
}
