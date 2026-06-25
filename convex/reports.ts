import { query } from "./_generated/server";
import { requirePermission } from "./lib/withAuth";

type ReportType =
  | "AUDIT" | "MGMT_REVIEW" | "PMS_REPORT" | "DECLARATION" | "CALIBRATION" | "INCOMING_GOODS";

interface ArchiveEntry {
  key: string;            // eindeutig: type + id
  type: ReportType;
  title: string;
  date: number;           // Sortier-/Anzeigedatum
  year: number;
  downloadUrl: string | null; // direktes Storage-PDF, null wenn client-generiert
  href: string;           // Route ins Quell-Modul
}

function yearOf(ts: number): number {
  return new Date(ts).getUTCFullYear();
}

// ============================================================
// archive — aggregiert alle eingefrorenen Nachweise aus den Modulen.
// Read-only, keine Duplizierung. Volltabellen-Scan ok (30-MA-Organisation).
// ponytail: keine Pagination — falls das Archiv > einige hundert Einträge
// wächst, hier Jahres-/Typ-Filter serverseitig nachziehen.
// ============================================================
export const archive = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports:list");

    const entries: ArchiveEntry[] = [];

    // 1. Auditberichte
    const audits = await ctx.db
      .query("audits")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    for (const a of audits) {
      if (!a.reportFileId) continue;
      entries.push({
        key: `AUDIT-${a._id}`,
        type: "AUDIT",
        title: a.title,
        date: a.auditDate ?? a.closedAt ?? a._creationTime,
        year: a.auditYear,
        downloadUrl: await ctx.storage.getUrl(a.reportFileId),
        href: `/audits/${a._id}`,
      });
    }

    // 2. Managementbewertungen
    const reviews = await ctx.db
      .query("managementReviews")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    for (const r of reviews) {
      if (!r.reportFileId) continue;
      entries.push({
        key: `MGMT_REVIEW-${r._id}`,
        type: "MGMT_REVIEW",
        title: `Managementbewertung ${r.year}`,
        date: r.approvedAt ?? r._creationTime,
        year: r.year,
        downloadUrl: await ctx.storage.getUrl(r.reportFileId),
        href: `/management-review/${r._id}`,
      });
    }

    // 3. PMS-Berichte
    const pms = await ctx.db
      .query("pmsReports")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    for (const p of pms) {
      if (!p.reportFileId) continue;
      entries.push({
        key: `PMS_REPORT-${p._id}`,
        type: "PMS_REPORT",
        title: `PMS-Bericht ${p.year}`,
        date: p.approvedAt ?? p._creationTime,
        year: p.year,
        downloadUrl: await ctx.storage.getUrl(p.reportFileId),
        href: `/pms-reports/${p._id}`,
      });
    }

    // 4. Konformitätserklärungen (hochgeladene DoC-PDFs)
    const decls = await ctx.db
      .query("declarationsOfConformity")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const products = await ctx.db.query("products").collect();
    const productName = new Map(products.map((p) => [p._id, p.name]));
    for (const d of decls) {
      if (!d.fileId) continue;
      entries.push({
        key: `DECLARATION-${d._id}`,
        type: "DECLARATION",
        title: `${productName.get(d.productId) ?? "Produkt"} — Konformitätserklärung v${d.version}`,
        date: d.issuedAt,
        year: yearOf(d.issuedAt),
        downloadUrl: await ctx.storage.getUrl(d.fileId),
        href: `/mdr/declarations/${d._id}`,
      });
    }

    // 5. Kalibrierzertifikate
    const cals = await ctx.db
      .query("deviceCalibrations")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const devices = await ctx.db.query("deviceRecords").collect();
    const deviceName = new Map(devices.map((d) => [d._id, `${d.name} (${d.inventoryNumber})`]));
    for (const c of cals) {
      if (!c.certFileId) continue;
      entries.push({
        key: `CALIBRATION-${c._id}`,
        type: "CALIBRATION",
        title: `Kalibrierzertifikat — ${deviceName.get(c.deviceId) ?? "Prüfmittel"}`,
        date: c.calibrationDate,
        year: yearOf(c.calibrationDate),
        downloadUrl: await ctx.storage.getUrl(c.certFileId),
        href: `/devices/${c.deviceId}`,
      });
    }

    // 6. Wareneingangsprüfungen (PDF wird client-seitig erzeugt → kein Storage-Link)
    const checks = await ctx.db
      .query("incomingGoodsChecks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgName = new Map(orgs.map((o) => [o._id, o.name]));
    for (const c of checks) {
      entries.push({
        key: `INCOMING_GOODS-${c._id}`,
        type: "INCOMING_GOODS",
        title: `Wareneingang ${orgName.get(c.locationId) ?? ""} — ${c.manufacturer} (${c.productArea})`,
        date: c.checkDate,
        year: yearOf(c.checkDate),
        downloadUrl: null,
        href: `/incoming-goods/${c._id}`,
      });
    }

    entries.sort((a, b) => b.date - a.date);
    return entries;
  },
});
