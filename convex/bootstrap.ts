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

/** Erstbetrieb (npx convex run): Den ersten registrierten Nutzer zum Admin machen.
 *  Läuft nur, wenn GENAU EIN Nutzer existiert — danach laufen Rollenänderungen
 *  ausschließlich über die Admin-UI (users.update mit RBAC + Audit-Trail). */
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
