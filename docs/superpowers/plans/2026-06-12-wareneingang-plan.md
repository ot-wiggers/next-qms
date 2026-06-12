# Wareneingangsprüfung: MDR-Checkliste + Filial-Überwachung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Platzhalter-Modul „Wareneingang" wird zur vollwertigen MDR-Art.-14-Wareneingangsprüfung — portiert aus der bestehenden Eurocom-Checklisten-App (alle Inhalte/Felder), auf Convex statt SharePoint, mit Unterschrift + Foto/Anhängen, PDF-Export, Ampel-Übersicht Filiale×Monat und wöchentlichen Erinnerungsmails ab dem 15., solange eine Filiale im Monat keine Prüfung erfasst hat.

**Architecture:** Die Filialen sind die **bestehenden Standorte** (`organizations` mit `type: "location"`, fertiger Verwaltungs-Tab) — sie bekommen nur ein neues Feld `reminderEmails` und werden mit den 4 Standorten aus der Quell-App geseedet. Die Prüfung ist EIN Datensatz `incomingGoodsChecks` mit strukturierten Abschnitts-Objekten (duties/labeling/identification/storage/custom), gespiegelt aus dem `FormData`-Interface der Quell-App. Statt des 7-Schritte-Wizards der Quelle: **eine Erfassungsseite mit 7 Abschnitts-Cards** (Hausmuster, Tablet-tauglich, weniger Code, identische Inhalte). Unterschrift als Canvas-Pad (Port, shadcn-Dialog-Variante) → PNG in Convex-Storage; Anhänge per Datei-Input (`capture="environment"` öffnet auf Tablets die Kamera). PDF-Export als neuer Haus-Stil-jsPDF-Exporter wie Audit/Managementbewertung — bewusst KEIN Port des 977-Zeilen-Eurocom-Generators (SharePoint-/Icon-/EmailJS-verwoben; Inhalte sind vollständig, Wartbarkeit schlägt Branding). Erinnerungen: täglicher Cron, sendet am 15./22./29. via Resend (Muster aus `convex/email.ts`), Dedup über Log-Tabelle `incomingGoodsReminders`.

**Tech Stack:** Next.js 15 (App Router), Convex (Storage, Crons, internalAction + Resend), Tailwind v4 + shadcn/ui, jsPDF.

**Verifikation:** Kein Test-Framework — Hauskonvention: `npx tsc --noEmit` (+ `npx convex dev --once` bei Convex-Tasks) und Commit pro Task; am Ende Browser-Walkthrough (Memory „Runtime-Verifikation Pflicht") inkl. manuellem Reminder-Testlauf per `npx convex run`.

**Beschluss-Referenz:** Grill-me-Interview 2026-06-12, Punkte 6+7 (Memory `qm-backlog-beschluesse-2026-06`): Port aus `/Users/kristofeilers/Development/Checkliste Wareneingang/wareneingang-app`; mitnehmen: Unterschrift + Foto/Anhänge; weglassen: Barcode-Scanner (spätere Ausbaustufe), OCR, EmailJS-Versand. NEU: Filial-Stammdaten (Name + E-Mail) in der Verwaltung; Monats-Überwachung pro Filiale — Erinnerungsmail ab dem 15. wöchentlich, bis eine Prüfung mit Datum im laufenden Monat erfasst ist; Ampel-Übersicht Filiale×Monat.

**Verifizierte Fakten (2026-06-12):**
- Quell-Datenmodell: `wareneingang-app/src/types/form.ts` — 71 Felder in 7 Abschnitten; die 8 MDR-Fragen stehen wörtlich in `PruefpflichtenSection.tsx`; 22 Produktbereiche in `StammdatenSection.tsx`; Standorte der Quelle: Bremer Heerstraße, Gerhard-Stalling-Straße, Ofenerdieker Straße, Hauptstraße (= Filial-Seed). Die Quelle hat zwei redundante Checkboxen `anforderungenErfuellt`/`anforderungenNichtErfuellt` → konsolidiert zu `result: PASSED|FAILED` + `failureReason`.
- `organizations`-Tabelle (schema.ts:223) unterstützt `type: "location"`; Admin-Tab „Standorte" (`components/domain/admin/locations-tab.tsx`) hat fertiges CRUD über `organizations.create/update/archive` (Permission `admin:settings`); aktuell existiert NUR die Organisation „Wiggers GmbH & Co. KG" (`ns75jyfp3sqnsjjebtnfjc83ks88cvj2`), KEINE locations.
- Platzhalter: `incomingGoodsChecks` ist Stub (`status: v.literal("PLACEHOLDER")`, schema.ts:1021) und die Tabelle ist LEER — darf ersetzt werden. Feature-Flag `INCOMING_GOODS` existiert und ist aktiv (Sidebar-Eintrag „Wareneingang" mit Badge „IN PLANUNG" in Gruppe „Prüfungen").
- E-Mail: `convex/email.ts` sendet direkt via `fetch("https://api.resend.com/emails")` mit `process.env.RESEND_API_KEY` (fehlt der Key → silently skip) und `from: "QMS <noreply@qms.example.com>"`. Crons: `convex/crons.ts`, tägliche Slots bis 04:00 UTC belegt.
- Permissions: `lib/types/domain.ts` PermissionAction-Union (endet auf `| "admin:settings" | "admin:featureFlags"`), RBAC-Matrix in `convex/lib/permissions.ts` (admin = Wildcard).
- Storage-Upload-Muster (audit [id]/page.tsx): `generateUploadUrl`-Mutation → `fetch(postUrl, { method: "POST", headers: { "Content-Type": ... }, body: blob })` → `{ storageId }`.

**Dateistruktur:**

| Datei | Aktion | Verantwortung |
|---|---|---|
| `lib/types/enums.ts` | Modify | PRODUCT_AREAS, MDR_DUTY_QUESTIONS, STORAGE_FLAGS, Ergebnis-Labels |
| `lib/types/domain.ts` + `convex/lib/permissions.ts` | Modify | `incomingGoods:list/record/manage` + RBAC |
| `convex/schema.ts` | Modify | incomingGoodsChecks (echt), incomingGoodsReminders, organizations.reminderEmails |
| `convex/organizations.ts` | Modify | reminderEmails in create/update; seedLocations |
| `components/domain/admin/locations-tab.tsx` | Modify | E-Mail-Feld + Spalte |
| `convex/incomingGoods.ts` | Create | CRUD, Queries (list/getById/monthlyStatus), Upload, Reminder (Action+Helpers) |
| `convex/crons.ts` | Modify | täglicher Reminder-Check |
| `components/domain/incoming-goods/yes-no-field.tsx` | Create | Ja/Nein-Umschalter (3-Zustand) |
| `components/domain/incoming-goods/signature-pad.tsx` | Create | Unterschrift (Canvas, Port) |
| `components/domain/incoming-goods/check-form.tsx` | Create | Erfassungsmaske (7 Abschnitte, create+edit) |
| `app/(dashboard)/incoming-goods/page.tsx` | Replace | Liste mit Filtern + Ampel-Tab |
| `app/(dashboard)/incoming-goods/new/page.tsx` | Create | Neue Prüfung |
| `app/(dashboard)/incoming-goods/[id]/page.tsx` | Create | Detail (read-only) + PDF + Bearbeiten |
| `app/(dashboard)/incoming-goods/[id]/edit/page.tsx` | Create | Bearbeiten (manage) |
| `lib/export/incoming-goods-exporter.ts` | Create | PDF (Haus-Stil, inkl. Unterschrift) |
| `components/layout/sidebar.tsx` | Modify | Badge „IN PLANUNG" bei Wareneingang entfernen |

**Ausführungskontext:** Branch: `git checkout -b feature/wareneingang` (vor Task 1). Convex-Push nach jedem Convex-Task: `npx convex dev --once`.

---

### Task 1: Enums + Permissions

**Files:**
- Modify: `lib/types/enums.ts` (ans Dateiende)
- Modify: `lib/types/domain.ts` (PermissionAction-Union)
- Modify: `convex/lib/permissions.ts` (RBAC-Matrix)

- [ ] **Step 1: Enums anfügen** — ans Ende von `lib/types/enums.ts`:

```ts
// ============================================================
// Wareneingangsprüfung (MDR Art. 14, AA 7.4.3) — portiert aus der
// Eurocom-Checklisten-App (wareneingang-app, Stand 11-2020)
// ============================================================

// Produktbereiche (Hilfsmittelverzeichnis-Gruppen) — exakt wie Quell-App
export const PRODUCT_AREAS = [
  "02 - Adaptionshilfen",
  "04 - Bade- und Duschhilfen",
  "05 - Bandagen",
  "08 - Einlagen",
  "10 - Gehhilfen",
  "11 - Hilfsmittel gegen Dekubitus",
  "17 - Kompressionstherapie",
  "18 - Kranken- / Behindertenfahrzeuge",
  "19 - Krankenpflegeartikel",
  "20 - Lagerungshilfen",
  "21 - Messgeräte",
  "22 - Mobilitätshilfen",
  "23 - Orthesen / Schienen",
  "24 - Beinprothesen",
  "26 - Sitzhilfen",
  "28 - Stehhilfen",
  "31 - Schuhe",
  "32 - Therapeutische Bewegungsgeräte",
  "33 - Toilettenhilfen",
  "38 - Armprothesen",
  "50 - Pflegehilfsmittel",
  "99 - Verschiedenes",
] as const;

// Die 8 Prüfpflichten des Händlers nach Art. 14 MDR — Fragen wörtlich aus der Quell-App
export const MDR_DUTY_QUESTIONS = [
  { key: "isMedizinprodukt", question: "Handelt es sich bei dem Produkt um ein Medizinprodukt oder Zubehör?" },
  { key: "hasCeKennzeichnung", question: "Trägt das Produkt die CE-Kennzeichnung bzw. die Kennzeichnung als Sonderanfertigung?" },
  { key: "hasHerstellerInfos", question: "Liegen dem Produkt die vom Hersteller gemäß Art. 10 (11) MDR bereitzustellenden Informationen bei (z. B. Gebrauchsanweisung)?" },
  { key: "hasEuKonformitaet", question: "Wurde eine EU-Konformitätserklärung für das Produkt ausgestellt?" },
  { key: "hasUdi", question: "Wurde vom Hersteller eine UDI vergeben?" },
  { key: "hasLagerungBedingungen", question: "Wurden die Lagerungs- und Transportbedingungen vom Hersteller berücksichtigt?" },
  { key: "entsprichtMdr", question: "Entspricht das Produkt den Anforderungen der MDR?" },
  { key: "keineGefahr", question: "Stellt das Produkt keine schwerwiegende Gefahr dar?" },
] as const;
export type MdrDutyKey = (typeof MDR_DUTY_QUESTIONS)[number]["key"];

// Lagerungs-/Handhabungssymbole — exakt wie Quell-App
export const STORAGE_FLAGS = [
  { key: "trockenLagern", label: "Trocken lagern" },
  { key: "sonnenlichtSchutz", label: "Vor Sonnenlicht schützen" },
  { key: "zerbrechlich", label: "Zerbrechlich" },
  { key: "temperaturbegrenzung", label: "Temperaturbegrenzung" },
  { key: "luftfeuchte", label: "Luftfeuchte, Begrenzung" },
] as const;
export type StorageFlagKey = (typeof STORAGE_FLAGS)[number]["key"];

export const INCOMING_RESULTS = ["PASSED", "FAILED"] as const;
export type IncomingResult = (typeof INCOMING_RESULTS)[number];
export const INCOMING_RESULT_LABELS: Record<IncomingResult, string> = {
  PASSED: "Anforderungen erfüllt — Ware freigegeben",
  FAILED: "Anforderungen nicht erfüllt — Ware gesperrt",
};
```

- [ ] **Step 2: PermissionAction erweitern** — in `lib/types/domain.ts` in der Union vor `| "admin:settings"` einfügen:

```ts
  | "incomingGoods:list" | "incomingGoods:record" | "incomingGoods:manage"
```

- [ ] **Step 3: RBAC erweitern** — in `convex/lib/permissions.ts`:

In `qmb` (nach `"pmsReports:list", "pmsReports:manage", "pmsReports:approve",`):

```ts
    "incomingGoods:list", "incomingGoods:record", "incomingGoods:manage",
```

In `department_lead` (nach `"pmsReports:list",`):

```ts
    "incomingGoods:list", "incomingGoods:record", "incomingGoods:manage",
```

In `employee` (nach `"complaints:list", "complaints:create",`) — Filial-Mitarbeitende erfassen die Prüfungen selbst:

```ts
    "incomingGoods:list", "incomingGoods:record",
```

In `auditor` (nach `"pmsReports:list",`):

```ts
    "incomingGoods:list",
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add lib/types/enums.ts lib/types/domain.ts convex/lib/permissions.ts
git commit -m "feat(wareneingang): Enums (Produktbereiche, MDR-Pflichten, Lagerungssymbole) + Permissions"
```

---

### Task 2: Schema — echte Tabellen + reminderEmails

**Files:**
- Modify: `convex/schema.ts` (organizations ~Zeile 223; Platzhalter-Block ~Zeile 1020)

- [ ] **Step 1: `reminderEmails` an organizations** — im `organizations`-defineTable nach `code: v.string(),` einfügen:

```ts
    // Wareneingangs-Erinnerungen (nur type "location"): Empfänger, kommagetrennt
    reminderEmails: v.optional(v.string()),
```

- [ ] **Step 2: Platzhalter `incomingGoodsChecks` ersetzen** — den Stub-Block

```ts
  // TODO: Phase 4 — Wareneingang & Stichproben
  incomingGoodsChecks: defineTable({
    title: v.optional(v.string()),
    status: v.literal("PLACEHOLDER"),
    ...auditFields,
  }),
```

ersetzen durch (Tabelle ist leer — verifiziert; Struktur gespiegelt aus `FormData` der Quell-App):

```ts
  // Wareneingangsprüfung (MDR Art. 14, AA 7.4.3) — portiert aus der
  // Eurocom-Checklisten-App; Abschnitte gespiegelt aus deren FormData
  incomingGoodsChecks: defineTable({
    locationId: v.id("organizations"),       // Filiale (type "location")
    checkDate: v.number(),                   // Prüfdatum — Basis der Monats-Überwachung
    inspectorName: v.optional(v.string()),   // Prüfer/in
    // 1. Stammdaten
    manufacturer: v.string(),
    productArea: v.string(),                 // PRODUCT_AREAS
    deliveryDate: v.optional(v.number()),
    // 2. Allgemeine Prüfpflichten MDR Art. 14 (undefined = nicht beantwortet)
    duties: v.object({
      isMedizinprodukt: v.optional(v.boolean()),
      hasCeKennzeichnung: v.optional(v.boolean()),
      hasHerstellerInfos: v.optional(v.boolean()),
      hasEuKonformitaet: v.optional(v.boolean()),
      hasUdi: v.optional(v.boolean()),
      hasLagerungBedingungen: v.optional(v.boolean()),
      entsprichtMdr: v.optional(v.boolean()),
      keineGefahr: v.optional(v.boolean()),
    }),
    // 3. Kennzeichnung nach Anhang I 23.2 MDR
    labeling: v.object({
      produktName: v.optional(v.string()),
      ceKennzeichnung: v.optional(v.boolean()),
      herstellerName: v.optional(v.string()),
      haendlerName: v.optional(v.string()),
      importeursName: v.optional(v.string()),
      bevollmaechtigten: v.optional(v.string()),
    }),
    // 4. Produktidentifikation
    identification: v.object({
      hasRef: v.optional(v.boolean()), ref: v.optional(v.string()),
      hasLot: v.optional(v.boolean()), lot: v.optional(v.string()),
      hasSn: v.optional(v.boolean()), sn: v.optional(v.string()),
      hasUdiTraeger: v.optional(v.boolean()), udiTraeger: v.optional(v.string()),
      haltbarkeitsdatum: v.optional(v.string()),  // Freitext wie Quelle
      herstelldatum: v.optional(v.string()),
    }),
    // 5. Lagerung/Handhabung + Hinweise
    storage: v.object({
      trockenLagern: v.optional(v.boolean()),
      sonnenlichtSchutz: v.optional(v.boolean()),
      zerbrechlich: v.optional(v.boolean()),
      temperaturbegrenzung: v.optional(v.boolean()),
      luftfeuchte: v.optional(v.boolean()),
      warnhinweise: v.optional(v.string()),
      gebrauchshinweise: v.optional(v.string()),
      patientHinweise: v.optional(v.string()),
      aufbereitungszyklen: v.optional(v.string()),
      beschraenkungZyklen: v.optional(v.string()),
    }),
    // 6. Sonderanfertigung
    custom: v.object({
      isSonderanfertigung: v.optional(v.boolean()),
      mdKennzeichnung: v.optional(v.boolean()),
      nurKlinischePruefung: v.optional(v.boolean()),
      sichereEntsorgung: v.optional(v.string()),
    }),
    // 7. Stichproben-Kontrolle → Ergebnis
    result: v.union(v.literal("PASSED"), v.literal("FAILED")),
    failureReason: v.optional(v.string()),
    remarks: v.optional(v.string()),
    // Nachweise
    signatureFileId: v.optional(v.id("_storage")),
    attachmentFileIds: v.optional(v.array(v.id("_storage"))),
    ...auditFields,
  })
    .index("by_location", ["locationId"])
    .index("by_checkDate", ["checkDate"]),

  // Versandprotokoll der Monats-Erinnerungen (Dedup pro Filiale/Monat/Tag)
  incomingGoodsReminders: defineTable({
    locationId: v.id("organizations"),
    year: v.number(),
    month: v.number(),                      // 1–12
    sentAt: v.number(),
    recipients: v.string(),
    ...auditFields,
  }).index("by_location_month", ["locationId", "year", "month"]),
```

- [ ] **Step 3: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(wareneingang): Schema — incomingGoodsChecks (echt), Reminder-Log, reminderEmails an Standorten"
```

---

### Task 3: Standorte — reminderEmails + Seed + Verwaltungs-UI

**Files:**
- Modify: `convex/organizations.ts` (create/update + seedLocations ans Dateiende)
- Modify: `components/domain/admin/locations-tab.tsx`

- [ ] **Step 1: `create`-Mutation erweitern** — in den `args` nach `code: v.string(),` einfügen:

```ts
    reminderEmails: v.optional(v.string()),
```

(Der Handler nutzt `...args` — keine weitere Änderung nötig.)

- [ ] **Step 2: `update`-Mutation erweitern** — in den `args` nach `code: v.optional(v.string()),` einfügen:

```ts
    reminderEmails: v.optional(v.string()),
```

(Der Handler spreadet `...updates` — kein weiterer Eingriff; leerer String wird gespeichert, das ist ok: die Reminder-Logik behandelt leer wie fehlend.)

- [ ] **Step 3: `seedLocations` ans Dateiende von `convex/organizations.ts`:**

```ts
// ============================================================
// seedLocations — Einmal-Seed (npx convex run): die 4 Filialen aus der
// Wareneingang-Quell-App als Standorte anlegen (Dedup über code).
// reminderEmails bleiben leer — Pflege durch Admin im Standorte-Tab.
// ============================================================

export const seedLocations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const SEED = [
      { name: "Bremer Heerstraße", code: "BHS" },
      { name: "Gerhard-Stalling-Straße", code: "GSS" },
      { name: "Ofenerdieker Straße", code: "OFD" },
      { name: "Hauptstraße", code: "HPT" },
    ];
    const parent = await ctx.db
      .query("organizations")
      .withIndex("by_type", (q) => q.eq("type", "organization"))
      .first();
    const existing = await ctx.db.query("organizations").collect();
    const existingCodes = new Set(existing.map((o) => o.code));

    const now = Date.now();
    let created = 0;
    for (const loc of SEED) {
      if (existingCodes.has(loc.code)) continue;
      const id = await ctx.db.insert("organizations", {
        name: loc.name,
        code: loc.code,
        type: "location",
        parentId: parent?._id,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      await logAuditEvent(ctx, {
        action: "CREATE",
        entityType: "organizations",
        entityId: id,
        metadata: { seed: "wareneingang-locations", name: loc.name },
      });
      created++;
    }
    return { created, skipped: SEED.length - created };
  },
});
```

Falls `internalMutation` in `convex/organizations.ts` noch nicht importiert ist: den Server-Import um `internalMutation` ergänzen.

- [ ] **Step 4: LocationsTab erweitern** — in `components/domain/admin/locations-tab.tsx`:

1. `OrgRow` um `reminderEmails?: string;` ergänzen.
2. Beide Form-States um das Feld erweitern: `useState({ name: "", code: "", parentId: "", reminderEmails: "" })` bzw. in `openEdit`: `reminderEmails: row.reminderEmails ?? ""`.
3. In `handleCreate` und `handleEdit` an die Mutation übergeben: `reminderEmails: form.reminderEmails` bzw. `editForm.reminderEmails`.
4. In BEIDEN Dialogen nach dem Kürzel-Feld einfügen:

```tsx
                <div className="space-y-2">
                  <Label>Erinnerungs-E-Mails (Wareneingang)</Label>
                  <Input
                    value={form.reminderEmails}
                    onChange={(e) => setForm({ ...form, reminderEmails: e.target.value })}
                    placeholder="filiale@example.de, leitung@example.de"
                  />
                  <p className="text-xs text-muted-foreground">
                    Kommagetrennt — erhält ab dem 15. wöchentlich eine Erinnerung,
                    solange im Monat keine Wareneingangsprüfung erfasst wurde.
                  </p>
                </div>
```

(im Edit-Dialog entsprechend `editForm.reminderEmails` / `setEditForm`).
5. Neue Spalte in `columns` nach „Kürzel":

```tsx
    {
      key: "reminderEmails",
      header: "Erinnerungs-E-Mails",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.reminderEmails || "—"}</span>
      ),
    },
```

- [ ] **Step 5: Typecheck + Push + Seed ausführen**

```bash
npx tsc --noEmit && npx convex dev --once
npx convex run organizations:seedLocations
```

Expected: `{ created: 4, skipped: 0 }`

- [ ] **Step 6: Commit**

```bash
git add convex/organizations.ts components/domain/admin/locations-tab.tsx
git commit -m "feat(wareneingang): Standorte — reminderEmails-Feld, Verwaltungs-UI, Seed der 4 Filialen"
```

---

### Task 4: Convex — CRUD + Queries

**Files:**
- Create: `convex/incomingGoods.ts`

- [ ] **Step 1: Datei anlegen** — `convex/incomingGoods.ts`:

```ts
import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/withAuth";
import { logAuditEvent } from "./lib/auditLog";
import { archiveRecord } from "./lib/softDelete";

// ============================================================
// Wareneingangsprüfung (MDR Art. 14, AA 7.4.3)
// Abschnitts-Validatoren gespiegelt aus convex/schema.ts
// ============================================================

const dutiesArg = v.object({
  isMedizinprodukt: v.optional(v.boolean()),
  hasCeKennzeichnung: v.optional(v.boolean()),
  hasHerstellerInfos: v.optional(v.boolean()),
  hasEuKonformitaet: v.optional(v.boolean()),
  hasUdi: v.optional(v.boolean()),
  hasLagerungBedingungen: v.optional(v.boolean()),
  entsprichtMdr: v.optional(v.boolean()),
  keineGefahr: v.optional(v.boolean()),
});
const labelingArg = v.object({
  produktName: v.optional(v.string()),
  ceKennzeichnung: v.optional(v.boolean()),
  herstellerName: v.optional(v.string()),
  haendlerName: v.optional(v.string()),
  importeursName: v.optional(v.string()),
  bevollmaechtigten: v.optional(v.string()),
});
const identificationArg = v.object({
  hasRef: v.optional(v.boolean()), ref: v.optional(v.string()),
  hasLot: v.optional(v.boolean()), lot: v.optional(v.string()),
  hasSn: v.optional(v.boolean()), sn: v.optional(v.string()),
  hasUdiTraeger: v.optional(v.boolean()), udiTraeger: v.optional(v.string()),
  haltbarkeitsdatum: v.optional(v.string()),
  herstelldatum: v.optional(v.string()),
});
const storageArg = v.object({
  trockenLagern: v.optional(v.boolean()),
  sonnenlichtSchutz: v.optional(v.boolean()),
  zerbrechlich: v.optional(v.boolean()),
  temperaturbegrenzung: v.optional(v.boolean()),
  luftfeuchte: v.optional(v.boolean()),
  warnhinweise: v.optional(v.string()),
  gebrauchshinweise: v.optional(v.string()),
  patientHinweise: v.optional(v.string()),
  aufbereitungszyklen: v.optional(v.string()),
  beschraenkungZyklen: v.optional(v.string()),
});
const customArg = v.object({
  isSonderanfertigung: v.optional(v.boolean()),
  mdKennzeichnung: v.optional(v.boolean()),
  nurKlinischePruefung: v.optional(v.boolean()),
  sichereEntsorgung: v.optional(v.string()),
});
const resultArg = v.union(v.literal("PASSED"), v.literal("FAILED"));

const checkPayloadArgs = {
  locationId: v.id("organizations"),
  checkDate: v.number(),
  inspectorName: v.optional(v.string()),
  manufacturer: v.string(),
  productArea: v.string(),
  deliveryDate: v.optional(v.number()),
  duties: dutiesArg,
  labeling: labelingArg,
  identification: identificationArg,
  storage: storageArg,
  custom: customArg,
  result: resultArg,
  failureReason: v.optional(v.string()),
  remarks: v.optional(v.string()),
  signatureFileId: v.optional(v.id("_storage")),
  attachmentFileIds: v.optional(v.array(v.id("_storage"))),
};

/** Gemeinsame Payload-Validierung für create/update */
async function validatePayload(
  ctx: MutationCtx,
  args: { locationId: Id<"organizations">; manufacturer: string; result: "PASSED" | "FAILED"; failureReason?: string },
) {
  const location = await ctx.db.get(args.locationId);
  if (!location || location.isArchived || location.type !== "location") {
    throw new Error("Ungültige Filiale");
  }
  if (!args.manufacturer.trim()) throw new Error("Hersteller ist erforderlich");
  if (args.result === "FAILED" && !args.failureReason?.trim()) {
    throw new Error("Bei „nicht erfüllt“ ist eine Begründung erforderlich");
  }
}

// ============================================================
// list — alle Prüfungen mit Filialname (Filter macht der Client)
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "incomingGoods:list");
    const checks = await ctx.db
      .query("incomingGoodsChecks")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgName = new Map(orgs.map((o) => [o._id, o.name]));
    return checks
      .sort((a, b) => b.checkDate - a.checkDate)
      .map((c) => ({
        _id: c._id,
        checkDate: c.checkDate,
        locationId: c.locationId,
        locationName: orgName.get(c.locationId) ?? "—",
        manufacturer: c.manufacturer,
        productArea: c.productArea,
        result: c.result,
        inspectorName: c.inspectorName,
      }));
  },
});

// ============================================================
// getById — Prüfung + Filialname + Datei-URLs (Unterschrift, Anhänge)
// ============================================================

export const getById = query({
  args: { id: v.id("incomingGoodsChecks") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "incomingGoods:list");
    const check = await ctx.db.get(args.id);
    if (!check) return null;
    const location = await ctx.db.get(check.locationId);
    const signatureUrl = check.signatureFileId
      ? await ctx.storage.getUrl(check.signatureFileId)
      : null;
    const attachments = await Promise.all(
      (check.attachmentFileIds ?? []).map(async (fileId) => ({
        fileId,
        url: await ctx.storage.getUrl(fileId),
      })),
    );
    return {
      ...check,
      locationName: location?.name ?? "—",
      signatureUrl,
      attachments,
    };
  },
});

// ============================================================
// monthlyStatus — Ampel Filiale × Monat (Anzahl Prüfungen je Monat)
// ============================================================

export const monthlyStatus = query({
  args: { year: v.number() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "incomingGoods:list");
    const yearStart = Date.UTC(args.year, 0, 1);
    const yearEnd = Date.UTC(args.year + 1, 0, 1);

    const locations = (await ctx.db.query("organizations").collect())
      .filter((o) => o.type === "location" && !o.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    const checks = (
      await ctx.db
        .query("incomingGoodsChecks")
        .withIndex("by_checkDate", (q) => q.gte("checkDate", yearStart).lt("checkDate", yearEnd))
        .collect()
    ).filter((c) => !c.isArchived);

    const rows = locations.map((loc) => {
      const months = Array.from({ length: 12 }, () => 0);
      for (const c of checks) {
        if (c.locationId !== loc._id) continue;
        months[new Date(c.checkDate).getUTCMonth()]++;
      }
      return {
        locationId: loc._id,
        name: loc.name,
        hasReminderEmails: !!loc.reminderEmails?.trim(),
        months,
      };
    });

    return { year: args.year, rows };
  },
});

// ============================================================
// create / update / archive / Upload
// ============================================================

export const create = mutation({
  args: checkPayloadArgs,
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "incomingGoods:record");
    await validatePayload(ctx, args);

    const now = Date.now();
    const id = await ctx.db.insert("incomingGoodsChecks", {
      ...args,
      manufacturer: args.manufacturer.trim(),
      inspectorName: args.inspectorName?.trim() || `${user.firstName} ${user.lastName}`,
      failureReason: args.failureReason?.trim() || undefined,
      remarks: args.remarks?.trim() || undefined,
      isArchived: false,
      createdAt: now, createdBy: user._id,
      updatedAt: now, updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "CREATE",
      entityType: "incomingGoodsChecks", entityId: id,
      metadata: { manufacturer: args.manufacturer, productArea: args.productArea, result: args.result },
    });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("incomingGoodsChecks"), ...checkPayloadArgs },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "incomingGoods:manage");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.isArchived) throw new Error("Prüfung nicht gefunden");
    await validatePayload(ctx, args);

    const { id, ...payload } = args;
    await ctx.db.patch(id, {
      ...payload,
      manufacturer: payload.manufacturer.trim(),
      inspectorName: payload.inspectorName?.trim() || undefined,
      failureReason: payload.failureReason?.trim() || undefined,
      remarks: payload.remarks?.trim() || undefined,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
    await logAuditEvent(ctx, {
      userId: user._id, action: "UPDATE",
      entityType: "incomingGoodsChecks", entityId: id,
      changes: { manufacturer: payload.manufacturer, result: payload.result },
    });
  },
});

export const archive = mutation({
  args: { id: v.id("incomingGoodsChecks") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "incomingGoods:manage");
    await archiveRecord(ctx, "incomingGoodsChecks", args.id, user._id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "incomingGoods:record");
    return await ctx.storage.generateUploadUrl();
  },
});
```

- [ ] **Step 2: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add convex/incomingGoods.ts
git commit -m "feat(wareneingang): Convex — CRUD, Listen-/Detail-/Ampel-Queries, Storage-Upload"
```

---

### Task 5: Reminder — internalAction + Cron

**Files:**
- Modify: `convex/incomingGoods.ts` (ans Dateiende)
- Modify: `convex/crons.ts`

Beschluss: Erinnerung ab dem 15. wöchentlich (15./22./29.), bis die Filiale eine Prüfung mit Datum im laufenden Monat erfasst hat. Resend-Muster + Silent-Skip ohne API-Key exakt wie `convex/email.ts`.

- [ ] **Step 1: Imports erweitern** — Zeile 2 von `convex/incomingGoods.ts` ändern zu:

```ts
import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
```

und nach Zeile 3 einfügen:

```ts
import { internal } from "./_generated/api";
```

- [ ] **Step 2: Reminder-Logik ans Dateiende anfügen:**

```ts
// ============================================================
// Monats-Überwachung: Erinnerungsmail je Filiale am 15./22./29.,
// solange im laufenden Monat keine Prüfung erfasst wurde.
// ============================================================

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function buildReminderHtml(locationName: string, monthLabel: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;padding:16px 24px;">
      <h1 style="color:#fff;margin:0;font-size:16px;font-weight:600;">QMS</h1>
    </div>
    <div style="padding:24px;">
      <h2 style="color:#18181b;margin:0 0 8px;font-size:18px;">Wareneingangsprüfung ${monthLabel} ausstehend</h2>
      <p style="color:#52525b;margin:0 0 24px;line-height:1.5;">
        Für die Filiale <strong>${locationName}</strong> wurde im ${monthLabel} noch keine
        Wareneingangsprüfung (MDR Art. 14, AA 7.4.3) erfasst. Bitte führen Sie die
        Stichprobenprüfung durch und dokumentieren Sie sie im QMS.
      </p>
      <a href="${appUrl}/incoming-goods/new" style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        Prüfung jetzt erfassen
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e4e4e7;">
      <p style="color:#a1a1aa;margin:0;font-size:12px;">
        Diese Erinnerung wiederholt sich wöchentlich, bis eine Prüfung für den laufenden Monat erfasst ist.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Zustand für den Reminder-Lauf: je Filiale mit Empfängern — Prüfung im Monat? heute schon erinnert? */
export const getReminderState = internalQuery({
  args: { year: v.number(), month: v.number(), todayStart: v.number() },
  handler: async (ctx, args) => {
    const monthStart = Date.UTC(args.year, args.month - 1, 1);
    const monthEnd = Date.UTC(args.year, args.month, 1);

    const locations = (await ctx.db.query("organizations").collect()).filter(
      (o) => o.type === "location" && !o.isArchived,
    );
    const checks = (
      await ctx.db
        .query("incomingGoodsChecks")
        .withIndex("by_checkDate", (q) => q.gte("checkDate", monthStart).lt("checkDate", monthEnd))
        .collect()
    ).filter((c) => !c.isArchived);
    const reminders = await ctx.db.query("incomingGoodsReminders").collect();

    return locations.map((loc) => ({
      locationId: loc._id,
      name: loc.name,
      recipients: loc.reminderEmails?.trim() ?? "",
      hasCheck: checks.some((c) => c.locationId === loc._id),
      remindedToday: reminders.some(
        (r) =>
          r.locationId === loc._id &&
          r.year === args.year &&
          r.month === args.month &&
          r.sentAt >= args.todayStart,
      ),
    }));
  },
});

export const recordReminder = internalMutation({
  args: { locationId: v.id("organizations"), year: v.number(), month: v.number(), recipients: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("incomingGoodsReminders", {
      ...args,
      sentAt: now,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      action: "CREATE",
      entityType: "incomingGoodsReminders",
      entityId: id,
      metadata: { locationId: args.locationId, year: args.year, month: args.month },
    });
  },
});

/** Cron (täglich): sendet am 15./22./29. des Monats. `force: true` für manuelle Testläufe. */
export const checkMonthlyDue = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const now = new Date();
    const day = now.getUTCDate();
    if (!args.force && (day < 15 || (day - 15) % 7 !== 0)) {
      return { skipped: true, reason: `Tag ${day} ist kein Erinnerungstag (15./22./29.)` };
    }
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const todayStart = Date.UTC(year, month - 1, day);

    const state = await ctx.runQuery(internal.incomingGoods.getReminderState, {
      year, month, todayStart,
    });

    const apiKey = process.env.RESEND_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qms.example.com";
    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

    let sent = 0;
    let skipped = 0;
    for (const loc of state) {
      if (loc.hasCheck || loc.remindedToday || !loc.recipients) {
        skipped++;
        continue;
      }
      if (apiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "QMS <noreply@qms.example.com>",
            to: loc.recipients.split(",").map((e) => e.trim()).filter(Boolean),
            subject: `Erinnerung: Wareneingangsprüfung ${monthLabel} — ${loc.name}`,
            html: buildReminderHtml(loc.name, monthLabel, appUrl),
          }),
        });
      }
      await ctx.runMutation(internal.incomingGoods.recordReminder, {
        locationId: loc.locationId,
        year, month,
        recipients: loc.recipients,
      });
      sent++;
    }
    return { sent, skipped, emailConfigured: !!apiKey };
  },
});
```

- [ ] **Step 3: Cron registrieren** — in `convex/crons.ts` vor `export default crons;`:

```ts
// Wareneingang: Monats-Erinnerung je Filiale (sendet nur am 15./22./29.)
crons.daily(
  "check-incoming-goods-due",
  { hourUTC: 4, minuteUTC: 30 },
  internal.incomingGoods.checkMonthlyDue,
  {}
);
```

- [ ] **Step 4: Typecheck + Push**

Run: `npx tsc --noEmit && npx convex dev --once`
Expected: keine Fehler

- [ ] **Step 5: Commit**

```bash
git add convex/incomingGoods.ts convex/crons.ts
git commit -m "feat(wareneingang): Monats-Erinnerung je Filiale (15./22./29., Resend, Dedup-Log) + Cron"
```

---

### Task 6: UI-Bausteine — YesNoField + SignaturePad

**Files:**
- Create: `components/domain/incoming-goods/yes-no-field.tsx`
- Create: `components/domain/incoming-goods/signature-pad.tsx`

- [ ] **Step 1: YesNoField anlegen** — `components/domain/incoming-goods/yes-no-field.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

/** Ja/Nein-Umschalter mit drittem Zustand „unbeantwortet" (erneuter Klick hebt auf) */
export function YesNoField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <span className="flex-1 text-sm">{label}</span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={value === true ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(value === true ? undefined : true)}
        >
          Ja
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === false ? "destructive" : "outline"}
          disabled={disabled}
          onClick={() => onChange(value === false ? undefined : false)}
        >
          Nein
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SignaturePad anlegen** — `components/domain/incoming-goods/signature-pad.tsx` (Port der Quell-App-Komponente, shadcn-Dialog statt Eigenbau-Overlay; Maus + Touch):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, PenLine, RotateCcw } from "lucide-react";

/** Unterschriften-Feld: öffnet einen Canvas-Dialog, liefert PNG-DataURL über onChange */
export function SignaturePad({
  value,
  onChange,
  label = "Unterschrift Prüfer/in",
  disabled,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Canvas vorbereiten + vorhandene Unterschrift laden, sobald der Dialog offen ist
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [open, value]);

  function pointFromEvent(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = "touches" in e ? e.touches[0] : e;
    if (!source) return null;
    // Skalierung: CSS-Breite ≠ Canvas-Pixel — umrechnen, sonst versetzte Striche
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (source.clientX - rect.left) * scaleX, y: (source.clientY - rect.top) * scaleY };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    if (!ctx || !p) return;
    drawingRef.current = true;
    setIsEmpty(false);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = pointFromEvent(e);
    if (!ctx || !p) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange("");
  }

  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground hover:bg-muted/50 disabled:cursor-default"
      >
        {value ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="font-medium text-foreground">Unterschrift vorhanden</span>
          </>
        ) : (
          <>
            <PenLine className="h-4 w-4" />
            Zum Unterschreiben klicken
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Unterschrift</DialogTitle></DialogHeader>
          <div className="rounded-md border-2 p-1">
            <canvas
              ref={canvasRef}
              width={440}
              height={180}
              className="h-auto w-full cursor-crosshair touch-none rounded bg-white"
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={(e) => { e.preventDefault(); start(e); }}
              onTouchMove={(e) => { e.preventDefault(); move(e); }}
              onTouchEnd={end}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Unterschrift mit Maus oder Finger zeichnen
          </p>
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={clear} disabled={isEmpty}>
              <RotateCcw className="mr-2 h-4 w-4" /> Löschen
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>Fertig</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add components/domain/incoming-goods/yes-no-field.tsx components/domain/incoming-goods/signature-pad.tsx
git commit -m "feat(wareneingang): UI-Bausteine — YesNoField (3-Zustand) + SignaturePad (Canvas-Port)"
```

---

### Task 7: Erfassungsmaske — check-form.tsx

**Files:**
- Create: `components/domain/incoming-goods/check-form.tsx`

Eine Komponente für Anlegen UND Bearbeiten (Unterscheidung über `initial`). 7 Abschnitts-Cards, Inhalte 1:1 aus der Quell-App. Unterschrift/Anhänge werden erst beim Speichern in den Storage geladen.

- [ ] **Step 1: Komponente anlegen** — `components/domain/incoming-goods/check-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { YesNoField } from "./yes-no-field";
import { SignaturePad } from "./signature-pad";
import {
  PRODUCT_AREAS, MDR_DUTY_QUESTIONS, STORAGE_FLAGS,
  INCOMING_RESULT_LABELS, type MdrDutyKey, type StorageFlagKey,
} from "@/lib/types/enums";
import { toast } from "sonner";

type Check = Doc<"incomingGoodsChecks">;

function toDateInput(ts: number | undefined): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : "";
}

function emptyForm() {
  return {
    locationId: "" as string,
    checkDate: new Date().toISOString().slice(0, 10),
    inspectorName: "",
    manufacturer: "",
    productArea: "" as string,
    deliveryDate: "",
    duties: {} as Partial<Record<MdrDutyKey, boolean | undefined>>,
    labeling: {
      produktName: "", ceKennzeichnung: undefined as boolean | undefined,
      herstellerName: "", haendlerName: "", importeursName: "", bevollmaechtigten: "",
    },
    identification: {
      hasRef: undefined as boolean | undefined, ref: "",
      hasLot: undefined as boolean | undefined, lot: "",
      hasSn: undefined as boolean | undefined, sn: "",
      hasUdiTraeger: undefined as boolean | undefined, udiTraeger: "",
      haltbarkeitsdatum: "", herstelldatum: "",
    },
    storageFlags: {} as Partial<Record<StorageFlagKey, boolean | undefined>>,
    storageNotes: {
      warnhinweise: "", gebrauchshinweise: "", patientHinweise: "",
      aufbereitungszyklen: "", beschraenkungZyklen: "",
    },
    custom: {
      isSonderanfertigung: undefined as boolean | undefined,
      mdKennzeichnung: undefined as boolean | undefined,
      nurKlinischePruefung: undefined as boolean | undefined,
      sichereEntsorgung: "",
    },
    result: "" as "" | "PASSED" | "FAILED",
    failureReason: "",
    remarks: "",
  };
}

function formFromCheck(check: Check) {
  const f = emptyForm();
  f.locationId = check.locationId;
  f.checkDate = toDateInput(check.checkDate);
  f.inspectorName = check.inspectorName ?? "";
  f.manufacturer = check.manufacturer;
  f.productArea = check.productArea;
  f.deliveryDate = toDateInput(check.deliveryDate);
  f.duties = { ...check.duties };
  f.labeling = {
    produktName: check.labeling.produktName ?? "",
    ceKennzeichnung: check.labeling.ceKennzeichnung,
    herstellerName: check.labeling.herstellerName ?? "",
    haendlerName: check.labeling.haendlerName ?? "",
    importeursName: check.labeling.importeursName ?? "",
    bevollmaechtigten: check.labeling.bevollmaechtigten ?? "",
  };
  f.identification = {
    hasRef: check.identification.hasRef, ref: check.identification.ref ?? "",
    hasLot: check.identification.hasLot, lot: check.identification.lot ?? "",
    hasSn: check.identification.hasSn, sn: check.identification.sn ?? "",
    hasUdiTraeger: check.identification.hasUdiTraeger, udiTraeger: check.identification.udiTraeger ?? "",
    haltbarkeitsdatum: check.identification.haltbarkeitsdatum ?? "",
    herstelldatum: check.identification.herstelldatum ?? "",
  };
  f.storageFlags = {
    trockenLagern: check.storage.trockenLagern,
    sonnenlichtSchutz: check.storage.sonnenlichtSchutz,
    zerbrechlich: check.storage.zerbrechlich,
    temperaturbegrenzung: check.storage.temperaturbegrenzung,
    luftfeuchte: check.storage.luftfeuchte,
  };
  f.storageNotes = {
    warnhinweise: check.storage.warnhinweise ?? "",
    gebrauchshinweise: check.storage.gebrauchshinweise ?? "",
    patientHinweise: check.storage.patientHinweise ?? "",
    aufbereitungszyklen: check.storage.aufbereitungszyklen ?? "",
    beschraenkungZyklen: check.storage.beschraenkungZyklen ?? "",
  };
  f.custom = {
    isSonderanfertigung: check.custom.isSonderanfertigung,
    mdKennzeichnung: check.custom.mdKennzeichnung,
    nurKlinischePruefung: check.custom.nurKlinischePruefung,
    sichereEntsorgung: check.custom.sichereEntsorgung ?? "",
  };
  f.result = check.result;
  f.failureReason = check.failureReason ?? "";
  f.remarks = check.remarks ?? "";
  return f;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export function CheckForm({ initial }: { initial?: Check }) {
  const router = useRouter();
  const orgs = useQuery(api.organizations.list, {});
  const createCheck = useMutation(api.incomingGoods.create);
  const updateCheck = useMutation(api.incomingGoods.update);
  const generateUploadUrl = useMutation(api.incomingGoods.generateUploadUrl);

  const [form, setForm] = useState(() => (initial ? formFromCheck(initial) : emptyForm()));
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const locations = ((orgs ?? []) as Array<{ _id: string; name: string; type: string }>)
    .filter((o) => o.type === "location")
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  async function uploadBlob(blob: Blob, contentType: string): Promise<Id<"_storage">> {
    const postUrl = await generateUploadUrl();
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!res.ok) throw new Error("Datei-Upload fehlgeschlagen");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  async function handleSave() {
    if (saving) return;
    if (!form.locationId) { toast.error("Filiale ist erforderlich"); return; }
    if (!form.checkDate) { toast.error("Prüfdatum ist erforderlich"); return; }
    if (!form.manufacturer.trim()) { toast.error("Hersteller ist erforderlich"); return; }
    if (!form.productArea) { toast.error("Produktbereich ist erforderlich"); return; }
    if (!form.result) { toast.error("Ergebnis der Stichproben-Kontrolle ist erforderlich"); return; }
    if (form.result === "FAILED" && !form.failureReason.trim()) {
      toast.error("Bei „nicht erfüllt“ ist eine Begründung erforderlich");
      return;
    }

    setSaving(true);
    try {
      // Unterschrift + neue Anhänge erst jetzt hochladen
      let signatureFileId = initial?.signatureFileId;
      if (signatureDataUrl) {
        signatureFileId = await uploadBlob(await dataUrlToBlob(signatureDataUrl), "image/png");
      }
      const attachmentFileIds = [...(initial?.attachmentFileIds ?? [])];
      for (const file of newFiles) {
        attachmentFileIds.push(await uploadBlob(file, file.type || "application/octet-stream"));
      }

      const trimmedOrUndefined = (s: string) => s.trim() || undefined;
      const payload = {
        locationId: form.locationId as Id<"organizations">,
        checkDate: new Date(form.checkDate).getTime(),
        inspectorName: trimmedOrUndefined(form.inspectorName),
        manufacturer: form.manufacturer,
        productArea: form.productArea,
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).getTime() : undefined,
        duties: { ...form.duties },
        labeling: {
          produktName: trimmedOrUndefined(form.labeling.produktName),
          ceKennzeichnung: form.labeling.ceKennzeichnung,
          herstellerName: trimmedOrUndefined(form.labeling.herstellerName),
          haendlerName: trimmedOrUndefined(form.labeling.haendlerName),
          importeursName: trimmedOrUndefined(form.labeling.importeursName),
          bevollmaechtigten: trimmedOrUndefined(form.labeling.bevollmaechtigten),
        },
        identification: {
          hasRef: form.identification.hasRef, ref: trimmedOrUndefined(form.identification.ref),
          hasLot: form.identification.hasLot, lot: trimmedOrUndefined(form.identification.lot),
          hasSn: form.identification.hasSn, sn: trimmedOrUndefined(form.identification.sn),
          hasUdiTraeger: form.identification.hasUdiTraeger,
          udiTraeger: trimmedOrUndefined(form.identification.udiTraeger),
          haltbarkeitsdatum: trimmedOrUndefined(form.identification.haltbarkeitsdatum),
          herstelldatum: trimmedOrUndefined(form.identification.herstelldatum),
        },
        storage: {
          ...form.storageFlags,
          warnhinweise: trimmedOrUndefined(form.storageNotes.warnhinweise),
          gebrauchshinweise: trimmedOrUndefined(form.storageNotes.gebrauchshinweise),
          patientHinweise: trimmedOrUndefined(form.storageNotes.patientHinweise),
          aufbereitungszyklen: trimmedOrUndefined(form.storageNotes.aufbereitungszyklen),
          beschraenkungZyklen: trimmedOrUndefined(form.storageNotes.beschraenkungZyklen),
        },
        custom: {
          isSonderanfertigung: form.custom.isSonderanfertigung,
          mdKennzeichnung: form.custom.mdKennzeichnung,
          nurKlinischePruefung: form.custom.nurKlinischePruefung,
          sichereEntsorgung: trimmedOrUndefined(form.custom.sichereEntsorgung),
        },
        result: form.result,
        failureReason: trimmedOrUndefined(form.failureReason),
        remarks: trimmedOrUndefined(form.remarks),
        signatureFileId,
        attachmentFileIds: attachmentFileIds.length > 0 ? attachmentFileIds : undefined,
      };

      if (initial) {
        await updateCheck({ id: initial._id, ...payload });
        toast.success("Prüfung gespeichert");
        router.push(`/incoming-goods/${initial._id}`);
      } else {
        const id = await createCheck(payload);
        toast.success("Wareneingangsprüfung erfasst");
        router.push(`/incoming-goods/${id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Stammdaten */}
      <Card>
        <CardHeader><CardTitle>1. Stammdaten</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Filiale *</Label>
            <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Filiale wählen…" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ig-checkdate">Prüfdatum *</Label>
            <Input id="ig-checkdate" type="date" value={form.checkDate}
              onChange={(e) => setForm({ ...form, checkDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ig-manufacturer">Hersteller *</Label>
            <Input id="ig-manufacturer" value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </div>
          <div>
            <Label>Produktbereich *</Label>
            <Select value={form.productArea} onValueChange={(v) => setForm({ ...form, productArea: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Bereich wählen…" /></SelectTrigger>
              <SelectContent>
                {PRODUCT_AREAS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ig-delivery">Lieferdatum</Label>
            <Input id="ig-delivery" type="date" value={form.deliveryDate}
              onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ig-inspector">Prüfer/in</Label>
            <Input id="ig-inspector" value={form.inspectorName}
              onChange={(e) => setForm({ ...form, inspectorName: e.target.value })}
              placeholder="leer = angemeldeter Nutzer" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Prüfpflichten MDR Art. 14 */}
      <Card>
        <CardHeader><CardTitle>2. Allgemeine Prüfpflichten des Händlers nach Art. 14 MDR</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {MDR_DUTY_QUESTIONS.map((q) => (
            <YesNoField
              key={q.key}
              label={q.question}
              value={form.duties[q.key]}
              onChange={(v) => setForm({ ...form, duties: { ...form.duties, [q.key]: v } })}
            />
          ))}
        </CardContent>
      </Card>

      {/* 3. Kennzeichnung */}
      <Card>
        <CardHeader><CardTitle>3. Angaben zur Kennzeichnung nach Anhang I 23.2 MDR</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <YesNoField
            label="CE-Kennzeichnung auf dem Produkt vorhanden"
            value={form.labeling.ceKennzeichnung}
            onChange={(v) => setForm({ ...form, labeling: { ...form.labeling, ceKennzeichnung: v } })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ig-productname">Name / Handelsname des Produkts</Label>
              <Input id="ig-productname" value={form.labeling.produktName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, produktName: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-herstellername">Name und Anschrift des Herstellers</Label>
              <Input id="ig-herstellername" value={form.labeling.herstellerName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, herstellerName: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-haendler">Händler</Label>
              <Input id="ig-haendler" value={form.labeling.haendlerName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, haendlerName: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-importeur">Importeur</Label>
              <Input id="ig-importeur" value={form.labeling.importeursName}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, importeursName: e.target.value } })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ig-bevoll">Bevollmächtigter</Label>
              <Input id="ig-bevoll" value={form.labeling.bevollmaechtigten}
                onChange={(e) => setForm({ ...form, labeling: { ...form.labeling, bevollmaechtigten: e.target.value } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Produktidentifikation */}
      <Card>
        <CardHeader><CardTitle>4. Produktidentifikation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["hasRef", "ref", "REF (Artikelnummer)"],
              ["hasLot", "lot", "LOT (Chargennummer)"],
              ["hasSn", "sn", "SN (Seriennummer)"],
              ["hasUdiTraeger", "udiTraeger", "UDI-Träger"],
            ] as const
          ).map(([flagKey, valueKey, label]) => (
            <div key={flagKey} className="grid items-end gap-2 sm:grid-cols-2">
              <YesNoField
                label={`${label} vorhanden?`}
                value={form.identification[flagKey]}
                onChange={(v) =>
                  setForm({ ...form, identification: { ...form.identification, [flagKey]: v } })
                }
              />
              <Input
                value={form.identification[valueKey]}
                placeholder={label}
                onChange={(e) =>
                  setForm({ ...form, identification: { ...form.identification, [valueKey]: e.target.value } })
                }
              />
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ig-mhd">Haltbarkeitsdatum</Label>
              <Input id="ig-mhd" value={form.identification.haltbarkeitsdatum}
                placeholder="z. B. 05/2028"
                onChange={(e) => setForm({ ...form, identification: { ...form.identification, haltbarkeitsdatum: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="ig-mfg">Herstelldatum</Label>
              <Input id="ig-mfg" value={form.identification.herstelldatum}
                placeholder="z. B. 03/2026"
                onChange={(e) => setForm({ ...form, identification: { ...form.identification, herstelldatum: e.target.value } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Lagerung / Handhabung */}
      <Card>
        <CardHeader><CardTitle>5. Lagerungs- / Handhabungsbedingungen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {STORAGE_FLAGS.map((f) => (
              <YesNoField
                key={f.key}
                label={f.label}
                value={form.storageFlags[f.key]}
                onChange={(v) => setForm({ ...form, storageFlags: { ...form.storageFlags, [f.key]: v } })}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["warnhinweise", "Warnhinweise"],
                ["gebrauchshinweise", "Gebrauchshinweise"],
                ["patientHinweise", "Hinweise für Patienten"],
                ["aufbereitungszyklen", "Aufbereitungszyklen (Anzahl/Verfahren)"],
                ["beschraenkungZyklen", "Beschränkung der Wiederverwendung"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={key === "beschraenkungZyklen" ? "sm:col-span-2" : ""}>
                <Label htmlFor={`ig-${key}`}>{label}</Label>
                <Textarea id={`ig-${key}`} rows={2} value={form.storageNotes[key]}
                  onChange={(e) => setForm({ ...form, storageNotes: { ...form.storageNotes, [key]: e.target.value } })} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 6. Sonderanfertigung */}
      <Card>
        <CardHeader><CardTitle>6. Sonderanfertigung</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <YesNoField
            label="Produkt ist eine Sonderanfertigung"
            value={form.custom.isSonderanfertigung}
            onChange={(v) => setForm({ ...form, custom: { ...form.custom, isSonderanfertigung: v } })}
          />
          <YesNoField
            label="Kennzeichnung „MD“ (Sonderanfertigung) vorhanden"
            value={form.custom.mdKennzeichnung}
            onChange={(v) => setForm({ ...form, custom: { ...form.custom, mdKennzeichnung: v } })}
          />
          <YesNoField
            label="Nur für klinische Prüfung bestimmt"
            value={form.custom.nurKlinischePruefung}
            onChange={(v) => setForm({ ...form, custom: { ...form.custom, nurKlinischePruefung: v } })}
          />
          <div>
            <Label htmlFor="ig-entsorgung">Hinweise zur sicheren Entsorgung</Label>
            <Textarea id="ig-entsorgung" rows={2} value={form.custom.sichereEntsorgung}
              onChange={(e) => setForm({ ...form, custom: { ...form.custom, sichereEntsorgung: e.target.value } })} />
          </div>
        </CardContent>
      </Card>

      {/* 7. Stichproben-Kontrolle + Nachweise */}
      <Card>
        <CardHeader><CardTitle>7. Stichproben-Kontrolle</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Ergebnis *</Label>
            <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v as "PASSED" | "FAILED" })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Ergebnis wählen…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSED">{INCOMING_RESULT_LABELS.PASSED}</SelectItem>
                <SelectItem value="FAILED">{INCOMING_RESULT_LABELS.FAILED}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.result === "FAILED" && (
            <div>
              <Label htmlFor="ig-reason">Begründung (nicht erfüllt) *</Label>
              <Textarea id="ig-reason" rows={3} value={form.failureReason}
                onChange={(e) => setForm({ ...form, failureReason: e.target.value })} />
            </div>
          )}
          <div>
            <Label htmlFor="ig-remarks">Zusätzliche Bemerkungen</Label>
            <Textarea id="ig-remarks" rows={2} value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
          <SignaturePad
            value={signatureDataUrl || (initial?.signatureFileId ? "vorhanden" : "")}
            onChange={setSignatureDataUrl}
          />
          {initial?.signatureFileId && !signatureDataUrl && (
            <p className="text-xs text-muted-foreground">
              Vorhandene Unterschrift bleibt erhalten — neue Unterschrift ersetzt sie.
            </p>
          )}
          <div>
            <Label htmlFor="ig-files">Fotos / Anhänge</Label>
            <Input
              id="ig-files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
            />
            {(initial?.attachmentFileIds?.length ?? 0) > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {initial!.attachmentFileIds!.length} vorhandene(r) Anhang/Anhänge bleiben erhalten.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Abbrechen
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
```

**Hinweis zur Unterschrift im Edit-Fall:** `value="vorhanden"` ist kein `data:image` — der Pad zeigt „Unterschrift vorhanden", lädt aber nichts ins Canvas; erst eine neue Zeichnung erzeugt eine neue Datei. Genau so gewollt (alte Datei bleibt, neue ersetzt).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add components/domain/incoming-goods/check-form.tsx
git commit -m "feat(wareneingang): Erfassungsmaske — 7 Abschnitte aus der Quell-App, Unterschrift + Anhänge mit Storage-Upload"
```

---

### Task 8: Seiten — Liste + Ampel, Neu, Detail, Bearbeiten

**Files:**
- Replace: `app/(dashboard)/incoming-goods/page.tsx`
- Create: `app/(dashboard)/incoming-goods/new/page.tsx`
- Create: `app/(dashboard)/incoming-goods/[id]/page.tsx`
- Create: `app/(dashboard)/incoming-goods/[id]/edit/page.tsx`

- [ ] **Step 1: Listen-Seite ersetzen** — `app/(dashboard)/incoming-goods/page.tsx` komplett ersetzen:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { PRODUCT_AREAS, INCOMING_RESULT_LABELS } from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { Plus } from "lucide-react";

interface CheckRow {
  _id: string;
  checkDate: number;
  locationId: string;
  locationName: string;
  manufacturer: string;
  productArea: string;
  result: "PASSED" | "FAILED";
  inspectorName?: string;
}

const RESULT_BADGE: Record<string, string> = {
  PASSED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function IncomingGoodsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const checks = useQuery(api.incomingGoods.list, {});

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const status = useQuery(api.incomingGoods.monthlyStatus, { year });

  const [filterLocation, setFilterLocation] = useState("ALL");
  const [filterArea, setFilterArea] = useState("ALL");
  const [search, setSearch] = useState("");

  const locations = Array.from(
    new Map(((checks ?? []) as CheckRow[]).map((c) => [c.locationId, c.locationName])).entries(),
  );

  const filtered = ((checks ?? []) as CheckRow[]).filter((c) => {
    if (filterLocation !== "ALL" && c.locationId !== filterLocation) return false;
    if (filterArea !== "ALL" && c.productArea !== filterArea) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${c.manufacturer} ${c.locationName} ${c.productArea} ${c.inspectorName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const columns: Column<CheckRow>[] = [
    { key: "date", header: "Prüfdatum", cell: (r) => formatDate(r.checkDate) },
    { key: "location", header: "Filiale", cell: (r) => <span className="font-medium">{r.locationName}</span> },
    { key: "manufacturer", header: "Hersteller", cell: (r) => r.manufacturer },
    { key: "area", header: "Produktbereich", cell: (r) => r.productArea },
    {
      key: "result", header: "Ergebnis",
      cell: (r) => (
        <Badge className={RESULT_BADGE[r.result]} variant="secondary">
          {r.result === "PASSED" ? "freigegeben" : "gesperrt"}
        </Badge>
      ),
    },
    { key: "inspector", header: "Prüfer/in", cell: (r) => r.inspectorName ?? "—" },
  ];

  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wareneingangsprüfung"
        description="Prüfpflichten des Händlers nach Art. 14 MDR (AA 7.4.3) — Stichprobe je Filiale, 1–2× monatlich"
        actions={
          can("incomingGoods:record") ? (
            <Button onClick={() => router.push("/incoming-goods/new")}>
              <Plus className="mr-2 h-4 w-4" /> Neue Prüfung
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="checks">
        <TabsList>
          <TabsTrigger value="checks">Prüfungen</TabsTrigger>
          <TabsTrigger value="status">Monats-Ampel</TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="space-y-4">
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Filialen</SelectItem>
                {locations.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Produktbereiche</SelectItem>
                {PRODUCT_AREAS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="w-[240px]" placeholder="Suchen (Hersteller, Filiale…)"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(r) => router.push(`/incoming-goods/${r._id}`)}
            emptyMessage="Noch keine Wareneingangsprüfungen erfasst"
          />
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="mt-2 flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Zahl = erfasste Prüfungen im Monat · ab dem 15. ohne Prüfung gehen wöchentliche Erinnerungen an die Filiale
            </p>
          </div>
          {status === undefined ? (
            <div className="p-8 text-muted-foreground">Lade…</div>
          ) : status.rows.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-muted-foreground">
              Keine Filialen angelegt — Standorte in der Verwaltung pflegen.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Filiale</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="w-12 px-2 py-2 text-center font-medium">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status.rows.map((row) => (
                    <tr key={row.locationId} className="border-b">
                      <td className="px-3 py-2 font-medium">
                        {row.name}
                        {!row.hasReminderEmails && (
                          <span className="ml-2 text-xs text-amber-600" title="Keine Erinnerungs-E-Mail hinterlegt (Verwaltung → Standorte)">
                            ohne E-Mail
                          </span>
                        )}
                      </td>
                      {row.months.map((count, idx) => {
                        const month = idx + 1;
                        const isPast = year < currentYear || (year === currentYear && month < currentMonth);
                        const isCurrent = year === currentYear && month === currentMonth;
                        const cls =
                          count > 0
                            ? "bg-green-100 text-green-800"
                            : isPast
                              ? "bg-red-100 text-red-800"
                              : isCurrent
                                ? "bg-amber-100 text-amber-800"
                                : "text-muted-foreground";
                        return (
                          <td key={month} className="px-1 py-1 text-center">
                            <span className={`inline-block w-8 rounded py-0.5 text-xs font-medium ${cls}`}>
                              {count > 0 ? count : isPast || isCurrent ? "0" : "—"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Neu-Seite** — `app/(dashboard)/incoming-goods/new/page.tsx`:

```tsx
"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CheckForm } from "@/components/domain/incoming-goods/check-form";

export default function NewIncomingGoodsCheckPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Neue Wareneingangsprüfung"
        description="Prüfpflichten des Händlers nach Art. 14 MDR (AA 7.4.3)"
      />
      <CheckForm />
    </div>
  );
}
```

- [ ] **Step 3: Detail-Seite** — `app/(dashboard)/incoming-goods/[id]/page.tsx`:

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  MDR_DUTY_QUESTIONS, STORAGE_FLAGS, INCOMING_RESULT_LABELS,
} from "@/lib/types/enums";
import { formatDate } from "@/lib/utils/dates";
import { downloadIncomingGoodsPdf } from "@/lib/export/incoming-goods-exporter";
import { toast } from "sonner";

function yesNo(v: boolean | undefined): string {
  return v === true ? "Ja" : v === false ? "Nein" : "—";
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-56 shrink-0 text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line">{value || "—"}</span>
    </div>
  );
}

export default function IncomingGoodsDetailPage() {
  const params = useParams<{ id: string }>();
  const checkId = params.id as Id<"incomingGoodsChecks">;
  const router = useRouter();
  const { can } = usePermissions();
  const check = useQuery(api.incomingGoods.getById, { id: checkId });

  if (check === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (check === null) return <div className="p-8">Prüfung nicht gefunden.</div>;

  async function handlePdf() {
    try {
      await downloadIncomingGoodsPdf(check!, `Wareneingangspruefung_${formatDate(check!.checkDate).replaceAll(".", "-")}_${check!.locationName}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Wareneingangsprüfung ${formatDate(check.checkDate)}`}
        description={`${check.locationName} · ${check.manufacturer}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              className={check.result === "PASSED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
              variant="secondary"
            >
              {INCOMING_RESULT_LABELS[check.result]}
            </Badge>
            <Button variant="outline" onClick={handlePdf}>PDF herunterladen</Button>
            {can("incomingGoods:manage") && (
              <Button variant="outline" onClick={() => router.push(`/incoming-goods/${checkId}/edit`)}>
                Bearbeiten
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>1. Stammdaten</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Filiale" value={check.locationName} />
          <Row label="Prüfdatum" value={formatDate(check.checkDate)} />
          <Row label="Prüfer/in" value={check.inspectorName} />
          <Row label="Hersteller" value={check.manufacturer} />
          <Row label="Produktbereich" value={check.productArea} />
          <Row label="Lieferdatum" value={check.deliveryDate ? formatDate(check.deliveryDate) : undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Prüfpflichten nach Art. 14 MDR</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {MDR_DUTY_QUESTIONS.map((q) => (
            <div key={q.key} className="flex items-start justify-between gap-4 text-sm">
              <span className="flex-1">{q.question}</span>
              <Badge
                variant="secondary"
                className={
                  check.duties[q.key] === true
                    ? "bg-green-100 text-green-800"
                    : check.duties[q.key] === false
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-600"
                }
              >
                {yesNo(check.duties[q.key])}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Kennzeichnung (Anhang I 23.2 MDR)</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="CE-Kennzeichnung vorhanden" value={yesNo(check.labeling.ceKennzeichnung)} />
          <Row label="Name / Handelsname" value={check.labeling.produktName} />
          <Row label="Hersteller (Name/Anschrift)" value={check.labeling.herstellerName} />
          <Row label="Händler" value={check.labeling.haendlerName} />
          <Row label="Importeur" value={check.labeling.importeursName} />
          <Row label="Bevollmächtigter" value={check.labeling.bevollmaechtigten} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Produktidentifikation</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="REF vorhanden / Wert" value={`${yesNo(check.identification.hasRef)} ${check.identification.ref ?? ""}`.trim()} />
          <Row label="LOT vorhanden / Wert" value={`${yesNo(check.identification.hasLot)} ${check.identification.lot ?? ""}`.trim()} />
          <Row label="SN vorhanden / Wert" value={`${yesNo(check.identification.hasSn)} ${check.identification.sn ?? ""}`.trim()} />
          <Row label="UDI-Träger vorhanden / Wert" value={`${yesNo(check.identification.hasUdiTraeger)} ${check.identification.udiTraeger ?? ""}`.trim()} />
          <Row label="Haltbarkeitsdatum" value={check.identification.haltbarkeitsdatum} />
          <Row label="Herstelldatum" value={check.identification.herstelldatum} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5. Lagerung / Handhabung</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {STORAGE_FLAGS.map((f) => (
            <Row key={f.key} label={f.label} value={yesNo(check.storage[f.key])} />
          ))}
          <Row label="Warnhinweise" value={check.storage.warnhinweise} />
          <Row label="Gebrauchshinweise" value={check.storage.gebrauchshinweise} />
          <Row label="Hinweise für Patienten" value={check.storage.patientHinweise} />
          <Row label="Aufbereitungszyklen" value={check.storage.aufbereitungszyklen} />
          <Row label="Beschränkung der Wiederverwendung" value={check.storage.beschraenkungZyklen} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6. Sonderanfertigung</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          <Row label="Sonderanfertigung" value={yesNo(check.custom.isSonderanfertigung)} />
          <Row label="Kennzeichnung „MD“" value={yesNo(check.custom.mdKennzeichnung)} />
          <Row label="Nur für klinische Prüfung" value={yesNo(check.custom.nurKlinischePruefung)} />
          <Row label="Sichere Entsorgung" value={check.custom.sichereEntsorgung} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7. Stichproben-Kontrolle &amp; Nachweise</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="Ergebnis" value={INCOMING_RESULT_LABELS[check.result]} />
          {check.failureReason && <Row label="Begründung" value={check.failureReason} />}
          {check.remarks && <Row label="Bemerkungen" value={check.remarks} />}
          {check.signatureUrl && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Unterschrift Prüfer/in</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={check.signatureUrl} alt="Unterschrift" className="h-24 rounded border bg-white" />
            </div>
          )}
          {check.attachments.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Anhänge ({check.attachments.length})</p>
              <div className="flex flex-wrap gap-2">
                {check.attachments.map((a, i) =>
                  a.url ? (
                    <Button key={a.fileId} variant="outline" size="sm" asChild>
                      <a href={a.url} target="_blank" rel="noopener noreferrer">Anhang {i + 1}</a>
                    </Button>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Edit-Seite** — `app/(dashboard)/incoming-goods/[id]/edit/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { CheckForm } from "@/components/domain/incoming-goods/check-form";
import { usePermissions } from "@/lib/hooks/usePermissions";

export default function EditIncomingGoodsCheckPage() {
  const params = useParams<{ id: string }>();
  const checkId = params.id as Id<"incomingGoodsChecks">;
  const { can } = usePermissions();
  const check = useQuery(api.incomingGoods.getById, { id: checkId });

  if (check === undefined) return <div className="p-8 text-muted-foreground">Lade…</div>;
  if (check === null) return <div className="p-8">Prüfung nicht gefunden.</div>;
  if (!can("incomingGoods:manage")) return <div className="p-8">Keine Berechtigung.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wareneingangsprüfung bearbeiten"
        description={`${check.locationName} · ${check.manufacturer}`}
      />
      <CheckForm initial={check as unknown as Doc<"incomingGoodsChecks">} />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck** — `downloadIncomingGoodsPdf` existiert noch nicht (Task 9). Damit dieser Task eigenständig grün ist: Task 8 und Task 9 werden zusammen committet, falls nacheinander von EINEM Agenten bearbeitet; ansonsten in Task 8 den PDF-Button-Import vorerst auskommentieren? NEIN — verbindliche Regel: **Tasks 8 und 9 werden von einem Agenten gemeinsam umgesetzt und einmal committet** (siehe Task 9 Step 4).

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected nach Task 8 allein: Fehler NUR wegen `lib/export/incoming-goods-exporter` (fehlt) — wird in Task 9 angelegt.

---

### Task 9: PDF-Exporter (gemeinsamer Commit mit Task 8)

**Files:**
- Create: `lib/export/incoming-goods-exporter.ts`

- [ ] **Step 1: Exporter anlegen** — Haus-Stil wie `mgmt-review-exporter.ts`; lädt die Unterschrift von der Storage-URL und bettet sie ein:

```ts
import { jsPDF } from "jspdf";
import {
  MDR_DUTY_QUESTIONS, STORAGE_FLAGS, INCOMING_RESULT_LABELS,
} from "@/lib/types/enums";

/** Datenform = Rückgabe von api.incomingGoods.getById */
export interface IncomingGoodsCheckData {
  locationName: string;
  checkDate: number;
  inspectorName?: string;
  manufacturer: string;
  productArea: string;
  deliveryDate?: number;
  duties: Record<string, boolean | undefined>;
  labeling: {
    produktName?: string; ceKennzeichnung?: boolean; herstellerName?: string;
    haendlerName?: string; importeursName?: string; bevollmaechtigten?: string;
  };
  identification: {
    hasRef?: boolean; ref?: string; hasLot?: boolean; lot?: string;
    hasSn?: boolean; sn?: string; hasUdiTraeger?: boolean; udiTraeger?: string;
    haltbarkeitsdatum?: string; herstelldatum?: string;
  };
  storage: Record<string, boolean | string | undefined>;
  custom: {
    isSonderanfertigung?: boolean; mdKennzeichnung?: boolean;
    nurKlinischePruefung?: boolean; sichereEntsorgung?: string;
  };
  result: "PASSED" | "FAILED";
  failureReason?: string;
  remarks?: string;
  signatureUrl?: string | null;
  attachments: Array<{ url: string | null }>;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

function yesNo(v: boolean | undefined): string {
  return v === true ? "Ja" : v === false ? "Nein" : "—";
}

function formatDe(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleDateString("de-DE") : "—";
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildIncomingGoodsPdf(data: IncomingGoodsCheckData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > 277) { doc.addPage(); y = MARGIN; }
  }
  function heading(text: string) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(text, MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal").setFontSize(10);
  }
  function row(label: string, value: string) {
    ensureSpace(8);
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", CONTENT_WIDTH - 70);
    doc.text(lines, MARGIN + 70, y);
    y += Math.max(5, lines.length * 4.5) + 1.5;
  }

  // Kopf
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("Wareneingangsprüfung", MARGIN, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  doc.text("MDR Art. 14 · AA 7.4.3 (App)", PAGE_WIDTH - MARGIN, y, { align: "right" });
  doc.setTextColor(0);
  y += 10;

  heading("1. Stammdaten");
  row("Filiale", data.locationName);
  row("Prüfdatum", formatDe(data.checkDate));
  row("Prüfer/in", data.inspectorName ?? "—");
  row("Hersteller", data.manufacturer);
  row("Produktbereich", data.productArea);
  row("Lieferdatum", formatDe(data.deliveryDate));

  heading("2. Prüfpflichten nach Art. 14 MDR");
  for (const q of MDR_DUTY_QUESTIONS) {
    ensureSpace(10);
    const lines = doc.splitTextToSize(q.question, CONTENT_WIDTH - 14);
    doc.setFontSize(9);
    doc.text(lines, MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.text(yesNo(data.duties[q.key]), PAGE_WIDTH - MARGIN, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += lines.length * 4.5 + 2;
  }
  doc.setFontSize(10);

  heading("3. Kennzeichnung (Anhang I 23.2 MDR)");
  row("CE-Kennzeichnung", yesNo(data.labeling.ceKennzeichnung));
  row("Name / Handelsname", data.labeling.produktName ?? "—");
  row("Hersteller", data.labeling.herstellerName ?? "—");
  row("Händler", data.labeling.haendlerName ?? "—");
  row("Importeur", data.labeling.importeursName ?? "—");
  row("Bevollmächtigter", data.labeling.bevollmaechtigten ?? "—");

  heading("4. Produktidentifikation");
  row("REF", `${yesNo(data.identification.hasRef)}  ${data.identification.ref ?? ""}`.trim());
  row("LOT", `${yesNo(data.identification.hasLot)}  ${data.identification.lot ?? ""}`.trim());
  row("SN", `${yesNo(data.identification.hasSn)}  ${data.identification.sn ?? ""}`.trim());
  row("UDI-Träger", `${yesNo(data.identification.hasUdiTraeger)}  ${data.identification.udiTraeger ?? ""}`.trim());
  row("Haltbarkeitsdatum", data.identification.haltbarkeitsdatum ?? "—");
  row("Herstelldatum", data.identification.herstelldatum ?? "—");

  heading("5. Lagerung / Handhabung");
  for (const f of STORAGE_FLAGS) {
    row(f.label, yesNo(data.storage[f.key] as boolean | undefined));
  }
  row("Warnhinweise", (data.storage.warnhinweise as string) ?? "—");
  row("Gebrauchshinweise", (data.storage.gebrauchshinweise as string) ?? "—");
  row("Hinweise für Patienten", (data.storage.patientHinweise as string) ?? "—");
  row("Aufbereitungszyklen", (data.storage.aufbereitungszyklen as string) ?? "—");
  row("Beschränkung Wiederverwendung", (data.storage.beschraenkungZyklen as string) ?? "—");

  heading("6. Sonderanfertigung");
  row("Sonderanfertigung", yesNo(data.custom.isSonderanfertigung));
  row("Kennzeichnung „MD“", yesNo(data.custom.mdKennzeichnung));
  row("Nur klinische Prüfung", yesNo(data.custom.nurKlinischePruefung));
  row("Sichere Entsorgung", data.custom.sichereEntsorgung ?? "—");

  heading("7. Stichproben-Kontrolle");
  row("Ergebnis", INCOMING_RESULT_LABELS[data.result]);
  if (data.failureReason) row("Begründung", data.failureReason);
  if (data.remarks) row("Bemerkungen", data.remarks);
  row("Anhänge", `${data.attachments.length}`);

  // Unterschrift
  if (data.signatureUrl) {
    const dataUrl = await loadImageDataUrl(data.signatureUrl);
    if (dataUrl) {
      ensureSpace(40);
      doc.setFont("helvetica", "bold").setFontSize(9);
      doc.text("Unterschrift Prüfer/in", MARGIN, y);
      y += 3;
      doc.addImage(dataUrl, "PNG", MARGIN, y, 66, 27);
      y += 30;
      doc.setFont("helvetica", "normal");
    }
  }

  // Fußzeile
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(100);
    doc.text("Wareneingangsprüfung MDR Art. 14 · erstellt mit QMS (App)", MARGIN, 290);
    doc.text(`Seite ${i} von ${pages}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

/** Browser-Download (async wegen Unterschrift-Nachladen) */
export async function downloadIncomingGoodsPdf(
  data: IncomingGoodsCheckData,
  fileName: string,
): Promise<void> {
  const doc = await buildIncomingGoodsPdf(data);
  doc.save(fileName);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler (jetzt inkl. Task-8-Seiten)

- [ ] **Step 3: Detail-Seiten-Aufruf prüfen** — der Aufruf in `[id]/page.tsx` übergibt das `getById`-Ergebnis direkt; die Typen passen per Interface-Struktur (strukturelle Typisierung). Falls tsc hier einen Konflikt meldet (z. B. `signatureUrl: string | null` vs. optional): Aufruf zu `downloadIncomingGoodsPdf(check! as unknown as IncomingGoodsCheckData, …)` präzisieren und `IncomingGoodsCheckData` importieren.

- [ ] **Step 4: Commit (Tasks 8+9 gemeinsam)**

```bash
git add "app/(dashboard)/incoming-goods" lib/export/incoming-goods-exporter.ts
git commit -m "feat(wareneingang): Seiten (Liste+Ampel, Neu, Detail, Bearbeiten) + PDF-Export im Haus-Stil"
```

---

### Task 10: Sidebar-Badge entfernen

**Files:**
- Modify: `components/layout/sidebar.tsx` (Gruppe „Prüfungen")

- [ ] **Step 1: Badge entfernen** — den Wareneingang-Eintrag ändern von:

```tsx
      { label: "Wareneingang", href: "/incoming-goods", icon: Truck, featureFlag: "INCOMING_GOODS", badge: "IN PLANUNG" },
```

zu:

```tsx
      { label: "Wareneingang", href: "/incoming-goods", icon: Truck, featureFlag: "INCOMING_GOODS", permission: "incomingGoods:list" },
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npx tsc --noEmit
git add components/layout/sidebar.tsx
git commit -m "feat(wareneingang): Sidebar — Modul live, IN-PLANUNG-Badge entfernt"
```

---

### Task 11: Runtime-Verifikation (Pflicht)

**Files:** keine Code-Änderungen (nur Fixes aus dem Walkthrough)

- [ ] **Step 1: Dev-Server frisch starten** (Stale-Server-Memory beachten)

- [ ] **Step 2: Standorte + Erfassung prüfen**

1. `/admin` → Tab „Standorte": 4 Filialen (BHS/GSS/OFD/HPT) vorhanden; bei „Gerhard-Stalling-Straße" eine Test-E-Mail eintragen (z. B. `test@example.com`) und speichern; Spalte zeigt sie an.
2. Sidebar: „Wareneingang" ohne Badge in Gruppe „Prüfungen" → Seite lädt mit Tabs „Prüfungen" (leer) + „Monats-Ampel" (4 Zeilen; vergangene Monate rot 0, aktueller Monat amber 0; Filialen ohne E-Mail mit Hinweis „ohne E-Mail").
3. „Neue Prüfung": alle 7 Abschnitte sichtbar; Pflichtfeld-Validierung (ohne Filiale/Hersteller/Ergebnis → Fehlertoast); MDR-Fragen Ja/Nein/wieder-abwählbar; Ergebnis „nicht erfüllt" blendet Begründungsfeld ein (und erzwingt es); Unterschrift zeichnen (Dialog, Maus); Prüfung speichern (Filiale Gerhard-Stalling-Straße, Hersteller „Test-Hersteller Walkthrough", Bereich „05 - Bandagen", Ergebnis erfüllt).
4. Detailseite: alle Abschnitte mit erfassten Werten; Unterschrift als Bild sichtbar; „PDF herunterladen" läuft ohne Fehler durch.
5. Liste: 1 Zeile mit grünem Badge; Filter Filiale/Produktbereich/Suche greifen; Ampel: laufender Monat bei GSS jetzt grün „1".
6. Bearbeiten (als QMB/Admin): Hersteller ändern → speichern → Detail zeigt Änderung; vorhandene Unterschrift blieb erhalten.

- [ ] **Step 3: Reminder-Testlauf**

```bash
npx convex run incomingGoods:checkMonthlyDue '{"force": true}'
```

Expected: `{ sent: N, skipped: M, emailConfigured: true|false }` — GSS hat eine Prüfung im Monat → wird übersprungen; Filialen ohne reminderEmails → übersprungen; eine Filiale MIT Test-E-Mail und OHNE Prüfung → `sent: 1` und Eintrag in `npx convex data incomingGoodsReminders`. Zweiter Lauf direkt danach → `sent: 0` (Dedup „heute schon erinnert"). Hinweis: ohne `RESEND_API_KEY` wird nur protokolliert, nicht gesendet (`emailConfigured: false`) — Logik trotzdem verifizierbar.

- [ ] **Step 4: Archivieren-Button nachrüsten (bekanntes UI-Loch) + Aufräumen + Commit**

Die `archive`-Mutation existiert ohne UI (gleiche Lücke wie beim Audit-Modul, dort im Walkthrough nachgerüstet). Auf der Detailseite (`app/(dashboard)/incoming-goods/[id]/page.tsx`) bei den Header-Actions ergänzen — Imports: `useMutation`, `AlertDialog`-Komponenten, `useState`:

```tsx
            {can("incomingGoods:manage") && (
              <Button variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setArchiveOpen(true)}>
                Archivieren
              </Button>
            )}
```

plus State `const [archiveOpen, setArchiveOpen] = useState(false);`, Mutation `const archiveCheck = useMutation(api.incomingGoods.archive);` und AlertDialog (Bestätigung „Prüfung archivieren? — verschwindet aus Liste und Monats-Ampel", Aktion: `await archiveCheck({ id: checkId }); router.push("/incoming-goods")`).

Dann aufräumen: Test-Prüfung („Test-Hersteller Walkthrough") über den neuen Button archivieren; Test-E-Mail am Standort Gerhard-Stalling-Straße in der Verwaltung wieder leeren. Reminder-Log-Einträge bleiben (historisches Protokoll, harmlos).

```bash
npx tsc --noEmit
git add -A
git commit -m "fix(wareneingang): Archivieren-Button auf Detailseite + Findings aus Runtime-Walkthrough"
```

---

## Bewusst NICHT in diesem Plan

- **Barcode-/QR-Scanner + OCR** — Beschluss: spätere Ausbaustufe (Bibliotheken + Kamera-Berechtigungs-Testaufwand)
- **E-Mail-Versand des Prüfberichts** (EmailJS der Quelle) — Beschluss: entfällt, zentrale Ablage im QMS
- **Eurocom-PDF-Branding** (977-Zeilen-Generator + Icon-Assets) — neuer Haus-Stil-Exporter mit identischem Inhalt; Branding bei Bedarf später
- **Prüfmittel + Berichtsarchiv** — eigene Pläne (Beschluss-Punkte 7–8)
- **AQL-Stichprobenrechner** (stand auf der alten Platzhalterseite) — nicht Teil der Quell-App und nicht beschlossen; Stichprobe erfolgt 1–2× monatlich gemäß AA 7.4.3
