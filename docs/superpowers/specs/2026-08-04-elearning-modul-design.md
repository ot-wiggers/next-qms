# Design: E-Learning-Modul für next-qms

Datum: 2026-08-04 · Status: vom Auftraggeber freigegeben (Chat-Brainstorming)

## Kontext & Ziel

Das Sanitätshaus Wiggers braucht ein Schulungssystem für Pflichtschulungen (aktueller Anlass:
KI-Schulung nach Art. 4 KI-VO, produziert als eigenständige offline lauffähige HTML-Datei).
Entscheidung: **kein separates System**, sondern ein neues Modul im bestehenden QMS
(`next-qms`), das bereits Nutzer/Rollen (admin/qmb/employee), `trainings`, `trainingSessions`,
`trainingParticipants`, `trainingFeedback`, `trainingMatrix`, `effectivenessChecks`,
`notifications`, `crons` und `email` mitbringt.

Verworfene Alternativen: eigenständige Plattform (doppelte Nutzerverwaltung), Moodle+SCORM
(schwergewichtig, QM-Bogen nur angenähert), LMS-Template von GitHub (CC-BY-NC-Lizenz,
US-SaaS-Abhängigkeiten Clerk/Sanity/Mux/OpenAI).

## Zweigleisigkeit

- **Track 1 (erledigt/parallel):** Die fertige `KI-Schulung_Wiggers.html` läuft als statische
  Site auf Dokploy (Repo `KristofEilers/wiggers-ki-schulung`, nginx, Container-Port 80,
  Ziel-Domain `schulung.ot-wiggers.de`). Bewertungsbogen per mailto an `eilers@ot-wiggers.de`
  bzw. Ausdruck. Wird nach Track-2-Livegang durch Redirect aufs QMS abgelöst.
- **Track 2 (dieses Design):** E-Learning-Modul im QMS.

## Schema-Erweiterungen (Convex)

- `trainings`: `deliveryType: "presence" | "elearning"` (neu, default presence),
  `packageFileId: v.optional(v.id("_storage"))` (HTML-Paket), `packageVersion: v.optional(v.number())`,
  `refreshAfterMonths: v.optional(v.number())` (KI-Schulung: 12).
- `trainingParticipants`: `score: v.optional(v.number())`, `maxScore: v.optional(v.number())`,
  `completedAt: v.optional(v.number())`, `progress: v.optional(v.number())` (0–6 Level).
  `attendedAt` bleibt Präsenz-Semantik.
- `trainingFeedback`: Felder exakt nach QM-Vorlage 6 2 0 (Rev. 0, Stand 07.2018):
  12 Skala-Items (1–6; die 4 Organisations-Items zusätzlich `"na"`), `kurzbericht` (Pflicht,
  ≥ 80 Wörter), `why56` (Pflicht, wenn ein Item 5/6), `confirmedAt` (Zeitstempel der
  Bestätigungs-Checkbox „Angaben selbst gemacht"). Digitale Abgabe ersetzt die
  Papier-Unterschrift; PDF-Export im Vorlagen-Layout bleibt möglich.
- Neu `certificates`: `userId`, `trainingId`, `participantId`, `issuedAt`, `validUntil`,
  `score`, `snapshot` (Name/Titel zum Ausstellungszeitpunkt).

## Player & Paket-Schnittstelle

- Route `/trainings/[id]/lernen`: lädt das HTML-Paket aus Convex File Storage in ein
  sandboxed `<iframe>` (`allow-scripts`, same-origin nur falls für localStorage nötig — prüfen).
- **postMessage-Protokoll** (Paket → Host): `{type:"progress", level}`, `{type:"completed",
  score, maxScore}`, `{type:"bogen", data}` · Host → Paket: `{type:"init", user:{name}}`.
- Die Schulungs-HTML erhält in `build.py` (Projekt `schulungsinhalte/`) einen ~20-Zeilen-Adapter:
  im iframe → melden an Host (Name kommt via init, keine Namenseingabe); standalone → Verhalten
  wie heute (localStorage, mailto, Print). Eine Datei für beide Welten.

## QM-Funktionen

- Abschlüsse erscheinen automatisch in der bestehenden `trainingMatrix`.
- Auffrischung: Cron prüft `completedAt + refreshAfterMonths`, erzeugt `notifications`
  + E-Mail über bestehende Infrastruktur.
- Bogen-PDFs und Zertifikat-PDFs für qmb/admin abrufbar; Zertifikat für Mitarbeitende
  im eigenen Bereich.
- Rollen: employee sieht „Meine Schulungen" (fällig/absolviert), qmb/admin verwalten
  Trainings, laden Pakete hoch, sehen Auswertungen.

## Hosting

Convex self-hosted auf Dokploy (Playbook `~/.claude/skills/dokploy/references/convex-selfhosted.md`),
Next-App als eigener Dokploy-Service. Keine US-SaaS-Dienste.

## Nicht im Scope (YAGNI)

Authoring-Tool, SCORM-Import, Video-Streaming-Stack, Abteilungshierarchien,
externe Teilnehmer.

## Fehlerfälle & Tests

- Paket meldet nichts (geschlossen vor Abschluss): `progress` wird gespeichert,
  Wiedereinstieg über init-Restore (Level-Nummer).
- Doppelte completed-Messages: idempotent (erstes `completedAt` gewinnt).
- Manipulation: postMessage nur vom iframe-Origin akzeptieren; Score dient dem Nachweis,
  nicht der Zugangskontrolle.
- Tests: Convex-Funktionstests für Abschluss-/Feedback-Mutations (Validierung 80 Wörter,
  5/6-Begründung, Idempotenz); ein Playwright-Durchlauf Player → completed → Matrix.
