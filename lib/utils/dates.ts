import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), "dd.MM.yyyy", { locale: de });
}

export function formatDateTime(timestamp: number): string {
  return format(new Date(timestamp), "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatRelative(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: de });
}

export function daysUntil(timestamp: number): number {
  return differenceInDays(new Date(timestamp), new Date());
}

export function isOverdue(dueDate: number): boolean {
  return dueDate < Date.now();
}
