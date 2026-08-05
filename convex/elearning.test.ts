import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

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

    return { uid, tid, orgId };
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

  it("lehnt archivierte und inaktive Trainings ab (Direkt-URL-Guard)", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });

    await t.run((ctx) => ctx.db.patch(tid, { isArchived: true }));
    await expect(asUser.mutation(api.elearning.start, { trainingId: tid }))
      .rejects.toThrow(/archiviert/);

    await t.run((ctx) => ctx.db.patch(tid, { isArchived: false, status: "ARCHIVED" }));
    await expect(asUser.mutation(api.elearning.start, { trainingId: tid }))
      .rejects.toThrow(/nicht aktiv/);
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

const ORG = { venueAccessibility: 0, conferenceRooms: 0, catering: 0, staffSupport: 0 };
const ORG_NA = { venueAccessibility: true, conferenceRooms: true, catering: true, staffSupport: true };
const EVENT_OK = { overallEvent: 1, knowledgeUsefulness: 2, structurePresentation: 1, seminarContent: 1, questionOpportunity: 2, seminarMaterials: 1, speakerExpertise: 1, presentationQuality: 1 };
const WORDS_80 = Array.from({ length: 80 }, (_, i) => "wort" + i).join(" ");

describe("elearning.attachPackage", () => {
  it("setzt Paket und Version (qmb)", async () => {
    const t = convexTest(schema);
    const { tid } = await seedElearningTraining(t);
    const qmbId = await t.run(async (ctx) => {
      const now = Date.now();
      const orgId = await ctx.db.insert("organizations", {
        name: "QMB-Org",
        type: "organization",
        code: "QMB",
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      });
      return await ctx.db.insert("users", {
        firstName: "QMB",
        lastName: "User",
        email: "q@x.de",
        role: "qmb",
        organizationId: orgId,
        status: "active",
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      } as any);
    });
    const asQmb = t.withIdentity({ subject: String(qmbId) });
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["<html>"], { type: "text/html" })));
    await asQmb.mutation(api.elearning.attachPackage, { trainingId: tid, fileId });
    await asQmb.mutation(api.elearning.attachPackage, { trainingId: tid, fileId });
    const tr = await t.run((ctx) => ctx.db.get(tid));
    expect(tr).toMatchObject({ packageFileId: fileId, packageVersion: 2, deliveryType: "elearning" });
  });
});

describe("elearning.submitFeedback", () => {
  async function completed(t: ReturnType<typeof convexTest>) {
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
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

async function seedPresenceParticipant(t: ReturnType<typeof convexTest>, status: string) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: "Presenz-Org",
      type: "organization",
      code: "PRES",
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    const uid = await ctx.db.insert("users", {
      email: "peter@x.de",
      firstName: "Peter",
      lastName: "Presenz",
      role: "employee",
      organizationId: orgId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    });

    const tid = await ctx.db.insert("trainings", {
      title: "Präsenz-Schulung",
      isRequired: true,
      effectivenessCheckAfterDays: 30,
      status: "ACTIVE",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    });

    const sessionId = await ctx.db.insert("trainingSessions", {
      trainingId: tid,
      scheduledDate: now,
      location: "Konferenzraum",
      status: "PLANNED",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    });

    const participantId = await ctx.db.insert("trainingParticipants", {
      sessionId,
      userId: uid,
      status,
      progress: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    });

    return { uid, participantId };
  });
}

describe("elearning deliveryType-Guard (Präsenz-Teilnehmer abgelehnt)", () => {
  it("complete lehnt Präsenz-Teilnehmer ab", async () => {
    const t = convexTest(schema);
    const { uid, participantId } = await seedPresenceParticipant(t, "INVITED");
    const asUser = t.withIdentity({ subject: String(uid) });
    await expect(
      asUser.mutation(api.elearning.complete, { participantId, score: 1, maxScore: 1 })
    ).rejects.toThrow(/E-Learning/);
  });

  it("reportProgress lehnt Präsenz-Teilnehmer ab", async () => {
    const t = convexTest(schema);
    const { uid, participantId } = await seedPresenceParticipant(t, "INVITED");
    const asUser = t.withIdentity({ subject: String(uid) });
    await expect(
      asUser.mutation(api.elearning.reportProgress, { participantId, level: 1 })
    ).rejects.toThrow(/E-Learning/);
  });

  it("submitFeedback lehnt Präsenz-Teilnehmer ab", async () => {
    const t = convexTest(schema);
    const { uid, participantId } = await seedPresenceParticipant(t, "FEEDBACK_PENDING");
    const asUser = t.withIdentity({ subject: String(uid) });
    await expect(
      asUser.mutation(api.elearning.submitFeedback, {
        participantId, shortReport: WORDS_80, organizationRatings: ORG,
        organizationRatingsNa: ORG_NA, eventRatings: EVENT_OK,
      })
    ).rejects.toThrow(/E-Learning/);
  });
});

describe("elearning.feedbackById", () => {
  async function withFeedback(t: ReturnType<typeof convexTest>) {
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
    await asUser.mutation(api.elearning.submitFeedback, {
      participantId, shortReport: WORDS_80, organizationRatings: ORG,
      organizationRatingsNa: ORG_NA, eventRatings: EVENT_OK,
    });
    const fb = await t.run((ctx) => ctx.db.query("trainingFeedback").first());
    return { asUser, feedbackId: fb!._id };
  }

  it("liefert das eigene Feedback", async () => {
    const t = convexTest(schema);
    const { asUser, feedbackId } = await withFeedback(t);
    const result = await asUser.query(api.elearning.feedbackById, { feedbackId });
    expect(result).toMatchObject({ trainingTitle: "KI-Kompetenz", userName: "Maria Test" });
    expect(result!.fb._id).toEqual(feedbackId);
  });

  it("verweigert fremdes Feedback ohne trainings:manage", async () => {
    const t = convexTest(schema);
    const { feedbackId } = await withFeedback(t);
    const now = Date.now();
    const otherId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Fremd-Org", type: "organization", code: "FRGN",
        createdAt: now, updatedAt: now, isArchived: false,
      });
      return await ctx.db.insert("users", {
        email: "other@x.de", firstName: "Other", lastName: "User",
        role: "employee", organizationId: orgId, status: "active",
        createdAt: now, updatedAt: now, isArchived: false,
      });
    });
    const asOther = t.withIdentity({ subject: String(otherId) });
    await expect(asOther.query(api.elearning.feedbackById, { feedbackId })).rejects.toThrow();
  });
});

describe("elearning.myElearning", () => {
  it("zeigt Abschluss", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
    const list = await asUser.query(api.elearning.myElearning, {});
    expect(list[0]).toMatchObject({ title: "KI-Kompetenz", status: "FEEDBACK_PENDING" });
  });
});

describe("elearning refresh (Wiederholung nach Ablauf)", () => {
  it("start legt bei fälliger Auffrischung neuen Teilnehmer an neuer Session an", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });

    const r1 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    const c1 = await asUser.mutation(api.elearning.complete, {
      participantId: r1.participantId, score: 8, maxScore: 8,
    });
    await t.run((ctx) =>
      ctx.db.patch(r1.participantId, { completedAt: Date.now() - 13 * 30.44 * 24 * 3600 * 1000 })
    );

    // Fällige Auffrischung → neuer Teilnehmer, Fortschritt 0
    const r2 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    expect(r2.participantId).not.toEqual(r1.participantId);
    expect(r2.progress).toBe(0);

    // Wiederholter start bleibt idempotent auf der neuen Teilnahme
    const r3 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    expect(r3.participantId).toEqual(r2.participantId);

    // Abschluss der Wiederholung → neues Zertifikat, completedAt erneuert
    const c2 = await asUser.mutation(api.elearning.complete, {
      participantId: r2.participantId, score: 6, maxScore: 8,
    });
    expect(c2.certificateId).not.toEqual(c1.certificateId);
    const p2 = await t.run((ctx) => ctx.db.get(r2.participantId));
    expect(p2!.completedAt).toBeGreaterThan(Date.now() - 60_000);
    const cert2 = await t.run((ctx) => ctx.db.get(c2.certificateId));
    expect(cert2!.validUntil).toBe(cert2!.issuedAt + 12 * 30.44 * 24 * 3600 * 1000);
  });

  it("start ohne fällige Auffrischung bleibt idempotent", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const r1 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId: r1.participantId, score: 8, maxScore: 8 });
    const r2 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    expect(r2.participantId).toEqual(r1.participantId);
  });
});

describe("elearning.checkRefreshDue", () => {
  it("meldet fällige Auffrischung genau einmal, auch bei zweitem Cron-Lauf", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
    // Abschluss künstlich 13 Monate alt machen (refreshAfterMonths: 12)
    await t.run((ctx) =>
      ctx.db.patch(participantId, { completedAt: Date.now() - 13 * 30.44 * 24 * 3600 * 1000 })
    );

    await t.mutation(internal.elearning.checkRefreshDue, {});
    await t.mutation(internal.elearning.checkRefreshDue, {});

    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.filter((n) => n.type === "training_refresh_due")).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      userId: uid,
      resourceType: "trainingParticipants",
      resourceId: String(participantId),
    });
  });

  it("meldet nicht, wenn eine neuere Teilnahme existiert", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });
    await t.run((ctx) =>
      ctx.db.patch(participantId, { completedAt: Date.now() - 13 * 30.44 * 24 * 3600 * 1000 })
    );
    // User hat die Wiederholung bereits gestartet → keine Mahnung
    const r2 = await asUser.mutation(api.elearning.start, { trainingId: tid });
    expect(r2.participantId).not.toEqual(participantId);

    await t.mutation(internal.elearning.checkRefreshDue, {});

    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.filter((n) => n.type === "training_refresh_due")).toHaveLength(0);
  });

  it("meldet nicht, wenn Abschluss noch nicht fällig ist", async () => {
    const t = convexTest(schema);
    const { uid, tid } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    await asUser.mutation(api.elearning.complete, { participantId, score: 8, maxScore: 8 });

    await t.mutation(internal.elearning.checkRefreshDue, {});

    const notes = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notes.filter((n) => n.type === "training_refresh_due")).toHaveLength(0);
  });
});

describe("elearning.nachweise + certificateById", () => {
  it("liefert Nachweis-Zeile mit Bogen- und Zertifikat-Verweis (qmb); Fremdzugriff aufs Zertifikat ohne Permission wirft", async () => {
    const t = convexTest(schema);
    const { uid, tid, orgId } = await seedElearningTraining(t);
    const asUser = t.withIdentity({ subject: String(uid) });
    const { participantId } = await asUser.mutation(api.elearning.start, { trainingId: tid });
    const { certificateId } = await asUser.mutation(api.elearning.complete, { participantId, score: 7, maxScore: 8 });
    await asUser.mutation(api.elearning.submitFeedback, {
      participantId, shortReport: WORDS_80, organizationRatings: ORG,
      organizationRatingsNa: ORG_NA, eventRatings: EVENT_OK,
    });
    const qmbId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { firstName: "Q", lastName: "MB", email: "qmb-nachweis@x.de", role: "qmb", status: "active", organizationId: orgId, isArchived: false, createdAt: 1, updatedAt: 1 } as any));
    const asQmb = t.withIdentity({ subject: String(qmbId) });
    const rows = await asQmb.query(api.elearning.nachweise, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 7, certificateId, status: "FEEDBACK_DONE" });
    expect(rows[0].feedbackId).toBeTruthy();
    // Selbstzugriff aufs eigene Zertifikat ok
    const own = await asUser.query(api.elearning.certificateById, { certificateId });
    expect(own).toMatchObject({ score: 7 });
    // Fremder employee ohne trainings:manage → wirft
    const otherId = await t.run(async (ctx: any) =>
      ctx.db.insert("users", { firstName: "F", lastName: "Remd", email: "fremd@x.de", role: "employee", status: "active", organizationId: orgId, isArchived: false, createdAt: 1, updatedAt: 1 } as any));
    const asOther = t.withIdentity({ subject: String(otherId) });
    await expect(asOther.query(api.elearning.certificateById, { certificateId })).rejects.toThrow();
    // qmb darf fremdes Zertifikat lesen
    const byQmb = await asQmb.query(api.elearning.certificateById, { certificateId });
    expect(byQmb).toMatchObject({ score: 7 });
  });
});
