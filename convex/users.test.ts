/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

describe("changePassword", () => {
  it("weist Nicht-Admins ab", async () => {
    // Module ausdrücklich laden: ohne Angabe sucht convex-test relativ zu node_modules (in Worktrees falscher Checkout)
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const userId = await t.run(async (ctx) => {
      const now = Date.now();
      const orgId = await ctx.db.insert("organizations", {
        name: "Org", type: "organization", code: "T", createdAt: now, updatedAt: now, isArchived: false,
      } as any);
      return ctx.db.insert("users", {
        email: "ma@example.com", firstName: "M", lastName: "A", role: "employee",
        organizationId: orgId, status: "active", createdAt: now, updatedAt: now, isArchived: false,
      } as any);
    });
    await expect(
      t.withIdentity({ subject: `${userId}|s` }).action(api.users.changePassword, {
        email: "admin@example.com", newPassword: "irgendwas123",
      })
    ).rejects.toThrow(/Keine Berechtigung/);
  });
});
