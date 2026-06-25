# Gescopte Dashboards (Option A) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Dashboard zeigt rollenabhängige Datenausschnitte — Mitarbeiter sehen strikt nur ihre eigenen Daten, Abteilungsleitung das eigene Team, QMB/Auditor die org-weite Governance-Sicht — und das bisher tote Permission-Paar `dashboard:view` / `dashboard:view_all` wird dabei lebendig.

**Architecture:** Ein einheitlicher Scope-Resolver in `convex/dashboard.ts` leitet aus der Rolle den Scope ab (`dashboard:view_all → all`, sonst `tasks:team → team`, sonst `own`) und liefert die Menge der Nutzer-Ids im Scope (`own`=ich, `team`=Abteilung, `all`=null/kein Filter). Die personalisierbaren Queries (überfällige Aufgaben, Dokumente in Prüfung, anstehende Überprüfungen, Schulungsquote) filtern serverseitig über diese Menge (Aufgaben per `assigneeId`, Dokumente per `responsibleUserId`, Schulung per Nutzer-Set). Reine Governance-Widgets (Dokumentstatus-Verteilung, org-Lesebestätigungsraten) werden zusätzlich serverseitig auf `dashboard:view_all` gegated und auf der Seite nur für diese Rollen gerendert. Mitarbeiter bekommen statt der org-Lesequote die Kennzahl „offene Bestätigungen" (Dokumente, die ich selbst noch bestätigen muss). Keine neue Tabelle, kein Storage, kein Cron.

**Tech Stack:** Next.js 15 (App Router), Convex (read-only queries), Tailwind v4 + shadcn/ui.

**Verifikation:** Kein Test-Framework — Hauskonvention: `npx tsc --noEmit` (+ `npx convex dev --once` bei Convex-Tasks), Commit pro Task; am Ende Browser-Walkthrough als Mitarbeiter UND als QMB (Memory „Runtime-Verifikation Pflicht").

**Beschluss-Referenz:** Backlog-Punkt 9 (Memory `qm-backlog-beschluesse-2026-06`), bestätigt 2026-06-25: Option A, Grenze **Mitarbeiter = strikt eigene · Leitung = eigenes Team · QMB/Auditor = alles**. Striktes serverseitiges Scoping (kein Kollegen-Leak in den persönlichen Widgets).

**Verifizierte Fakten (2026-06-25):**
- `convex/dashboard.ts` Queries: `openReviews`, `documentStatusDistribution`, `overdueTasks` (nutzt schon `tasks:all`/`tasks:team` → own/team/all), `upcomingReviews`, `trainingQuota`, `readConfirmationRates`. Importiert bereits `getAuthenticatedUser`, `hasPermission`, `UserRole`.
- RBAC heute (`convex/lib/permissions.ts`): `qmb` hat `dashboard:view`+`dashboard:view_all` (Z.33); `department_lead` nur `dashboard:view` (Z.57); `auditor` nur `dashboard:view_all` (Z.92, KEIN view); `employee` hat KEINS. → muss korrigiert werden: employee + auditor brauchen `dashboard:view`.
- `dashboard:view`/`view_all` werden aktuell NIRGENDS abgefragt (totes Paar — Fund aus graphify-Erkundung).
- Schema-Felder: `documentRecords.responsibleUserId` (`Id<"users">`, Pflicht), `.status` (APPROVED/IN_REVIEW), `.nextReviewDate?`, Index `by_status`; `users.departmentId?` + Index `by_department`, `.status` "active"; `readConfirmations` Indizes `by_document_user` (`[documentRecordId, userId]`), `by_user`; `trainingParticipants.by_user` + `.status` "ATTENDED" + `.sessionId`; `trainings.isRequired`; `trainingSessions.by_training` + `.status` "HELD".
- Dashboard-Seite `app/(dashboard)/page.tsx`: KPI-Reihe (4 KpiCards: Offene Prüfungen/Überfällige Aufgaben/Schulungsquote/Lesebestätigungen) + Charts-Reihe (`<DocumentStatusChart/>` ruft intern `documentStatusDistribution`, `<UpcomingReviewsWidget/>` ruft `upcomingReviews`) + `<ReadConfirmationWidget/>` (ruft `readConfirmationRates`, schon hinter `can("documents:read")`) + Detail-Widgets (Tasks/RecentDocs/Training/DevicesAmpel). `usePermissions()` liefert `can`, `role`.
- `KpiCard`-Props: `{ title, value, description?, icon, trend?, loading? }`.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `convex/lib/permissions.ts` | Modify | `dashboard:view` an employee + auditor |
| `convex/dashboard.ts` | Modify | Scope-Helper + Scoping der 4 personalisierbaren Queries + `view_all`-Gate der 2 Governance-Queries + neue `myOpenConfirmations` |
| `app/(dashboard)/page.tsx` | Modify | scope-abhängiges Rendern: Governance-Widgets nur `view_all`, 4. KPI = „Offene Bestätigungen" für Nicht-`view_all`, Scope-Hinweis |

**Ausführungskontext:** Branch: `git checkout -b feature/gescopte-dashboards` (vor Task 1). Convex-Push nach jedem Convex-Task: `npx convex dev --once`.

---

### Task 1: RBAC — `dashboard:view` an employee + auditor

**Files:**
- Modify: `convex/lib/permissions.ts`

- [ ] **Step 1: employee** — in der `employee`-Liste (nach `"notifications:read", "notifications:manage",`) einfügen:

```ts
    "dashboard:view",
```

- [ ] **Step 2: auditor** — in der `auditor`-Liste die Zeile

```ts
    "dashboard:view_all",
```

ersetzen durch:

```ts
    "dashboard:view", "dashboard:view_all",
```

(department_lead und qmb haben `dashboard:view` bereits — nicht anfassen.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/lib/permissions.ts
git commit -m "feat(dashboard): dashboard:view an employee + auditor (Scope-Ladder vollständig)"
```

---

### Task 2: Convex — Scope-Helper + Scoping der personalisierbaren Queries

**Files:**
- Modify: `convex/dashboard.ts`

- [ ] **Step 1: Imports + Helper** — die Import-Zeilen oben ersetzen/ergänzen, sodass die Datei beginnt mit:

```ts
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { hasPermission } from "./lib/permissions";
import type { UserRole } from "../lib/types/enums";

// ============================================================
// Dashboard-Scope: who sees whose data
//   all  → dashboard:view_all (QMB, Auditor) → org-weit (kein Filter)
//   team → tasks:team (Abteilungsleitung)    → eigene Abteilung
//   own  → sonst (Mitarbeiter)               → nur eigene
// ============================================================
type DashboardScope = "own" | "team" | "all";

function resolveScope(role: UserRole): DashboardScope {
  if (hasPermission(role, "dashboard:view_all")) return "all";
  if (hasPermission(role, "tasks:team")) return "team";
  return "own";
}

/** Nutzer-Ids im Scope; null = org-weit (kein Filter). */
async function scopedUserIds(
  ctx: QueryCtx,
  user: { _id: Id<"users">; departmentId?: Id<"organizations"> },
  scope: DashboardScope,
): Promise<Set<Id<"users">> | null> {
  if (scope === "all") return null;
  const deptId = user.departmentId;
  if (scope === "own" || !deptId) return new Set([user._id]);
  const team = await ctx.db
    .query("users")
    .withIndex("by_department", (q) => q.eq("departmentId", deptId))
    .filter((q) => q.eq(q.field("isArchived"), false))
    .collect();
  const ids = new Set(team.map((u) => u._id));
  ids.add(user._id);
  return ids;
}
```

- [ ] **Step 2: `overdueTasks` scope-vereinheitlichen** — die ganze `overdueTasks`-Query ersetzen durch:

```ts
/** Überfällige Aufgaben im Scope (own/team/all) */
export const overdueTasks = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));

    const tasks = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isOverdue"), true),
          q.neq(q.field("status"), "DONE"),
          q.neq(q.field("status"), "CANCELLED"),
        ),
      )
      .collect();

    const scoped = userIds === null ? tasks : tasks.filter((t) => t.assigneeId && userIds.has(t.assigneeId));
    return { count: scoped.length };
  },
});
```

- [ ] **Step 3: `openReviews` scopen** (per `responsibleUserId`) — die ganze Query ersetzen durch:

```ts
/** Dokumente in Prüfung im Scope (own = von mir verantwortete) */
export const openReviews = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));

    const docs = await ctx.db
      .query("documentRecords")
      .withIndex("by_status", (q) => q.eq("status", "IN_REVIEW"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const scoped = userIds === null ? docs : docs.filter((d) => userIds.has(d.responsibleUserId));
    return { count: scoped.length };
  },
});
```

- [ ] **Step 4: `upcomingReviews` scopen** — die ganze Query ersetzen durch:

```ts
/** Anstehende Überprüfungen (90 Tage) im Scope (own = von mir verantwortete) */
export const upcomingReviews = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));
    const now = Date.now();
    const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;

    const docs = await ctx.db
      .query("documentRecords")
      .filter((q) =>
        q.and(q.eq(q.field("isArchived"), false), q.eq(q.field("status"), "APPROVED")),
      )
      .collect();

    const upcoming = docs
      .filter(
        (d) =>
          (userIds === null || userIds.has(d.responsibleUserId)) &&
          d.nextReviewDate !== undefined &&
          d.nextReviewDate <= ninetyDays,
      )
      .sort((a, b) => (a.nextReviewDate ?? 0) - (b.nextReviewDate ?? 0))
      .slice(0, 10);

    return upcoming.map((d) => ({
      _id: d._id,
      documentCode: d.documentCode,
      title: d.title,
      nextReviewDate: d.nextReviewDate,
      daysUntil: Math.floor(((d.nextReviewDate ?? 0) - now) / (24 * 60 * 60 * 1000)),
    }));
  },
});
```

- [ ] **Step 5: `documentStatusDistribution` auf `view_all` gaten** — die erste Handler-Zeile

```ts
    await getAuthenticatedUser(ctx);
```

(in `documentStatusDistribution`) ersetzen durch:

```ts
    await requirePermission(ctx, "dashboard:view_all");
```

(Rest der Query unverändert — reine org-Governance-Verteilung.)

- [ ] **Step 6: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 7: Commit**

```bash
git add convex/dashboard.ts
git commit -m "feat(dashboard): Scope-Helper + Scoping (Aufgaben/Prüfungen/Überprüfungen), Statusverteilung view_all-gegated"
```

---

### Task 3: Convex — Schulungsquote scopen + `myOpenConfirmations` + Lesequote gaten

**Files:**
- Modify: `convex/dashboard.ts`

- [ ] **Step 1: `trainingQuota` scopen** — die ganze Query ersetzen durch:

```ts
/** Schulungsquote im Scope: own = meine, team = Abteilung, all = org */
export const trainingQuota = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const userIds = await scopedUserIds(ctx, user, resolveScope(user.role as UserRole));

    const requiredTrainings = await ctx.db
      .query("trainings")
      .filter((q) => q.and(q.eq(q.field("isArchived"), false), q.eq(q.field("isRequired"), true)))
      .collect();

    const activeUsers = await ctx.db
      .query("users")
      .filter((q) => q.and(q.eq(q.field("status"), "active"), q.eq(q.field("isArchived"), false)))
      .collect();
    const scopeUsers = userIds === null ? activeUsers : activeUsers.filter((u) => userIds.has(u._id));

    if (requiredTrainings.length === 0 || scopeUsers.length === 0) {
      return { percentage: 100, completed: 0, total: 0 };
    }

    const total = requiredTrainings.length * scopeUsers.length;
    let completed = 0;
    for (const training of requiredTrainings) {
      const sessions = await ctx.db
        .query("trainingSessions")
        .withIndex("by_training", (q) => q.eq("trainingId", training._id))
        .filter((q) => q.eq(q.field("status"), "HELD"))
        .collect();
      const sessionIds = new Set(sessions.map((s) => s._id));
      for (const u of scopeUsers) {
        const participation = await ctx.db
          .query("trainingParticipants")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .filter((q) => q.eq(q.field("status"), "ATTENDED"))
          .collect();
        if (participation.some((p) => sessionIds.has(p.sessionId))) completed++;
      }
    }
    return { percentage: Math.round((completed / total) * 100), completed, total };
  },
});
```

- [ ] **Step 2: `readConfirmationRates` auf `view_all` gaten** — die erste Handler-Zeile

```ts
    await getAuthenticatedUser(ctx);
```

(in `readConfirmationRates`) ersetzen durch:

```ts
    await requirePermission(ctx, "dashboard:view_all");
```

(Rest unverändert — org-weite Raten.)

- [ ] **Step 3: `myOpenConfirmations` neu anfügen** (ans Dateiende) — persönliche Sicht für jeden Nutzer:

```ts
/** Dokumente, die ICH noch lesen/bestätigen muss (immer self — kein Kollegen-Bezug) */
export const myOpenConfirmations = query({
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:view");
    const approved = await ctx.db
      .query("documentRecords")
      .withIndex("by_status", (q) => q.eq("status", "APPROVED"))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    let count = 0;
    const documents: Array<{ _id: Id<"documentRecords">; documentCode: string; title?: string }> = [];
    for (const doc of approved) {
      const confirmed = await ctx.db
        .query("readConfirmations")
        .withIndex("by_document_user", (q) =>
          q.eq("documentRecordId", doc._id).eq("userId", user._id),
        )
        .first();
      if (!confirmed) {
        count++;
        if (documents.length < 10) {
          documents.push({ _id: doc._id, documentCode: doc.documentCode, title: doc.title });
        }
      }
    }
    return { count, documents };
  },
});
```

- [ ] **Step 4: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add convex/dashboard.ts
git commit -m "feat(dashboard): Schulungsquote gescopt + myOpenConfirmations (persönlich), Lesequote view_all-gegated"
```

---

### Task 4: Dashboard-Seite — scope-abhängiges Rendern

**Files:**
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Queries + Scope-Flag** — den Block der `useQuery`-Aufrufe (Zeile 28–31) ersetzen durch:

```tsx
  const viewAll = can("dashboard:view_all");

  const openReviews = useQuery(api.dashboard.openReviews);
  const overdueTasks = useQuery(api.dashboard.overdueTasks);
  const trainingQuota = useQuery(api.dashboard.trainingQuota);
  // org-weite Lesequote nur für view_all; sonst persönliche „offene Bestätigungen"
  const readRates = useQuery(
    api.dashboard.readConfirmationRates,
    viewAll ? {} : "skip",
  );
  const myConfirmations = useQuery(
    api.dashboard.myOpenConfirmations,
    viewAll ? "skip" : {},
  );
```

- [ ] **Step 2: Scope-Hinweis unter dem Header** — direkt nach dem `<PageHeader .../>` (vor `{/* KPI row */}`) einfügen:

```tsx
      <p className="-mt-2 text-sm text-muted-foreground">
        {viewAll
          ? "Org-weite Sicht — alle Bereiche."
          : can("tasks:team")
            ? "Sicht auf Ihr Team."
            : "Ihre persönliche Sicht — nur Ihre eigenen Daten."}
      </p>
```

- [ ] **Step 3: 4. KPI scope-abhängig** — die vierte `KpiCard` (Lesebestätigungen, Zeile 73–79) ersetzen durch:

```tsx
        {viewAll ? (
          <KpiCard
            title="Lesebestätigungen"
            value={readRates ? `${readRates.averageRate}%` : "–"}
            icon={BookCheck}
            loading={!readRates}
            description="Durchschnittliche Rate (org-weit)"
          />
        ) : (
          <KpiCard
            title="Offene Bestätigungen"
            value={myConfirmations?.count ?? "–"}
            icon={BookCheck}
            trend={myConfirmations && myConfirmations.count > 0 ? "up" : undefined}
            loading={!myConfirmations}
            description="Dokumente, die Sie noch bestätigen müssen"
          />
        )}
```

- [ ] **Step 4: Governance-Widgets nur für `view_all`** — die Charts-Reihe (Zeile 82–86) und den ReadConfirmation-Block (Zeile 88–93) ersetzen durch:

```tsx
      {/* Charts row — Statusverteilung nur org-weit, Überprüfungen immer (gescopt) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {viewAll && <DocumentStatusChart />}
        <UpcomingReviewsWidget />
      </div>

      {/* Org-weite Lesebestätigungsraten nur für view_all */}
      {viewAll && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ReadConfirmationWidget />
        </div>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/page.tsx"
git commit -m "feat(dashboard): scope-abhängiges Rendern — Governance-Widgets nur view_all, persönliche Bestätigungs-KPI, Scope-Hinweis"
```

---

### Task 5: Runtime-Verifikation (Pflicht) — Mitarbeiter vs. QMB

**Files:** keine Code-Änderungen (nur Fixes aus dem Walkthrough)

- [ ] **Step 1: Dev-Server frisch starten** (Stale-Server-Memory beachten)

- [ ] **Step 2: Als QMB (view_all = org-weit)** — Test-QMB registrieren + `bootstrap:setUserRoleByEmail … qmb`

1. Dashboard `/`: Scope-Hinweis „Org-weite Sicht". KPI-Reihe hat „Lesebestätigungen %" (org). Charts-Reihe zeigt **Dokumentstatus-Verteilung** + Anstehende Überprüfungen. ReadConfirmation-Widget sichtbar. Zahlen = org-weit (alle Aufgaben/Dokumente).
2. Konsole ohne Fehler (keine Permission-Throws).

- [ ] **Step 3: Als Mitarbeiter (own = strikt eigene)** — zweiten Test-Nutzer registrieren, Rolle `employee` setzen (`bootstrap:setUserRoleByEmail '{"email":"…","role":"employee"}'`). Vorher mit dem QMB ein paar Datensätze anlegen, deren Verantwortlicher/Assignee NICHT der Mitarbeiter ist (z. B. eine Aufgabe dem QMB zuweisen), damit „Kollegen-Daten" existieren, die NICHT auftauchen dürfen.

3. Als Mitarbeiter einloggen → Dashboard: Scope-Hinweis „Ihre persönliche Sicht — nur Ihre eigenen Daten."
4. **Kern-Check (kein Leak):** Die KPI „Überfällige Aufgaben" zählt NUR Aufgaben mit `assigneeId == ich` (die dem QMB zugewiesene überfällige Aufgabe darf NICHT mitzählen). Die 4. KPI ist „Offene Bestätigungen" (meine), NICHT die org-Lesequote.
5. **Dokumentstatus-Verteilung ist NICHT sichtbar** (Governance, nur view_all). ReadConfirmation-Widget NICHT sichtbar.
6. „Anstehende Überprüfungen" zeigt nur Dokumente, deren `responsibleUserId == ich` (oder leer, wenn ich keine verantworte).
7. Schulungsquote = meine eigene (nicht die Firmen-Quote).
8. Konsole ohne Fehler (insbesondere KEIN „Keine Berechtigung für: dashboard:view_all" — die gegateten Queries dürfen für den Mitarbeiter gar nicht erst aufgerufen werden, da bedingt gerendert/`"skip"`).

- [ ] **Step 4: Aufräumen + Befunde fixen + Commit**

`npx convex run bootstrap:purgeWalkthroughTestData` (entfernt die `claude-test@`-Nutzer). Walkthrough-Findings beheben, dann:

```bash
git add -A
git commit -m "fix(dashboard): Findings aus Runtime-Walkthrough (Scoping)"
```

(Entfällt, wenn der Walkthrough sauber durchläuft.)

---

## Bewusst NICHT in diesem Plan

- **Frei konfigurierbares Dashboard / Drag-&-Drop-Layout** (Option C) — Over-Engineering für eine 30-MA-Organisation.
- **Eigene Tab-Trennung „Meine/QM-Übersicht"** (Option B) — Option A liefert die Scope-Trennung auf einer Seite; der Schritt zu Tabs bliebe später klein.
- **Team-Aggregat-Versionen der reinen Governance-Widgets** (Dokumentstatus-Verteilung pro Abteilung) — die Verteilung ist eine org-Übersicht; eine Abteilungs-Variante ist nicht gefordert.
- **„Offene Bestätigungen"-Detailliste als eigenes Widget** — die `myOpenConfirmations`-Query liefert bereits `documents[]` für einen späteren Ausbau; vorerst nur die KPI-Zahl (YAGNI).
