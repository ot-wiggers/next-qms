import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

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

async function seedElearningTraining(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: "Test-Organisation",
      type: "organization",
      code: "TEST",
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    const uid = await ctx.db.insert("users", {
      email: "m@x.de",
      firstName: "Maria",
      lastName: "Test",
      role: "employee",
      organizationId: orgId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    const tid = await ctx.db.insert("trainings", {
      title: "KI-Kompetenz",
      isRequired: true,
      effectivenessCheckAfterDays: 30,
      status: "ACTIVE",
      deliveryType: "elearning",
      refreshAfterMonths: 12,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    });

    return { uid, tid };
  });
}

describe("elearning.start", () => {
  it("legt implizite Session + Teilnehmer an und ist idempotent", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });

    const r1 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    const r2 = await asUser.mutation(api.elearning.start, { trainingId: tid });

    expect(r1.participantId).toEqual(r2.participantId);
    expect(r1.userName).toBe("Maria Test");

    const sessions = await t.run((ctx) => ctx.db.query("trainingSessions").collect());
    expect(sessions).toHaveLength(1);
    expect(sessions[0].location).toBe("E-Learning");
  });
});

describe("elearning.complete", () => {
  it("setzt Status, speichert Score, stellt Zertifikat aus — idempotent", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });

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
