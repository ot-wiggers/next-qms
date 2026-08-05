import { test, expect } from "@playwright/test";

/**
 * E2E-Durchlauf: Login → /trainings → KI-Training öffnen → „Lernen starten" →
 * im iframe Level 1 durchklicken → zurück → Fortschritt sichtbar.
 *
 * Selektoren sind aus den realen Seiten abgeleitet:
 *  - app/(auth)/login/page.tsx: #login-email, #login-password, Button "Anmelden"
 *  - app/(dashboard)/trainings/page.tsx: DataTable-Zeile (role="row") mit Trainingstitel
 *  - app/(dashboard)/trainings/[id]/page.tsx: Link "Lernen starten"
 *  - components/domain/elearning/PlayerFrame.tsx: <iframe title="E-Learning">
 *  - app/(dashboard)/trainings/[id]/lernen/page.tsx: Zurück-Link auf /trainings/{id}
 *
 * Die IDs innerhalb des iframes (#uname, #btn-start, #btn-vnext, #btn-i1,
 * #btn-i1next) stammen aus dem hochgeladenen E-Learning-Paket selbst (nicht Teil
 * dieses Repos) — Namenseingabe entfällt durch das ki-schulung:init-Postmessage,
 * der Start-Button ist trotzdem zu klicken.
 *
 * Preconditions, die sich headless nicht herstellen lassen (siehe Task-12-Report):
 *  1. Ein registrierter Nutzer mit Login-Zugang — UI-Registrierung
 *     (Tab "Registrieren" auf /login) erzeugt Rolle "employee" per Default.
 *  2. Eine aktive Schulung mit deliveryType "elearning" UND angehängtem Paket
 *     (elearning.attachPackage verlangt trainings:manage — Rolle ggf. per
 *     convex/bootstrap.ts setUserRoleByEmail hochstufen, z. B. auf "qmb").
 *  3. Titel der Schulung über E2E_TRAINING_TITLE an den Test übergeben.
 *
 * Es gibt aktuell keine UI, die trainingParticipants.progress als Zahl/Balken
 * anzeigt (die Query elearning.myElearning ist ungenutzt). "Fortschritt sichtbar"
 * wird hier dadurch geprüft, dass der Player nach dem Zurücknavigieren erneut
 * geöffnet wird und ohne Fehlermeldung lädt — Teilnahme + Fortschritt bleiben
 * serverseitig erhalten (elearning.start ist idempotent, reportProgress zählt nur
 * aufwärts). Wer dies gegen ein echtes Paket laufen lässt, sollte die Assertion
 * nach Blick ins tatsächliche Paket-DOM ggf. auf ein konkretes Resume-Element
 * verschärfen.
 *
 * Lokal ausführen:
 *   E2E_EMAIL=... E2E_PASSWORD=... E2E_TRAINING_TITLE="KI-Training" npx playwright test
 */

test("Login, Training starten, Level 1 durchklicken, Fortschritt bleibt erhalten", async ({
  page,
}) => {
  test.skip(!process.env.E2E_EMAIL, "E2E-Zugangsdaten nicht gesetzt");

  const email = process.env.E2E_EMAIL!;
  const password = process.env.E2E_PASSWORD!;
  const trainingTitle = process.env.E2E_TRAINING_TITLE ?? "KI-Training";

  // Login
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForURL("/");

  // Trainings-Liste → KI-Training öffnen
  await page.goto("/trainings");
  await page.getByRole("row", { name: new RegExp(trainingTitle) }).click();
  await page.waitForURL(/\/trainings\/[^/]+$/);
  const trainingId = page.url().match(/\/trainings\/([^/]+)$/)![1];

  // Lernen starten
  await page.getByRole("link", { name: "Lernen starten" }).click();
  await page.waitForURL(`**/trainings/${trainingId}/lernen`);

  // Im iframe (Paket-DOM) Level 1 durchklicken
  const frame = page.frameLocator('iframe[title="E-Learning"]');
  await frame.locator("#btn-start").click();
  await frame.locator("#btn-vnext").click();
  await frame.locator("#btn-i1").click();
  await frame.locator("#btn-i1next").click();

  // Zurück zur Trainingsdetailseite
  await page.locator(`a[href="/trainings/${trainingId}"]`).first().click();
  await page.waitForURL(`**/trainings/${trainingId}`);

  // Fortschritt sichtbar: Player erneut öffnen — lädt ohne Fehlermeldung,
  // Teilnahme/Fortschritt sind serverseitig erhalten geblieben.
  await page.getByRole("link", { name: "Lernen starten" }).click();
  await page.waitForURL(`**/trainings/${trainingId}/lernen`);
  await expect(
    page.getByText("Für diese Schulung ist noch kein Paket hinterlegt.")
  ).toHaveCount(0);
  await expect(frame.locator("body")).toBeVisible();
});
