import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// Selbstregistrierung nur mit Firmen-E-Mail (bestehende Konten dürfen sich weiter anmelden)
export const SIGNUP_DOMAIN = "@ot-wiggers.de";
export function assertSignupAllowed(email: string) {
  if (!email.trim().toLowerCase().endsWith(SIGNUP_DOMAIN)) {
    throw new Error(`Registrierung nur mit einer ${SIGNUP_DOMAIN}-Adresse möglich.`);
  }
}

const CustomPassword = Password({
  profile(params) {
    return {
      email: params.email as string,
      name: `${params.firstName ?? ""} ${params.lastName ?? ""}`.trim(),
      firstName: (params.firstName as string) ?? "",
      lastName: (params.lastName as string) ?? "",
    };
  },
});

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [CustomPassword],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, ...args }) {
      if (existingUserId) {
        return existingUserId;
      }

      const profile = (args as any).profile ?? {};
      assertSignupAllowed(profile.email ?? "");

      const org = await ctx.db
        .query("organizations")
        .filter((q: any) => q.eq(q.field("type"), "organization"))
        .first();

      if (!org) {
        throw new Error(
          "Keine Organisation vorhanden. Bitte zuerst eine Organisation anlegen."
        );
      }

      const now = Date.now();
      return await ctx.db.insert("users", {
        email: profile.email ?? "",
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        role: "employee",
        organizationId: org._id,
        status: "active",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      } as any);
    },
  },
});
