"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  DIGEST_FREQUENCIES,
  DIGEST_FREQUENCY_LABELS,
} from "@/lib/types/enums";

const NOTIFICATION_GROUPS = [
  {
    label: "Dokumente",
    types: [
      "DOCUMENT_STATUS_CHANGED",
      "DOCUMENT_APPROVED",
      "DOCUMENT_REVIEW_REQUESTED",
      "DOCUMENT_REVIEW_DUE",
      "DOCUMENT_EXPIRING",
      "READ_CONFIRMATION_DUE",
      "READ_CONFIRMATION_RECEIVED",
      "REVIEW_COMPLETED",
    ],
  },
  {
    label: "Schulungen",
    types: [
      "TRAINING_ASSIGNED",
      "TRAINING_COMPLETED",
      "TRAINING_FEEDBACK_DUE",
      "TRAINING_REQUEST_SUBMITTED",
      "TRAINING_REQUEST_APPROVED",
      "TRAINING_REQUEST_REJECTED",
    ],
  },
  {
    label: "Aufgaben",
    types: ["TASK_ASSIGNED", "TASK_OVERDUE"],
  },
];

export default function NotificationPreferencesPage() {
  const prefs = useQuery(api.notifications.getPreferences) as
    | {
        emailEnabled: boolean;
        digestFrequency: string;
        mutedEventTypes: string[];
      }
    | null
    | undefined;
  const updatePreferences = useMutation(api.notifications.updatePreferences);

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [mutedTypes, setMutedTypes] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (prefs !== undefined && !initialized) {
      setEmailEnabled(prefs?.emailEnabled ?? true);
      setDigestFrequency(prefs?.digestFrequency ?? "daily");
      setMutedTypes(new Set(prefs?.mutedEventTypes ?? []));
      setInitialized(true);
    }
  }, [prefs, initialized]);

  const toggleMuted = (type: string) => {
    setMutedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await updatePreferences({
        emailEnabled,
        digestFrequency,
        mutedEventTypes: Array.from(mutedTypes),
      });
      toast.success("Einstellungen gespeichert");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Speichern");
    }
  };

  if (prefs === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader title="Benachrichtigungen" />
        <p className="text-sm text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Benachrichtigungseinstellungen" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>E-Mail</CardTitle>
          <CardDescription>Einstellungen für E-Mail-Benachrichtigungen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">E-Mail-Benachrichtigungen</Label>
            <Switch
              id="email-enabled"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label>Zusammenfassung</Label>
            <Select value={digestFrequency} onValueChange={setDigestFrequency}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {DIGEST_FREQUENCY_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ereignisse stummschalten</CardTitle>
          <CardDescription>
            Deaktivierte Benachrichtigungstypen werden weder in der App noch per E-Mail angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {NOTIFICATION_GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="text-sm font-medium mb-3">{group.label}</h4>
              <div className="space-y-2">
                {group.types.map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <Label htmlFor={`mute-${type}`} className="text-sm font-normal">
                      {NOTIFICATION_TYPE_LABELS[type as keyof typeof NOTIFICATION_TYPE_LABELS] ?? type}
                    </Label>
                    <Switch
                      id={`mute-${type}`}
                      checked={!mutedTypes.has(type)}
                      onCheckedChange={() => toggleMuted(type)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={handleSave}>
        Einstellungen speichern
      </Button>
    </div>
  );
}
