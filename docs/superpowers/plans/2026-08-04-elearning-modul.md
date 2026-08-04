# E-Learning-Modul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E-Learning-Modul in next-qms: HTML-Schulungspakete hochladen, im Player absolvieren, Abschluss/Bogen/Zertifikat im bestehenden QM-Workflow erfassen.

**Architecture:** Neues Convex-Modul `convex/elearning.ts` nutzt die bestehenden Tabellen (`trainings`, `trainingSessions`, `trainingParticipants`, `trainingFeedback`) plus neue Tabelle `certificates`. Pro E-Learning-Training existiert genau eine implizite `trainingSessions`-Zeile (Ort „E-Learning"), damit Teilnehmer-Statusmaschine, Feedback und Wirksamkeitsprüfung unverändert funktionieren. Der Player (`/trainings/[id]/lernen`) lädt das HTML-Paket aus Convex File Storage in ein sandboxed iframe; Kommunikation per postMessage.

**Tech Stack:** Next.js App Router, Convex (self-hosted), convex-test + vitest (neu), bestehende Helper (`withAuth`, `stateMachine`, `auditLog`, `notificationHelpers`, `assignees`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-elearning-modul-design.md`
- Alle Convex-Funktionen: `requirePermission`-Aufruf wie in `convex/trainings.ts`; Schreiboperationen mit `logAuditEvent`.
- Statusübergänge NUR über `validateTransition("participantStatus", …)` (Kette: INVITED→ATTENDED→FEEDBACK_PENDING→FEEDBACK_DONE).
- Schema-Erweiterungen ausschließlich `v.optional(...)` — keine Migration nötig.
- Kurzbericht-Validierung: **mindestens 80 Wörter** (`trim().split(/\s+/)`), Organisations-Items dürfen `"na"` sein, 5/6 ⇒ `badRatingReason` Pflicht.
- UI-Texte Deutsch, Sie-Form. Bestehende shadcn-Komponenten aus `components/ui` verwenden.
- Nach jedem Task: `npx convex codegen && npm run lint` fehlerfrei.

---

### Task 1: Test-Infrastruktur (vitest + convex-test)

**Files:**
- Modify: `package.json` (devDependencies, test-Script)
- Create: `vitest.config.ts`
- Test: `convex/elearning.test.ts` (Smoke)

**Interfaces:**
- Produces: `npm test` führt vitest aus; `convexTest(schema)`-Muster für alle Folge-Tasks.

- [ ] **Step 1: Pakete installieren**

```bash
npm i -D vitest convex-test @edge-runtime/vm
```

- [ ] **Step 2: vitest.config.ts anlegen**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: test-Script ergänzen** — in `package.json` unter `scripts`: `"test": "vitest run"`

- [ ] **Step 4: Smoke-Test schreiben** (`convex/elearning.test.ts`)

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("test-infra", () => {
  it("bootet das Schema", async () => {
    const t = convexTest(schema);
    expect(t).toBeDefined();
  });
});
```

- [ ] **Step 5: Ausführen** — `npm test` · Erwartet: 1 passed

- [ ] **Step 6: Commit** — `git add -A && git commit -m "test: vitest + convex-test Infrastruktur"`

---

### Task 2: Schema-Erweiterungen

**Files:**
- Modify: `convex/schema.ts` (trainings, trainingParticipants, trainingFeedback, neue Tabelle certificates)
- Test: `convex/elearning.test.ts` (Insert-Roundtrip)

**Interfaces:**
- Produces: Felder `trainings.deliveryType|packageFileId|packageVersion|refreshAfterMonths`; `trainingParticipants.score|maxScore|completedAt|progress`; `trainingFeedback.confirmedAt` + `organizationRatingsNa`; Tabelle `certificates`.

- [ ] **Step 1: trainings erweitern** — im `trainings: defineTable({...})`-Block nach `externalLink` einfügen:

```ts
    deliveryType: v.optional(v.union(v.literal("presence"), v.literal("elearning"))), // undefined = presence
    packageFileId: v.optional(v.id("_storage")),
    packageVersion: v.optional(v.number()),
    refreshAfterMonths: v.optional(v.number()),
```

- [ ] **Step 2: trainingParticipants erweitern** — nach `attendedAt` einfügen:

```ts
    progress: v.optional(v.number()),    // höchstes abgeschlossenes Level (E-Learning)
    score: v.optional(v.number()),
    maxScore: v.optional(v.number()),
    completedAt: v.optional(v.number()), // E-Learning-Abschluss
```

- [ ] **Step 3: trainingFeedback erweitern** — nach `badRatingReason` einfügen:

```ts
    // Selbstlern-Format: Organisations-Items können entfallen (true = "entfällt";
    // der Zahlenwert in organizationRatings ist dann 0 und wird ignoriert)
    organizationRatingsNa: v.optional(v.object({
      venueAccessibility: v.boolean(),
      conferenceRooms: v.boolean(),
      catering: v.boolean(),
      staffSupport: v.boolean(),
    })),
    confirmedAt: v.optional(v.number()), // Zeitstempel Bestätigung „Angaben selbst gemacht"
```

- [ ] **Step 4: Tabelle certificates anlegen** — nach dem `trainingFeedback`-Block:

```ts
  certificates: defineTable({
    userId: v.id("users"),
    trainingId: v.id("trainings"),
    participantId: v.id("trainingParticipants"),
    issuedAt: v.number(),
    validUntil: v.optional(v.number()),
    score: v.number(),
    maxScore: v.number(),
    snapshotUserName: v.string(),
    snapshotTrainingTitle: v.string(),
    ...auditFields,
  })
    .index("by_user", ["userId"])
    .index("by_training", ["trainingId"]),
```

- [ ] **Step 5: Codegen + Roundtrip-Test** — `npx convex codegen`; Test ergänzen:

```ts
it("akzeptiert elearning-Felder", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { name: "T", email: "t@x.de", role: "employee", status: "active", isArchived: false, createdAt: 1, updatedAt: 1 } as any);
    const tid = await ctx.db.insert("trainings", { title: "KI", isRequired: true, effectivenessCheckAfterDays: 30, status: "ACTIVE", deliveryType: "elearning", refreshAfterMonths: 12, isArchived: false, createdAt: 1, updatedAt: 1, createdBy: uid, updatedBy: uid } as any);
    expect(await ctx.db.get(tid)).toMatchObject({ deliveryType: "elearning" });
  });
});
```

Hinweis: Falls das `users`-Insert an Pflichtfeldern scheitert, die Feldliste an `convex/schema.ts` (users-Tabelle) anpassen — Ziel ist nur ein gültiger Datensatz.

- [ ] **Step 6: `npm test` grün, dann Commit** — `git commit -am "feat(schema): E-Learning-Felder + certificates"`

---

### Task 3: elearning.start — implizite Session + Teilnehmer

**Files:**
- Create: `convex/elearning.ts`
- Test: `convex/elearning.test.ts`

**Interfaces:**
- Consumes: `getAuthenticatedUser`, `requirePermission` aus `./lib/withAuth`; Schema-Felder aus Task 2.
- Produces: `elearning.start({ trainingId })` → `{ participantId, progress, userName, packageUrl }`; interner Helper `getOrCreateElearningSession(ctx, training, userId)`.

- [ ] **Step 1: Failing Test**

```ts
import { api } from "./_generated/api";

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { name: "Maria Test", email: "m@x.de", role: "employee", status: "active", isArchived: false, createdAt: 1, updatedAt: 1 } as any);
    const tid = await ctx.db.insert("trainings", { title: "KI-Kompetenz", isRequired: true, effectivenessCheckAfterDays: 30, status: "ACTIVE", deliveryType: "elearning", refreshAfterMonths: 12, isArchived: false, createdAt: 1, updatedAt: 1, createdBy: uid, updatedBy: uid } as any);
    return { uid, tid };
  });
}

describe("elearning.start", () => {
  it("legt implizite Session + Teilnehmer an und ist idempotent", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seed(t);
    const asUser = t.withIdentity({ subject: uid });
    const r1 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    const r2 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    expect(r1.participantId).toEqual(r2.participantId);
    expect(r1.userName).toBe("Maria Test");
    const sessions = await t.run((ctx) => ctx.db.query("trainingSessions").collect());
    expect(sessions).toHaveLength(1);
    expect(sessions[0].location).toBe("E-Learning");
  });
});
```

Hinweis: `t.withIdentity({ subject: uid })` muss zum Lookup in `getAuthenticatedUser` passen — vorher in `convex/lib/withAuth.ts` nachsehen, wie der User aus der Identity aufgelöst wird (z. B. über `tokenIdentifier` oder Auth-Tabellen), und den Seed/die Identity entsprechend bauen. Das ist erfahrungsgemäß der einzige Stolperstein dieses Tasks.

- [ ] **Step 2: `npm test` → FAIL** (api.elearning existiert nicht)

- [ ] **Step 3: Implementierung** (`convex/elearning.ts`)

```ts
import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { validateTransition } from "./lib/stateMachine";

/** Implizite Session je E-Learning-Training (genau eine, Ort "E-Learning"). */
async function getOrCreateElearningSession(
  ctx: MutationCtx, training: Doc<"trainings">, userId: Id<"users">
): Promise<Doc<"trainingSessions">> {
  const existing = await ctx.db
    .query("trainingSessions")
    .withIndex("by_training", (q) => q.eq("trainingId", training._id))
    .filter((q) => q.eq(q.field("location"), "E-Learning"))
    .first();
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("trainingSessions", {
    trainingId: training._id, scheduledDate: now, location: "E-Learning",
    status: "PLANNED", isArchived: false,
    createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
  });
  return (await ctx.db.get(id))!;
}

async function getParticipant(ctx: MutationCtx, sessionId: Id<"trainingSessions">, userId: Id<"users">) {
  return await ctx.db
    .query("trainingParticipants")
    .withIndex("by_session_user", (q) => q.eq("sessionId", sessionId).eq("userId", userId))
    .first();
}

/** Player-Start: Teilnehmer anlegen/finden, Wiedereinstiegsdaten liefern. */
export const start = mutation({
  args: { trainingId: v.id("trainings") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:list");
    const training = await ctx.db.get(args.trainingId);
    if (!training || training.deliveryType !== "elearning")
      throw new Error("Kein E-Learning-Training");
    const session = await getOrCreateElearningSession(ctx, training, user._id);
    let participant = await getParticipant(ctx, session._id, user._id);
    if (!participant) {
      const now = Date.now();
      const pid = await ctx.db.insert("trainingParticipants", {
        sessionId: session._id, userId: user._id, status: "INVITED", progress: 0,
        isArchived: false, createdAt: now, updatedAt: now, createdBy: user._id, updatedBy: user._id,
      });
      participant = (await ctx.db.get(pid))!;
      await logAuditEvent(ctx, { entityType: "trainingParticipants", entityId: pid, action: "create", userId: user._id });
    }
    const packageUrl = training.packageFileId ? await ctx.storage.getUrl(training.packageFileId) : null;
    return { participantId: participant._id, progress: participant.progress ?? 0, userName: user.name, packageUrl };
  },
});
```

Hinweis: Signatur von `logAuditEvent` vor Verwendung in `convex/lib/auditLog.ts` prüfen und die Aufrufe an das tatsächliche Argument-Objekt anpassen (gleiches Muster wie in `convex/trainings.ts`).

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat(elearning): start mit impliziter Session"`

---

### Task 4: reportProgress + complete (idempotent) + Zertifikat

**Files:**
- Modify: `convex/elearning.ts`
- Test: `convex/elearning.test.ts`

**Interfaces:**
- Consumes: Task 3 (`start`, Helper).
- Produces: `elearning.reportProgress({ participantId, level })`; `elearning.complete({ participantId, score, maxScore })` → `{ certificateId }`, setzt Status INVITED→ATTENDED→FEEDBACK_PENDING, `completedAt`, legt `certificates`-Zeile an (validUntil = issuedAt + refreshAfterMonths).

- [ ] **Step 1: Failing Tests**

```ts
describe("elearning.complete", () => {
  it("setzt Status, speichert Score, stellt Zertifikat aus — idempotent", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seed(t);
    const asUser = t.withIdentity({ subject: uid });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.reportProgress, { participantId, level: 3 });
    const c1 = await asUser.mutation(api.elearning.complete, { participantId, score: 7, maxScore: 8 });
    const c2 = await asUser.mutation(api.elearning.complete, { participantId, score: 5, maxScore: 8 });
    expect(c1.certificateId).toEqual(c2.certificateId); // erster Abschluss gewinnt
    const p = await t.run((ctx) => ctx.db.get(participantId));
    expect(p).toMatchObject({ status: "FEEDBACK_PENDING", score: 7, progress: 3 });
    expect(p!.completedAt).toBeGreaterThan(0);
    const cert = await t.run((ctx) => ctx.db.get(c1.certificateId));
    expect(cert).toMatchObject({ snapshotUserName: "Maria Test", score: 7 });
    expect(cert!.validUntil).toBe(cert!.issuedAt + 12 * 30.44 * 24 * 3600 * 1000);
  });
});
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implementierung** — in `convex/elearning.ts` ergänzen:

```ts
const MONTH_MS = 30.44 * 24 * 3600 * 1000;

export const reportProgress = mutation({
  args: { participantId: v.id("trainingParticipants"), level: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:list");
    const p = await ctx.db.get(args.participantId);
    if (!p || p.userId !== user._id) throw new Error("Nicht Ihr Teilnahmedatensatz");
    if ((p.progress ?? 0) < args.level)
      await ctx.db.patch(p._id, { progress: args.level, updatedAt: Date.now(), updatedBy: user._id });
  },
});

export const complete = mutation({
  args: { participantId: v.id("trainingParticipants"), score: v.number(), maxScore: v.number() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:list");
    const p = await ctx.db.get(args.participantId);
    if (!p || p.userId !== user._id) throw new Error("Nicht Ihr Teilnahmedatensatz");

    // Idempotent: erster Abschluss gewinnt
    if (p.completedAt) {
      const existing = await ctx.db
        .query("certificates")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("participantId"), p._id))
        .first();
      return { certificateId: existing!._id };
    }

    const session = (await ctx.db.get(p.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    const now = Date.now();

    validateTransition("participantStatus", p.status, "ATTENDED");
    validateTransition("participantStatus", "ATTENDED", "FEEDBACK_PENDING");
    await ctx.db.patch(p._id, {
      status: "FEEDBACK_PENDING", attendedAt: now, completedAt: now,
      score: args.score, maxScore: args.maxScore, updatedAt: now, updatedBy: user._id,
    });

    const certificateId = await ctx.db.insert("certificates", {
      userId: user._id, trainingId: training._id, participantId: p._id,
      issuedAt: now,
      validUntil: training.refreshAfterMonths ? now + training.refreshAfterMonths * MONTH_MS : undefined,
      score: args.score, maxScore: args.maxScore,
      snapshotUserName: user.name, snapshotTrainingTitle: training.title,
      isArchived: false, createdAt: now, updatedAt: now, createdBy: user._id, updatedBy: user._id,
    });
    await logAuditEvent(ctx, { entityType: "trainingParticipants", entityId: p._id, action: "elearning-complete", userId: user._id });
    return { certificateId };
  },
});
```

- [ ] **Step 4: `npm test` → PASS** · **Step 5: Commit** — `git commit -am "feat(elearning): progress, complete, Zertifikat"`

---

### Task 5: Bewertungsbogen-Submit (Vorlage 6 2 0)

**Files:**
- Modify: `convex/elearning.ts`
- Test: `convex/elearning.test.ts`

**Interfaces:**
- Consumes: Task 4 (Teilnehmer in FEEDBACK_PENDING).
- Produces: `elearning.submitFeedback({ participantId, shortReport, organizationRatings, organizationRatingsNa, eventRatings, badRatingReason? })` → validiert (≥80 Wörter; 5/6 ⇒ Begründung), schreibt `trainingFeedback` mit `confirmedAt`, Status → FEEDBACK_DONE.

- [ ] **Step 1: Failing Tests**

```ts
const ORG = { venueAccessibility: 0, conferenceRooms: 0, catering: 0, staffSupport: 0 };
const ORG_NA = { venueAccessibility: true, conferenceRooms: true, catering: true, staffSupport: true };
const EVENT_OK = { overallEvent: 1, knowledgeUsefulness: 2, structurePresentation: 1, seminarContent: 1, questionOpportunity: 2, seminarMaterials: 1, speakerExpertise: 1, presentationQuality: 1 };
const WORDS_80 = Array.from({ length: 80 }, (_, i) => "wort" + i).join(" ");

describe("elearning.submitFeedback", () => {
  async function completed(t: ReturnType<typeof convexTest>) {
    const { uid, tid } = await seed(t);
    const asUser = t.withIdentity({ subject: uid });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
    return { asUser, participantId };
  }
  it("lehnt < 80 Wörter ab", async () => {
    const t = convexTest(schema);
    const { asUser, participantId } = await completed(t);
    await expect(asUser.mutation(api.elearning.submitFeedback, {
      participantId, shortReport: "zu kurz", organizationRatings: ORG,
      organizationRatingsNa: ORG_NA, eventRatings: EVENT_OK,
    })).rejects.toThrow(/80 Wörter/);
  });
  it("verlangt Begründung bei 5/6", async () => {
    const t = convexTest(schema);
    const { asUser, participantId } = await completed(t);
    await expect(asUser.mutation(api.elearning.submitFeedback, {
      participantId, shortReport: WORDS_80, organizationRatings: ORG,
      organizationRatingsNa: ORG_NA, eventRatings: { ...EVENT_OK, seminarMaterials: 5 },
    })).rejects.toThrow(/5\/6/);
  });
  it("speichert gültigen Bogen mit confirmedAt, Status FEEDBACK_DONE", async () => {
    const t = convexTest(schema);
    const { asUser, participantId } = await completed(t);
    await asUser.mutation(api.elearning.submitFeedback, {
      participantId, shortReport: WORDS_80, organizationRatings: ORG,
      organizationRatingsNa: ORG_NA, eventRatings: EVENT_OK,
    });
    const fb = await t.run((ctx) => ctx.db.query("trainingFeedback").first());
    expect(fb!.confirmedAt).toBeGreaterThan(0);
    const p = await t.run((ctx) => ctx.db.get(participantId));
    expect(p!.status).toBe("FEEDBACK_DONE");
  });
});
```

- [ ] **Step 2: FAIL** · **Step 3: Implementierung** — in `convex/elearning.ts`:

```ts
const orgRatingsValidator = v.object({
  venueAccessibility: v.number(), conferenceRooms: v.number(),
  catering: v.number(), staffSupport: v.number(),
});
const orgNaValidator = v.object({
  venueAccessibility: v.boolean(), conferenceRooms: v.boolean(),
  catering: v.boolean(), staffSupport: v.boolean(),
});
const eventRatingsValidator = v.object({
  overallEvent: v.number(), knowledgeUsefulness: v.number(),
  structurePresentation: v.number(), seminarContent: v.number(),
  questionOpportunity: v.number(), seminarMaterials: v.number(),
  speakerExpertise: v.number(), presentationQuality: v.number(),
});

export const submitFeedback = mutation({
  args: {
    participantId: v.id("trainingParticipants"),
    shortReport: v.string(),
    organizationRatings: orgRatingsValidator,
    organizationRatingsNa: orgNaValidator,
    eventRatings: eventRatingsValidator,
    badRatingReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:feedback:submit");
    const p = await ctx.db.get(args.participantId);
    if (!p || p.userId !== user._id) throw new Error("Nicht Ihr Teilnahmedatensatz");
    if (p.status !== "FEEDBACK_PENDING") throw new Error("Bogen bereits abgegeben oder Schulung nicht abgeschlossen");

    const words = args.shortReport.trim().split(/\s+/).filter(Boolean).length;
    if (words < 80) throw new Error(`Der Kurzbericht braucht mindestens 80 Wörter (aktuell ${words}).`);

    const eventVals = Object.values(args.eventRatings);
    const orgVals = (Object.keys(args.organizationRatings) as (keyof typeof args.organizationRatings)[])
      .filter((k) => !args.organizationRatingsNa[k])
      .map((k) => args.organizationRatings[k]);
    for (const val of [...eventVals, ...orgVals])
      if (val < 1 || val > 6) throw new Error("Bewertungen müssen zwischen 1 und 6 liegen (oder „entfällt").");
    if ([...eventVals, ...orgVals].some((r) => r >= 5) && !args.badRatingReason?.trim())
      throw new Error("Sie haben eine 5/6 vergeben — bitte begründen.");

    const now = Date.now();
    await ctx.db.insert("trainingFeedback", {
      participantId: p._id, sessionId: p.sessionId, userId: user._id,
      shortReport: args.shortReport,
      organizationRatings: args.organizationRatings,
      organizationRatingsNa: args.organizationRatingsNa,
      eventRatings: args.eventRatings,
      badRatingReason: args.badRatingReason,
      confirmedAt: now,
      isArchived: false, createdAt: now, updatedAt: now, createdBy: user._id, updatedBy: user._id,
    });
    validateTransition("participantStatus", p.status, "FEEDBACK_DONE");
    await ctx.db.patch(p._id, { status: "FEEDBACK_DONE", updatedAt: now, updatedBy: user._id });
    await logAuditEvent(ctx, { entityType: "trainingFeedback", entityId: p._id, action: "submit", userId: user._id });
  },
});
```

- [ ] **Step 4: PASS** · **Step 5: Commit** — `git commit -am "feat(elearning): Bewertungsbogen 6 2 0 digital"`

---

### Task 6: Paket-Upload (qmb/admin)

**Files:**
- Modify: `convex/elearning.ts`
- Test: `convex/elearning.test.ts`

**Interfaces:**
- Produces: `elearning.generatePackageUploadUrl()` (Permission `trainings:manage`); `elearning.attachPackage({ trainingId, fileId })` setzt `packageFileId`, inkrementiert `packageVersion`, `deliveryType: "elearning"`.

- [ ] **Step 1: Failing Test**

```ts
describe("elearning.attachPackage", () => {
  it("setzt Paket und Version (qmb)", async () => {
    const t = convexTest(schema);
    const { tid } = await seed(t);
    const qmbId = await t.run((ctx) => ctx.db.insert("users", { name: "QMB", email: "q@x.de", role: "qmb", status: "active", isArchived: false, createdAt: 1, updatedAt: 1 } as any));
    const asQmb = t.withIdentity({ subject: qmbId });
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["<html>"], { type: "text/html" })));
    await asQmb.mutation(api.elearning.attachPackage, { trainingId: tid, fileId });
    await asQmb.mutation(api.elearning.attachPackage, { trainingId: tid, fileId });
    const tr = await t.run((ctx) => ctx.db.get(tid));
    expect(tr).toMatchObject({ packageFileId: fileId, packageVersion: 2, deliveryType: "elearning" });
  });
});
```

- [ ] **Step 2: FAIL** · **Step 3: Implementierung**

```ts
export const generatePackageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "trainings:manage");
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachPackage = mutation({
  args: { trainingId: v.id("trainings"), fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "trainings:manage");
    const training = await ctx.db.get(args.trainingId);
    if (!training) throw new Error("Training nicht gefunden");
    await ctx.db.patch(args.trainingId, {
      packageFileId: args.fileId,
      packageVersion: (training.packageVersion ?? 0) + 1,
      deliveryType: "elearning",
      updatedAt: Date.now(), updatedBy: user._id,
    });
    await logAuditEvent(ctx, { entityType: "trainings", entityId: args.trainingId, action: "attach-package", userId: user._id });
  },
});
```

- [ ] **Step 4: PASS** · **Step 5: Commit** — `git commit -am "feat(elearning): Paket-Upload"`

---

### Task 7: Auffrischungs-Cron

**Files:**
- Modify: `convex/elearning.ts`, `convex/crons.ts`
- Test: `convex/elearning.test.ts`

**Interfaces:**
- Produces: `internal.elearning.checkRefreshDue` (internalMutation) — findet Teilnahmen mit `completedAt + refreshAfterMonths·Monat < jetzt`, ohne neuere Teilnahme, erzeugt genau EINE Notification pro Fälligkeit über `createNotification` (Muster aus `convex/lib/notificationHelpers.ts`).

- [ ] **Step 1: Failing Test**

```ts
import { internal } from "./_generated/api";

describe("elearning.checkRefreshDue", () => {
  it("meldet fällige Auffrischung genau einmal", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seed(t);
    const asUser = t.withIdentity({ subject: uid });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
    // Abschluss künstlich 13 Monate alt machen
    await t.run((ctx) => ctx.db.patch(participantId, { completedAt: Date.now() - 13 * 30.44 * 24 * 3600 * 1000 }));
    await t.mutation(internal.elearning.checkRefreshDue, {});
    await t.mutation(internal.elearning.checkRefreshDue, {});
    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.filter((n: any) => n.type === "training_refresh_due")).toHaveLength(1);
  });
});
```

Hinweis: Feldnamen der `notifications`-Tabelle und die `createNotification`-Signatur vorab in `convex/lib/notificationHelpers.ts` prüfen und Test/Implementierung daran ausrichten.

- [ ] **Step 2: FAIL** · **Step 3: Implementierung** — in `convex/elearning.ts`:

```ts
import { internalMutation } from "./_generated/server";
import { createNotification } from "./lib/notificationHelpers";

export const checkRefreshDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const trainings = await ctx.db.query("trainings")
      .filter((q) => q.and(q.eq(q.field("isArchived"), false), q.eq(q.field("deliveryType"), "elearning")))
      .collect();
    for (const training of trainings.filter((t) => t.refreshAfterMonths)) {
      const sessions = await ctx.db.query("trainingSessions")
        .withIndex("by_training", (q) => q.eq("trainingId", training._id)).collect();
      for (const session of sessions) {
        const parts = await ctx.db.query("trainingParticipants")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id)).collect();
        for (const p of parts) {
          if (!p.completedAt) continue;
          const due = p.completedAt + training.refreshAfterMonths! * MONTH_MS;
          if (due > now) continue;
          // schon benachrichtigt? (eine Notification pro Fälligkeitszyklus)
          const existing = await ctx.db.query("notifications")
            .filter((q) => q.and(
              q.eq(q.field("userId"), p.userId),
              q.eq(q.field("type"), "training_refresh_due"),
              q.eq(q.field("relatedId"), p._id),
            )).first();
          if (existing) continue;
          await createNotification(ctx, {
            userId: p.userId, type: "training_refresh_due",
            title: `Auffrischung fällig: ${training.title}`,
            message: `Ihre Schulung „${training.title}" ist älter als ${training.refreshAfterMonths} Monate. Bitte erneut absolvieren.`,
            relatedId: p._id,
          });
        }
      }
    }
  },
});
```

(Die Parameter von `createNotification` und die Filter-Feldnamen an die tatsächliche Signatur anpassen — Muster aus bestehenden Aufrufen in `convex/trainings.ts` übernehmen.)

- [ ] **Step 4: Cron registrieren** — in `convex/crons.ts` vor `export default crons`:

```ts
crons.daily(
  "elearning-refresh-due",
  { hourUTC: 5, minuteUTC: 30 },
  internal.elearning.checkRefreshDue,
);
```

- [ ] **Step 5: PASS + Commit** — `git commit -am "feat(elearning): Auffrischungs-Erinnerung (Cron)"`

---

### Task 8: Player-Route mit postMessage-Bridge

**Files:**
- Create: `app/(dashboard)/trainings/[id]/lernen/page.tsx`
- Create: `components/domain/elearning/PlayerFrame.tsx`

**Interfaces:**
- Consumes: `api.elearning.start|reportProgress|complete|submitFeedback` (Tasks 3–5).
- Produces: Seite `/trainings/<id>/lernen`. postMessage-Protokoll: Host→Paket `{type:"ki-schulung:init", userName, progress}` · Paket→Host `{type:"ki-schulung:progress", level}` | `{type:"ki-schulung:completed", score, maxScore}` | `{type:"ki-schulung:bogen", data:{shortReport, organizationRatings, organizationRatingsNa, eventRatings, badRatingReason}}`.

- [ ] **Step 1: PlayerFrame-Komponente**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type StartData = { participantId: Id<"trainingParticipants">; progress: number; userName: string; packageUrl: string | null };

export function PlayerFrame({ trainingId }: { trainingId: Id<"trainings"> }) {
  const start = useMutation(api.elearning.start);
  const reportProgress = useMutation(api.elearning.reportProgress);
  const complete = useMutation(api.elearning.complete);
  const submitFeedback = useMutation(api.elearning.submitFeedback);
  const [data, setData] = useState<StartData | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { start({ trainingId }).then(setData); }, [trainingId, start]);

  useEffect(() => {
    if (!data) return;
    const onMessage = async (e: MessageEvent) => {
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;
      const m = e.data;
      if (m?.type === "ki-schulung:ready")
        frameRef.current?.contentWindow?.postMessage(
          { type: "ki-schulung:init", userName: data.userName, progress: data.progress }, "*");
      if (m?.type === "ki-schulung:progress")
        await reportProgress({ participantId: data.participantId, level: m.level });
      if (m?.type === "ki-schulung:completed")
        await complete({ participantId: data.participantId, score: m.score, maxScore: m.maxScore });
      if (m?.type === "ki-schulung:bogen")
        await submitFeedback({ participantId: data.participantId, ...m.data });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [data, reportProgress, complete, submitFeedback]);

  if (!data) return <p className="p-8 text-muted-foreground">Schulung wird geladen …</p>;
  if (!data.packageUrl) return <p className="p-8">Für diese Schulung ist noch kein Paket hinterlegt.</p>;
  return (
    <iframe ref={frameRef} src={data.packageUrl} sandbox="allow-scripts allow-modals"
      className="h-[calc(100vh-8rem)] w-full rounded-lg border" title="E-Learning" />
  );
}
```

- [ ] **Step 2: Seite** (`app/(dashboard)/trainings/[id]/lernen/page.tsx`)

```tsx
import { PlayerFrame } from "@/components/domain/elearning/PlayerFrame";
import { Id } from "@/convex/_generated/dataModel";

export default async function LernenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerFrame trainingId={id as Id<"trainings">} />;
}
```

(Import-Alias `@/` und params-Konvention an vorhandene Seiten unter `app/(dashboard)/trainings/[id]/` angleichen.)

- [ ] **Step 3: Manuell testen** — `npm run dev`, Training mit Paket öffnen (nach Task 10), Meldungen im Netzwerk-Tab prüfen.

- [ ] **Step 4: Commit** — `git commit -am "feat(elearning): Player-Route mit postMessage-Bridge"`

---

### Task 9: Verwaltung (Upload) + „Meine Schulungen"

**Files:**
- Create: `components/domain/elearning/PackageUpload.tsx`
- Modify: `app/(dashboard)/trainings/[id]/page.tsx` (Upload-Karte + „Lernen starten"-Button einbinden — an vorhandene Struktur der Seite anpassen)
- Modify: `convex/elearning.ts` (Query `myElearning`)

**Interfaces:**
- Produces: `elearning.myElearning()` → Liste `{ trainingId, title, completedAt, validUntil, status }` für den eingeloggten User; Upload-Komponente für qmb/admin.

- [ ] **Step 1: Query + Test**

```ts
export const myElearning = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const trainings = await ctx.db.query("trainings")
      .filter((q) => q.and(q.eq(q.field("isArchived"), false), q.eq(q.field("deliveryType"), "elearning")))
      .collect();
    const result = [];
    for (const training of trainings) {
      const sessions = await ctx.db.query("trainingSessions")
        .withIndex("by_training", (q) => q.eq("trainingId", training._id)).collect();
      let participant = null;
      for (const s of sessions) {
        const p = await ctx.db.query("trainingParticipants")
          .withIndex("by_session_user", (q) => q.eq("sessionId", s._id).eq("userId", user._id)).first();
        if (p) participant = p;
      }
      const cert = participant ? await ctx.db.query("certificates")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("participantId"), participant!._id)).first() : null;
      result.push({
        trainingId: training._id, title: training.title,
        completedAt: participant?.completedAt ?? null,
        validUntil: cert?.validUntil ?? null,
        status: participant?.status ?? "OFFEN",
      });
    }
    return result;
  },
});
```

Test:

```ts
it("myElearning zeigt Abschluss", async () => {
  const t = convexTest(schema);
  const { uid, tid } = await seed(t);
  const asUser = t.withIdentity({ subject: uid });
  const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
  await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
  const list = await asUser.query(api.elearning.myElearning, {});
  expect(list[0]).toMatchObject({ title: "KI-Kompetenz", status: "FEEDBACK_PENDING" });
});
```

- [ ] **Step 2: PackageUpload-Komponente**

```tsx
"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

export function PackageUpload({ trainingId }: { trainingId: Id<"trainings"> }) {
  const generateUrl = useMutation(api.elearning.generatePackageUploadUrl);
  const attach = useMutation(api.elearning.attachPackage);
  const [busy, setBusy] = useState(false);
  async function onFile(file: File) {
    setBusy(true);
    try {
      const url = await generateUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/html" }, body: file });
      const { storageId } = await res.json();
      await attach({ trainingId, fileId: storageId });
    } finally { setBusy(false); }
  }
  return (
    <label>
      <input type="file" accept=".html" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <Button asChild variant="outline" disabled={busy}><span>{busy ? "Lädt hoch …" : "HTML-Paket hochladen"}</span></Button>
    </label>
  );
}
```

- [ ] **Step 3: In Trainings-Detailseite einbinden** — `PackageUpload` (nur bei Permission `trainings:manage`, Muster der Seite folgen) und, wenn `deliveryType === "elearning"` und Paket vorhanden, Link-Button „Lernen starten" → `/trainings/${id}/lernen`.

- [ ] **Step 4: `npm test` grün + Commit** — `git commit -am "feat(elearning): Upload + Meine Schulungen"`

---

### Task 10: Bogen-Druckansicht (Vorlagen-Layout 6 2 0)

**Files:**
- Create: `app/(dashboard)/trainings/feedback/[feedbackId]/print/page.tsx`
- Modify: `convex/elearning.ts` (Query `feedbackById`)

**Interfaces:**
- Produces: Druckbare Seite im Layout der QM-Vorlage (Kopf „Revision 0 / Stand 07.2018", roter Titel, Logo, Meta-Tabelle, Kästchen-Matrix, Unterschriftszeilen). Query `elearning.feedbackById({ feedbackId })` (Selbstzugriff oder `trainings:manage`).

- [ ] **Step 1: Query**

```ts
export const feedbackById = query({
  args: { feedbackId: v.id("trainingFeedback") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const fb = await ctx.db.get(args.feedbackId);
    if (!fb) return null;
    if (fb.userId !== user._id) await requirePermission(ctx, "trainings:manage");
    const p = (await ctx.db.get(fb.participantId))!;
    const session = (await ctx.db.get(fb.sessionId))!;
    const training = (await ctx.db.get(session.trainingId))!;
    const author = (await ctx.db.get(fb.userId))!;
    return { fb, trainingTitle: training.title, userName: author.name, completedAt: p.completedAt };
  },
});
```

- [ ] **Step 2: Print-Seite** — Client-Komponente, die `feedbackById` lädt und das Layout der QM-Vorlage rendert. Das exakte Markup/CSS aus dem Referenzprojekt übernehmen: `schulungsinhalte/produktion/template.html`, Abschnitt `<!-- BEWERTUNGSBOGEN -->` samt zugehöriger `@media print`-Regeln (dort bereits 1:1 nach Vorlage gebaut); Formularfelder durch die Werte aus der Query ersetzen, `window.print()`-Button oben (className `print:hidden`).

- [ ] **Step 3: Manuell prüfen** — Druckvorschau: einseitig, Kopf/Fuß wie Vorlage. · **Step 4: Commit** — `git commit -am "feat(elearning): Bogen-Druckansicht 6 2 0"`

---

### Task 11: Schulungs-Adapter im Paket (Referenzprojekt schulungsinhalte)

**Files (außerhalb next-qms, Projekt `~/Development/schulungsinhalte`):**
- Modify: `produktion/template.html` (Adapter-Script + Hooks)
- Modify: Deploy-Repo `wiggers-ki-schulung` (neue index.html pushen)

**Interfaces:**
- Produces: Paket sendet `ki-schulung:ready|progress|completed|bogen` und akzeptiert `ki-schulung:init` (Protokoll aus Task 8). Standalone-Verhalten unverändert.

- [ ] **Step 1: Adapter in `template.html`** — vor `renderHeader()` am Skriptende einfügen:

```js
/* ============ QMS-Player-Adapter ============ */
const inPlayer = window.parent !== window;
let hostReady = false;
function toHost(msg){ if(inPlayer) window.parent.postMessage(msg, "*"); }
if (inPlayer) {
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (m?.type === "ki-schulung:init") {
      hostReady = true;
      if (m.userName) { S.name = m.userName; save(); $("uname").value = m.userName; }
    }
  });
  toHost({ type: "ki-schulung:ready" });
}
```

- [ ] **Step 2: Hooks einbauen**
  - In `completeLevel(i)` am Ende: `toHost({type:"ki-schulung:progress", level:i+1});`
  - In `$('btn-qdone').onclick` nach `save()`: `if(pass) toHost({type:"ki-schulung:completed", score:qScore, maxScore:8});`
  - In `$('btn-bogen-done').onclick` nach `save()` zusätzlich:

```js
  toHost({ type: "ki-schulung:bogen", data: {
    shortReport: $("bogen-report").value,
    organizationRatings: { venueAccessibility: 0, conferenceRooms: 0, catering: 0, staffSupport: 0 },
    organizationRatingsNa: { venueAccessibility: true, conferenceRooms: true, catering: true, staffSupport: true },
    eventRatings: readEventRatings(), // Hilfsfunktion: liest die 8 Veranstaltungs-Zeilen aus #bogen-table (Radio-Werte, Reihenfolge wie BOGEN_ITEMS)
    badRatingReason: $("bogen-whytext").value || undefined,
  }});
```

  `readEventRatings()` implementieren: die Zeilen 5–12 aus `#bogen-table tbody` lesen (`input:checked`-Werte, `"na"` kommt dort nicht vor) und auf die 8 Schlüssel in der Reihenfolge `overallEvent, knowledgeUsefulness, structurePresentation, seminarContent, questionOpportunity, seminarMaterials, speakerExpertise, presentationQuality` mappen. Die Organisations-Zeilen bleiben im Player-Kontext auf „entfällt" (Selbstlern-Format).
  - Optional-Verhalten im Player: mailto-Button per `if(inPlayer)` ausblenden (`$('btn-bogen-mail').classList.add('hidden')`).

- [ ] **Step 3: Bauen, lokal testen, deployen**

```bash
cd ~/Development/schulungsinhalte && python3 produktion/build.py
cp KI-Schulung_Wiggers.html ~/Development/wiggers-ki-schulung/index.html
cd ~/Development/wiggers-ki-schulung && git commit -am "feat: QMS-Player-Adapter (postMessage)" && git push
```

Danach Redeploy des Dokploy-Service `ki-schulung` per API auslösen und https://schulung.ot-wiggers.de stichprobenartig prüfen (Standalone-Verhalten unverändert: Name-Eingabe, mailto sichtbar).

- [ ] **Step 4: Paket im QMS hochladen** — als qmb: Training „KI-Kompetenz" anlegen (refreshAfterMonths 12), `PackageUpload` mit der neuen `KI-Schulung_Wiggers.html`, Player-Durchlauf: Level 1 abschließen → `trainingParticipants.progress` = 1 in Convex-Dashboard sichtbar.

---

### Task 12: E2E-Durchlauf (Playwright, minimal)

**Files:**
- Create: `e2e/elearning.spec.ts`, `playwright.config.ts`
- Modify: `package.json` (`"test:e2e": "playwright test"`)

- [ ] **Step 1: Setup** — `npm i -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2: playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
});
```

- [ ] **Step 3: Spec** — Login als Seed-Employee (Zugangsdaten aus `convex/seed.ts` entnehmen), `/trainings` öffnen, KI-Training → „Lernen starten", im iframe Level 1 durchklicken (Namenseingabe entfällt durch init), zurück auf `/trainings`: Status-Anzeige aktualisiert. Selektoren beim Schreiben aus der realen Seite ableiten; der Test besteht, wenn nach Level 1 der Fortschritt sichtbar ist.

- [ ] **Step 4: Commit** — `git commit -am "test(e2e): E-Learning-Durchlauf"`

---

## Self-Review-Ergebnis

- Spec-Abdeckung: Schema ✓ (T2) · Player+Protokoll ✓ (T8/T11) · Bogen-Validierung ✓ (T5) · Idempotenz ✓ (T4) · Auffrischung ✓ (T7) · Matrix-Sichtbarkeit: entsteht über Teilnehmer-Status (bestehende `trainingMatrix`-Queries) — kein Task nötig · PDF/Druck ✓ (T10) · Tests ✓ (T1, je Task, T12).
- Offene Realitäts-Checks sind als Hinweise in T3 (withAuth-Identity) und T7 (Notification-Signatur) markiert — dort prüfen statt raten.
