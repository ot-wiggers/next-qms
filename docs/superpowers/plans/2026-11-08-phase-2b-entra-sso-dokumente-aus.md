# next-qms – Phase 2B (Entra-SSO, Dokumentenmodul aus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle melden sich in next-qms mit ihrem Microsoft-Konto an, der Zugang hängt an der Entra-Gruppe `QMS-Nutzer`. Das Dokumentenmodul ist nur noch ein lesbares Archiv. Dokumentnummern in Audits, Qualitätszielen und der Suche führen ins QM-Handbuch in SharePoint.

**Architecture:**
- **Anmeldung:** Convex Auth bekommt den Anbieter `MicrosoftEntraID` (aus dem installierten `@auth/core`) neben `Password`.
  - Den Zugang regelt Entra selbst (Unternehmensanwendung mit *Zuweisung erforderlich*, Gruppe `QMS-Nutzer`).
  - `createOrUpdateUser` übernimmt bestehende Konten über die E-Mail. Neue Konten entstehen nur über Entra.
  - Passwort bleibt Notzugang für eine Allowlist.
- **Dokumentenmodul:** eine Sperre in `hasPermission`, das von Server und Oberfläche gemeinsam genutzt wird. Dazu ein einmaliges Aufräumskript und das Entfernen von Cron, Dashboard-Kacheln und Menüpunkt.
- **Links:** ein Helfer `convex/lib/qmHandbuch.ts` (URL und Nummernerkennung) und eine kleine Link-Komponente.

**Tech Stack:** Next.js 16 (App Router), Convex 1.32 self-hosted (Dokploy), `@convex-dev/auth` 0.0.90, `@auth/core` 0.37, vitest 4 + convex-test, Microsoft Entra ID; für die Gruppe PowerShell 7.4/PnP aus `wiggers-intranet`.

**Spec:** `docs/superpowers/specs/2026-11-08-phase-2b-entra-sso-dokumente-aus-design.md`

**Arbeitsweise:**
- **Teil A** (Task 1–5, SSO) auf `master`.
- **Teil B** (Task 6–10, Dokumentenmodul aus) auf dem Branch `phase-2b-dokumente-aus`. Gemergt wird erst, wenn Phase 2A in Prod läuft (2A-Plan Task 12).
- **Teil C** (Task 11) ist der Rollout.
- **Prüfschritte:** `npm test` (vorher 22 grün), `npx tsc --noEmit`, `npx tsc --noEmit -p convex`. `npm run lint` ist im Bestand rot und kein Prüfschritt.
- **Prod-Befehle:** immer mit `--env-file .env.server.local`. Fehlt die Datei: `scripts/convex-server-key.sh`. Lokal gilt `.env.local` (Docker-Container `nextqms-local-convex`).
- **Secrets** nur per Zwischenablage an `npx convex env set`, nie in Dateien oder Befehlszeilen.

---

## Dateistruktur

| Datei | Änderung |
|---|---|
| `convex/auth.ts` | Entra-Anbieter, Allowlist für Passwort, `createOrUpdateUser` mit E-Mail-Übernahme |
| `convex/auth.test.ts` | Tests Allowlist und Konto-Zuordnung |
| `app/(auth)/login/page.tsx` | Knopf „Mit Microsoft anmelden“, Passwort eingeklappt, kein Registrieren |
| `e2e/elearning.spec.ts` | Login öffnet den Notzugang |
| `lib/types/domain.ts` | Aktion `documents:confirm` |
| `convex/lib/permissions.ts` | Sperre aller `documents:*` außer Lesen; Lesen nur Admin, QMB, Auditor |
| `convex/lib/permissions.test.ts` | **neu** |
| `convex/documents.ts` | `confirmRead` → `documents:confirm`; `checkReviewDates` raus, `closeOpenDocumentTasks` rein |
| `convex/documentReviews.ts` | `submitReview` → `documents:review` |
| `convex/documents.test.ts` | **neu** |
| `convex/crons.ts` | Cron `check-document-review-dates` raus |
| `convex/lib/qmHandbuch.ts`, `convex/lib/qmHandbuch.test.ts` | **neu**: URL, Nummernerkennung |
| `components/shared/qm-dokument-links.tsx` | **neu**: Links zu gefundenen Nummern |
| `app/(dashboard)/audits/[id]/page.tsx`, `app/(dashboard)/quality-objectives/page.tsx`, `components/shared/command-search.tsx` | Links ins QM-Handbuch |
| `components/layout/sidebar.tsx` | „QM-Handbuch“ extern, „Dokumentenarchiv“, kein Graph |
| `app/(dashboard)/documents/layout.tsx` | **neu**: Archiv-Hinweis |
| `app/(dashboard)/page.tsx`, `convex/dashboard.ts` | Dokument-Kacheln und -Queries raus |
| `components/domain/documents/document-detail.tsx` | Lesebestätigungs-Knopf raus |
| gelöscht: `components/domain/dashboard/document-status-chart.tsx`, `upcoming-reviews-widget.tsx`, `read-confirmation-widget.tsx`, `components/domain/documents/recent-documents-widget.tsx`, `read-confirmation-button.tsx` | nicht mehr genutzt |
| `~/Development/wiggers-intranet/config/wiggers.psd1`, `docs/sitemap.md` | Gruppe `QMS-Nutzer` |

---

## Teil A – Entra-SSO

### Task 1: Entra-Anmeldung im Backend

**Files:**
- Modify: `convex/auth.ts`
- Test: `convex/auth.test.ts`

- [ ] **Step 1: Failing tests schreiben** – `convex/auth.test.ts` komplett ersetzen:

```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { assertSignupAllowed, assertPasswordLoginAllowed, createOrUpdateUser } from "./auth";

describe("Registrierungssperre", () => {
  it("lässt nur Firmen-Adressen zu", () => {
    expect(() => assertSignupAllowed(" Max.Muster@OT-Wiggers.de ")).not.toThrow();
    expect(() => assertSignupAllowed("probe@example.com")).toThrow(/ot-wiggers\.de/);
    expect(() => assertSignupAllowed("x@ot-wiggers.de.evil.com")).toThrow();
    expect(() => assertSignupAllowed("")).toThrow();
  });
});

describe("Passwort-Notzugang", () => {
  it("lässt nur Adressen aus der Allowlist zu", () => {
    const list = "admin@ot-wiggers.de, notfall@ot-wiggers.de";
    expect(() => assertPasswordLoginAllowed(" Admin@OT-Wiggers.de", list)).not.toThrow();
    expect(() => assertPasswordLoginAllowed("notfall@ot-wiggers.de", list)).not.toThrow();
    expect(() => assertPasswordLoginAllowed("kollegin@ot-wiggers.de", list)).toThrow(/Microsoft/);
    expect(() => assertPasswordLoginAllowed("admin@ot-wiggers.de", "")).toThrow(/Microsoft/);
  });
});

const entra = { id: "microsoft-entra-id" };

async function mitBestand() {
  const t = convexTest(schema);
  const base = { createdAt: Date.now(), updatedAt: Date.now(), isArchived: false };
  const userId = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Wiggers", type: "organization", code: "W", ...base });
    return await ctx.db.insert("users", {
      email: "Max.Muster@ot-wiggers.de", firstName: "Max", lastName: "Muster",
      role: "qmb", organizationId: orgId, status: "active", ...base,
    });
  });
  return { t, userId };
}

describe("Entra-Anmeldung", () => {
  it("übernimmt das bestehende Konto über die E-Mail (Groß-/Kleinschreibung egal)", async () => {
    const { t, userId } = await mitBestand();
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, { existingUserId: null, provider: entra, profile: { email: "max.muster@ot-wiggers.de", name: "Max Muster" } }),
    );
    expect(id).toBe(userId);
    expect(await t.run(async (ctx) => (await ctx.db.query("users").collect()).length)).toBe(1);
  });

  it("legt Unbekannte als Mitarbeiter an", async () => {
    const { t } = await mitBestand();
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as any, { existingUserId: null, provider: entra, profile: { email: "erika.beispiel@ot-wiggers.de", name: "Erika von Beispiel" } }),
    );
    const u = await t.run((ctx) => ctx.db.get(id));
    expect(u).toMatchObject({ email: "erika.beispiel@ot-wiggers.de", firstName: "Erika", lastName: "von Beispiel", role: "employee", status: "active" });
  });

  it("lehnt fremde Domains ab", async () => {
    const { t } = await mitBestand();
    await expect(
      t.run((ctx) => createOrUpdateUser(ctx as any, { existingUserId: null, provider: entra, profile: { email: "gast@example.com", name: "Gast" } })),
    ).rejects.toThrow(/ot-wiggers\.de/);
  });

  it("gibt bekannte Konten unverändert zurück", async () => {
    const { t, userId } = await mitBestand();
    const id = await t.run((ctx) => createOrUpdateUser(ctx as any, { existingUserId: userId, provider: entra, profile: {} }));
    expect(id).toBe(userId);
  });

  it("legt über Passwort keine Konten an, auch nicht per E-Mail-Übernahme", async () => {
    const { t } = await mitBestand();
    await expect(
      t.run((ctx) => createOrUpdateUser(ctx as any, { existingUserId: null, provider: { id: "password" }, profile: { email: "max.muster@ot-wiggers.de" } })),
    ).rejects.toThrow(/Microsoft/);
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

Run: `npm test -- convex/auth.test.ts`
Expected: FAIL, `assertPasswordLoginAllowed is not a function` bzw. `createOrUpdateUser is not a function`

- [ ] **Step 3: `convex/auth.ts` komplett ersetzen**

```ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import MicrosoftEntraID from "@auth/core/providers/microsoft-entra-id";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Neue Konten nur mit Firmen-E-Mail
export const SIGNUP_DOMAIN = "@ot-wiggers.de";
export function assertSignupAllowed(email: string) {
  if (!email.trim().toLowerCase().endsWith(SIGNUP_DOMAIN)) {
    throw new Error(`Registrierung nur mit einer ${SIGNUP_DOMAIN}-Adresse möglich.`);
  }
}

// Passwort ist nur noch Notzugang (z. B. wenn das Entra-Secret abgelaufen ist).
// Erlaubt sind die Adressen in der Convex-Variable AUTH_PASSWORD_ALLOWLIST (Komma-getrennt).
export function assertPasswordLoginAllowed(email: string, allowlist = process.env.AUTH_PASSWORD_ALLOWLIST ?? "") {
  const allowed = allowlist.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(email.trim().toLowerCase())) {
    throw new Error("Passwort-Anmeldung ist abgeschaltet. Bitte mit Microsoft anmelden.");
  }
}

const CustomPassword = Password({
  profile(params) {
    assertPasswordLoginAllowed(String(params.email ?? ""));
    return {
      email: params.email as string,
      name: `${params.firstName ?? ""} ${params.lastName ?? ""}`.trim(),
      firstName: (params.firstName as string) ?? "",
      lastName: (params.lastName as string) ?? "",
    };
  },
});

// Single-Tenant: Der Issuer enthält die Mandanten-ID, also kommen nur Wiggers-Konten durch.
// Wer rein darf, regelt Entra (Unternehmensanwendung: Zuweisung erforderlich, Gruppe QMS-Nutzer).
const Entra = MicrosoftEntraID({
  clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
  clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  // Eigenes Profil: ohne Graph-Fotoabruf; E-Mail notfalls aus dem Anmeldenamen (UPN)
  profile: (p) => ({
    id: p.sub,
    email: String(p.email ?? p.preferred_username ?? "").toLowerCase(),
    name: p.name ?? "",
  }),
});

type UpsertArgs = {
  existingUserId: Id<"users"> | null;
  provider: { id: string };
  profile: Record<string, unknown>;
};

export async function createOrUpdateUser(ctx: MutationCtx, args: UpsertArgs): Promise<Id<"users">> {
  if (args.existingUserId) return args.existingUserId;
  if (args.provider.id !== "microsoft-entra-id") {
    throw new Error("Neue Konten entstehen nur über die Microsoft-Anmeldung.");
  }

  // Bestehendes Konto (Passwort oder von der Verwaltung angelegt) über die E-Mail übernehmen
  const email = String(args.profile.email ?? "").trim().toLowerCase();
  // ponytail: Vollscan über ~35 Nutzer, weil alte Adressen nicht normalisiert gespeichert sind
  const users = await ctx.db.query("users").collect();
  const existing = users.find((u) => u.email.trim().toLowerCase() === email);
  if (existing) return existing._id;

  assertSignupAllowed(email);
  const org = await ctx.db
    .query("organizations")
    .filter((q) => q.eq(q.field("type"), "organization"))
    .first();
  if (!org) {
    throw new Error("Keine Organisation vorhanden. Bitte zuerst eine Organisation anlegen.");
  }

  const [firstName = "", ...rest] = String(args.profile.name ?? "").trim().split(/\s+/);
  const now = Date.now();
  return await ctx.db.insert("users", {
    email,
    firstName,
    lastName: rest.join(" "),
    role: "employee",
    organizationId: org._id,
    status: "active",
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Entra, CustomPassword],
  callbacks: {
    createOrUpdateUser: (ctx, args) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, args as unknown as UpsertArgs),
  },
});
```

- [ ] **Step 4: Tests und Typprüfung**

Run: `npm test && npx tsc --noEmit -p convex && npx tsc --noEmit`
Expected: `Tests  28 passed (28)`, die Typprüfung ohne Ausgabe

- [ ] **Step 5: Commit**

```bash
git add convex/auth.ts convex/auth.test.ts
git commit -m "feat(auth): Microsoft Entra ID als Anbieter, Konten per E-Mail übernehmen, Passwort nur Notzugang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Anmeldeseite

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `e2e/elearning.spec.ts`

- [ ] **Step 1: `app/(auth)/login/page.tsx` komplett ersetzen**

```tsx
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Leitet zu Microsoft weiter; zurück kommt man über SITE_URL mit ?code=…
  const handleMicrosoft = async () => {
    setError("");
    setIsLoading(true);
    try {
      await signIn("microsoft-entra-id", { redirectTo: "/" });
    } catch {
      setError("Microsoft-Anmeldung fehlgeschlagen");
      setIsLoading(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/");
    } catch {
      setError("Anmeldung fehlgeschlagen. Bitte mit Microsoft anmelden.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">QMS</CardTitle>
        <CardDescription>
          Qualitätsmanagementsystem — Sanitätshaus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" onClick={handleMicrosoft} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Mit Microsoft anmelden
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Notzugang mit Passwort (nur Administration)
          </summary>
          <form onSubmit={handlePassword} className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="login-email">E-Mail</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Passwort</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
              Anmelden
            </Button>
          </form>
        </details>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: E2E-Login anpassen** – in `e2e/elearning.spec.ts`:

```ts
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
```
ersetzen durch
```ts
  await page.goto("/login");
  await page.getByText("Notzugang mit Passwort").click();
  await page.locator("#login-email").fill(email);
```
und im Kommentar
```ts
 *  1. Ein registrierter Nutzer mit Login-Zugang — UI-Registrierung
 *     (Tab "Registrieren" auf /login) erzeugt Rolle "employee" per Default.
```
ersetzen durch
```ts
 *  1. Ein Nutzer mit Passwort, dessen Adresse in AUTH_PASSWORD_ALLOWLIST der
 *     lokalen Convex-Instanz steht (Registrieren gibt es seit Phase 2B nicht mehr).
```

- [ ] **Step 3: Lokale Allowlist setzen** (sonst kommt lokal niemand mehr per Passwort rein)

```bash
cd ~/Development/next-qms
npx convex data users --limit 500 --format jsonLines \
  | python3 -c 'import sys, json; print(",".join(u["email"] for u in (json.loads(l) for l in sys.stdin if l.strip()) if u.get("role") == "admin" and u.get("status") == "active"))' \
  | npx convex env set AUTH_PASSWORD_ALLOWLIST
npx convex dev --once
```
Expected: `✔ Successfully set AUTH_PASSWORD_ALLOWLIST`, danach `✔ Convex functions ready!`

- [ ] **Step 4: Von Hand prüfen** – `npm run dev`, dann http://localhost:3000/login öffnen:
  - Der Knopf „Mit Microsoft anmelden“ ist da. Lokal endet der Klick mit einem Fehler, weil lokal keine Redirect-URI registriert ist. Das ist so gewollt.
  - Notzugang aufklappen und mit dem Admin-Konto anmelden: Das Dashboard erscheint.
  - Mit einem anderen Passwortkonto anmelden: „Anmeldung fehlgeschlagen. Bitte mit Microsoft anmelden.“

- [ ] **Step 5: Typprüfung und Commit**

Run: `npx tsc --noEmit`
Expected: keine Ausgabe

```bash
git add "app/(auth)/login/page.tsx" e2e/elearning.spec.ts
git commit -m "feat(login): Mit Microsoft anmelden, Passwort nur als Notzugang, Registrierung entfernt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Entra einrichten – Gruppe QMS-Nutzer und App-Registrierung

**Files:**
- Modify: `~/Development/wiggers-intranet/config/wiggers.psd1`
- Modify (lokal, gitignored): `~/Development/wiggers-intranet/config/mitglieder.Prod.csv`

- [ ] **Step 1: Gruppe in die Konfiguration** – in `config/wiggers.psd1` unter `Groups` nach `'Premium-Nutzer'` einfügen:

```powershell
        'QMS-Nutzer'
```

- [ ] **Step 2: Intranet-Tests**

Run: `cd ~/Development/wiggers-intranet && pwsh -NoProfile -Command "Invoke-Pester -Path tests -Output Detailed"`
Expected: alle grün (die Zahl wie vor der Änderung)

- [ ] **Step 3: Alle Mitarbeitenden in die Gruppe** (Spec-Entscheidung 2)

```bash
cd ~/Development/wiggers-intranet
awk -F';' -v OFS=';' 'NR > 1 && $2 ~ /Alle-Mitarbeitenden/ && $2 !~ /QMS-Nutzer/ { $2 = $2 ",QMS-Nutzer" } 1' \
  config/mitglieder.Prod.csv > config/mitglieder.Prod.csv.neu && mv config/mitglieder.Prod.csv.neu config/mitglieder.Prod.csv
grep -c 'QMS-Nutzer' config/mitglieder.Prod.csv
```
Expected: so viele Zeilen wie Zeilen mit `Alle-Mitarbeitenden`

- [ ] **Step 4: Gruppe anlegen und füllen** (erst Test, dann Prod, wie im Intranet üblich)

```bash
pwsh ./scripts/Invoke-Provisioning.ps1 -Environment Test -Phase 1
pwsh ./scripts/Invoke-Provisioning.ps1 -Environment Prod -Phase 1
pwsh ./scripts/Test-Provisioning.ps1 -Environment Prod -Phase 1
```
Expected: `+ Gruppe QMS-Nutzer` (Test: `QMS-Nutzer-Test`), beim Prüfen „Alles grün.“

- [ ] **Step 5: Commit im Intranet-Repo** (nur diese Datei)

```bash
git commit config/wiggers.psd1 -m "feat: Entra-Gruppe QMS-Nutzer für next-qms (Phase 2B)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Callback-Domain ablesen** – Dokploy → Compose-Service `nextqms-convex` → *Environment* → Wert von `CONVEX_SITE_ORIGIN` notieren (die Domain auf Port 3211).

- [ ] **Step 7: App registrieren** (entra.microsoft.com, von Hand)
  1. *Identität → Anwendungen → App-Registrierungen → Neue Registrierung*
     - Name: `next-qms`
     - Unterstützte Kontotypen: *Nur Konten in diesem Organisationsverzeichnis*
     - Umleitungs-URI: Plattform *Web*, `<CONVEX_SITE_ORIGIN aus Step 6>/api/auth/callback/microsoft-entra-id`
     - *Registrieren*
  2. *API-Berechtigungen*: Microsoft Graph `User.Read` (delegiert) ist voreingestellt → *Administratorzustimmung für Wiggers erteilen*.
  3. *Unternehmensanwendungen → next-qms → Eigenschaften*: *Zuweisung erforderlich* = **Ja** → *Speichern*.
  4. *Benutzer und Gruppen → Benutzer/Gruppe hinzufügen*: Gruppe `QMS-Nutzer` → *Zuweisen*.
  5. Den geheimen Clientschlüssel **noch nicht** anlegen. Er ist nur einmal sichtbar und wird in Task 5 direkt übernommen.

---

### Task 4: Benutzer abgleichen (vor dem SSO-Start)

Ziel: Jedes aktive next-qms-Konto hat dieselbe E-Mail wie das M365-Konto. Sonst entsteht beim ersten Microsoft-Login ein zweites Konto ohne Nachweise.

- [ ] **Step 1: Konten aus Prod holen und vergleichen**

```bash
cd ~/Development/next-qms
mkdir -p scripts/out
npx convex data users --env-file .env.server.local --limit 500 --format jsonLines > scripts/out/qms-users.jsonl
python3 - <<'EOF'
import csv, json
qms = [json.loads(l) for l in open("scripts/out/qms-users.jsonl") if l.strip()]
m365 = {r["UPN"].strip().lower() for r in csv.DictReader(open("../wiggers-intranet/config/mitglieder.Prod.csv"), delimiter=";") if (r.get("UPN") or "").strip()}
for u in qms:
    if u.get("status") == "active" and u["email"].strip().lower() not in m365:
        print("ohne M365-Konto:", u["email"], u.get("role"))
print(len(qms), "QMS-Konten,", len(m365), "M365-Konten")
EOF
```
Expected: nur die Summenzeile. Jede Zeile „ohne M365-Konto“ ist ein Fall für Step 2.

- [ ] **Step 2: Abweichungen korrigieren** (Kristof)
  - Tippfehler oder Alias: Adresse ändern unter *Verwaltung → Benutzer* (https://qms.ot-wiggers.de/admin/users).
  - Person ausgeschieden: *Status* auf *inaktiv* setzen.
  - Step 1 wiederholen, bis nur noch die Summenzeile kommt.

`scripts/out/` ist gitignored (`out/` in `.gitignore`); die Datei enthält E-Mail-Adressen und bleibt lokal.

---

### Task 5: Produktivstart SSO

- [ ] **Step 1: Stand prüfen**

Run: `git status --short && git log --oneline -3 && npm test`
Expected: kein lokaler Rest, oben die Commits aus Task 1 und 2, `Tests  28 passed (28)`

- [ ] **Step 2: Client-ID setzen** – Entra → App-Registrierung `next-qms` → *Übersicht* → *Anwendungs-ID (Client)* kopieren:

```bash
pbpaste | npx convex env set AUTH_MICROSOFT_ENTRA_ID_ID --env-file .env.server.local
```
Expected: `✔ Successfully set AUTH_MICROSOFT_ENTRA_ID_ID`

- [ ] **Step 3: Secret anlegen und sofort setzen** – *Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel*, Beschreibung `convex-prod`, Ablauf 24 Monate → Spalte *Wert* kopieren:

```bash
pbpaste | npx convex env set AUTH_MICROSOFT_ENTRA_ID_SECRET --env-file .env.server.local
printf '' | pbcopy
```
Expected: `✔ Successfully set AUTH_MICROSOFT_ENTRA_ID_SECRET`. Danach im Kalender eine Erinnerung einen Monat vor Ablauf eintragen: „next-qms: Entra-Secret erneuern“.

- [ ] **Step 4: Übrige Variablen**

```bash
npx convex env set AUTH_MICROSOFT_ENTRA_ID_ISSUER https://login.microsoftonline.com/c3ee9942-cae7-4847-a21f-3a9dabcc2059/v2.0 --env-file .env.server.local
npx convex env set SITE_URL https://qms.ot-wiggers.de --env-file .env.server.local
python3 -c 'import json; print(",".join(u["email"] for u in (json.loads(l) for l in open("scripts/out/qms-users.jsonl") if l.strip()) if u.get("role") == "admin" and u.get("status") == "active"))' \
  | npx convex env set AUTH_PASSWORD_ALLOWLIST --env-file .env.server.local
npx convex env list --env-file .env.server.local | cut -d= -f1 | sort
```
Expected: Die Liste enthält `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_PASSWORD_ALLOWLIST`, `JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL`. Die Mandanten-ID stammt aus `wiggers-intranet/config/wiggers.psd1` (`TenantId`).

- [ ] **Step 5: Funktionen deployen**

Run: `npx convex deploy --env-file .env.server.local -y`
Expected: `✔ Deployed Convex functions to https://convex-qms.ot-wiggers.de`

- [ ] **Step 6: Frontend deployen**

Run: `git push origin master`
Danach in Dokploy beim Service der Next-App den Build abwarten, oder *Deploy* auslösen, falls kein Auto-Deploy eingerichtet ist.
Expected: https://qms.ot-wiggers.de/login zeigt „Mit Microsoft anmelden“.

- [ ] **Step 7: Rauchtest**
  1. Mit dem eigenen Konto „Mit Microsoft anmelden“ → Dashboard, Rolle *Administrator*, die eigenen Schulungsnachweise sind da.
  2. Gleiche Nutzer-ID prüfen:

     ```bash
     npx convex data authAccounts --env-file .env.server.local --format jsonLines | grep microsoft-entra-id
     ```
     Expected: eine Zeile, deren `userId` die `_id` des Admin-Kontos aus `scripts/out/qms-users.jsonl` ist. Die Anzahl in `npx convex data users --env-file .env.server.local --limit 500 --format jsonLines | wc -l` ist unverändert.
  3. Mit dem Testkonto aus `mitglieder.Test.csv` (nicht in `QMS-Nutzer`) im privaten Fenster anmelden → Microsoft zeigt AADSTS50105.
  4. Notzugang mit dem Admin-Passwort klappt. Ein anderes Passwortkonto bekommt „Bitte mit Microsoft anmelden“.

---

## Teil B – Dokumentenmodul aus

Vor Task 6: `git switch -c phase-2b-dokumente-aus`

### Task 6: Dokumentenmodul nur noch lesen

**Files:**
- Modify: `lib/types/domain.ts`
- Modify: `convex/lib/permissions.ts`
- Modify: `convex/documents.ts`
- Modify: `convex/documentReviews.ts`
- Create: `convex/lib/permissions.test.ts`
- Create: `convex/documents.test.ts`

- [ ] **Step 1: Failing tests schreiben**

`convex/lib/permissions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hasPermission } from "./permissions";
import type { PermissionAction } from "../../lib/types/domain";

const schreiben: PermissionAction[] = [
  "documents:create", "documents:review", "documents:approve",
  "documents:archive", "documents:delete", "documents:link", "documents:confirm",
];

describe("Dokumentenmodul als Archiv", () => {
  it("sperrt alle Schreibrechte, auch für Admin", () => {
    for (const a of schreiben) {
      expect(hasPermission("admin", a)).toBe(false);
      expect(hasPermission("qmb", a)).toBe(false);
      expect(hasPermission("department_lead", a)).toBe(false);
    }
  });

  it("lässt das Archiv nur Admin, QMB und Auditor lesen", () => {
    expect(hasPermission("admin", "documents:read")).toBe(true);
    expect(hasPermission("qmb", "documents:read")).toBe(true);
    expect(hasPermission("auditor", "documents:read")).toBe(true);
    expect(hasPermission("department_lead", "documents:read")).toBe(false);
    expect(hasPermission("employee", "documents:read")).toBe(false);
  });

  it("lässt alle anderen Rechte unverändert", () => {
    expect(hasPermission("admin", "capa:create")).toBe(true);
    expect(hasPermission("qmb", "audits:manage")).toBe(true);
    expect(hasPermission("employee", "complaints:create")).toBe(true);
  });
});
```

`convex/documents.test.ts`:
```ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

async function bestand() {
  const t = convexTest(schema);
  const now = Date.now();
  const base = { createdAt: now, updatedAt: now, isArchived: false };
  const ids = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Wiggers", type: "organization", code: "W", ...base });
    const adminId = await ctx.db.insert("users", {
      email: "admin@ot-wiggers.de", firstName: "Ad", lastName: "Min",
      role: "admin", organizationId: orgId, status: "active", ...base,
    });
    const docId = await ctx.db.insert("documentRecords", {
      documentType: "form_template", documentCode: "FB 8.2.4", version: "5",
      status: "APPROVED", responsibleUserId: adminId, ...base,
    });
    const offen = await ctx.db.insert("tasks", {
      type: "READ_DOCUMENT", title: "Lesen", status: "OPEN", priority: "MEDIUM",
      assigneeId: adminId, resourceType: "documentRecords", resourceId: docId, ...base,
    });
    await ctx.db.insert("tasks", {
      type: "READ_DOCUMENT", title: "Gelesen", status: "DONE", priority: "MEDIUM",
      assigneeId: adminId, resourceType: "documentRecords", resourceId: docId, ...base,
    });
    const fremd = await ctx.db.insert("tasks", {
      type: "GENERAL", title: "Anderes", status: "OPEN", priority: "MEDIUM",
      assigneeId: adminId, resourceType: "capa", resourceId: "x", ...base,
    });
    await ctx.db.insert("notifications", {
      userId: adminId, type: "DOCUMENT_REVIEW_DUE", title: "Prüfung", message: "FB 8.2.4",
      resourceType: "documentRecords", resourceId: docId, isRead: false, createdAt: now,
    });
    return { adminId, docId, offen, fremd };
  });
  return { t, ...ids };
}

describe("Dokumentenmodul abgeschaltet", () => {
  it("nimmt keine Lesebestätigung mehr an, auch nicht vom Admin", async () => {
    const { t, adminId, docId } = await bestand();
    await expect(
      t.withIdentity({ subject: String(adminId) }).mutation(api.documents.confirmRead, { documentRecordId: docId }),
    ).rejects.toThrow(/Keine Berechtigung/);
  });

  it("lässt das Archiv lesbar", async () => {
    const { t, adminId, docId } = await bestand();
    const doc = await t.withIdentity({ subject: String(adminId) }).query(api.documents.getById, { id: docId });
    expect(doc?.documentCode).toBe("FB 8.2.4");
  });
});
```

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

Run: `npm test -- convex/lib/permissions.test.ts convex/documents.test.ts`
Expected: FAIL in „sperrt alle Schreibrechte“, „nur Admin, QMB und Auditor“ und „keine Lesebestätigung“; „Archiv lesbar“ und „unverändert“ sind grün

- [ ] **Step 3: Neue Aktion** – in `lib/types/domain.ts`:

```ts
  | "documents:approve" | "documents:archive" | "documents:delete" | "documents:link"
```
ersetzen durch
```ts
  | "documents:approve" | "documents:archive" | "documents:delete" | "documents:link" | "documents:confirm"
```

- [ ] **Step 4: Rechte** – in `convex/lib/permissions.ts`:

Bei `qmb` die zwei Zeilen
```ts
    "documents:read", "documents:create", "documents:review",
    "documents:approve", "documents:archive", "documents:delete", "documents:link",
```
ersetzen durch
```ts
    "documents:read", // Phase 2B: nur Archiv
```
Bei `department_lead` die Zeile `    "documents:read", "documents:review", "documents:link",` löschen.
Bei `employee` die Zeile `    "documents:read",` löschen (die erste Zeile im `employee`-Array; beim `auditor` bleibt sie).

`hasPermission` ersetzen durch
```ts
export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  // Phase 2B: Dokumentenlenkung liegt im QM-Handbuch (SharePoint), hier nur noch Archiv
  if (action.startsWith("documents:") && action !== "documents:read") return false;
  if (role === "admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}
```

- [ ] **Step 5: Die zwei Schlupflöcher schließen**

`convex/documents.ts`, in `confirmRead`:
```ts
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:read");

    // Check document exists and is approved
```
ersetzen durch
```ts
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "documents:confirm"); // Phase 2B: immer gesperrt

    // Check document exists and is approved
```

`convex/documentReviews.ts`, in `submitReview`:
```ts
    const user = await getAuthenticatedUser(ctx);

    const review = await ctx.db
```
ersetzen durch
```ts
    const user = await requirePermission(ctx, "documents:review"); // Phase 2B: immer gesperrt

    const review = await ctx.db
```

- [ ] **Step 6: Tests und Typprüfung**

Run: `npm test && npx tsc --noEmit -p convex && npx tsc --noEmit`
Expected: `Tests  33 passed (33)`, die Typprüfung ohne Ausgabe

- [ ] **Step 7: Commit**

```bash
git add lib/types/domain.ts convex/lib/permissions.ts convex/lib/permissions.test.ts convex/documents.ts convex/documentReviews.ts convex/documents.test.ts
git commit -m "feat(dokumente): Modul nur noch lesbar (Archiv für Admin, QMB, Auditor)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Prüf-Cron aus, offene Dokument-Aufgaben schließen

**Files:**
- Modify: `convex/crons.ts`
- Modify: `convex/documents.ts`
- Test: `convex/documents.test.ts`

- [ ] **Step 1: Failing test** – in `convex/documents.test.ts` den Import ändern:

```ts
import { api } from "./_generated/api";
```
→
```ts
import { api, internal } from "./_generated/api";
```
und im `describe`-Block nach dem Test „lässt das Archiv lesbar“ anfügen:
```ts
  it("schließt offene Dokument-Aufgaben und -Hinweise genau einmal", async () => {
    const { t, offen, fremd } = await bestand();
    expect(await t.mutation(internal.documents.closeOpenDocumentTasks, {})).toEqual({ tasks: 1, notifications: 1 });
    expect(await t.mutation(internal.documents.closeOpenDocumentTasks, {})).toEqual({ tasks: 0, notifications: 0 });
    const [a, b] = await t.run(async (ctx) => [await ctx.db.get(offen), await ctx.db.get(fremd)]);
    expect(a?.status).toBe("CANCELLED");
    expect(b?.status).toBe("OPEN");
  });
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- convex/documents.test.ts`
Expected: FAIL im neuen Test (Funktion `documents:closeOpenDocumentTasks` gibt es nicht)

- [ ] **Step 3: Cron raus** – in `convex/crons.ts` diesen Block löschen:

```ts
// Check document review dates daily at 03:30 CET
crons.daily(
  "check-document-review-dates",
  { hourUTC: 2, minuteUTC: 30 },
  internal.documents.checkReviewDates
);

```

- [ ] **Step 4: Prüffunktion durch Aufräumskript ersetzen** – in `convex/documents.ts` alles ab der Zeile `// ============================================================` direkt über `// Internal: Review Date Checks (called by cron)` bis einschließlich `});` am Ende von `checkReviewDates` (direkt vor `/** Generate a signed upload URL for document images */`) ersetzen durch:

```ts
// ============================================================
// Phase 2B: Modul abgeschaltet – Dokumentenlenkung im QM-Handbuch (SharePoint)
// ============================================================

/** Einmalig nach dem Abschalten: offene Dokument-Aufgaben abbrechen und Dokument-Hinweise
 *  als gelesen markieren. Idempotent. `npx convex run documents:closeOpenDocumentTasks` */
export const closeOpenDocumentTasks = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_resource", (q) => q.eq("resourceType", "documentRecords"))
      .collect();
    let cancelled = 0;
    for (const t of tasks) {
      if (t.status === "DONE" || t.status === "CANCELLED") continue;
      await ctx.db.patch(t._id, { status: "CANCELLED", updatedAt: now });
      await logAuditEvent(ctx, {
        action: "STATUS_CHANGE",
        entityType: "tasks",
        entityId: t._id,
        previousStatus: t.status,
        newStatus: "CANCELLED",
        metadata: { grund: "Dokumentenmodul abgeschaltet (Phase 2B)" },
      });
      cancelled++;
    }

    // ponytail: Vollscan der Hinweise (wenige Hundert), es gibt keinen Index auf resourceType
    const notifications = await ctx.db.query("notifications").collect();
    let read = 0;
    for (const n of notifications) {
      if (n.isRead || n.resourceType !== "documentRecords") continue;
      await ctx.db.patch(n._id, { isRead: true, readAt: now });
      read++;
    }
    return { tasks: cancelled, notifications: read };
  },
});
```

- [ ] **Step 5: Tests und Typprüfung**

Run: `grep -rn "checkReviewDates" convex --include='*.ts' | grep -v _generated; npm test && npx tsc --noEmit -p convex`
Expected: `grep` findet nichts, `Tests  34 passed (34)`, die Typprüfung ohne Ausgabe

- [ ] **Step 6: Commit**

```bash
git add convex/crons.ts convex/documents.ts convex/documents.test.ts
git commit -m "feat(dokumente): Prüf-Cron aus, Aufräumskript für offene Dokument-Aufgaben

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Links ins QM-Handbuch

**Files:**
- Create: `convex/lib/qmHandbuch.ts`, `convex/lib/qmHandbuch.test.ts`
- Create: `components/shared/qm-dokument-links.tsx`
- Modify: `app/(dashboard)/audits/[id]/page.tsx`
- Modify: `app/(dashboard)/quality-objectives/page.tsx`
- Modify: `components/shared/command-search.tsx`

- [ ] **Step 1: Failing test** – `convex/lib/qmHandbuch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { QM_HANDBUCH_URL, qmDokumentUrl, findQmDokumentnummern } from "./qmHandbuch";

describe("QM-Handbuch-Links", () => {
  it("baut die gefilterte Bibliotheksansicht", () => {
    expect(QM_HANDBUCH_URL).toBe("https://otwiggers.sharepoint.com/sites/qm-handbuch");
    expect(qmDokumentUrl("FB 4.2.4")).toBe(
      "https://otwiggers.sharepoint.com/sites/qm-handbuch/QMDokumente/Forms/AllItems.aspx?FilterField1=Dokumentnummer&FilterValue1=FB%204.2.4",
    );
    expect(qmDokumentUrl("QMH 1+2")).toContain("FilterValue1=QMH%201%2B2");
  });

  it("findet Dokumentnummern im Freitext", () => {
    expect(findQmDokumentnummern("Nachweis: FB 8.2.4 Rev. 5, PA 8.2.4 und AA OT-01.")).toEqual(["FB 8.2.4", "PA 8.2.4", "AA OT-01"]);
    expect(findQmDokumentnummern("PA 7.5.3/7.5.4 sowie QMH 1+2, FO B-09, FB 0")).toEqual(["PA 7.5.3/7.5.4", "QMH 1+2", "FO B-09", "FB 0"]);
    expect(findQmDokumentnummern("FB 8.2.4 und nochmal FB 8.2.4")).toEqual(["FB 8.2.4"]);
    expect(findQmDokumentnummern("Pflegebett 4.2 kg, FAQ 12, OTWin")).toEqual([]);
    expect(findQmDokumentnummern(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Test schlägt fehl**

Run: `npm test -- convex/lib/qmHandbuch.test.ts`
Expected: FAIL, `Failed to resolve import "./qmHandbuch"`

- [ ] **Step 3: Helfer** – `convex/lib/qmHandbuch.ts`:

```ts
// QM-Handbuch in SharePoint (Phase 2A): Master für alle gelenkten QM-Dokumente.
// Von Server und Oberfläche genutzt (wie permissions.ts).
export const QM_HANDBUCH_URL = "https://otwiggers.sharepoint.com/sites/qm-handbuch";

// Eine Dokumentnummer gehört oft zu mehreren Dokumenten (z. B. fünfmal „FB 6.4.0“),
// darum die nach Nummer gefilterte Bibliotheksansicht statt eines Einzellinks.
export function qmDokumentUrl(nummer: string): string {
  return `${QM_HANDBUCH_URL}/QMDokumente/Forms/AllItems.aspx?FilterField1=Dokumentnummer&FilterValue1=${encodeURIComponent(nummer)}`;
}

// ponytail: erkennt QMH/PA/AA/FB/FO + Ziffernfolge (auch „a/b“, „1+2“) oder „XX-01“; „FO W“ bewusst nicht (mehrdeutig)
const NUMMER = /\b(?:QMH|PA|AA|FB|FO) (?:[A-Z]{1,2}-\d{2}|\d+(?:\.\d+)*(?:[/+]\d+(?:\.\d+)*)?)(?!\w)/g;

export function findQmDokumentnummern(text?: string): string[] {
  return [...new Set(text?.match(NUMMER) ?? [])];
}
```

- [ ] **Step 4: Test grün**

Run: `npm test -- convex/lib/qmHandbuch.test.ts`
Expected: `Tests  2 passed (2)`

- [ ] **Step 5: Komponente** – `components/shared/qm-dokument-links.tsx`:

```tsx
import { ExternalLink } from "lucide-react";
import { findQmDokumentnummern, qmDokumentUrl } from "../../convex/lib/qmHandbuch";

/** Dokumentnummern im Text als Links ins QM-Handbuch (SharePoint). Keine Nummer → nichts. */
export function QmDokumentLinks({ text }: { text?: string }) {
  const nummern = findQmDokumentnummern(text);
  if (nummern.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {nummern.map((n) => (
        <a
          key={n}
          href={qmDokumentUrl(n)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
        >
          {n}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </span>
  );
}
```

- [ ] **Step 6: Audit-Nachweis** – in `app/(dashboard)/audits/[id]/page.tsx`:

Nach `import { toast } from "sonner";` einfügen:
```tsx
import { QmDokumentLinks } from "@/components/shared/qm-dokument-links";
```
Dann
```tsx
              <Textarea id="evidence" rows={2} value={answerForm.evidence}
                onChange={(e) => setAnswerForm({ ...answerForm, evidence: e.target.value })} />
            </div>
```
ersetzen durch
```tsx
              <Textarea id="evidence" rows={2} value={answerForm.evidence}
                onChange={(e) => setAnswerForm({ ...answerForm, evidence: e.target.value })} />
              <div className="mt-1"><QmDokumentLinks text={answerForm.evidence} /></div>
            </div>
```

- [ ] **Step 7: Qualitätsziele** – in `app/(dashboard)/quality-objectives/page.tsx`:

Nach `import { toast } from "sonner";` einfügen:
```tsx
import { QmDokumentLinks } from "@/components/shared/qm-dokument-links";
```
Dann
```tsx
          {obj.dataSource && <> · Quelle: {obj.dataSource}</>}
```
ersetzen durch
```tsx
          {obj.dataSource && <> · Quelle: {obj.dataSource} <QmDokumentLinks text={obj.dataSource} /></>}
```

- [ ] **Step 8: Schnellsuche** – in `components/shared/command-search.tsx`:

Nach `import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";` einfügen:
```tsx
import { qmDokumentUrl } from "../../convex/lib/qmHandbuch";
```
Dann
```tsx
                onSelect={() => navigate(`/documents/${doc._id}`)}
```
ersetzen durch
```tsx
                onSelect={() => {
                  // Phase 2B: gültige Fassung im QM-Handbuch (SharePoint)
                  onOpenChange(false);
                  window.open(qmDokumentUrl(doc.documentCode), "_blank", "noopener");
                }}
```

- [ ] **Step 9: Tests und Typprüfung**

Run: `npm test && npx tsc --noEmit`
Expected: `Tests  36 passed (36)`, die Typprüfung ohne Ausgabe

- [ ] **Step 10: Commit**

```bash
git add convex/lib/qmHandbuch.ts convex/lib/qmHandbuch.test.ts components/shared/qm-dokument-links.tsx "app/(dashboard)/audits/[id]/page.tsx" "app/(dashboard)/quality-objectives/page.tsx" components/shared/command-search.tsx
git commit -m "feat(dokumente): Dokumentnummern verlinken ins QM-Handbuch (Audit-Nachweis, Q-Ziele, Suche)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Navigation, Archiv-Hinweis, Dashboard

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Create: `app/(dashboard)/documents/layout.tsx`
- Modify: `app/(dashboard)/page.tsx`
- Modify: `convex/dashboard.ts`
- Modify: `components/domain/documents/document-detail.tsx`
- Delete: fünf Widget-Dateien (siehe Step 6)

- [ ] **Step 1: Seitenleiste** – in `components/layout/sidebar.tsx`:

Nach `import { useEffect, useState } from "react";` einfügen:
```tsx
import { QM_HANDBUCH_URL } from "@/convex/lib/qmHandbuch";
```
In der Icon-Importliste die Zeile `  GitBranch,` löschen.
Dann
```tsx
      { label: "Dokumente", href: "/documents", icon: FileText, permission: "documents:read" },
      { label: "Dokumenten-Graph", href: "/documents/graph", icon: GitBranch, permission: "documents:read" },
```
ersetzen durch
```tsx
      { label: "QM-Handbuch", href: QM_HANDBUCH_URL, icon: BookOpen },
      { label: "Dokumentenarchiv", href: "/documents", icon: FileText, permission: "documents:read" },
```
In `NavLink`
```tsx
    <Link
      href={item.href}
      className={cn(
```
ersetzen durch
```tsx
    <Link
      href={item.href}
      target={item.href.startsWith("http") ? "_blank" : undefined}
      className={cn(
```

- [ ] **Step 2: Archiv-Hinweis** – `app/(dashboard)/documents/layout.tsx`:

```tsx
import { QM_HANDBUCH_URL } from "@/convex/lib/qmHandbuch";

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Archiv der früheren Dokumentenlenkung – nur lesen. Gültige Fassungen und Lesebestätigungen
        finden Sie im{" "}
        <a href={QM_HANDBUCH_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          QM-Handbuch (SharePoint)
        </a>
        .
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Lesebestätigungs-Knopf raus** – in `components/domain/documents/document-detail.tsx` die Zeile
```tsx
import { ReadConfirmationButton } from "./read-confirmation-button";
```
und den Block
```tsx
          {/* Read confirmation button (only for APPROVED docs) */}
          {document.status === "APPROVED" && (
            <div className="mt-4">
              <ReadConfirmationButton documentRecordId={document._id} />
            </div>
          )}
```
löschen.

- [ ] **Step 4: Dashboard-Seite** – `app/(dashboard)/page.tsx` komplett ersetzen:

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { TaskListWidget } from "@/components/domain/tasks/task-list-widget";
import { TrainingStatusWidget } from "@/components/domain/training/training-status-widget";
import { KpiCard } from "@/components/domain/dashboard/kpi-card";
import { DevicesAmpelCard } from "@/components/domain/dashboard/devices-ampel-card";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { USER_ROLE_LABELS } from "@/lib/types/enums";
import { AlertTriangle, GraduationCap } from "lucide-react";

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { can, role } = usePermissions();

  const viewAll = can("dashboard:view_all");

  const overdueTasks = useQuery(api.dashboard.overdueTasks);
  const trainingQuota = useQuery(api.dashboard.trainingQuota);

  const greeting = user
    ? `Willkommen, ${user.firstName}`
    : "Willkommen";

  const roleLabel = role ? USER_ROLE_LABELS[role] : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting}
        description={roleLabel ? `Angemeldet als ${roleLabel}` : undefined}
      />

      <p className="-mt-2 text-sm text-muted-foreground">
        {viewAll
          ? "Org-weite Sicht — alle Bereiche."
          : can("tasks:team")
            ? "Sicht auf Ihr Team."
            : "Ihre persönliche Sicht — nur Ihre eigenen Daten."}
      </p>

      {/* KPI row — Dokumente und Lesebestätigungen laufen seit Phase 2B im QM-Handbuch (SharePoint) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="Überfällige Aufgaben"
          value={overdueTasks?.count ?? "–"}
          icon={AlertTriangle}
          trend={overdueTasks && overdueTasks.count > 0 ? "up" : undefined}
          loading={!overdueTasks}
        />
        <KpiCard
          title="Schulungsquote"
          value={trainingQuota ? `${trainingQuota.percentage}%` : "–"}
          icon={GraduationCap}
          loading={!trainingQuota}
          description={
            trainingQuota
              ? `${trainingQuota.completed} / ${trainingQuota.total}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TaskListWidget />
        {can("trainings:list") && <TrainingStatusWidget />}
        <DevicesAmpelCard />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Dashboard-Queries** – in `convex/dashboard.ts` diese fünf Exporte samt dem `/** … */`-Kommentar direkt darüber löschen: `openReviews`, `documentStatusDistribution`, `upcomingReviews`, `readConfirmationRates`, `myOpenConfirmations`. Danach bleiben nur der Kopf (Imports, `resolveScope`, `scopedUserIds`), `overdueTasks` und `trainingQuota`.

Run: `grep -n "^export const" convex/dashboard.ts`
Expected:
```
export const overdueTasks = query({
export const trainingQuota = query({
```

- [ ] **Step 6: Ungenutzte Widgets löschen**

```bash
git rm components/domain/dashboard/document-status-chart.tsx \
  components/domain/dashboard/upcoming-reviews-widget.tsx \
  components/domain/dashboard/read-confirmation-widget.tsx \
  components/domain/documents/recent-documents-widget.tsx \
  components/domain/documents/read-confirmation-button.tsx
grep -rnE "DocumentStatusChart|UpcomingReviewsWidget|ReadConfirmationWidget|RecentDocumentsWidget|ReadConfirmationButton|openReviews|documentStatusDistribution|upcomingReviews|readConfirmationRates|myOpenConfirmations" app components lib convex --include='*.ts' --include='*.tsx' | grep -v _generated
```
Expected: `grep` findet nichts

- [ ] **Step 7: Typprüfung, Tests, Build**

Run: `npx convex codegen && npx tsc --noEmit && npx tsc --noEmit -p convex && npm test && npm run build`
Expected: Typprüfung ohne Ausgabe, `Tests  36 passed (36)`, Build mit `✓ Compiled successfully`

- [ ] **Step 8: Von Hand prüfen (lokal)** – `npx convex dev --once`, `npm run dev`, als Admin über den Notzugang anmelden:
  - In der Seitenleiste stehen „QM-Handbuch“ (öffnet SharePoint im neuen Tab) und „Dokumentenarchiv“, „Dokumenten-Graph“ ist weg.
  - `/documents` zeigt den gelben Archiv-Hinweis und keine Knöpfe *Neu*, *Archivieren*, *Löschen*. Die Detailseite zeigt keine Knöpfe *Bearbeiten*, *Freigeben*, *Lesebestätigung*.
  - Dashboard: zwei Kacheln, keine Dokument-Widgets.
  - Schnellsuche (⌘K) „FB 8.2.4“ → Klick öffnet `…/QMDokumente/Forms/AllItems.aspx?FilterField1=Dokumentnummer&FilterValue1=FB%208.2.4`.
  - Audit öffnen → Prüfpunkt → „Nachweis“ mit „PA 8.2.4 Rev. 3“ füllen → darunter erscheint der Link „PA 8.2.4“.

- [ ] **Step 9: Commit**

```bash
git add components/layout/sidebar.tsx "app/(dashboard)/documents/layout.tsx" "app/(dashboard)/page.tsx" convex/dashboard.ts components/domain/documents/document-detail.tsx convex/_generated
git commit -m "feat(dokumente): Archiv-Hinweis, QM-Handbuch in der Navigation, Dokument-Widgets entfernt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Produktivstart Dokumentenmodul aus

**Voraussetzung:** Phase 2A ist in Prod abgeschlossen (2A-Plan Task 12): 129 Dokumente in `QMDokumente`, F3a-QM und F4 laufen.

- [ ] **Step 1: Bestand einfrieren** (Spec-Entscheidung 5)

```bash
cd ~/Development/next-qms
f="scripts/out/next-qms-abschaltung-$(date +%F).zip"
npx convex export --path "$f" --include-file-storage --env-file .env.server.local
shasum -a 256 "$f" > "$f.sha256"
```
Expected: `✔ Downloaded snapshot …` und die Prüfsummendatei

- [ ] **Step 2: Aufs NAS** – beide Dateien in den NAS-Ordner `QM-Archiv/next-qms/` kopieren und dort mit `shasum -a 256 -c next-qms-abschaltung-*.zip.sha256` prüfen (Expected: `OK`). Danach die lokalen Kopien löschen; sie enthalten Kundendaten aus Reklamationen. Nicht nach SharePoint oder OneDrive.

- [ ] **Step 3: Mergen und deployen**

```bash
git switch master
git merge --no-ff phase-2b-dokumente-aus -m "Merge Phase 2B: Dokumentenmodul aus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
npm test
npx convex deploy --env-file .env.server.local -y
git push origin master
```
Expected: `Tests  36 passed (36)`, `✔ Deployed Convex functions to https://convex-qms.ot-wiggers.de`, dann Build und Deploy der Next-App in Dokploy

- [ ] **Step 4: Aufräumen**

```bash
npx convex run documents:closeOpenDocumentTasks --env-file .env.server.local
npx convex run documents:closeOpenDocumentTasks --env-file .env.server.local
```
Expected: erst `{ "notifications": <n>, "tasks": <m> }`, beim zweiten Lauf `{ "notifications": 0, "tasks": 0 }`

- [ ] **Step 5: Rauchtest Prod** – die Prüfungen aus Task 9 Step 8 auf https://qms.ot-wiggers.de wiederholen, mit Microsoft-Anmeldung. Zusätzlich: Der Link aus der Suche zeigt in SharePoint die Dokumente der Nummer.

---

## Teil C – Rollout

### Task 11: An die Belegschaft geben

- [ ] **Step 1: Module schalten** – *Admin → Einstellungen*: `AUDITS`, `CAPA`, `COMPLAINTS`, `TRAINING_MATRIX`, `DEVICES` an. Die übrigen Flags lassen, wie sie sind; das entscheidet die QMB.

- [ ] **Step 2: Ankündigung** – Kristof postet im Team *Wiggers*, Kanal *Qualitätsmanagement* (keine Patientendaten, nur Link):

> **QMS jetzt mit Microsoft-Anmeldung**
> Das QMS erreichen Sie unter https://qms.ot-wiggers.de (auch über den Quicklink im Intranet). Bitte „Mit Microsoft anmelden“ wählen, dasselbe Konto wie für Teams. Ein Passwort brauchen Sie nicht mehr.
> QM-Dokumente und Lesebestätigungen gibt es nur noch im QM-Handbuch in SharePoint.

- [ ] **Step 3: Intranet-Doku nachziehen** – in `~/Development/wiggers-intranet/docs/sitemap.md` `` `QMS-Nutzer` 📝 2B `` durch `` `QMS-Nutzer` ✅ `` ersetzen, dann:

```bash
cd ~/Development/wiggers-intranet
git commit docs/sitemap.md -m "docs: QMS-Nutzer und next-qms-SSO live (Phase 2B)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Nach einer Woche nachsehen**

```bash
cd ~/Development/next-qms
npx convex data authAccounts --env-file .env.server.local --limit 500 --format jsonLines | grep -c microsoft-entra-id
npx convex data users --env-file .env.server.local --limit 500 --format jsonLines | grep -c '"status":"active"'
```
Expected: Die erste Zahl nähert sich der zweiten. Neu angelegte Konten (Rolle *Mitarbeiter*) prüft die Verwaltung unter *Verwaltung → Benutzer* und vergibt bei Bedarf eine andere Rolle.

---

## Nicht in diesem Plan

- Rollen aus Entra-Gruppen ableiten (Spec-Entscheidung 3).
- Löschen von Dokumentdaten, Tabellen oder Import-Funktionen.
- Inhalte der E-Mail-Benachrichtigungen (Reklamationstitel über Resend, siehe Spec 9).
- next-qms als Teams-Tab.
