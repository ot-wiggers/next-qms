# Quick Wins + UI/UX — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Risiko-Dialog ohne Seitenscrollen, Schulungsmatrix mit vollständigem CRUD (Themen/Funktionen inkl. Archivieren + endgültig löschen), Listenansichten und Planentwurf-Filtern, Sidebar mit einklappbaren Gruppen, funktionierender Dark/Light-Mode.

**Architecture:** Muster der Phasen 1–7. Alle Matrix-Stammdaten behalten Soft-Delete (`isArchived` aus `auditFields`); „Endgültig löschen" nur für unverknüpfte Einträge (Guard in der Mutation). Listenansichten als zwei neue Tabs auf der bestehenden Schulungsmatrix-Seite, ausgelagert in eigene Komponenten unter `components/domain/training-matrix/`. Planentwurf-Filter rein clientseitig (Query liefert bereits alle Felder). Sidebar-Gruppen mit plain-React-Collapse + `localStorage` (kein neues Paket). Dark Mode über das bereits installierte `next-themes` (Attribut `class`, CSS-Variablen in `globals.css` existieren komplett); hell verdrahtete Statusfarben (`bg-green-100` etc., ~25 Dateien) werden **zentral** über `.dark`-Overrides in `globals.css` abgedeckt statt pro Datei.

**Tech Stack:** Next.js 15 (App Router, Turbopack), Convex, Tailwind v4 (Theme inline in globals.css, OKLCH), shadcn/ui (radix-ui Unified-Paket), next-themes ^0.4.6, lucide-react.

**Verifikation:** Das Repo hat keine Test-Infrastruktur (kein Test-Script, keine Test-Dateien) — Hauskonvention der Phasen-Pläne gilt: `npx tsc --noEmit` nach jedem Task + Commit, am Ende verpflichtender Browser-Walkthrough (Memory „Runtime-Verifikation Pflicht"). Achtung Memory „Stale-Dev-Server 404": bei 404 auf Detailrouten zuerst Dev-Server neu starten.

**Beschluss-Referenz:** Grill-me-Interview 2026-06-12 (Memory `qm-backlog-beschluesse-2026-06`), Punkte 1–3 der Reihenfolge „Quick Wins → Audit → Rest". Audit-Umbau, Managementbewertung, Wareneingang, Prüfmittel, Berichte sind **eigene, spätere Pläne**.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `app/(dashboard)/risks/page.tsx` | Modify | Dialog-Breite + Faktoren-Grid |
| `convex/trainingMatrix.ts` | Modify | updateTopic, Name-Update, Archiv/Restore/Delete, Admin-Listen |
| `components/domain/training-matrix/topics-admin-tab.tsx` | Create | Themen-Listenansicht mit CRUD |
| `components/domain/training-matrix/functions-admin-tab.tsx` | Create | Funktionen-Listenansicht mit CRUD |
| `app/(dashboard)/training-matrix/page.tsx` | Modify | 2 neue Tabs + Planentwurf-Filter |
| `components/layout/sidebar.tsx` | Modify | Neue Gruppen, Collapse, localStorage |
| `components/theme-provider.tsx` | Create | next-themes Client-Wrapper |
| `components/layout/theme-toggle.tsx` | Create | Hell/Dunkel/System-Umschalter |
| `app/layout.tsx` | Modify | ThemeProvider + suppressHydrationWarning |
| `components/layout/topbar.tsx` | Modify | ThemeToggle einhängen |
| `app/globals.css` | Modify | Dark-Overrides für Statusfarben |
| `components/domain/documents/document-graph.tsx` | Modify | CSS-Variablen + ReactFlow colorMode |

---

### Task 1: Risiko-Dialog verbreitern (kein Seitenscrollen)

**Files:**
- Modify: `app/(dashboard)/risks/page.tsx:463` (DialogContent) und `:498` (Faktoren-Wrapper)

- [ ] **Step 1: Dialog-Breite anheben**

In `app/(dashboard)/risks/page.tsx` Zeile 463 ändern von:

```tsx
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
```

zu:

```tsx
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
```

- [ ] **Step 2: Faktoren nebeneinander statt untereinander**

Die drei Pflicht-Faktoren (Auftretenswahrscheinlichkeit/Schweregrad/Folgen, Zeile 498) nutzen die neue Breite. Wrapper ändern von:

```tsx
            {/* Faktoren */}
            <div className="space-y-3">
```

zu:

```tsx
            {/* Faktoren */}
            <div className="grid gap-3 sm:grid-cols-3">
```

Gleiches für die „Werte vor Maßnahme"-Sektion (innerer Wrapper Zeile 575) von:

```tsx
                <div className="space-y-3 border-t p-3">
```

zu:

```tsx
                <div className="grid gap-3 border-t p-3 sm:grid-cols-3">
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/risks/page.tsx"
git commit -m "fix(risks): Risiko-Dialog verbreitert (max-w-3xl), Faktoren als 3-Spalten-Grid — kein Seitenscrollen"
```

---

### Task 2: Convex — `updateTopic` + Funktionsname änderbar

**Files:**
- Modify: `convex/trainingMatrix.ts` (updateFunction ab Zeile 346; updateTopic neu nach createTopic, Zeile ~503)

- [ ] **Step 1: `updateFunction` um `name` erweitern**

In den `args` von `updateFunction` (Zeile 347–359) nach `id` einfügen:

```ts
    name: v.optional(v.string()),
```

Im Handler direkt nach dem `fn`-Guard (Zeile 364) einfügen:

```ts
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Name ist erforderlich");
      patch.name = name;
    }
```

- [ ] **Step 2: `updateTopic` neu anlegen** (direkt nach `createTopic`, vor `setRequirement`)

```ts
// ============================================================
// 7b. updateTopic — per-field Patch (trainingMatrix:manage)
// ============================================================

export const updateTopic = mutation({
  args: {
    id: v.id("trainingTopics"),
    cluster: v.optional(v.string()),
    title: v.optional(v.string()),
    frequency: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");

    const topic = await ctx.db.get(args.id);
    if (!topic || topic.isArchived) throw new Error("Thema nicht gefunden oder archiviert");

    const patch: Partial<Doc<"trainingTopics">> = {};

    if (args.cluster !== undefined) {
      // Cluster A–G validieren (gespiegelt aus createTopic)
      if (!["A", "B", "C", "D", "E", "F", "G"].includes(args.cluster)) {
        throw new Error("Ungültiger Cluster — erlaubt: A, B, C, D, E, F, G");
      }
      patch.cluster = args.cluster;
    }
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Titel ist erforderlich");
      patch.title = title;
    }
    // Clearable text fields (trim || undefined)
    if (args.frequency !== undefined) patch.frequency = args.frequency.trim() || undefined;
    if (args.provider !== undefined) patch.provider = args.provider.trim() || undefined;

    await ctx.db.patch(args.id, { ...patch, updatedAt: Date.now(), updatedBy: user._id });

    const { id: _id, ...changes } = args;
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "UPDATE",
      entityType: "trainingTopics",
      entityId: args.id,
      changes,
    });
  },
});
```

- [ ] **Step 3: Typecheck + Convex-Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler, Funktionen deployed

- [ ] **Step 4: Commit**

```bash
git add convex/trainingMatrix.ts
git commit -m "feat(matrix): updateTopic-Mutation + Funktionsname über updateFunction änderbar"
```

---

### Task 3: Convex — Archivieren/Wiederherstellen/Endgültig löschen + Admin-Listen

**Files:**
- Modify: `convex/trainingMatrix.ts` (neue Mutationen/Queries ans Dateiende, vor `seedFromImport`)

Beschluss: „Löschen" = Archivieren (Soft-Delete, Historie bleibt); „Endgültig löschen" nur für Einträge **ohne** Verknüpfungen (Zuordnungen/Erfüllungen — auch archivierte zählen). Die bestehenden Queries (`overview`, `matrix`, `planDraft`) filtern bereits `isArchived === false`, archivierte Einträge verschwinden dort automatisch.

- [ ] **Step 1: Archiv-Mutationen anlegen**

```ts
// ============================================================
// 12. setTopicArchived / setFunctionArchived — Archivieren/Wiederherstellen
// (trainingMatrix:manage) — Soft-Delete, Historie bleibt nachweisbar
// ============================================================

export const setTopicArchived = mutation({
  args: { id: v.id("trainingTopics"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Thema nicht gefunden");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: args.archived,
      archivedAt: args.archived ? now : undefined,
      archivedBy: args.archived ? user._id : undefined,
      updatedAt: now,
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: args.archived ? "ARCHIVE" : "RESTORE",
      entityType: "trainingTopics",
      entityId: args.id,
      metadata: { title: topic.title, cluster: topic.cluster },
    });
  },
});

export const setFunctionArchived = mutation({
  args: { id: v.id("jobFunctions"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const fn = await ctx.db.get(args.id);
    if (!fn) throw new Error("Funktion nicht gefunden");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      isArchived: args.archived,
      archivedAt: args.archived ? now : undefined,
      archivedBy: args.archived ? user._id : undefined,
      updatedAt: now,
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id,
      action: args.archived ? "ARCHIVE" : "RESTORE",
      entityType: "jobFunctions",
      entityId: args.id,
      metadata: { name: fn.name },
    });
  },
});
```

- [ ] **Step 2: Endgültig-löschen-Mutationen mit Verknüpfungs-Guard**

```ts
// ============================================================
// 13. deleteTopicPermanent / deleteFunctionPermanent — Hard-Delete
// NUR für unverknüpfte Einträge (Tippfehler-Anlagen). Guard zählt
// auch archivierte Verknüpfungen — QM-Historie darf nie brechen.
// ============================================================

export const deleteTopicPermanent = mutation({
  args: { id: v.id("trainingTopics") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const topic = await ctx.db.get(args.id);
    if (!topic) throw new Error("Thema nicht gefunden");

    const reqs = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_topic", (q) => q.eq("topicId", args.id))
      .collect();
    if (reqs.length > 0) {
      throw new Error("Thema hat Matrix-Zuordnungen — bitte archivieren statt löschen");
    }
    const fulfillments = (await ctx.db.query("trainingFulfillments").collect()).filter(
      (f) => f.topicId === args.id,
    );
    if (fulfillments.length > 0) {
      throw new Error("Thema hat Erfüllungseinträge — bitte archivieren statt löschen");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "trainingTopics",
      entityId: args.id,
      metadata: { title: topic.title, cluster: topic.cluster },
    });
  },
});

export const deleteFunctionPermanent = mutation({
  args: { id: v.id("jobFunctions") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainingMatrix:manage");
    const fn = await ctx.db.get(args.id);
    if (!fn) throw new Error("Funktion nicht gefunden");

    const reqs = await ctx.db
      .query("trainingRequirements")
      .withIndex("by_function", (q) => q.eq("functionId", args.id))
      .collect();
    if (reqs.length > 0) {
      throw new Error("Funktion hat Matrix-Zuordnungen — bitte archivieren statt löschen");
    }
    const fulfillments = await ctx.db
      .query("trainingFulfillments")
      .withIndex("by_function", (q) => q.eq("functionId", args.id))
      .collect();
    if (fulfillments.length > 0) {
      throw new Error("Funktion hat Erfüllungseinträge — bitte archivieren statt löschen");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      userId: user._id,
      action: "PERMANENT_DELETE",
      entityType: "jobFunctions",
      entityId: args.id,
      metadata: { name: fn.name },
    });
  },
});
```

- [ ] **Step 3: Admin-Listen-Queries (inkl. Verknüpfungszähler für die UI-Guards)**

```ts
// ============================================================
// 14. topicsAdminList / functionsAdminList — Listenansichten
// (trainingMatrix:list) — linkCount steuert den Löschen-Button in der UI
// ============================================================

export const topicsAdminList = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const topics = await ctx.db.query("trainingTopics").collect();
    const requirements = await ctx.db.query("trainingRequirements").collect();
    const fulfillments = await ctx.db.query("trainingFulfillments").collect();

    return topics
      .filter((t) => (args.includeArchived ? true : !t.isArchived))
      .sort((a, b) =>
        a.cluster !== b.cluster
          ? a.cluster.localeCompare(b.cluster)
          : a.sortOrder - b.sortOrder,
      )
      .map((t) => ({
        _id: t._id,
        cluster: t.cluster,
        title: t.title,
        frequency: t.frequency,
        provider: t.provider,
        sortOrder: t.sortOrder,
        isArchived: t.isArchived,
        linkCount:
          requirements.filter((r) => r.topicId === t._id).length +
          fulfillments.filter((f) => f.topicId === t._id).length,
      }));
  },
});

export const functionsAdminList = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "trainingMatrix:list");

    const functions = await ctx.db.query("jobFunctions").collect();
    const requirements = await ctx.db.query("trainingRequirements").collect();
    const fulfillments = await ctx.db.query("trainingFulfillments").collect();

    return functions
      .filter((f) => (args.includeArchived ? true : !f.isArchived))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        _id: f._id,
        name: f.name,
        holder: f.holder,
        staffingStatus: f.staffingStatus,
        sortOrder: f.sortOrder,
        isArchived: f.isArchived,
        linkCount:
          requirements.filter((r) => r.functionId === f._id).length +
          fulfillments.filter((ff) => ff.functionId === f._id).length,
      }));
  },
});
```

- [ ] **Step 4: Typecheck + Convex-Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add convex/trainingMatrix.ts
git commit -m "feat(matrix): Archivieren/Wiederherstellen + endgültig löschen (Guard) + Admin-Listen-Queries"
```

---

### Task 4: UI — Themen-Listenansicht (neuer Tab)

**Files:**
- Create: `components/domain/training-matrix/topics-admin-tab.tsx`
- Modify: `app/(dashboard)/training-matrix/page.tsx` (Tabs, Zeile 422–427 + neuer TabsContent)

- [ ] **Step 1: Komponente anlegen** — `components/domain/training-matrix/topics-admin-tab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TOPIC_CLUSTERS } from "@/lib/types/enums";
import { toast } from "sonner";

type AdminTopic = {
  _id: Id<"trainingTopics">;
  cluster: string;
  title: string;
  frequency?: string;
  provider?: string;
  sortOrder: number;
  isArchived: boolean;
  linkCount: number;
};

export function TopicsAdminTab({ canManage }: { canManage: boolean }) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const topics = useQuery(api.trainingMatrix.topicsAdminList, { includeArchived }) as
    | AdminTopic[]
    | undefined;

  const updateTopic = useMutation(api.trainingMatrix.updateTopic);
  const setTopicArchived = useMutation(api.trainingMatrix.setTopicArchived);
  const deleteTopicPermanent = useMutation(api.trainingMatrix.deleteTopicPermanent);

  const [editTarget, setEditTarget] = useState<AdminTopic | null>(null);
  const [editForm, setEditForm] = useState({
    cluster: "A",
    title: "",
    frequency: "",
    provider: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminTopic | null>(null);

  function openEdit(topic: AdminTopic) {
    setEditForm({
      cluster: topic.cluster,
      title: topic.title,
      frequency: topic.frequency ?? "",
      provider: topic.provider ?? "",
    });
    setEditTarget(topic);
  }

  async function handleSaveEdit() {
    if (!editTarget || saving) return;
    if (!editForm.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      // Rohstrings übergeben — Server-trim||undefined leert optionale Felder
      await updateTopic({
        id: editTarget._id,
        cluster: editForm.cluster,
        title: editForm.title,
        frequency: editForm.frequency,
        provider: editForm.provider,
      });
      toast.success("Thema gespeichert");
      setEditTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive(topic: AdminTopic) {
    try {
      await setTopicArchived({ id: topic._id, archived: !topic.isArchived });
      toast.success(topic.isArchived ? "Thema wiederhergestellt" : "Thema archiviert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTopicPermanent({ id: deleteTarget._id });
      toast.success("Thema endgültig gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="topics-show-archived" className="text-sm text-muted-foreground">
          Archivierte anzeigen
        </Label>
        <Switch
          id="topics-show-archived"
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
        />
      </div>

      {topics === undefined ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : topics.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Themen vorhanden.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cluster</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Frequenz</TableHead>
              <TableHead>Quelle/Anbieter</TableHead>
              <TableHead className="text-right">Verknüpfungen</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow key={topic._id} className={topic.isArchived ? "opacity-60" : ""}>
                <TableCell>
                  {TOPIC_CLUSTERS.find((c) => c.key === topic.cluster)?.title ?? topic.cluster}
                </TableCell>
                <TableCell className="font-medium">{topic.title}</TableCell>
                <TableCell className="text-muted-foreground">{topic.frequency ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{topic.provider ?? "—"}</TableCell>
                <TableCell className="text-right">{topic.linkCount}</TableCell>
                <TableCell>
                  {topic.isArchived ? (
                    <Badge variant="outline">Archiviert</Badge>
                  ) : (
                    <Badge variant="secondary">Aktiv</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    {!topic.isArchived && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(topic)}>
                        Bearbeiten
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleArchive(topic)}
                    >
                      {topic.isArchived ? "Wiederherstellen" : "Archivieren"}
                    </Button>
                    {topic.linkCount === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(topic)}
                      >
                        Löschen
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit-Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thema bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-topic-cluster">Cluster</Label>
              <Select
                value={editForm.cluster}
                onValueChange={(v) => setEditForm({ ...editForm, cluster: v })}
              >
                <SelectTrigger id="edit-topic-cluster"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOPIC_CLUSTERS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-topic-title">Titel</Label>
              <Input
                id="edit-topic-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-topic-frequency">Frequenz (optional)</Label>
              <Input
                id="edit-topic-frequency"
                value={editForm.frequency}
                onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-topic-provider">Quelle/Anbieter (optional)</Label>
              <Input
                id="edit-topic-provider"
                value={editForm.provider}
                onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Endgültig-löschen-Bestätigung */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thema endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.title}" wird unwiderruflich gelöscht. Das ist nur für
              versehentlich angelegte Themen ohne Verknüpfungen gedacht — für alles
              andere bitte Archivieren verwenden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Endgültig löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Tab in der Seite registrieren**

In `app/(dashboard)/training-matrix/page.tsx`:

Import ergänzen (bei den anderen Komponenten-Imports):

```tsx
import { TopicsAdminTab } from "@/components/domain/training-matrix/topics-admin-tab";
```

TabsList (Zeile 423–427) erweitern zu:

```tsx
        <TabsList>
          <TabsTrigger value="soll-ist">Soll-Ist</TabsTrigger>
          <TabsTrigger value="matrix">Matrix</TabsTrigger>
          <TabsTrigger value="plan-entwurf">Plan-Entwurf</TabsTrigger>
          <TabsTrigger value="themen">Themen</TabsTrigger>
          <TabsTrigger value="funktionen">Funktionen</TabsTrigger>
        </TabsList>
```

Nach dem schließenden `</TabsContent>` von `plan-entwurf` (Zeile 725) einfügen:

```tsx
        {/* ======================================================
            Tab 4: Themen (Listenansicht + CRUD)
        ====================================================== */}
        <TabsContent value="themen">
          <TopicsAdminTab canManage={canManage} />
        </TabsContent>
```

(Der `funktionen`-TabsContent folgt in Task 5 — bis dahin rendert der Trigger einen leeren Tab, das ist für diesen Commit in Ordnung.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add components/domain/training-matrix/topics-admin-tab.tsx "app/(dashboard)/training-matrix/page.tsx"
git commit -m "feat(matrix): Themen-Listenansicht als Tab — Bearbeiten, Archivieren, endgültig löschen"
```

---

### Task 5: UI — Funktionen-Listenansicht (neuer Tab)

**Files:**
- Create: `components/domain/training-matrix/functions-admin-tab.tsx`
- Modify: `app/(dashboard)/training-matrix/page.tsx`

- [ ] **Step 1: Komponente anlegen** — `components/domain/training-matrix/functions-admin-tab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  STAFFING_STATUSES,
  STAFFING_STATUS_LABELS,
  type StaffingStatus,
} from "@/lib/types/enums";
import { toast } from "sonner";

type AdminFunction = {
  _id: Id<"jobFunctions">;
  name: string;
  holder?: string;
  staffingStatus: StaffingStatus;
  sortOrder: number;
  isArchived: boolean;
  linkCount: number;
};

export function FunctionsAdminTab({ canManage }: { canManage: boolean }) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const functions = useQuery(api.trainingMatrix.functionsAdminList, { includeArchived }) as
    | AdminFunction[]
    | undefined;

  const updateFunction = useMutation(api.trainingMatrix.updateFunction);
  const setFunctionArchived = useMutation(api.trainingMatrix.setFunctionArchived);
  const deleteFunctionPermanent = useMutation(api.trainingMatrix.deleteFunctionPermanent);

  const [editTarget, setEditTarget] = useState<AdminFunction | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    holder: string;
    staffingStatus: StaffingStatus;
  }>({ name: "", holder: "", staffingStatus: "FILLED" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminFunction | null>(null);

  function openEdit(fn: AdminFunction) {
    setEditForm({
      name: fn.name,
      holder: fn.holder ?? "",
      staffingStatus: fn.staffingStatus,
    });
    setEditTarget(fn);
  }

  async function handleSaveEdit() {
    if (!editTarget || saving) return;
    if (!editForm.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      await updateFunction({
        id: editTarget._id,
        name: editForm.name,
        holder: editForm.holder,
        staffingStatus: editForm.staffingStatus,
      });
      toast.success("Funktion gespeichert");
      setEditTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive(fn: AdminFunction) {
    try {
      await setFunctionArchived({ id: fn._id, archived: !fn.isArchived });
      toast.success(fn.isArchived ? "Funktion wiederhergestellt" : "Funktion archiviert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteFunctionPermanent({ id: deleteTarget._id });
      toast.success("Funktion endgültig gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="functions-show-archived" className="text-sm text-muted-foreground">
          Archivierte anzeigen
        </Label>
        <Switch
          id="functions-show-archived"
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
        />
      </div>

      {functions === undefined ? (
        <div className="p-8 text-muted-foreground">Lade…</div>
      ) : functions.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Keine Funktionen vorhanden.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funktion</TableHead>
              <TableHead>Stelleninhaber/in</TableHead>
              <TableHead>Besetzungsstatus</TableHead>
              <TableHead className="text-right">Verknüpfungen</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {functions.map((fn) => (
              <TableRow key={fn._id} className={fn.isArchived ? "opacity-60" : ""}>
                <TableCell className="font-medium">{fn.name}</TableCell>
                <TableCell className="text-muted-foreground">{fn.holder ?? "—"}</TableCell>
                <TableCell>{STAFFING_STATUS_LABELS[fn.staffingStatus]}</TableCell>
                <TableCell className="text-right">{fn.linkCount}</TableCell>
                <TableCell>
                  {fn.isArchived ? (
                    <Badge variant="outline">Archiviert</Badge>
                  ) : (
                    <Badge variant="secondary">Aktiv</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    {!fn.isArchived && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(fn)}>
                        Bearbeiten
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleToggleArchive(fn)}>
                      {fn.isArchived ? "Wiederherstellen" : "Archivieren"}
                    </Button>
                    {fn.linkCount === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(fn)}
                      >
                        Löschen
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit-Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Funktion bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-fn-name">Funktionsbezeichnung</Label>
              <Input
                id="edit-fn-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-fn-holder">Stelleninhaber/in (optional)</Label>
              <Input
                id="edit-fn-holder"
                value={editForm.holder}
                onChange={(e) => setEditForm({ ...editForm, holder: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-fn-status">Besetzungsstatus</Label>
              <Select
                value={editForm.staffingStatus}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, staffingStatus: v as StaffingStatus })
                }
              >
                <SelectTrigger id="edit-fn-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFFING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAFFING_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Endgültig-löschen-Bestätigung */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Funktion endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}" wird unwiderruflich gelöscht. Das ist nur für
              versehentlich angelegte Funktionen ohne Verknüpfungen gedacht — für alles
              andere bitte Archivieren verwenden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Endgültig löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Tab in der Seite registrieren**

Import in `app/(dashboard)/training-matrix/page.tsx` ergänzen:

```tsx
import { FunctionsAdminTab } from "@/components/domain/training-matrix/functions-admin-tab";
```

Nach dem `themen`-TabsContent aus Task 4 einfügen:

```tsx
        {/* ======================================================
            Tab 5: Funktionen (Listenansicht + CRUD)
        ====================================================== */}
        <TabsContent value="funktionen">
          <FunctionsAdminTab canManage={canManage} />
        </TabsContent>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add components/domain/training-matrix/functions-admin-tab.tsx "app/(dashboard)/training-matrix/page.tsx"
git commit -m "feat(matrix): Funktionen-Listenansicht als Tab — Bearbeiten (inkl. Name), Archivieren, endgültig löschen"
```

---

### Task 6: Planentwurf-Filter

**Files:**
- Modify: `app/(dashboard)/training-matrix/page.tsx` (State bei den anderen Hooks ~Zeile 378; TabsContent `plan-entwurf` Zeile 649–725)

Beschlossene Filter: Funktion, Cluster/Thema, Einstufung, Freitextsuche. Rein clientseitig — `planDraft` liefert alle Felder bereits.

- [ ] **Step 1: Filter-State + Filterlogik** (nach dem `creatingTrainings`-State, Zeile ~378, einfügen):

```tsx
  // ---- Plan-Entwurf: Filter (clientseitig) ----
  const [pdFunction, setPdFunction] = useState<string>("ALL");
  const [pdCluster, setPdCluster] = useState<string>("ALL");
  const [pdLevel, setPdLevel] = useState<string>("ALL");
  const [pdSearch, setPdSearch] = useState("");

  const filteredPlanDraft = ((planDraft ?? []) as PlanDraftRow[]).filter((row) => {
    if (pdFunction !== "ALL" && row.functionId !== pdFunction) return false;
    if (pdCluster !== "ALL" && row.cluster !== pdCluster) return false;
    if (pdLevel !== "ALL" && row.level !== pdLevel) return false;
    if (pdSearch.trim()) {
      const q = pdSearch.trim().toLowerCase();
      const hay = `${row.topicTitle} ${row.functionName} ${row.provider ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
```

- [ ] **Step 2: Filterleiste + gefilterte Tabelle**

Im TabsContent `plan-entwurf`: direkt **nach** dem beschreibenden `<p className="text-sm text-muted-foreground">…</p>` (Zeile 658–661) die Filterleiste einfügen:

```tsx
              {/* Filterleiste */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={pdFunction} onValueChange={setPdFunction}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Funktion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Alle Funktionen</SelectItem>
                    {((overview ?? []) as OverviewItem[]).map((fn) => (
                      <SelectItem key={fn._id} value={fn._id}>
                        {fn.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pdCluster} onValueChange={setPdCluster}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Alle Cluster</SelectItem>
                    {TOPIC_CLUSTERS.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pdLevel} onValueChange={setPdLevel}>
                  <SelectTrigger className="w-[230px]">
                    <SelectValue placeholder="Einstufung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Alle Einstufungen</SelectItem>
                    {MANDATORY_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>
                        {REQUIREMENT_LEVEL_SYMBOLS[lvl]} {REQUIREMENT_LEVEL_LABELS[lvl]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-[240px]"
                  placeholder="Suchen (Thema, Funktion, Anbieter)…"
                  value={pdSearch}
                  onChange={(e) => setPdSearch(e.target.value)}
                />
              </div>
```

Dann die Tabelle auf die gefilterten Zeilen umstellen: Zeile 675 von

```tsx
                    {(planDraft as PlanDraftRow[]).map((row) => {
```

zu

```tsx
                    {filteredPlanDraft.map((row) => {
```

und den Tabellen-Container (`<div className="overflow-x-auto rounded-md border">…</div>`) mit einem Leer-Treffer-Zustand umschließen:

```tsx
              {filteredPlanDraft.length === 0 ? (
                <div className="rounded-md border p-8 text-center text-muted-foreground">
                  Keine Treffer mit den aktuellen Filtern.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  {/* …bestehende <table> unverändert… */}
                </div>
              )}
```

(Der äußere Leerzustand „Keine offenen Pflichtschulungen — alle Funktionen vollständig." bei `planDraft.length === 0` bleibt unverändert davor bestehen.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/training-matrix/page.tsx"
git commit -m "feat(matrix): Planentwurf-Filter — Funktion, Cluster, Einstufung, Freitextsuche"
```

---

### Task 7: Sidebar — einklappbare Gruppen

**Files:**
- Modify: `components/layout/sidebar.tsx` (navSections Zeile 54–112, NavContent Zeile 141–180)

Beschlossene Gruppierung: Dashboard/Aufgaben/Kalender fix oben (ohne Überschrift, nicht einklappbar); 7 einklappbare Gruppen. Wareneingang/Prüfmittel/Berichte wandern mit ihrem „IN PLANUNG"-Badge in die Zielgruppen (die Gruppe „In Planung" entfällt). Zustand in `localStorage`, Standard: alle offen; die Gruppe mit der aktiven Route wird automatisch aufgeklappt. Permission-/Flag-Filterung bleibt unverändert (Gruppen ohne sichtbare Items werden weiter komplett ausgeblendet).

- [ ] **Step 1: `ChevronDown` importieren**

In der lucide-Import-Liste (Zeile 5–33) `ChevronDown,` ergänzen.

- [ ] **Step 2: `navSections` ersetzen** (Zeile 54–112 komplett ersetzen):

```tsx
const navSections: { title: string; items: NavItem[] }[] = [
  {
    // Fix sichtbar, ohne Überschrift, nicht einklappbar
    title: "",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Aufgaben", href: "/tasks", icon: ClipboardList },
      { label: "Kalender", href: "/calendar", icon: Calendar },
    ],
  },
  {
    title: "Dokumente",
    items: [
      { label: "Dokumente", href: "/documents", icon: FileText, permission: "documents:read" },
      { label: "Dokumenten-Graph", href: "/documents/graph", icon: GitBranch, permission: "documents:read" },
      { label: "Berichte", href: "/reports", icon: BarChart3, featureFlag: "REPORTS", badge: "IN PLANUNG" },
    ],
  },
  {
    title: "Schulungen",
    items: [
      { label: "Schulungen", href: "/trainings", icon: GraduationCap, permission: "trainings:list" },
      { label: "Schulungsanträge", href: "/training-requests", icon: MessageSquarePlus },
      { label: "Schulungsmatrix", href: "/training-matrix", icon: Grid3x3, permission: "trainingMatrix:list", featureFlag: "TRAINING_MATRIX" },
    ],
  },
  {
    title: "Audits & Maßnahmen",
    items: [
      { label: "Interne Audits", href: "/audits", icon: ClipboardCheck, featureFlag: "AUDITS", permission: "audits:list" },
      { label: "Auditplan", href: "/audits/plan", icon: CalendarRange, permission: "audits:list", featureFlag: "AUDITS" },
      { label: "CAPA", href: "/capa", icon: AlertTriangle, featureFlag: "CAPA", permission: "capa:list" },
      { label: "Reklamationen", href: "/complaints", icon: MessageSquarePlus, permission: "complaints:list", featureFlag: "COMPLAINTS" },
    ],
  },
  {
    title: "QM-Steuerung",
    items: [
      { label: "Risikoregister", href: "/risks", icon: ShieldAlert, permission: "risks:list", featureFlag: "RISKS" },
      { label: "Qualitätsziele", href: "/quality-objectives", icon: Target, permission: "qualityObjectives:list", featureFlag: "QUALITY_OBJECTIVES" },
      { label: "Managementbewertung", href: "/management-review", icon: FileCheck, permission: "mgmtReview:list", featureFlag: "MGMT_REVIEW" },
      { label: "PMS-Bericht", href: "/pms-reports", icon: FileSearch, permission: "pmsReports:list", featureFlag: "PMS_REPORTS" },
    ],
  },
  {
    title: "Produkte & MDR",
    items: [
      { label: "Produkte", href: "/mdr/products", icon: Package, permission: "products:list" },
      { label: "Hersteller", href: "/mdr/manufacturers", icon: Factory, permission: "products:list" },
      { label: "Konformitätserklärungen", href: "/mdr/declarations", icon: Shield, permission: "declarations:list" },
      { label: "Hilfsmittelverzeichnis", href: "/mdr/hilfsmittelverzeichnis", icon: BookOpen, permission: "hmv:browse" },
      { label: "Versorgungsspektrum", href: "/mdr/versorgungsspektrum", icon: CheckSquare, permission: "hmv:browse" },
    ],
  },
  {
    title: "Prüfungen",
    items: [
      { label: "Wareneingang", href: "/incoming-goods", icon: Truck, featureFlag: "INCOMING_GOODS", badge: "IN PLANUNG" },
      { label: "Prüfmittel", href: "/devices", icon: Wrench, featureFlag: "DEVICES", badge: "IN PLANUNG" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Benachrichtigungen", href: "/settings/notifications", icon: Bell },
      { label: "Verwaltung", href: "/admin", icon: Building2, permission: "users:list" },
      { label: "Einstellungen", href: "/admin/settings", icon: Settings, permission: "admin:settings" },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "qms-sidebar-open-groups";

function isItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
}
```

- [ ] **Step 3: `NavLink` vereinfachen** — die Aktiv-Logik nutzt jetzt den Helper. In `NavLink` (Zeile 116–139) die beiden Zeilen

```tsx
  const isActive = pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
```

ersetzen durch:

```tsx
  const isActive = isItemActive(item, pathname);
```

- [ ] **Step 4: `NavContent` mit Collapse-Logik ersetzen** (Zeile 141–180 komplett ersetzen):

```tsx
function NavContent() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const flags = useQuery(api.featureFlags.list, {});
  const enabledFlags = new Set(
    (flags ?? []).filter((f) => f.enabled).map((f) => f.key)
  );

  // Offene Gruppen: Default alle offen; localStorage erst nach Mount lesen
  // (vermeidet SSR-Hydration-Mismatch)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setOpenGroups(JSON.parse(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? "{}"));
    } catch {
      // korrupter Eintrag → Default (alle offen)
    }
  }, []);

  // Gruppe mit aktiver Route immer aufklappen
  useEffect(() => {
    const activeSection = navSections.find(
      (s) => s.title !== "" && s.items.some((i) => isItemActive(i, pathname))
    );
    if (activeSection && openGroups[activeSection.title] === false) {
      setOpenGroups((prev) => {
        const next = { ...prev, [activeSection.title]: true };
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !(prev[title] ?? true) };
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <ScrollArea className="h-full py-4">
      <div className="px-3 space-y-4">
        <div className="px-3">
          <h2 className="text-lg font-semibold tracking-tight">QMS</h2>
          <p className="text-xs text-muted-foreground">Qualitätsmanagementsystem</p>
        </div>
        {navSections.map((section) => {
          const permittedItems = section.items.filter((item) => {
            if (item.permission && !can(item.permission as PermissionAction)) return false;
            if (item.featureFlag && !enabledFlags.has(item.featureFlag)) return false;
            return true;
          });
          if (permittedItems.length === 0) return null;

          // Fixe Top-Gruppe ohne Überschrift
          if (section.title === "") {
            return (
              <div key="top" className="space-y-1">
                {permittedItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            );
          }

          const isOpen = openGroups[section.title] ?? true;

          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() => toggleGroup(section.title)}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={isOpen}
              >
                {section.title}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")}
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1">
                  {permittedItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
```

`useEffect` zum React-Import ergänzen (Zeile 43): `import { useEffect, useState } from "react";`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 6: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat(ui): Sidebar mit 8 thematischen, einklappbaren Gruppen (localStorage-persistiert, aktive Gruppe auto-offen)"
```

---

### Task 8: Dark Mode — Provider + Umschalter

**Files:**
- Create: `components/theme-provider.tsx`
- Create: `components/layout/theme-toggle.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/layout/topbar.tsx`

`next-themes` ^0.4.6 ist installiert, aber nicht verdrahtet. Die `.dark`-CSS-Variablen in `app/globals.css` (Zeile 85–117) existieren vollständig. Der Sonner-Toaster nutzt `useTheme` bereits und folgt automatisch, sobald der Provider da ist.

- [ ] **Step 1: Provider-Wrapper anlegen** — `components/theme-provider.tsx`:

```tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider(
  props: React.ComponentProps<typeof NextThemesProvider>,
) {
  return <NextThemesProvider {...props} />;
}
```

- [ ] **Step 2: Root-Layout verdrahten** — `app/layout.tsx` komplett ersetzen durch:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QMS — Qualitätsmanagementsystem",
  description: "Digitales QMS für Sanitätshaus (ISO 13485 + MDR)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors closeButton />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

(`suppressHydrationWarning` auf `<html>` ist Pflicht — next-themes setzt die Klasse vor der Hydration.)

- [ ] **Step 3: Umschalter anlegen** — `components/layout/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Sun className="h-5 w-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-5 w-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Design wechseln</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Hell</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dunkel</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: In die Topbar einhängen** — `components/layout/topbar.tsx`:

Import ergänzen (bei den anderen Layout-Imports, nach Zeile 30):

```tsx
import { ThemeToggle } from "./theme-toggle";
```

In der JSX vor `<NotificationBell />` (Zeile 115) einfügen:

```tsx
          <ThemeToggle />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 6: Commit**

```bash
git add components/theme-provider.tsx components/layout/theme-toggle.tsx app/layout.tsx components/layout/topbar.tsx
git commit -m "feat(ui): Dark Mode — next-themes verdrahtet, Hell/Dunkel/System-Umschalter in der Topbar"
```

---

### Task 9: Dark-Mode-Farb-Sweep (zentral) + Dokumenten-Graph

**Files:**
- Modify: `app/globals.css` (ans Dateiende)
- Modify: `components/domain/documents/document-graph.tsx`

~25 Dateien nutzen hell verdrahtete Status-Utilities (`bg-green-100 text-green-800` etc.) ohne `dark:`-Variante. Statt jede Datei anzufassen: zentrale `.dark`-Overrides in `globals.css` — höhere Spezifität als die Utility-Klasse, deckt auch künftige Verwendungen ab. Abgedeckt wird das per Grep ermittelte Ist-Inventar (bg-\*-50/100, text-\*-600–900, border-\*-200/300 der Familien red/orange/amber/yellow/green/blue/purple/gray).

- [ ] **Step 1: Overrides in `app/globals.css` ans Dateiende anfügen**

```css
/* ============================================================
   Dark-Mode-Überschreibungen für hell verdrahtete Status-Farben.
   Badges/Banner im Code nutzen bg-*-50/100 + text-*-600..900 +
   border-*-200/300 ohne dark:-Varianten — zentral hier abgefangen
   statt in ~25 Dateien. Hues: red 25, orange 55, amber 80,
   yellow 100, green 150, blue 260, purple 300.
   ============================================================ */

/* Hintergründe (helle Tints → dunkle Tints) */
.dark .bg-red-50     { background-color: oklch(0.22 0.04 25); }
.dark .bg-red-100    { background-color: oklch(0.28 0.06 25); }
.dark .bg-orange-100 { background-color: oklch(0.28 0.05 55); }
.dark .bg-amber-50   { background-color: oklch(0.22 0.03 80); }
.dark .bg-amber-100  { background-color: oklch(0.28 0.05 80); }
.dark .bg-yellow-50  { background-color: oklch(0.22 0.03 100); }
.dark .bg-green-50   { background-color: oklch(0.22 0.03 150); }
.dark .bg-green-100  { background-color: oklch(0.28 0.05 150); }
.dark .bg-blue-50    { background-color: oklch(0.22 0.03 260); }
.dark .bg-blue-100   { background-color: oklch(0.28 0.05 260); }
.dark .bg-purple-100 { background-color: oklch(0.28 0.05 300); }
.dark .bg-gray-50    { background-color: oklch(0.22 0.005 260); }
.dark .bg-gray-100   { background-color: oklch(0.28 0.005 260); }

/* Texte (dunkle Töne → helle, lesbare Töne) */
.dark .text-red-600    { color: oklch(0.72 0.16 25); }
.dark .text-red-700    { color: oklch(0.76 0.14 25); }
.dark .text-red-800    { color: oklch(0.81 0.12 25); }
.dark .text-red-900    { color: oklch(0.85 0.09 25); }
.dark .text-orange-600 { color: oklch(0.74 0.14 55); }
.dark .text-orange-700 { color: oklch(0.78 0.12 55); }
.dark .text-amber-600  { color: oklch(0.76 0.13 80); }
.dark .text-amber-700  { color: oklch(0.79 0.12 80); }
.dark .text-amber-800  { color: oklch(0.83 0.10 80); }
.dark .text-amber-900  { color: oklch(0.86 0.08 80); }
.dark .text-yellow-600 { color: oklch(0.78 0.13 100); }
.dark .text-yellow-700 { color: oklch(0.81 0.11 100); }
.dark .text-yellow-800 { color: oklch(0.84 0.09 100); }
.dark .text-green-600  { color: oklch(0.74 0.14 150); }
.dark .text-green-700  { color: oklch(0.78 0.12 150); }
.dark .text-green-800  { color: oklch(0.82 0.10 150); }
.dark .text-green-900  { color: oklch(0.86 0.08 150); }
.dark .text-blue-600   { color: oklch(0.72 0.13 260); }
.dark .text-blue-800   { color: oklch(0.81 0.09 260); }
.dark .text-purple-800 { color: oklch(0.81 0.09 300); }
.dark .text-gray-600   { color: oklch(0.72 0.01 260); }
.dark .text-gray-800   { color: oklch(0.85 0.01 260); }

/* Rahmen (helle Borders → dunkle Borders) */
.dark .border-red-200    { border-color: oklch(0.38 0.07 25); }
.dark .border-amber-200  { border-color: oklch(0.38 0.06 80); }
.dark .border-amber-300  { border-color: oklch(0.43 0.07 80); }
.dark .border-yellow-200 { border-color: oklch(0.38 0.06 100); }
.dark .border-green-200  { border-color: oklch(0.38 0.06 150); }
.dark .border-blue-200   { border-color: oklch(0.38 0.06 260); }
.dark .border-orange-300 { border-color: oklch(0.43 0.08 55); }
```

- [ ] **Step 2: Dokumenten-Graph theming** — `components/domain/documents/document-graph.tsx`:

Import ergänzen (nach den bestehenden Imports):

```tsx
import { useTheme } from "next-themes";
```

In der Komponente `DocumentGraph` als erste Zeile nach `const router = useRouter();`:

```tsx
  const { resolvedTheme } = useTheme();
```

Node-Style (Zeile 76–83) ändern von:

```tsx
      style: {
        background: "#fff",
        border: `2px solid ${TYPE_COLORS[doc.documentType] ?? "#94a3b8"}`,
```

zu:

```tsx
      style: {
        background: "var(--card)",
        color: "var(--card-foreground)",
        border: `2px solid ${TYPE_COLORS[doc.documentType] ?? "#94a3b8"}`,
```

Edge-Labels (Zeile 92) ändern von:

```tsx
      labelStyle: { fontSize: "10px", fill: "#71717a" },
```

zu:

```tsx
      labelStyle: { fontSize: "10px", fill: "var(--muted-foreground)" },
```

Und der `<ReactFlow>`-Komponente das colorMode-Prop geben (steuert Background/Controls/MiniMap), Props ergänzen:

```tsx
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
```

(Die `TYPE_COLORS` für Dokumenttypen bleiben absichtlich hart — kräftige Akzentfarben funktionieren in beiden Modi und sind Legende + Rahmen zugleich.)

- [ ] **Step 3: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: keine Fehler, Build erfolgreich

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/domain/documents/document-graph.tsx
git commit -m "fix(ui): Dark-Mode-Farbsweep — zentrale .dark-Overrides für Statusfarben, Dokumenten-Graph mit Theme-Variablen"
```

---

### Task 10: Runtime-Verifikation (Pflicht — Memory „Runtime-Verifikation Pflicht")

**Files:** keine Code-Änderungen (nur Fixes, falls der Walkthrough Probleme findet)

- [ ] **Step 1: Dev-Server frisch starten** (Memory „Stale-Dev-Server 404": alten Server beenden)

Run: `npm run dev` (parallel `npx convex dev`, falls nicht aktiv)
Expected: App erreichbar auf http://localhost:3000

- [ ] **Step 2: Browser-Walkthrough — Quick Wins**

1. `/risks` → Risiko anklicken → Dialog ist ~3xl breit, **kein horizontaler Scrollbalken**, Faktoren stehen in 3 Spalten.
2. `/training-matrix` → Tabs „Themen" und „Funktionen" sichtbar.
3. Themen-Tab: Thema bearbeiten (Titel ändern) → gespeichert; Thema archivieren → verschwindet aus Matrix-Tab und Planentwurf; „Archivierte anzeigen" → Eintrag mit Badge „Archiviert" + Wiederherstellen funktioniert; bei einem Thema mit Verknüpfungen ist **kein** Löschen-Button sichtbar; neues Test-Thema anlegen (Matrix-Tab „+ Thema hinzufügen") → im Themen-Tab endgültig löschen → weg.
4. Funktionen-Tab: Name einer Funktion ändern → in Soll-Ist-Karten sofort aktualisiert.
5. Planentwurf: alle 4 Filter einzeln und kombiniert testen; „Keine Treffer"-Zustand prüfen; „Training anlegen" funktioniert weiterhin aus gefilterter Liste.

- [ ] **Step 3: Browser-Walkthrough — UI/UX**

6. Sidebar: 8 Gruppen sichtbar (Dashboard-Block oben ohne Überschrift); Gruppe zuklappen → Reload → bleibt zu; Route in zugeklappter Gruppe öffnen (z. B. `/capa` direkt) → Gruppe „Audits & Maßnahmen" klappt automatisch auf; Mobile-Sheet (schmales Fenster) zeigt dieselben Gruppen.
7. Theme-Umschalter in der Topbar: Hell → Dunkel → System; Auswahl überlebt Reload.
8. Im Dark Mode prüfen: `/training-matrix` (Hinweis-Banner + Ampel-Badges lesbar), `/capa` und `/complaints` (Status-Badges lesbar), `/documents/graph` (Knoten dunkel, Beschriftung lesbar, MiniMap/Hintergrund dunkel), Dialoge und Toasts.

- [ ] **Step 4: Gefundene Probleme fixen, dann finaler Commit**

```bash
git add -A
git commit -m "fix(ui): Findings aus Runtime-Walkthrough Quick-Wins/UI-UX"
```

(Entfällt, wenn der Walkthrough sauber durchläuft.)

---

## Bewusst NICHT in diesem Plan

- Audit-Modellwechsel (ein Audit/Jahr), 2026-Import, Checklisten-Vorlagen-UI → eigener Plan (Beschluss-Punkt 4)
- Managementbewertung-Gliederung + 2025-Import → eigener Plan (Punkt 5)
- Wareneingang, Prüfmittel, Berichtsarchiv → eigene Pläne (Punkte 6–8)
- Genereller UI-Konsistenz-Durchgang über alle Module hinaus — der Dark-Sweep in Task 9 deckt die Farb-Altlasten zentral ab; weitere Findings sammelt der Walkthrough in Task 10
