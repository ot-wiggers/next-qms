import { mutation } from "./_generated/server";

/**
 * Seed demo data for development.
 * Run via Convex dashboard: api.seed.run
 */
export const run = mutation({
  handler: async (ctx) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // ============================================================
    // 1. Organization hierarchy
    // ============================================================

    const orgId = await ctx.db.insert("organizations", {
      name: "Sanitätshaus Muster GmbH",
      type: "organization",
      code: "SHM",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const locMainId = await ctx.db.insert("organizations", {
      name: "Hauptstandort München",
      type: "location",
      parentId: orgId,
      code: "MUC",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const locBranchId = await ctx.db.insert("organizations", {
      name: "Filiale Augsburg",
      type: "location",
      parentId: orgId,
      code: "AUG",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const deptQM = await ctx.db.insert("organizations", {
      name: "Qualitätsmanagement",
      type: "department",
      parentId: locMainId,
      code: "QM",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const deptVertrieb = await ctx.db.insert("organizations", {
      name: "Vertrieb",
      type: "department",
      parentId: locMainId,
      code: "VT",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const deptLager = await ctx.db.insert("organizations", {
      name: "Lager & Logistik",
      type: "department",
      parentId: locMainId,
      code: "LL",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const deptWerkstatt = await ctx.db.insert("organizations", {
      name: "Werkstatt",
      type: "department",
      parentId: locBranchId,
      code: "WS",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    // ============================================================
    // 2. Users (8 sample users)
    // ============================================================

    const userAdmin = await ctx.db.insert("users", {
      email: "admin@sanitaetshaus-muster.de",
      firstName: "Thomas",
      lastName: "Müller",
      role: "admin",
      organizationId: orgId,
      locationId: locMainId,
      departmentId: deptQM,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userQMB = await ctx.db.insert("users", {
      email: "qmb@sanitaetshaus-muster.de",
      firstName: "Sabine",
      lastName: "Schmidt",
      role: "qmb",
      organizationId: orgId,
      locationId: locMainId,
      departmentId: deptQM,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userDeptLeadVertrieb = await ctx.db.insert("users", {
      email: "vertrieb-leitung@sanitaetshaus-muster.de",
      firstName: "Michael",
      lastName: "Weber",
      role: "department_lead",
      organizationId: orgId,
      locationId: locMainId,
      departmentId: deptVertrieb,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userDeptLeadLager = await ctx.db.insert("users", {
      email: "lager-leitung@sanitaetshaus-muster.de",
      firstName: "Klaus",
      lastName: "Fischer",
      role: "department_lead",
      organizationId: orgId,
      locationId: locMainId,
      departmentId: deptLager,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userEmployee1 = await ctx.db.insert("users", {
      email: "maria.braun@sanitaetshaus-muster.de",
      firstName: "Maria",
      lastName: "Braun",
      role: "employee",
      organizationId: orgId,
      locationId: locMainId,
      departmentId: deptVertrieb,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userEmployee2 = await ctx.db.insert("users", {
      email: "andreas.wagner@sanitaetshaus-muster.de",
      firstName: "Andreas",
      lastName: "Wagner",
      role: "employee",
      organizationId: orgId,
      locationId: locMainId,
      departmentId: deptLager,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userEmployee3 = await ctx.db.insert("users", {
      email: "laura.becker@sanitaetshaus-muster.de",
      firstName: "Laura",
      lastName: "Becker",
      role: "employee",
      organizationId: orgId,
      locationId: locBranchId,
      departmentId: deptWerkstatt,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    const userAuditor = await ctx.db.insert("users", {
      email: "auditor@extern.de",
      firstName: "Dr. Frank",
      lastName: "Hoffmann",
      role: "auditor",
      organizationId: orgId,
      locationId: locMainId,
      status: "active",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    // ============================================================
    // 3. Trainings (3 with sessions and participants)
    // ============================================================

    const training1 = await ctx.db.insert("trainings", {
      title: "MDR-Grundlagen für Vertriebsmitarbeiter",
      description:
        "Einführung in die Medical Device Regulation (EU 2017/745) mit Fokus auf Beratungspflichten im Sanitätshausbereich.",
      category: "Regulatorik",
      isRequired: true,
      effectivenessCheckAfterDays: 30,
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 30 * day,
      updatedAt: now - 30 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const session1 = await ctx.db.insert("trainingSessions", {
      trainingId: training1,
      scheduledDate: now - 14 * day,
      location: "Konferenzraum A, Hauptstandort",
      trainerName: "Sabine Schmidt (QMB)",
      maxParticipants: 15,
      status: "CLOSED",
      isArchived: false,
      createdAt: now - 30 * day,
      updatedAt: now - 14 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // Add participants to session 1
    await ctx.db.insert("trainingParticipants", {
      sessionId: session1,
      userId: userEmployee1,
      status: "FEEDBACK_DONE",
      attendedAt: now - 14 * day,
      isArchived: false,
      createdAt: now - 14 * day,
      updatedAt: now - 10 * day,
      createdBy: userQMB,
      updatedBy: userEmployee1,
    });

    await ctx.db.insert("trainingParticipants", {
      sessionId: session1,
      userId: userDeptLeadVertrieb,
      status: "FEEDBACK_DONE",
      attendedAt: now - 14 * day,
      isArchived: false,
      createdAt: now - 14 * day,
      updatedAt: now - 12 * day,
      createdBy: userQMB,
      updatedBy: userDeptLeadVertrieb,
    });

    const training2 = await ctx.db.insert("trainings", {
      title: "Hygieneschulung nach RKI-Richtlinien",
      description:
        "Jährliche Pflichtschulung zur Hygiene im Umgang mit Medizinprodukten.",
      category: "Hygiene",
      isRequired: true,
      effectivenessCheckAfterDays: 60,
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 60 * day,
      updatedAt: now - 60 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // Upcoming session
    await ctx.db.insert("trainingSessions", {
      trainingId: training2,
      scheduledDate: now + 7 * day,
      location: "Schulungsraum B",
      trainerName: "Externer Referent",
      maxParticipants: 20,
      status: "PLANNED",
      isArchived: false,
      createdAt: now - 7 * day,
      updatedAt: now - 7 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const training3 = await ctx.db.insert("trainings", {
      title: "Produkteinweisung Kompressionsstrümpfe",
      description: "Anpassung und Beratung bei medizinischen Kompressionsstrümpfen.",
      category: "Produkt",
      isRequired: false,
      effectivenessCheckAfterDays: 45,
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 90 * day,
      updatedAt: now - 90 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // ============================================================
    // 4. Manufacturers & Products
    // ============================================================

    const mfr1 = await ctx.db.insert("manufacturers", {
      name: "medi GmbH & Co. KG",
      country: "Deutschland",
      contactInfo: "Bayreuth, kontakt@medi.de",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const mfr2 = await ctx.db.insert("manufacturers", {
      name: "Ottobock SE & Co. KGaA",
      country: "Deutschland",
      contactInfo: "Duderstadt, info@ottobock.com",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const mfr3 = await ctx.db.insert("manufacturers", {
      name: "Bauerfeind AG",
      country: "Deutschland",
      contactInfo: "Zeulenroda-Triebes",
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const prod1 = await ctx.db.insert("products", {
      name: "mediven elegance Kompressionsstrumpf",
      articleNumber: "MED-001",
      udi: "4046719012345",
      productGroup: "Kompressionstherapie",
      manufacturerId: mfr1,
      riskClass: "I",
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 180 * day,
      updatedAt: now - 180 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const prod2 = await ctx.db.insert("products", {
      name: "C-Brace Orthese",
      articleNumber: "OB-002",
      productGroup: "Orthetik",
      manufacturerId: mfr2,
      riskClass: "IIa",
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 120 * day,
      updatedAt: now - 120 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const prod3 = await ctx.db.insert("products", {
      name: "SofTec Genu Kniebandage",
      articleNumber: "BF-003",
      productGroup: "Bandagen",
      manufacturerId: mfr3,
      riskClass: "I",
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 90 * day,
      updatedAt: now - 90 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const prod4 = await ctx.db.insert("products", {
      name: "Rollator Topro Troja",
      articleNumber: "TP-004",
      productGroup: "Mobilität",
      riskClass: "I",
      status: "ACTIVE",
      isArchived: false,
      createdAt: now - 60 * day,
      updatedAt: now - 60 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    const prod5 = await ctx.db.insert("products", {
      name: "Einlagen-Rohling Ortho",
      articleNumber: "EL-005",
      productGroup: "Einlagen",
      manufacturerId: mfr3,
      riskClass: "I",
      status: "BLOCKED",
      notes: "Wartet auf neue DoC vom Hersteller",
      isArchived: false,
      createdAt: now - 30 * day,
      updatedAt: now - 5 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // ============================================================
    // 5. Declarations of Conformity (3 states)
    // ============================================================

    // Valid DoC
    await ctx.db.insert("declarationsOfConformity", {
      productId: prod1,
      fileId: "" as any, // placeholder — no real file in seed
      fileName: "DoC_MED001_v2.pdf",
      version: "2.0",
      issuedAt: now - 180 * day,
      validFrom: now - 180 * day,
      validUntil: now + 365 * day,
      notifiedBody: "TÜV SÜD",
      certificateNumber: "CE-2023-001",
      status: "VALID",
      isArchived: false,
      createdAt: now - 180 * day,
      updatedAt: now - 180 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // Expiring DoC (within 90 days)
    await ctx.db.insert("declarationsOfConformity", {
      productId: prod2,
      fileId: "" as any,
      fileName: "DoC_OB002_v1.pdf",
      version: "1.0",
      issuedAt: now - 300 * day,
      validFrom: now - 300 * day,
      validUntil: now + 60 * day,
      notifiedBody: "DEKRA",
      status: "EXPIRING",
      isArchived: false,
      createdAt: now - 300 * day,
      updatedAt: now - 5 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // Expired DoC
    await ctx.db.insert("declarationsOfConformity", {
      productId: prod5,
      fileId: "" as any,
      fileName: "DoC_EL005_v1.pdf",
      version: "1.0",
      issuedAt: now - 400 * day,
      validFrom: now - 400 * day,
      validUntil: now - 30 * day,
      status: "EXPIRED",
      isArchived: false,
      createdAt: now - 400 * day,
      updatedAt: now - 30 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // ============================================================
    // 6. Feature Flags
    // ============================================================

    await ctx.db.insert("featureFlags", {
      key: "enforceDocForActiveProduct",
      enabled: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userAdmin,
      updatedBy: userAdmin,
    });

    // ============================================================
    // 7. Sample Tasks
    // ============================================================

    await ctx.db.insert("tasks", {
      type: "GENERAL",
      title: "QM-Handbuch Kapitel 5 überarbeiten",
      description: "Aktualisierung nach letztem Audit-Ergebnis",
      assigneeId: userQMB,
      status: "OPEN",
      priority: "HIGH",
      dueDate: now + 14 * day,
      isArchived: false,
      createdAt: now - 3 * day,
      updatedAt: now - 3 * day,
      createdBy: userAdmin,
      updatedBy: userAdmin,
    });

    await ctx.db.insert("tasks", {
      type: "DOC_EXPIRY_WARNING",
      title: "DoC läuft ab: C-Brace Orthese",
      description: "Konformitätserklärung läuft in 60 Tagen ab. Bitte erneuern.",
      assigneeId: userQMB,
      status: "OPEN",
      priority: "HIGH",
      dueDate: now + 60 * day,
      resourceType: "products",
      resourceId: prod2 as string,
      isArchived: false,
      createdAt: now - 5 * day,
      updatedAt: now - 5 * day,
      createdBy: userAdmin,
      updatedBy: userAdmin,
    });

    await ctx.db.insert("tasks", {
      type: "READ_DOCUMENT",
      title: "Arbeitsanweisung AA-003 lesen",
      assigneeId: userEmployee1,
      status: "OPEN",
      priority: "MEDIUM",
      dueDate: now + 7 * day,
      isArchived: false,
      createdAt: now - 2 * day,
      updatedAt: now - 2 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    await ctx.db.insert("tasks", {
      type: "GENERAL",
      title: "Lieferantenbewertung Q4 durchführen",
      assigneeId: userDeptLeadLager,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: now + 21 * day,
      isArchived: false,
      createdAt: now - 10 * day,
      updatedAt: now - 5 * day,
      createdBy: userAdmin,
      updatedBy: userDeptLeadLager,
    });

    await ctx.db.insert("tasks", {
      type: "TRAINING_FEEDBACK",
      title: "Schulungsfeedback abgeben: Hygieneschulung",
      assigneeId: userEmployee2,
      status: "OPEN",
      priority: "MEDIUM",
      dueDate: now + 3 * day,
      isArchived: false,
      createdAt: now - 1 * day,
      updatedAt: now - 1 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    // ============================================================
    // 8. Document Records
    // ============================================================

    await ctx.db.insert("documentRecords", {
      sanityDocumentId: "qm-handbook-ch1",
      documentType: "qm_handbook",
      documentCode: "QMH-001",
      version: "3.0",
      status: "APPROVED",
      responsibleUserId: userQMB,
      approvedAt: now - 60 * day,
      approvedById: userAdmin,
      isArchived: false,
      createdAt: now - 90 * day,
      updatedAt: now - 60 * day,
      createdBy: userQMB,
      updatedBy: userAdmin,
    });

    await ctx.db.insert("documentRecords", {
      sanityDocumentId: "work-instruction-aa003",
      documentType: "work_instruction",
      documentCode: "AA-003",
      version: "2.1",
      status: "IN_REVIEW",
      responsibleUserId: userQMB,
      reviewerId: userAdmin,
      isArchived: false,
      createdAt: now - 14 * day,
      updatedAt: now - 7 * day,
      createdBy: userQMB,
      updatedBy: userQMB,
    });

    await ctx.db.insert("documentRecords", {
      sanityDocumentId: "form-template-fb001",
      documentType: "form_template",
      documentCode: "FB-001",
      version: "1.0",
      status: "APPROVED",
      responsibleUserId: userQMB,
      approvedAt: now - 120 * day,
      approvedById: userAdmin,
      isArchived: false,
      createdAt: now - 150 * day,
      updatedAt: now - 120 * day,
      createdBy: userQMB,
      updatedBy: userAdmin,
    });

    // ============================================================
    // 9. Training Request
    // ============================================================

    await ctx.db.insert("trainingRequests", {
      requesterId: userEmployee1,
      topic: "Fortbildung: MDR-Klassifizierung Klasse IIa/IIb",
      justification:
        "Für die Beratung bei höher klassifizierten Produkten (Orthesen, Prothesen) benötige ich vertieftes Wissen zur MDR-Klassifizierung.",
      urgency: "MEDIUM",
      estimatedCost: 450,
      status: "REQUESTED",
      isArchived: false,
      createdAt: now - 5 * day,
      updatedAt: now - 5 * day,
      createdBy: userEmployee1,
      updatedBy: userEmployee1,
    });

    return {
      message: "Seed-Daten erfolgreich erstellt",
      counts: {
        organizations: 7,
        users: 8,
        trainings: 3,
        manufacturers: 3,
        products: 5,
        declarations: 3,
        tasks: 5,
        documentRecords: 3,
        trainingRequests: 1,
      },
    };
  },
});
