import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("test-infra", () => {
  it("bootet das Schema", async () => {
    const t = convexTest(schema);
    expect(t).toBeDefined();
  });
});

describe("elearning-fields", () => {
  it("akzeptiert elearning-Felder im Schema (Roundtrip)", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    const result = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test-Organisation",
        type: "organization",
        code: "TEST",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as any);

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "employee",
        organizationId: orgId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as any);

      const trainingId = await ctx.db.insert("trainings", {
        title: "E-Learning-Kurs",
        isRequired: true,
        effectivenessCheckAfterDays: 30,
        deliveryType: "elearning",
        refreshAfterMonths: 12,
        packageVersion: 1,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as any);

      const sessionId = await ctx.db.insert("trainingSessions", {
        trainingId,
        scheduledDate: now,
        status: "HELD",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as any);

      const participantId = await ctx.db.insert("trainingParticipants", {
        sessionId,
        userId,
        status: "EFFECTIVE",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as any);

      const certificateId = await ctx.db.insert("certificates", {
        userId,
        trainingId,
        participantId,
        issuedAt: now,
        score: 95,
        maxScore: 100,
        snapshotUserName: "Test User",
        snapshotTrainingTitle: "E-Learning-Kurs",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as any);

      return { trainingId, certificateId };
    });

    const training = await t.run(async (ctx) => ctx.db.get(result.trainingId));
    expect(training).toMatchObject({
      deliveryType: "elearning",
      refreshAfterMonths: 12,
      packageVersion: 1,
    });

    const certificate = await t.run(async (ctx) => ctx.db.get(result.certificateId));
    expect(certificate).toMatchObject({
      snapshotUserName: "Test User",
      score: 95,
    });
  });
});
