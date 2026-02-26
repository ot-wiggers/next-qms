"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, isOverdue, daysUntil } from "@/lib/utils/dates";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
  startOfDay,
  endOfDay,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
  Clock,
  GraduationCap,
  ClipboardList,
  MapPin,
  Pencil,
  Trash2,
  CalendarIcon,
  List,
  LayoutGrid,
  Columns3,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

type ViewMode = "month" | "week" | "day" | "list";

interface CalendarItem {
  _id: string;
  type: "task" | "session" | "event";
  date: number;
  endDate?: number;
  title: string;
  subtitle: string;
  priority?: string;
  status?: string;
  color: string;
  allDay?: boolean;
  isOwn?: boolean; // for calendar events — can this user edit it?
  location?: string;
  description?: string;
  isPrivate?: boolean;
}

interface EventFormData {
  title: string;
  description: string;
  startDate: string; // datetime-local string
  endDate: string;
  allDay: boolean;
  location: string;
  color: string;
  isPrivate: boolean;
}

const EMPTY_FORM: EventFormData = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  allDay: false,
  location: "",
  color: "#22c55e",
  isPrivate: false,
};

const COLOR_PALETTE = [
  { value: "#22c55e", label: "Grün" },
  { value: "#3b82f6", label: "Blau" },
  { value: "#f59e0b", label: "Gelb" },
  { value: "#ef4444", label: "Rot" },
  { value: "#8b5cf6", label: "Lila" },
  { value: "#ec4899", label: "Pink" },
];

const TASK_TYPE_LABELS: Record<string, string> = {
  READ_DOCUMENT: "Dokument lesen",
  TRAINING_FEEDBACK: "Schulungs-Feedback",
  TRAINING_EFFECTIVENESS: "Wirksamkeitsprüfung",
  DOC_EXPIRY_WARNING: "DoC-Ablaufwarnung",
  TRAINING_REQUEST_REVIEW: "Schulungsantrag prüfen",
  DOCUMENT_REVIEW_DUE: "Dokumentenprüfung fällig",
  GENERAL: "Allgemein",
  FOLLOW_UP: "Folgemaßnahme",
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ============================================================
// Helper: convert timestamp to datetime-local input value
// ============================================================
function timestampToDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function datetimeLocalToTimestamp(val: string): number {
  return new Date(val).getTime();
}

function timestampToDateInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowDatetimeLocal(): string {
  return timestampToDatetimeLocal(Date.now());
}

// ============================================================
// Main Calendar Page
// ============================================================

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<Id<"calendarEvents"> | null>(null);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<"calendarEvents"> | null>(null);

  // Responsive: on mobile default to list
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setView("list");
    }
  }, []);

  // Data queries
  const calendarEvents = useQuery(api.calendarEvents.list, {});
  const tasks = useQuery(api.tasks.myTasks) as
    | Array<{
        _id: string;
        title: string;
        type: string;
        status: string;
        priority: string;
        dueDate?: number;
      }>
    | undefined;
  const sessions = useQuery(api.trainings.listUpcomingSessions) as
    | Array<{
        _id: string;
        scheduledDate: number;
        endDate?: number;
        location?: string;
        trainerName?: string;
        status: string;
        trainingTitle: string;
      }>
    | undefined;

  // Mutations
  const createEvent = useMutation(api.calendarEvents.create);
  const updateEvent = useMutation(api.calendarEvents.update);
  const archiveEvent = useMutation(api.calendarEvents.archive);

  // Merge all data sources into CalendarItems
  const allItems: CalendarItem[] = useMemo(() => {
    const items: CalendarItem[] = [];

    // Calendar events
    for (const e of calendarEvents ?? []) {
      items.push({
        _id: e._id,
        type: "event",
        date: e.startDate,
        endDate: e.endDate,
        title: e.title,
        subtitle: e.location ? `📍 ${e.location}` : "",
        color: e.color ?? "#22c55e",
        allDay: e.allDay,
        isOwn: true, // The list query only returns own + public; we mark all for now
        location: e.location,
        description: e.description,
        isPrivate: e.isPrivate,
      });
    }

    // Tasks with due dates
    for (const t of tasks ?? []) {
      if (t.dueDate && t.status !== "DONE" && t.status !== "CANCELLED") {
        items.push({
          _id: t._id,
          type: "task",
          date: t.dueDate,
          title: t.title,
          subtitle: TASK_TYPE_LABELS[t.type] ?? t.type,
          priority: t.priority,
          status: t.status,
          color: "#6b7280",
        });
      }
    }

    // Training sessions
    for (const s of sessions ?? []) {
      const parts: string[] = [];
      if (s.location) parts.push(s.location);
      if (s.trainerName) parts.push(`Trainer: ${s.trainerName}`);
      items.push({
        _id: s._id,
        type: "session",
        date: s.scheduledDate,
        endDate: s.endDate,
        title: `Schulung: ${s.trainingTitle}`,
        subtitle: parts.join(" · ") || "Geplant",
        status: s.status,
        color: "#3b82f6",
      });
    }

    items.sort((a, b) => a.date - b.date);
    return items;
  }, [calendarEvents, tasks, sessions]);

  // Navigation handlers
  const goToday = useCallback(() => setCurrentDate(new Date()), []);
  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      if (view === "month") return subMonths(d, 1);
      if (view === "week") return subWeeks(d, 1);
      return addDays(d, -1);
    });
  }, [view]);
  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      if (view === "month") return addMonths(d, 1);
      if (view === "week") return addWeeks(d, 1);
      return addDays(d, 1);
    });
  }, [view]);

  // Dialog handlers
  const openCreateDialog = useCallback(() => {
    setEditingEventId(null);
    const defaultStart = new Date();
    defaultStart.setMinutes(0, 0, 0);
    defaultStart.setHours(defaultStart.getHours() + 1);
    setFormData({
      ...EMPTY_FORM,
      startDate: timestampToDatetimeLocal(defaultStart.getTime()),
    });
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback(
    (item: CalendarItem) => {
      if (item.type !== "event") return;
      const event = (calendarEvents ?? []).find((e) => e._id === item._id);
      if (!event) return;
      setEditingEventId(event._id);
      setFormData({
        title: event.title,
        description: event.description ?? "",
        startDate: event.allDay
          ? timestampToDateInput(event.startDate) + "T00:00"
          : timestampToDatetimeLocal(event.startDate),
        endDate: event.endDate
          ? event.allDay
            ? timestampToDateInput(event.endDate) + "T23:59"
            : timestampToDatetimeLocal(event.endDate)
          : "",
        allDay: event.allDay,
        location: event.location ?? "",
        color: event.color ?? "#22c55e",
        isPrivate: event.isPrivate,
      });
      setDialogOpen(true);
    },
    [calendarEvents]
  );

  const handleSubmit = useCallback(async () => {
    if (!formData.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    if (!formData.startDate) {
      toast.error("Startdatum ist erforderlich");
      return;
    }

    try {
      const startTs = datetimeLocalToTimestamp(formData.startDate);
      const endTs = formData.endDate ? datetimeLocalToTimestamp(formData.endDate) : undefined;

      if (editingEventId) {
        await updateEvent({
          id: editingEventId,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          startDate: startTs,
          endDate: endTs,
          allDay: formData.allDay,
          location: formData.location.trim() || undefined,
          color: formData.color,
          isPrivate: formData.isPrivate,
        });
        toast.success("Termin aktualisiert");
      } else {
        await createEvent({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          startDate: startTs,
          endDate: endTs,
          allDay: formData.allDay,
          location: formData.location.trim() || undefined,
          color: formData.color,
          isPrivate: formData.isPrivate,
        });
        toast.success("Termin erstellt");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }, [formData, editingEventId, createEvent, updateEvent]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      await archiveEvent({ id: deleteConfirmId });
      toast.success("Termin gelöscht");
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }, [deleteConfirmId, archiveEvent]);

  // Current display label
  const headerLabel = useMemo(() => {
    if (view === "month") return format(currentDate, "MMMM yyyy", { locale: de });
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, "d. MMM", { locale: de })} – ${format(we, "d. MMM yyyy", { locale: de })}`;
    }
    if (view === "day") return format(currentDate, "EEEE, d. MMMM yyyy", { locale: de });
    return "Kalender";
  }, [view, currentDate]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-4">
      <PageHeader
        title="Kalender"
        description="Termine, Aufgaben und Schulungen"
        actions={
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Termin erstellen
          </Button>
        }
      />

      {/* Toolbar: view switcher + navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View switcher */}
        <div className="flex rounded-lg border bg-muted p-0.5">
          {([
            { key: "month", label: "Monat", icon: LayoutGrid },
            { key: "week", label: "Woche", icon: Columns3 },
            { key: "day", label: "Tag", icon: CalendarRange },
            { key: "list", label: "Liste", icon: List },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Date navigation */}
        {view !== "list" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Heute
            </Button>
            <Button variant="outline" size="sm" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-semibold">{headerLabel}</span>
          </div>
        )}
      </div>

      {/* View content */}
      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          items={allItems}
          onDayClick={(d) => {
            setCurrentDate(d);
            setView("day");
          }}
          onEventClick={openEditDialog}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          items={allItems}
          onEventClick={openEditDialog}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          items={allItems}
          onEventClick={openEditDialog}
        />
      )}
      {view === "list" && (
        <ListView items={allItems} onEventClick={openEditDialog} />
      )}

      {/* Create/Edit Dialog */}
      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isEditing={!!editingEventId}
        onDelete={editingEventId ? () => {
          setDialogOpen(false);
          setDeleteConfirmId(editingEventId);
        } : undefined}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin löschen</DialogTitle>
            <DialogDescription>
              Möchten Sie diesen Termin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Month View
// ============================================================

function MonthView({
  currentDate,
  items,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  items: CalendarItem[];
  onDayClick: (d: Date) => void;
  onEventClick: (item: CalendarItem) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build array of weeks, each week is 7 days
  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Group items by date key
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = format(new Date(item.date), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    return map;
  }, [items]);

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {dayNames.map((name) => (
          <div
            key={name}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayItems = itemsByDay.get(key) ?? [];
            const inMonth = isSameMonth(d, currentDate);
            const today = isToday(d);
            const maxShow = 2;
            const overflow = dayItems.length - maxShow;

            return (
              <div
                key={key}
                onClick={() => onDayClick(d)}
                className={`min-h-[80px] cursor-pointer border-r p-1 last:border-r-0 transition-colors hover:bg-muted/30 ${
                  !inMonth ? "bg-muted/20 text-muted-foreground/50" : ""
                }`}
              >
                <div
                  className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    today
                      ? "bg-primary text-primary-foreground"
                      : ""
                  }`}
                >
                  {format(d, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayItems.slice(0, maxShow).map((item) => (
                    <button
                      key={item._id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(item);
                      }}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight hover:opacity-80 transition-opacity truncate"
                      style={{ backgroundColor: item.color + "22", color: item.color }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.title}</span>
                    </button>
                  ))}
                  {overflow > 0 && (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{overflow} weitere
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Week View
// ============================================================

function WeekView({
  currentDate,
  items,
  onEventClick,
}: {
  currentDate: Date;
  items: CalendarItem[];
  onEventClick: (item: CalendarItem) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group items by day
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = format(new Date(item.date), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    return map;
  }, [items]);

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/50">
        <div className="border-r" />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className={`border-r px-2 py-2 text-center last:border-r-0 ${
                today ? "bg-primary/5" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">
                {format(d, "EEE", { locale: de })}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  today ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
        <div className="flex items-center justify-center border-r text-[10px] text-muted-foreground">
          Ganztg.
        </div>
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayItems = (itemsByDay.get(key) ?? []).filter(
            (item) => item.allDay
          );
          return (
            <div
              key={key}
              className="min-h-[28px] border-r p-0.5 last:border-r-0"
            >
              {dayItems.map((item) => (
                <button
                  key={item._id}
                  onClick={() => onEventClick(item)}
                  className="mb-0.5 w-full rounded px-1 py-0.5 text-left text-[10px] leading-tight truncate hover:opacity-80"
                  style={{
                    backgroundColor: item.color + "22",
                    color: item.color,
                  }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0"
          >
            <div className="flex items-start justify-center border-r pt-0.5 text-[10px] text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const dayItems = (itemsByDay.get(key) ?? []).filter((item) => {
                if (item.allDay) return false;
                const h = getHours(new Date(item.date));
                return h === hour;
              });
              return (
                <div
                  key={key}
                  className="relative min-h-[40px] border-r p-0.5 last:border-r-0"
                >
                  {dayItems.map((item) => {
                    const m = getMinutes(new Date(item.date));
                    return (
                      <button
                        key={item._id}
                        onClick={() => onEventClick(item)}
                        className="mb-0.5 w-full rounded px-1 py-0.5 text-left text-[10px] leading-tight truncate hover:opacity-80"
                        style={{
                          backgroundColor: item.color + "22",
                          color: item.color,
                          marginTop: `${(m / 60) * 100}%`,
                        }}
                      >
                        <span className="font-medium">
                          {String(getHours(new Date(item.date))).padStart(2, "0")}:
                          {String(m).padStart(2, "0")}
                        </span>{" "}
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Day View
// ============================================================

function DayView({
  currentDate,
  items,
  onEventClick,
}: {
  currentDate: Date;
  items: CalendarItem[];
  onEventClick: (item: CalendarItem) => void;
}) {
  const dayKey = format(currentDate, "yyyy-MM-dd");

  const dayItems = useMemo(() => {
    return items.filter((item) => {
      const itemDate = format(new Date(item.date), "yyyy-MM-dd");
      return itemDate === dayKey;
    });
  }, [items, dayKey]);

  const allDayItems = dayItems.filter((i) => i.allDay);
  const timedItems = dayItems.filter((i) => !i.allDay);

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* All-day section */}
      {allDayItems.length > 0 && (
        <div className="border-b bg-muted/30 p-2">
          <div className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">
            Ganztägig
          </div>
          <div className="flex flex-wrap gap-1">
            {allDayItems.map((item) => (
              <button
                key={item._id}
                onClick={() => onEventClick(item)}
                className="rounded px-2 py-1 text-xs font-medium hover:opacity-80"
                style={{
                  backgroundColor: item.color + "22",
                  color: item.color,
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hourly time slots */}
      <div className="max-h-[700px] overflow-y-auto">
        {HOURS.map((hour) => {
          const hourItems = timedItems.filter(
            (item) => getHours(new Date(item.date)) === hour
          );

          return (
            <div
              key={hour}
              className="grid grid-cols-[60px_1fr] border-b last:border-b-0"
            >
              <div className="flex items-start justify-center border-r pt-1 text-xs text-muted-foreground">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="min-h-[48px] p-1">
                {hourItems.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => onEventClick(item)}
                    className="mb-1 flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: item.color + "15",
                      borderLeft: `3px solid ${item.color}`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium" style={{ color: item.color }}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(item.date), "HH:mm")}
                      {item.endDate && ` – ${format(new Date(item.endDate), "HH:mm")}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// List View (kept similar to original, grouped by date)
// ============================================================

function ListView({
  items,
  onEventClick,
}: {
  items: CalendarItem[];
  onEventClick: (item: CalendarItem) => void;
}) {
  const overdueItems = items.filter((i) => isOverdue(i.date) && i.type !== "event");
  const upcomingItems = items.filter((i) => !isOverdue(i.date) || i.type === "event");

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of upcomingItems) {
      const key = formatDate(item.date);
      const group = map.get(key) ?? [];
      group.push(item);
      map.set(key, group);
    }
    return map;
  }, [upcomingItems]);

  const TypeIcon = ({ type }: { type: CalendarItem["type"] }) => {
    if (type === "session") return <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />;
    if (type === "event") return <CalendarIcon className="h-4 w-4 text-green-500 shrink-0" />;
    return <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Overdue section */}
      {overdueItems.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Überfällig ({overdueItems.length})
          </h2>
          <div className="space-y-2">
            {overdueItems.map((item) => (
              <Card key={item._id} className="border-red-200 bg-red-50">
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <TypeIcon type={item.type} />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.subtitle}
                        {" · Fällig: "}
                        {formatDate(item.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.priority && <StatusBadge status={item.priority} />}
                    {item.status && <StatusBadge status={item.status} />}
                    {item.type === "event" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEventClick(item)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming items grouped by date */}
      {grouped.size > 0 ? (
        Array.from(grouped.entries()).map(([date, dateItems]) => {
          const days = daysUntil(dateItems[0].date);
          const label =
            days === 0
              ? "Heute"
              : days === 1
                ? "Morgen"
                : days < 0
                  ? `vor ${Math.abs(days)} Tagen`
                  : `in ${days} Tagen`;

          return (
            <div key={date}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                {date}
                <span className="font-normal text-muted-foreground">({label})</span>
              </h2>
              <div className="space-y-2">
                {dateItems.map((item) => (
                  <Card
                    key={item._id}
                    className={
                      item.type === "session"
                        ? "border-blue-200 bg-blue-50/50"
                        : item.type === "event"
                          ? "border-l-4"
                          : undefined
                    }
                    style={
                      item.type === "event"
                        ? { borderLeftColor: item.color }
                        : undefined
                    }
                  >
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon type={item.type} />
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {!item.allDay && (
                              <span>
                                {format(new Date(item.date), "HH:mm")}
                                {item.endDate && ` – ${format(new Date(item.endDate), "HH:mm")}`}
                                {item.subtitle ? " · " : ""}
                              </span>
                            )}
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.priority && <StatusBadge status={item.priority} />}
                        {item.status && <StatusBadge status={item.status} />}
                        {item.type === "event" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEventClick(item)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        overdueItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p>Keine anstehenden Termine</p>
          </div>
        )
      )}
    </div>
  );
}

// ============================================================
// Event Dialog (Create / Edit)
// ============================================================

function EventDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  isEditing,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  onSubmit: () => void;
  isEditing: boolean;
  onDelete?: () => void;
}) {
  const update = (patch: Partial<EventFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Termin bearbeiten" : "Neuer Termin"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Ändern Sie die Details dieses Termins."
              : "Erstellen Sie einen neuen Kalendereintrag."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-1.5">
            <Label htmlFor="event-title">Titel *</Label>
            <Input
              id="event-title"
              value={formData.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Terminbezeichnung"
            />
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="event-description">Beschreibung</Label>
            <Textarea
              id="event-description"
              value={formData.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Optionale Beschreibung..."
              rows={2}
            />
          </div>

          {/* All Day toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="event-allday"
              checked={formData.allDay}
              onCheckedChange={(checked) => update({ allDay: !!checked })}
            />
            <Label htmlFor="event-allday">Ganztägig</Label>
          </div>

          {/* Start / End dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="event-start">Startdatum *</Label>
              <Input
                id="event-start"
                type={formData.allDay ? "date" : "datetime-local"}
                value={
                  formData.allDay && formData.startDate.includes("T")
                    ? formData.startDate.split("T")[0]
                    : formData.startDate
                }
                onChange={(e) => update({ startDate: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="event-end">Enddatum</Label>
              <Input
                id="event-end"
                type={formData.allDay ? "date" : "datetime-local"}
                value={
                  formData.allDay && formData.endDate.includes("T")
                    ? formData.endDate.split("T")[0]
                    : formData.endDate
                }
                onChange={(e) => update({ endDate: e.target.value })}
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid gap-1.5">
            <Label htmlFor="event-location">Ort</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="event-location"
                value={formData.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="Ort oder Raum"
                className="pl-8"
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="grid gap-1.5">
            <Label>Farbe</Label>
            <div className="flex gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.value}
                  onClick={() => update({ color: c.value })}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    formData.color === c.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Private toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="event-private"
              checked={formData.isPrivate}
              onCheckedChange={(checked) => update({ isPrivate: !!checked })}
            />
            <Label htmlFor="event-private">Privat (nur für mich sichtbar)</Label>
          </div>
        </div>

        <DialogFooter>
          {isEditing && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="mr-auto"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Löschen
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit}>
            {isEditing ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
