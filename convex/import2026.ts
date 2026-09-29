// Einmal-Import der Jahresablage 2026/ (npx convex run, nur intern aufrufbar).
// Alle Mutationen sind idempotent über natürliche Schlüssel — ein erneuter
// Lauf aktualisiert statt zu duplizieren. Ausgeführt von scripts/import-2026.py.
import { v } from "convex/values";
import { internalMutation, internalQuery, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { logAuditEvent } from "./lib/auditLog";

/** Import läuft im Namen des ersten aktiven Admins (Verantwortlicher/createdBy). */
async function importActor(ctx: MutationCtx) {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .collect();
  const actor = admins.find((u) => u.status === "active");
  if (!actor) throw new Error("Kein aktiver Admin für den Import gefunden");
  return actor;
}

/** Text → Tiptap-Dokument (ein Absatz je Leerzeilen-Block, Zeilenumbrüche als hardBreak) */
function toTiptap(text: string) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return {
    type: "doc",
    content: blocks.map((b) => {
      const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
      const content: any[] = [];
      lines.forEach((l, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        content.push({ type: "text", text: l });
      });
      return { type: "paragraph", content };
    }),
  };
}

export const generateUploadUrls = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    const urls: string[] = [];
    for (let i = 0; i < count; i++) urls.push(await ctx.storage.generateUploadUrl());
    return urls;
  },
});

// ============================================================
// Dokumentenlenkung: Kapitel / Prozesse / AA / Formblätter
// ============================================================
export const upsertDocuments = internalMutation({
  args: {
    docs: v.array(v.object({
      documentType: v.union(
        v.literal("qm_handbook"), v.literal("work_instruction"),
        v.literal("form_template"), v.literal("process_description"),
      ),
      documentCode: v.string(),
      title: v.string(),
      version: v.string(),
      validFrom: v.optional(v.number()),
      text: v.string(),
      withRichContent: v.boolean(),  // false: Flussdiagramm/Tabelle — nur Volltext für die Suche
      file: v.object({ fileId: v.id("_storage"), fileName: v.string(), fileSize: v.number() }),
    })),
  },
  handler: async (ctx, { docs }) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    let created = 0, updated = 0;
    for (const d of docs) {
      const existing = (await ctx.db
        .query("documentRecords")
        .withIndex("by_documentCode", (q) => q.eq("documentCode", d.documentCode))
        .collect()).find((r) => r.title === d.title && !r.isArchived);

      const pdfNote = `Freigegebenes Original: ${d.file.fileName} (Anhang). ` +
        `Der folgende Text ist automatisch aus der PDF extrahiert.`;
      const fields = {
        documentType: d.documentType,
        documentCode: d.documentCode,
        title: d.title,
        version: d.version,
        status: "APPROVED" as const,
        validFrom: d.validFrom,
        approvedAt: d.validFrom,
        approvedById: actor._id,
        richContent: d.withRichContent
          ? toTiptap(`${pdfNote}\n\n${d.text}`)
          : toTiptap(`Freigegebenes Original: ${d.file.fileName} (Anhang) — Ablaufdiagramm/Tabelle, bitte die PDF öffnen.`),
        contentPlaintext: `${d.documentCode} ${d.title}\n${d.text}`,
        attachments: [{ ...d.file, uploadedAt: now, uploadedBy: actor._id }],
        reviewIntervalDays: 365,
        requiresReconfirmation: false,
        updatedAt: now,
        updatedBy: actor._id,
      };

      if (existing) {
        // Alten Anhang nur löschen, wenn er ersetzt wird (erneuter Import)
        for (const a of existing.attachments ?? []) {
          if (a.fileId !== d.file.fileId) await ctx.storage.delete(a.fileId);
        }
        await ctx.db.patch(existing._id, fields);
        updated++;
      } else {
        const id = await ctx.db.insert("documentRecords", {
          ...fields,
          responsibleUserId: actor._id,
          isArchived: false,
          createdAt: now,
          createdBy: actor._id,
        });
        await logAuditEvent(ctx, {
          userId: actor._id, action: "CREATE", entityType: "documentRecords", entityId: id,
          metadata: { import2026: true, documentCode: d.documentCode, file: d.file.fileName },
        });
        created++;
      }
    }
    return { created, updated };
  },
});

// ============================================================
// Prüfmittel (FB 7.6.0 Prüfgerätekartei Rev. 3) + Kalibrierungen
// ============================================================
export const upsertDevices = internalMutation({
  args: {
    devices: v.array(v.object({
      inventoryNumber: v.string(),
      name: v.string(),
      manufacturer: v.optional(v.string()),
      serialNumber: v.optional(v.string()),
      location: v.optional(v.string()),
      responsible: v.optional(v.string()),
      calibrationIntervalMonths: v.number(),
      notes: v.optional(v.string()),
      calibration: v.object({
        date: v.number(),
        nextDueDate: v.number(),      // wie in der Kartei eingetragen
        performedBy: v.optional(v.string()),
        notes: v.optional(v.string()),
        certFileId: v.optional(v.id("_storage")),
      }),
    })),
  },
  handler: async (ctx, { devices }) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    const audit = { updatedAt: now, updatedBy: actor._id };
    const result: string[] = [];
    for (const d of devices) {
      const { calibration: c, ...fields } = d;
      const existing = (await ctx.db.query("deviceRecords").collect())
        .find((r) => r.inventoryNumber === d.inventoryNumber && !r.isArchived);
      const deviceFields = {
        ...fields,
        status: "ACTIVE" as const,
        lastCalibrationDate: c.date,
        nextDueDate: c.nextDueDate,
        certFileId: c.certFileId,
        ...audit,
      };
      let deviceId: Id<"deviceRecords">;
      if (existing) {
        await ctx.db.patch(existing._id, deviceFields);
        deviceId = existing._id;
      } else {
        deviceId = await ctx.db.insert("deviceRecords", {
          ...deviceFields, isArchived: false, createdAt: now, createdBy: actor._id,
        });
        await logAuditEvent(ctx, {
          userId: actor._id, action: "CREATE", entityType: "deviceRecords", entityId: deviceId,
          metadata: { import2026: true, inventoryNumber: d.inventoryNumber },
        });
      }
      const cals = await ctx.db.query("deviceCalibrations")
        .withIndex("by_device", (q) => q.eq("deviceId", deviceId)).collect();
      const cal = cals.find((x) => x.calibrationDate === c.date);
      const calFields = {
        deviceId, calibrationDate: c.date, performedBy: c.performedBy,
        result: "PASSED" as const, nextDueDate: c.nextDueDate,
        certFileId: c.certFileId, notes: c.notes, ...audit,
      };
      if (cal) await ctx.db.patch(cal._id, calFields);
      else await ctx.db.insert("deviceCalibrations", {
        ...calFields, isArchived: false, createdAt: now, createdBy: actor._id,
      });
      result.push(`${d.inventoryNumber}${existing ? " (aktualisiert)" : ""}`);
    }
    return result;
  },
});

// ============================================================
// Überwachungsaudit mdc 05.06.2026: 2 Nebenabweichungen → Findings + CAPAs
// ============================================================
export const recordSurveillanceAudit2026 = internalMutation({
  args: {
    auditId: v.id("audits"),
    auditDate: v.number(),
    deviations: v.array(v.object({
      key: v.string(),                 // "Abw. 1/2" — Idempotenz-Marker im Text
      chapter: v.string(),
      description: v.string(),
      capaTitle: v.string(),
      rootCause: v.string(),
      measures: v.array(v.object({ description: v.string(), dueAt: v.number() })),
      dueAt: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    const audit = await ctx.db.get(args.auditId);
    if (!audit || audit.auditType !== "EXTERNAL") throw new Error("Externes Audit nicht gefunden");
    await ctx.db.patch(args.auditId, {
      auditDate: args.auditDate,
      status: audit.status === "PLANNED" ? "IN_PROGRESS" : audit.status,
      updatedAt: now, updatedBy: actor._id,
    });

    const findings = await ctx.db.query("auditFindings")
      .withIndex("by_audit", (q) => q.eq("auditId", args.auditId)).collect();
    const out: string[] = [];
    for (const d of args.deviations) {
      const marker = `[mdc 05.06.2026 ${d.key}]`;
      if (findings.some((f) => f.description.startsWith(marker))) {
        out.push(`${d.key}: bereits vorhanden`);
        continue;
      }
      const year = 2026;
      const existing = await ctx.db.query("capas").withIndex("by_year", (q) => q.eq("year", year)).collect();
      const seq = Math.max(0, ...existing.map((c) => c.seq)) + 1;
      const capaNumber = `CAPA-${year}-${String(seq).padStart(2, "0")}`;
      const findingId = await ctx.db.insert("auditFindings", {
        auditId: args.auditId, chapter: d.chapter, classification: "ABWEICHUNG",
        description: `${marker} Nebenabweichung — ${d.description}`, status: "OPEN",
        isArchived: false, createdAt: now, createdBy: actor._id, updatedAt: now, updatedBy: actor._id,
      });
      const capaId = await ctx.db.insert("capas", {
        capaNumber, year, seq, title: d.capaTitle,
        description: `Aus Überwachungsaudit ISO 13485 (mdc, 05.06.2026), ${d.key}, ${d.chapter}.`,
        capaType: "CORRECTIVE", sourceType: "AUDIT", sourceId: findingId,
        rootCauseAnalysis: d.rootCause, status: "IN_PROGRESS", responsible: "GF / QMB",
        dueAt: d.dueAt,
        isArchived: false, createdAt: now, createdBy: actor._id, updatedAt: now, updatedBy: actor._id,
      });
      await ctx.db.patch(findingId, { capaId });
      for (const m of d.measures) {
        await ctx.db.insert("capaMeasures", {
          capaId, description: m.description, dueAt: m.dueAt, status: "OPEN",
          isArchived: false, createdAt: now, createdBy: actor._id, updatedAt: now, updatedBy: actor._id,
        });
      }
      await logAuditEvent(ctx, {
        userId: actor._id, action: "CREATE", entityType: "capas", entityId: capaId,
        metadata: { import2026: true, capaNumber, fromFinding: findingId },
      });
      out.push(`${d.key}: ${capaNumber}`);
    }
    return out;
  },
});

// ============================================================
// Wareneingangsprüfungen (Papier-Checklisten der Filialen, transkribiert)
// ============================================================
const opt = v.optional;
export const importIncomingGoods = internalMutation({
  args: {
    checks: v.array(v.object({
      locationCode: v.string(),        // HPT | OFD | GSS | BHS
      sourceKey: v.string(),           // Quelldatei — Idempotenz über remarks
      checkDate: v.number(),
      inspectorName: opt(v.string()),
      manufacturer: v.string(),
      productArea: v.string(),
      deliveryDate: opt(v.number()),
      duties: v.any(), labeling: v.any(), identification: v.any(), storage: v.any(), custom: v.any(),
      result: v.union(v.literal("PASSED"), v.literal("FAILED")),
      remarks: v.string(),
      attachmentFileIds: v.array(v.id("_storage")),
    })),
  },
  handler: async (ctx, { checks }) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    const all = await ctx.db.query("incomingGoodsChecks").collect();
    let created = 0, skipped = 0;
    for (const c of checks) {
      const loc = await ctx.db.query("organizations")
        .withIndex("by_code", (q) => q.eq("code", c.locationCode)).first();
      if (!loc) throw new Error(`Filiale ${c.locationCode} nicht gefunden`);
      if (all.some((x) => !x.isArchived && x.remarks?.includes(c.sourceKey))) { skipped++; continue; }
      const { locationCode, sourceKey, ...payload } = c;
      const id = await ctx.db.insert("incomingGoodsChecks", {
        ...payload, locationId: loc._id,
        isArchived: false, createdAt: now, createdBy: actor._id, updatedAt: now, updatedBy: actor._id,
      });
      await logAuditEvent(ctx, {
        userId: actor._id, action: "CREATE", entityType: "incomingGoodsChecks", entityId: id,
        metadata: { import2026: true, source: sourceKey },
      });
      created++;
    }
    return { created, skipped };
  },
});

// ============================================================
// Datenbank Konformitätserklärungen (xlsx) → Hersteller/Produkte/KE
// ============================================================
export const importConformity = internalMutation({
  args: {
    rows: v.array(v.object({
      manufacturer: v.string(),
      name: v.string(),
      productGroup: opt(v.string()),
      ceMarkPresent: opt(v.boolean()),
      instructionsPresent: opt(v.boolean()),
      regulatoryBasis: opt(v.union(v.literal("MDR"), v.literal("DIRECTIVE"))),
      notes: opt(v.string()),
      doc: opt(v.object({
        issuedAt: v.number(),
        validUntil: v.number(),
        externalUrl: opt(v.string()),
        fileName: opt(v.string()),
      })),
    })),
  },
  handler: async (ctx, { rows }) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    const base = { isArchived: false, createdAt: now, createdBy: actor._id, updatedAt: now, updatedBy: actor._id };
    const manufacturers = await ctx.db.query("manufacturers").collect();
    const products = await ctx.db.query("products").collect();
    let seq = products.filter((p) => p.articleNumber.startsWith("KE2026-")).length;
    let createdProducts = 0, createdDocs = 0, skipped = 0;
    for (const r of rows) {
      let m = manufacturers.find((x) => x.name.toLowerCase() === r.manufacturer.toLowerCase() && !x.isArchived);
      if (!m) {
        const mId = await ctx.db.insert("manufacturers", { name: r.manufacturer, ...base });
        m = (await ctx.db.get(mId))!;
        manufacturers.push(m);
      }
      if (products.some((p) => p.manufacturerId === m!._id && p.name === r.name && !p.isArchived)) {
        skipped++;
        continue;
      }
      // Risikoklasse steht nicht in der Quelle — "I" als Platzhalter, Hinweis in notes
      const productId = await ctx.db.insert("products", {
        name: r.name,
        articleNumber: `KE2026-${String(++seq).padStart(4, "0")}`,
        productGroup: r.productGroup,
        manufacturerId: m._id,
        riskClass: "I",
        status: "ACTIVE",
        ceMarkPresent: r.ceMarkPresent,
        instructionsPresent: r.instructionsPresent,
        regulatoryBasis: r.regulatoryBasis,
        migrationRequired: r.regulatoryBasis === "DIRECTIVE" ? true : undefined,
        notes: [r.notes, "Risikoklasse nicht in der Quelldatenbank — bitte prüfen (Import 2026)."]
          .filter(Boolean).join(" | "),
        ...base,
      });
      products.push((await ctx.db.get(productId))!);
      createdProducts++;
      if (r.doc) {
        await ctx.db.insert("declarationsOfConformity", {
          productId,
          version: "1.0",
          fileName: r.doc.fileName,
          issuedAt: r.doc.issuedAt,
          validFrom: r.doc.issuedAt,
          validUntil: r.doc.validUntil,
          status: r.doc.validUntil < now ? "EXPIRED" : "VALID",
          externalUrl: r.doc.externalUrl,
          urlStatus: r.doc.externalUrl ? "UNCHECKED" : undefined,
          ...base,
        });
        createdDocs++;
      }
    }
    await logAuditEvent(ctx, {
      userId: actor._id, action: "CREATE", entityType: "products", entityId: "import2026",
      metadata: { import2026: true, createdProducts, createdDocs, skipped },
    });
    return { createdProducts, createdDocs, skipped };
  },
});

/** Kontrollzählung nach dem Import (npx convex run import2026:summary) */
export const summary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = (await ctx.db.query("documentRecords").collect()).filter((d) => !d.isArchived);
    const byType: Record<string, number> = {};
    for (const d of docs) byType[d.documentType] = (byType[d.documentType] ?? 0) + 1;
    const checks = (await ctx.db.query("incomingGoodsChecks").collect()).filter((c) => !c.isArchived);
    const byLoc: Record<string, number> = {};
    for (const c of checks) {
      const loc = await ctx.db.get(c.locationId);
      byLoc[loc?.code ?? "?"] = (byLoc[loc?.code ?? "?"] ?? 0) + 1;
    }
    return {
      documents: byType,
      withAttachment: docs.filter((d) => (d.attachments?.length ?? 0) > 0).length,
      incomingGoodsByLocation: byLoc,
      devices: (await ctx.db.query("deviceRecords").collect()).filter((d) => !d.isArchived).map((d) => d.inventoryNumber),
      products: (await ctx.db.query("products").collect()).length,
      declarations: (await ctx.db.query("declarationsOfConformity").collect()).length,
      capas: (await ctx.db.query("capas").collect()).map((c) => c.capaNumber).slice(-3),
    };
  },
});

/** Anzeige-Korrektur nach Walkthrough: Version nur als Nummer (UI setzt „v“ davor),
 *  Prüfer/in ohne Transkriptions-Notizen (Original-Lesung wandert in die Bemerkungen). */
const INSPECTOR_FIX: Record<string, string> = {
  "Eversdj (Kürzel, nur ungefähr lesbar)": "Eversdj? (unsicher gelesen)",
  'Kürzel "H.B" mit Schnörkel (unsicher)': "H.B? (unsicher gelesen)",
  "blauer Schnörkel, unleserlich (J. ...ks)": "J. …ks? (unsicher gelesen)",
};
export const tidyLabels = internalMutation({
  args: {},
  handler: async (ctx) => {
    let docs = 0, checks = 0;
    for (const d of await ctx.db.query("documentRecords").collect()) {
      const m = d.version.match(/^Rev\. (\d+)$/);
      const version = m ? m[1] : d.version === "unbekannt" ? "?" : null;
      if (version !== null) { await ctx.db.patch(d._id, { version }); docs++; }
    }
    for (const c of await ctx.db.query("incomingGoodsChecks").collect()) {
      const name = c.inspectorName;
      if (!name || !/Schnörkel|lesbar|Kürzel/.test(name)) continue;
      await ctx.db.patch(c._id, {
        inspectorName: INSPECTOR_FIX[name] ?? "Unterschrift unleserlich",
        remarks: `${c.remarks ?? ""}\nUnterschrift lt. Transkription: ${name}`.trim(),
      });
      checks++;
    }
    return { docs, checks };
  },
});

/** Einmalig vor dem Server-Push: Test-/Probe-Konten (@example.com) samt ihrer
 *  Datensätze und die AC3/AO1-Proben (REK-1970-*, Probe-Aufgaben) entfernen. */
export const purgeServerProbes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const probes = (await ctx.db.query("users").collect()).filter((u) => u.email.endsWith("@example.com"));
    const ids = new Set<string>(probes.map((u) => u._id));
    const del: Record<string, number> = {};
    const drop = async (table: string, id: any) => { await ctx.db.delete(id); del[table] = (del[table] ?? 0) + 1; };

    const complaints = (await ctx.db.query("complaints").collect())
      .filter((c: any) => String(c.complaintNumber ?? "").startsWith("REK-1970-") || ids.has(c.createdBy));
    const gone = new Set<string>(complaints.map((c) => c._id));
    for (const c of complaints) await drop("complaints", c._id);

    for (const t of await ctx.db.query("tasks").collect()) {
      if (ids.has(t.assigneeId) || ids.has(t.createdBy as any) || gone.has(t.resourceId ?? "")) await drop("tasks", t._id);
    }
    for (const n of await ctx.db.query("notifications").collect()) {
      if (ids.has(n.userId) || gone.has(n.resourceId ?? "")) await drop("notifications", n._id);
    }
    for (const r of await ctx.db.query("trainingRequests").collect()) {
      if (ids.has(r.requesterId as any)) await drop("trainingRequests", r._id);
    }
    for (const a of await ctx.db.query("auditLog").collect()) {
      if (a.userId && ids.has(a.userId)) await drop("auditLog", a._id);
    }
    for (const acc of await ctx.db.query("authAccounts").collect()) {
      if (ids.has(acc.userId)) await drop("authAccounts", acc._id);
    }
    for (const s of await ctx.db.query("authSessions").collect()) {
      if (!ids.has(s.userId)) continue;
      for (const rt of await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect()) {
        await drop("authRefreshTokens", rt._id);
      }
      await drop("authSessions", s._id);
    }
    for (const u of probes) await drop("users", u._id);
    return del;
  },
});

/** Titel/Kategorien bereinigen + abgeleitete Dokumentverknüpfungen anlegen (idempotent). */
export const applyDocumentCleanup = internalMutation({
  args: {
    docs: v.array(v.object({
      documentCode: v.string(), oldTitle: v.string(), title: v.string(), category: v.string(),
    })),
    links: v.array(v.object({
      source: v.array(v.string()), target: v.array(v.string()),
      type: v.union(v.literal("implements"), v.literal("references")),
    })),
  },
  handler: async (ctx, args) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    const all = (await ctx.db.query("documentRecords").collect()).filter((d) => !d.isArchived);
    const find = (code: string, title: string) =>
      all.find((d) => d.documentCode === code && d.title === title);

    let renamed = 0;
    for (const r of args.docs) {
      const d = find(r.documentCode, r.oldTitle) ?? find(r.documentCode, r.title);
      if (!d) throw new Error(`Dokument nicht gefunden: ${r.documentCode} ${r.oldTitle}`);
      if (d.title !== r.title || d.category !== r.category) {
        const plain = (d.contentPlaintext ?? "").replace(/^.*\n/, `${r.documentCode} ${r.title}\n`);
        await ctx.db.patch(d._id, { title: r.title, category: r.category, contentPlaintext: plain,
          updatedAt: now, updatedBy: actor._id });
        d.title = r.title;
        renamed++;
      }
    }

    const existing = await ctx.db.query("documentLinks").collect();
    const seen = new Set(existing.map((l) => `${l.sourceDocumentId}|${l.targetDocumentId}|${l.linkType}`));
    let created = 0;
    for (const l of args.links) {
      const s = find(l.source[0], l.source[1]);
      const t = find(l.target[0], l.target[1]);
      if (!s || !t) throw new Error(`Verknüpfung ohne Dokument: ${l.source.join(" ")} → ${l.target.join(" ")}`);
      const key = `${s._id}|${t._id}|${l.type}`;
      if (seen.has(key)) continue;
      await ctx.db.insert("documentLinks", {
        sourceDocumentId: s._id, targetDocumentId: t._id, linkType: l.type,
        createdAt: now, createdBy: actor._id,
      });
      seen.add(key);
      created++;
    }
    return { renamed, linksCreated: created, linksTotal: seen.size };
  },
});

/** Versorgungsspektrum aus den PQ-Versorgungsbereichen markieren (idempotent über hmvNummer). */
export const markSpectrum = internalMutation({
  args: {
    items: v.array(v.object({
      hmvNummer: v.string(),
      hmvLevel: v.union(v.literal("produktgruppe"), v.literal("anwendungsort"),
        v.literal("untergruppe"), v.literal("produktart")),
      displayName: v.string(),
      rehadatId: v.string(),
    })),
  },
  handler: async (ctx, { items }) => {
    const actor = await importActor(ctx);
    const org = (await ctx.db.query("organizations").withIndex("by_type", (q) => q.eq("type", "organization")).first())!;
    const existing = new Set((await ctx.db.query("hmvMarkedItems")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id)).collect()).map((m) => m.hmvNummer));
    const now = Date.now();
    let created = 0;
    for (const it of items) {
      if (existing.has(it.hmvNummer)) continue;
      await ctx.db.insert("hmvMarkedItems", { ...it, organizationId: org._id, isArchived: false,
        createdAt: now, updatedAt: now, createdBy: actor._id, updatedBy: actor._id });
      created++;
    }
    // HMV-Platzhalter „Nicht besetzt“ gehören nicht ins Spektrum
    for (const m of await ctx.db.query("hmvMarkedItems")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id)).collect()) {
      if (m.displayName.includes("Nicht besetzt")) await ctx.db.delete(m._id);
    }
    await logAuditEvent(ctx, { userId: actor._id, action: "CREATE", entityType: "hmvMarkedItems",
      entityId: "import2026-pq", metadata: { import2026: true, created, source: "PQ-Zertifikate + GKV-Kriterienkatalog 28.04.2025" } });
    return { created, skipped: items.length - created };
  },
});

/** HMV-Nummern aus dem Abgleich an die Produkte schreiben (nur eindeutige Treffer). */
export const applyProductHmv = internalMutation({
  args: {
    matches: v.array(v.object({ productId: v.id("products"), hmvNummer: v.string(), hmvName: v.string() })),
  },
  handler: async (ctx, { matches }) => {
    const actor = await importActor(ctx);
    const now = Date.now();
    let updated = 0;
    for (const m of matches) {
      const p = await ctx.db.get(m.productId);
      if (!p || p.hmvNummer === m.hmvNummer) continue;
      const note = `HMV-Abgleich 2026: ${m.hmvNummer} „${m.hmvName}“`;
      await ctx.db.patch(p._id, {
        hmvNummer: m.hmvNummer,
        productGroup: p.productGroup ?? m.hmvNummer.slice(0, 2),
        notes: [p.notes, note].filter(Boolean).join(" | "),
        updatedAt: now, updatedBy: actor._id,
      });
      updated++;
    }
    return { updated };
  },
});
