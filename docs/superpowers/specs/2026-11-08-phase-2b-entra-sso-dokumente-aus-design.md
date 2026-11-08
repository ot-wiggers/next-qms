# Phase 2B – next-qms: Entra-SSO, Dokumentenmodul aus, Links ins QM-Handbuch – Design

**Stand:** 2026-11-08 · **Status:** Entwurf zur Freigabe · **Verantwortlich:** Kristof Eilers
**Bezug:** Gesamt-Design `~/Development/wiggers-intranet/docs/superpowers/specs/2026-11-05-wiggers-intranet-design.md` (2.3, 3, 5.1, 9, 11 Phase 2) und Phase 2A `…/2026-11-06-qm-handbuch-design.md`.

## Offene Entscheidungen (Empfehlung gesetzt)

| # | Frage | Empfehlung (so geplant) | Alternative |
|---|---|---|---|
| 1 | Bleibt die Passwort-Anmeldung? | Nur als **Notzugang** für die Adressen in der Convex-Variable `AUTH_PASSWORD_ALLOWLIST`, gefüllt mit den aktiven Admin-Konten (heute Kristof). Registrierung per Passwort ist aus. Grund: Sonst umgeht jedes der 22 Passwortkonten die Gruppe `QMS-Nutzer`, und Ausgeschiedene kämen weiter rein. | Passwort ganz aus (kein Notzugang, wenn das Entra-Secret abläuft) oder für alle lassen |
| 2 | Wer kommt in `QMS-Nutzer`? | **Alle Mitarbeitenden** (jede Zeile mit `Alle-Mitarbeitenden` in `mitglieder.Prod.csv`). Reklamationen, Wareneingang, E-Learning und Schulungsnachweise betreffen alle. | Nur Leitung und QMB |
| 3 | Rollen aus Entra-Gruppen ableiten? | **Nein.** Rollen bleiben in next-qms (Verwaltung → Benutzer). Neue Konten starten als *Mitarbeiter*. | Gruppe `QMB` → Rolle `qmb` bei jeder Anmeldung |
| 4 | Wer sieht das Dokumentenarchiv? | **Admin, QMB, Auditor.** Alle anderen arbeiten nur noch mit SharePoint. | Alle lesen weiter |
| 5 | Archiv lesend behalten oder exportieren? | **Beides, ohne Aufwand:** Die Daten bleiben unverändert in Convex und sind in der App nur lesbar. Zusätzlich wird am Abschalttag eine Gesamtsicherung (`npx convex export --include-file-storage`) eingefroren und auf dem NAS abgelegt (10 Jahre, wie 2A). **Nicht** nach SharePoint: Die Sicherung enthält Reklamationen mit Kundennamen. | Nur Export, Modul-Code löschen |
| 6 | Link auf ein Dokument | **Gefilterte Bibliotheksansicht** nach *Dokumentnummer*. Eine Nummer gehört oft zu mehreren Dokumenten (siehe 2.3), die Ansicht zeigt dann alle. | Einzellinks über eine Zuordnungstabelle Nummer+Titel → URL |
| 7 | Offene Dokument-Aufgaben und -Hinweise | **Abbrechen** (Status *Abgebrochen*) bzw. als gelesen markieren, einmalig per Skript, mit Audit-Log | Stehen lassen |
| 8 | Reihenfolge | **SSO zuerst** (unabhängig von 2A). **Dokumentenmodul erst aus, wenn 2A in Prod läuft** (2A-Plan Task 12), weil der 2A-Abgleich die next-qms-Sicherung braucht und die Links sonst ins Leere zeigen. | Alles auf einmal nach 2A |
| 9 | Übrige Module | Bleiben unverändert, auch die, die das Gesamt-Design nicht nennt (Risiken, Q-Ziele, Managementbewertung, PMS, Wareneingang, MDR, E-Learning) | Weitere Module abschalten |

## 1. Ziel

- Alle melden sich mit ihrem Microsoft-Konto an. Wer in `QMS-Nutzer` ist, kommt rein, sonst niemand.
- Gelenkte Dokumente gibt es nur noch im QM-Handbuch (SharePoint). next-qms zeigt den alten Stand nur noch als Archiv.
- Wo next-qms Dokumente nennt, führt ein Klick ins QM-Handbuch.

**Erfolg heißt:**
- Kristof meldet sich per Microsoft an und landet in seinem bestehenden Konto (gleiche Rolle, gleiche Schulungsnachweise).
- Ein Konto außerhalb von `QMS-Nutzer` wird von Microsoft abgewiesen.
- Niemand kann in next-qms Dokumente anlegen, ändern, freigeben oder Lesebestätigungen abgeben. Der Bestand bleibt vollständig erhalten.
- Ein Klick auf „FB 8.2.4“ im Audit-Nachweis öffnet die Dokumente dieser Nummer in SharePoint.

## 2. Befund im Code (Stand `cafdd8b`)

### 2.1 Anmeldung
- Convex Auth 0.0.90 mit nur einem Anbieter: `Password` (`convex/auth.ts`). `@auth/core` 0.37 ist installiert und bringt `microsoft-entra-id` mit.
- Der Callback `createOrUpdateUser` legt bei der Registrierung eine Zeile in `users` an (Rolle *employee*, Domain-Sperre `@ot-wiggers.de`). `getAuthUserId` liefert direkt die `users`-ID. Eine Verknüpfung über die E-Mail gibt es nicht. Ein zweiter Anbieter würde daher für jede Person ein **zweites, leeres Konto** anlegen.
- `users.status = "inactive"` sperrt sofort (`convex/lib/withAuth.ts`). Das bleibt der Weg fürs Offboarding.
- Anmeldeseite `app/(auth)/login/page.tsx`: Tabs *Anmelden* / *Registrieren*. Der E2E-Test `e2e/elearning.spec.ts` nutzt `#login-email`, `#login-password` und den Knopf „Anmelden“.

### 2.2 Dokumentenmodul
- Tabellen: `documentRecords`, `readConfirmations`, `documentVersions`, `documentReviews`, `documentLinks`. Funktionen in `convex/documents.ts`, `documentReviews.ts`, `documentVersions.ts`, `documentLinks.ts`.
- Fast alle Schreibzugriffe laufen über `requirePermission(…, "documents:*")`. Ausnahmen: `confirmRead` prüft nur `documents:read`, `submitReview` gar keine Berechtigung.
- `hasPermission` (`convex/lib/permissions.ts`) wird von Server **und** Oberfläche (`usePermissions`) genutzt. Admin hat dort einen Platzhalter für alles.
- Cron `check-document-review-dates` erzeugt Prüf-Hinweise. Im 2A-Flow F4 gibt es das schon in SharePoint.
- Dashboard: sechs Kacheln und Widgets zu Dokumenten und Lesebestätigungen (`app/(dashboard)/page.tsx`, `convex/dashboard.ts`).
- Weitere Stellen: Seitenleiste (`components/layout/sidebar.tsx`), Schnellsuche (`convex/search.ts`, `components/shared/command-search.tsx`), Aufgaben vom Typ `READ_DOCUMENT` und `DOCUMENT_REVIEW_DUE`.

### 2.3 Bezüge aus anderen Modulen
- **Kein** Fremdschlüssel aus CAPA, Audits, Schulungen, Reklamationen o. Ä. auf `documentRecords`.
- Dokumente werden nur als **Freitext-Nummer** genannt:
  - `auditChecklistAnswers.evidence` („Nachweis (PA/AA/FB/QMH inkl. Revisionsstand)“, Prüfpunkt-Dialog in `app/(dashboard)/audits/[id]/page.tsx`)
  - `qualityObjectives.dataSource` („Quelle: FB 6.2.0“, `app/(dashboard)/quality-objectives/page.tsx`)
  - Aufgabentitel des Jahreszyklus („… (FB 5.6.0)“)
- **Nummern sind nicht eindeutig:** 129 Dokumente, 88 Nummern (z. B. fünf Dokumente „FB 6.4.0“, sechs „FB 6.2.0“). Formate: `PA 7.5.3/7.5.4`, `QMH 1+2`, `AA OT-01`, `FO B-09`, `FB 0`, `FB 7.1`, `FO W`.

### 2.4 Betrieb und Rollout-Stand
- Backend: self-hosted Convex auf Dokploy, `https://convex-qms.ot-wiggers.de` (Compose-Service `nextqms-convex` mit Backend, Dashboard, Backup). Die Callback-Domain (Port 3211) steht dort als `CONVEX_SITE_ORIGIN`.
- Frontend: eigener Dokploy-Service, `https://qms.ot-wiggers.de` (so verlinkt im Intranet).
- Daten: Im September 2026 wurden der Cloud-Dev-Snapshot (Jahreszyklus, Import 2026) und der Server-Snapshot (22 Benutzer mit Passwort, E-Learning) zusammengeführt (`scripts/merge-snapshots.py`). Ältere Pläne nennen Convex-Cloud-Deployments; die sind überholt.
- Sicherung: täglich, 14 Tage (`deploy/convex-backup.compose.yml`).
- Deploy: Funktionen mit `npx convex deploy --env-file .env.server.local` (Admin-Key per `scripts/convex-server-key.sh`), Feature-Flags als Rollout-Schalter je Modul (Admin → Einstellungen).
- „Rollout steht aus“ heißt: Server und Konten gibt es, die Belegschaft arbeitet noch nicht damit. Ein Rollout-Dokument gibt es im Repo nicht.

### 2.5 Tests
`npm test` (vitest + convex-test, nur `convex/**/*.test.ts`): 22 grün. `npx tsc --noEmit` und `npx tsc --noEmit -p convex` sind sauber. `npm run lint` ist im Bestand rot (rund 96 000 Meldungen) und taugt nicht als Prüfschritt.

## 3. Entra-SSO

- **Anbieter:** `MicrosoftEntraID` aus `@auth/core/providers/microsoft-entra-id`, zusätzlich zu `Password`.
  - Single-Tenant: Der Issuer `https://login.microsoftonline.com/<Mandanten-ID>/v2.0` lässt nur Wiggers-Konten zu.
  - Eigenes `profile`: `sub`, E-Mail (ersatzweise `preferred_username`), Name. Ohne den Graph-Fotoabruf des Standardprofils.
- **Zugriff `QMS-Nutzer`:** Entra regelt das selbst, ohne Code. Bei der Unternehmensanwendung „next-qms“ steht *Zuweisung erforderlich = Ja*, zugewiesen ist nur die Gruppe `QMS-Nutzer`. Andere bekommen bei Microsoft die Meldung AADSTS50105. Die Gruppenzuweisung braucht Entra ID P1; das steckt in Business Premium.
- **Gruppe `QMS-Nutzer`:** kommt wie alle Gruppen aus `wiggers-intranet/config/wiggers.psd1`. Mitglieder stehen in `mitglieder.Prod.csv`.
- **Konto-Zuordnung** (`createOrUpdateUser`):
  1. Bekanntes Entra-Konto → bestehender Nutzer.
  2. Neues Entra-Konto → Nutzer mit gleicher E-Mail (Groß-/Kleinschreibung egal) übernehmen.
  3. Sonst neu anlegen: *Mitarbeiter*, Name aus Entra, Domain-Sperre bleibt.
  4. Über `Password` entstehen keine neuen Konten mehr.
- **Passwort-Notzugang:** Im `profile` des Password-Anbieters wird gegen `AUTH_PASSWORD_ALLOWLIST` geprüft. Wer nicht drinsteht, sieht „Bitte mit Microsoft anmelden“.
- **Anmeldeseite:** Ein Knopf „Mit Microsoft anmelden“. Darunter, eingeklappt (`<details>`), der Notzugang mit Passwort. Der Tab *Registrieren* entfällt.
- **Convex-Variablen (Prod):**
  - `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
  - `AUTH_PASSWORD_ALLOWLIST`
  - `SITE_URL=https://qms.ot-wiggers.de`
  - Das Secret wird nur per Zwischenablage → `npx convex env set` gesetzt und landet in keiner Datei.
- **Redirect-URI:** `<CONVEX_SITE_ORIGIN>/api/auth/callback/microsoft-entra-id`.
- **Datenschutz:** Microsoft bekommt nur die Anmeldung. next-qms speichert von Entra nur E-Mail, Name und die Konto-ID (`sub`).

## 4. Dokumentenmodul aus

- **Eine Sperre an zentraler Stelle:** `hasPermission` liefert für jede `documents:*`-Aktion außer `documents:read` `false`, auch für Admin. Damit sind die Schreibfunktionen auf dem Server zu, und die Knöpfe verschwinden, weil die Oberfläche dieselbe Funktion fragt.
- **Die zwei Ausnahmen schließen:**
  - `confirmRead` prüft die neue Aktion `documents:confirm`, die immer gesperrt ist.
  - `submitReview` prüft `documents:review`.
- **Lesen:** `documents:read` nur noch für Admin, QMB und Auditor. Archiv-Seiten (`/documents/…`) mit Hinweisbalken „Archiv – nur lesen“ und Link ins QM-Handbuch. Lesebestätigungs-Historie und Versionsverlauf bleiben sichtbar.
- **Aus:**
  - Cron `check-document-review-dates` samt Funktion
  - Dokument-Kacheln und -Widgets im Dashboard samt Queries
  - Knopf „Lesebestätigung“
  - Menüpunkt „Dokumenten-Graph“
- **Einmalig:** `internal.documents.closeOpenDocumentTasks` bricht offene Aufgaben mit `resourceType = "documentRecords"` ab (Audit-Log-Eintrag je Aufgabe) und markiert Dokument-Hinweise als gelesen. Das Skript ist idempotent.
- **Nicht gelöscht:** Tabellen, Schema, Dateien im Storage, Import-Funktionen (`convex/import2026.ts`, nur per CLI). Das Schema bleibt unverändert, also ist keine Migration nötig.
- **Eingefroren:** Gesamtsicherung am Abschalttag mit SHA-256-Prüfsumme auf dem NAS (Ordner `QM-Archiv/next-qms`).

## 5. Links ins QM-Handbuch

- **Ein Helfer** `convex/lib/qmHandbuch.ts`, wie `permissions.ts` von Server und Oberfläche nutzbar:
  - `QM_HANDBUCH_URL = https://otwiggers.sharepoint.com/sites/qm-handbuch` (fest, ändert sich nicht)
  - `qmDokumentUrl(nr)` → `…/QMDokumente/Forms/AllItems.aspx?FilterField1=Dokumentnummer&FilterValue1=<nr>`
  - `findQmDokumentnummern(text)` → Nummern im Freitext (Präfixe QMH, PA, AA, FB, FO; Ziffernfolgen, `a/b`, `1+2`, `XX-01`)
- **Komponente** `QmDokumentLinks`: zeigt die gefundenen Nummern als externe Links, sonst nichts.
- **Eingebaut an den echten Bezugsstellen:**
  - Audit-Prüfpunkt-Dialog unter „Nachweis“
  - Qualitätsziele hinter „Quelle“
  - Schnellsuche: Treffer „Dokumente“ öffnen SharePoint statt `/documents/<id>`
  - Seitenleiste: „QM-Handbuch“ (extern, neuer Tab) und „Dokumentenarchiv“ (nur mit `documents:read`)
- **Grenzen:** „FO W“ wird nicht erkannt, weil es im Fließtext mehrdeutig ist. Ältere Hinweise zeigen weiter aufs Archiv. Link-Texte enthalten nur Nummern, keine Patientendaten.
- CAPA, Schulungen und Reklamationen haben keine Dokumentbezüge, dort ändert sich nichts.

## 6. Rollout

1. **SSO live:** Gruppe und App-Registrierung, Benutzerabgleich, Variablen setzen, deployen, Rauchtest.
2. **Nach 2A Task 12, Dokumentenmodul aus:** Sicherung einfrieren, Branch mergen, deployen, `closeOpenDocumentTasks`, Rauchtest.
3. **An die Belegschaft:**
   - Feature-Flags der bleibenden Module prüfen.
   - Kristof kündigt im Kanal *Qualitätsmanagement* an (nur Link und Hinweis „Mit Microsoft anmelden“).
   - Sitemap und Checkliste in wiggers-intranet nachziehen.

Vor dem SSO-Start werden die E-Mails der next-qms-Konten mit den M365-Konten verglichen. Abweichende Adressen korrigiert Kristof in next-qms, bevor sich die Person anmeldet. Sonst entsteht ein zweites Konto ohne Nachweise.

## 7. Tests

- **vitest:**
  - Allowlist
  - Konto-Zuordnung: Übernahme per E-Mail, Neuanlage, fremde Domain, bekanntes Konto, keine Neuanlage per Passwort
  - Rechte: Schreibrechte für alle gesperrt, Lesen nur Admin/QMB/Auditor, andere Rechte unverändert
  - `confirmRead` abgewiesen, Archiv lesbar, `closeOpenDocumentTasks` einmalig
  - Nummernerkennung und URL
- **Typprüfung:** `npx tsc --noEmit` und `npx tsc --noEmit -p convex`.
- **Rauchtest Prod (von Hand):**
  - Microsoft-Login mit dem eigenen Konto: dieselbe Nutzer-ID
  - Testkonto ohne Gruppe: AADSTS50105
  - Passwort-Notzugang: geht für die Allowlist, sonst Fehlermeldung
  - Archiv ohne Bearbeiten-Knöpfe, Links öffnen SharePoint

## 8. Risiken

- **Client-Secret läuft ab** (24 Monate): Dann fällt die Microsoft-Anmeldung aus. Der Notzugang bleibt. Kristof trägt sich eine Erinnerung einen Monat vorher ein.
- **E-Mail-Abweichung** zwischen next-qms und M365: Dann entsteht ein Doppelkonto. Abhilfe ist der Abgleich vor dem Start (6.).
- **Offene Sitzungen nach Austritt:** Convex-Auth-Sitzungen laufen weiter, bis sie ablaufen. Beim Offboarding setzt die Verwaltung den Status in next-qms auf *inaktiv*. Das sperrt sofort.
- **E-Mail-Verknüpfung:** Die Übernahme per E-Mail ist sicher, weil der Issuer nur den eigenen Mandanten zulässt und dort nur Admins die Mail-Adresse setzen.

## 9. Nicht im Umfang

- Rollen aus Entra-Gruppen, Teams-Tab für next-qms, Löschen von Dokumentdaten oder Schema-Teilen.
- E-Learning (wird erst mit Phase 4 abgelöst).
- **Hinweis für später:** Die E-Mail-Benachrichtigungen (Resend) enthalten bei Reklamationen den Titel der Reklamation. Das widerspricht Gesamt-Design 2.4 („nur Nummern und Links“), wenn dort Kundendaten stehen. Das gehört in eine eigene Aufgabe.
