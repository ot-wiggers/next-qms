import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { logAuditEvent } from "./lib/auditLog";

/** Erstbetrieb (npx convex run): Organisation anlegen, falls noch keine existiert.
 *  Ohne Organisation scheitert die Registrierung (siehe convex/auth.ts createOrUpdateUser). */
export const ensureOrganization = internalMutation({
  args: { name: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_type", (q) => q.eq("type", "organization"))
      .first();
    if (existing) {
      return { skipped: true, organizationId: existing._id, name: existing.name };
    }
    const now = Date.now();
    const id = await ctx.db.insert("organizations", {
      name: args.name,
      type: "organization",
      code: args.code,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "organizations",
      entityId: id,
      metadata: { bootstrap: true, name: args.name },
    });
    return { skipped: false, organizationId: id };
  },
});

/** Entwicklung/Verifikation (npx convex run): Walkthrough-Testdaten hart entfernen.
 *  Internal-only — löscht die beim Runtime-Walkthrough erzeugten Test-Datensätze
 *  (Funktionen/Themen mit "(Test", Audits/CAPAs mit "Runtime-Walkthrough",
 *  ALLE trainingFulfillments [der Seed erzeugt 0], Test-Nutzer claude-test@) samt
 *  Abhängigkeiten. Idempotent. */
export const purgeWalkthroughTestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deleted: Record<string, number> = {};
    const del = async (table: string, id: Parameters<typeof ctx.db.delete>[0]) => {
      await ctx.db.delete(id);
      deleted[table] = (deleted[table] ?? 0) + 1;
    };

    // --- Schulungsmatrix: Test-Funktionen + Test-Themen + deren Verknüpfungen ---
    const fns = await ctx.db.query("jobFunctions").collect();
    const testFnIds = new Set(fns.filter((f) => f.name.includes("(Test")).map((f) => f._id));
    const topics = await ctx.db.query("trainingTopics").collect();
    const testTopicIds = new Set(topics.filter((t) => t.title.includes("(Test")).map((t) => t._id));

    const reqs = await ctx.db.query("trainingRequirements").collect();
    for (const r of reqs) {
      if (testFnIds.has(r.functionId) || testTopicIds.has(r.topicId)) {
        await del("trainingRequirements", r._id);
      }
    }
    // Der Seed erzeugt 0 Fulfillments — alle vorhandenen stammen aus Walkthroughs.
    const fulfillments = await ctx.db.query("trainingFulfillments").collect();
    for (const f of fulfillments) await del("trainingFulfillments", f._id);

    for (const id of testFnIds) await del("jobFunctions", id);
    for (const id of testTopicIds) await del("trainingTopics", id);

    // --- Test-Risiken (Phase 5) ---
    const risks = await ctx.db.query("risks").collect();
    for (const r of risks) {
      if (r.title.includes("(Test") || r.title.includes("Runtime-Walkthrough")) {
        await del("risks", r._id);
      }
    }

    // --- Test-Audits + Checklisten-Antworten + Findings ---
    const audits = await ctx.db.query("audits").collect();
    const testAuditIds = new Set(
      audits.filter((a) => a.title.includes("Runtime-Walkthrough")).map((a) => a._id),
    );
    const answers = await ctx.db.query("auditChecklistAnswers").collect();
    for (const ans of answers) {
      if (testAuditIds.has(ans.auditId)) await del("auditChecklistAnswers", ans._id);
    }
    const findings = await ctx.db.query("auditFindings").collect();
    for (const fd of findings) {
      if (testAuditIds.has(fd.auditId)) await del("auditFindings", fd._id);
    }
    for (const id of testAuditIds) await del("audits", id);

    // --- Test-CAPAs + Maßnahmen ---
    const capas = await ctx.db.query("capas").collect();
    const testCapaIds = new Set(
      capas.filter((c) => c.title.includes("Runtime-Walkthrough")).map((c) => c._id),
    );
    const measures = await ctx.db.query("capaMeasures").collect();
    for (const m of measures) {
      if (testCapaIds.has(m.capaId)) await del("capaMeasures", m._id);
    }
    for (const id of testCapaIds) await del("capas", id);

    // --- Test-Nutzer + Auth-Datensätze ---
    const users = await ctx.db.query("users").collect();
    const testUserIds = new Set(
      users.filter((u) => u.email?.includes("claude-test@")).map((u) => u._id),
    );
    const accounts = await ctx.db.query("authAccounts").collect();
    for (const a of accounts) {
      if (testUserIds.has(a.userId)) await del("authAccounts", a._id);
    }
    const sessions = await ctx.db.query("authSessions").collect();
    const testSessionIds = new Set<string>();
    for (const s of sessions) {
      if (testUserIds.has(s.userId)) {
        testSessionIds.add(s._id);
        await del("authSessions", s._id);
      }
    }
    const refresh = await ctx.db.query("authRefreshTokens").collect();
    for (const rt of refresh) {
      if (testSessionIds.has(rt.sessionId)) await del("authRefreshTokens", rt._id);
    }
    for (const id of testUserIds) await del("users", id);

    return { deleted };
  },
});

/** Erstbetrieb (npx convex run): Den ersten registrierten Nutzer zum Admin machen.
 *  Läuft nur, wenn GENAU EIN Nutzer existiert — danach laufen Rollenänderungen
 *  ausschließlich über die Admin-UI (users.update mit RBAC + Audit-Trail). */
/** Entwicklung/Verifikation (npx convex run): Rolle eines Nutzers per E-Mail setzen.
 *  Internal-only — für Runtime-Walkthroughs mit Testnutzern; produktive
 *  Rollenpflege läuft über die Admin-UI (users.update mit RBAC + Audit-Trail). */
export const setUserRoleByEmail = internalMutation({
  args: { email: v.string(), role: v.union(v.literal("admin"), v.literal("qmb"), v.literal("department_lead"), v.literal("employee"), v.literal("auditor")) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) {
      return { skipped: true, reason: `Kein Nutzer mit E-Mail ${args.email}` };
    }
    if (user.role === args.role) {
      return { skipped: true, reason: `Nutzer hat bereits Rolle ${args.role}` };
    }
    await ctx.db.patch(user._id, { role: args.role, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      action: "PERMISSION_CHANGE",
      entityType: "users",
      entityId: user._id,
      previousStatus: user.role,
      newStatus: args.role,
      metadata: { bootstrap: true, email: user.email },
    });
    return { skipped: false, email: user.email, role: args.role };
  },
});

export const promoteFirstUserToAdmin = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    if (users.length === 0) {
      return { skipped: true, reason: "Kein Nutzer vorhanden — zuerst registrieren" };
    }
    if (users.length > 1) {
      return { skipped: true, reason: `${users.length} Nutzer vorhanden — Rollen über die Admin-UI pflegen` };
    }
    const user = users[0];
    if (user.role === "admin") {
      return { skipped: true, reason: "Nutzer ist bereits Admin" };
    }
    await ctx.db.patch(user._id, { role: "admin", updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      action: "PERMISSION_CHANGE",
      entityType: "users",
      entityId: user._id,
      previousStatus: user.role,
      newStatus: "admin",
      metadata: { bootstrap: true, email: user.email },
    });
    return { skipped: false, email: user.email, role: "admin" };
  },
});
