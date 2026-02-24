import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, ...args }) {
      // Existing user (sign in) — just return the ID
      if (existingUserId) {
        return existingUserId;
      }

      // New user (sign up) — create with required schema fields
      const org = await ctx.db
        .query("organizations")
        .filter((q: any) => q.eq(q.field("type"), "organization"))
        .first();

      const now = Date.now();
      return await ctx.db.insert("users", {
        email: (args as any).profile?.email ?? "",
        firstName: "",
        lastName: "",
        role: "employee",
        organizationId: org!._id,
        status: "active",
        authId: "",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      } as any);
    },

  },
});
