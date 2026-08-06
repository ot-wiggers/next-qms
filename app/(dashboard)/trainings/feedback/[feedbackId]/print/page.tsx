"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

/** Items der Kästchenmatrix in Vorlagen-Reihenfolge (QM 6 2 0). */
const ORG_ITEMS: { key: keyof OrgRatings; label: string }[] = [
  { key: "venueAccessibility", label: "Erreichbarkeit des Tagungsortes (z. B. Anfahrtsweg, Ausschilderung, Parkplätze)" },
  { key: "conferenceRooms", label: "Tagungsräume (z. B. Raumgröße, Möglichkeit für Gruppenarbeit, Belüftung, Temperatur)" },
  { key: "catering", label: "Verpflegung" },
  { key: "staffSupport", label: "Betreuung durch das Personal des Tagungsortes" },
];
const EVENT_ITEMS: { key: keyof EventRatings; label: string }[] = [
  { key: "overallEvent", label: "Die Veranstaltung war insgesamt" },
  { key: "knowledgeUsefulness", label: "Der Nutzen der erworbenen Kenntnisse für meine betriebliche Praxis ist" },
  { key: "structurePresentation", label: "Aufbau und Präsentation des Seminars (z. B. Anschaulichkeit der Inhalte, Verständlichkeit der Sprache, Einsatz von Medien)" },
  { key: "seminarContent", label: "Die Inhalte des Seminars waren" },
  { key: "questionOpportunity", label: "Die Möglichkeit, Fragen zu stellen und das Eingehen des Referenten auf Fragen war" },
  { key: "seminarMaterials", label: "Die Seminarunterlagen waren" },
  { key: "speakerExpertise", label: "Die Sachkunde des Referenten war" },
  { key: "presentationQuality", label: "Die Qualität des Vortrags war" },
];

type OrgRatings = { venueAccessibility: number; conferenceRooms: number; catering: number; staffSupport: number };
type EventRatings = {
  overallEvent: number; knowledgeUsefulness: number; structurePresentation: number; seminarContent: number;
  questionOpportunity: number; seminarMaterials: number; speakerExpertise: number; presentationQuality: number;
};
function formatDate(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Rendert die 1-6 + entfällt Kästchen einer Zeile (■ = angekreuzt, □ = leer). */
function RatingRow({ label, value, na }: { label: string; value: number; na?: boolean }) {
  return (
    <tr>
      <td>{label}</td>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <td key={n} className="c">{!na && value === n ? "■" : "□"}</td>
      ))}
      <td className="c">{na ? "■" : "□"}</td>
    </tr>
  );
}

export default function FeedbackPrintPage() {
  const params = useParams();
  const feedbackId = params.feedbackId as Id<"trainingFeedback">;
  const data = useQuery(api.elearning.feedbackById, { feedbackId });

  if (data === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Lädt …</div>;
  }
  if (data === null) {
    return <div className="p-6 text-sm text-muted-foreground">Bewertungsbogen nicht gefunden.</div>;
  }

  const { fb, trainingTitle, userName, completedAt } = data;
  const allRatings = [
    ...ORG_ITEMS.map((i) => fb.organizationRatingsNa?.[i.key] ? 0 : fb.organizationRatings[i.key]),
    ...EVENT_ITEMS.map((i) => fb.eventRatings[i.key]),
  ];
  const showWhy = allRatings.some((r) => r >= 5);

  return (
    <div className="bogen">
      <style>{`
        @page { size: A4 portrait; margin: 14mm 16mm; }
        @media print {
          aside, header, nav { display: none !important; }
          html, body, main { background: #fff !important; padding: 0 !important; margin: 0 !important; }
          main * { color: #000; }
          .bogen { max-width: none; margin: 0; color: #000;
            print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .bogen-ph .ptitle { color: #c00000 !important; }
          .bogen-ph .logo { color: #005786 !important; }
          .bogen .kb-label { color: #c00000 !important; }
          .bogen { page-break-inside: avoid; }
        }
        .bogen { max-width: 760px; margin: 0 auto; font-size: 0.92rem; color: #001f2e;
          background: #fff; padding: 20px; border-radius: 8px; }
        .bogen-ph { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12pt; }
        .bogen-ph .rev { font-size: 8.5pt; line-height: 1.4; color: #5b7386; }
        .bogen-ph .ptitle { font-size: 17pt; font-weight: 700; color: #c00000; }
        .bogen-ph .logo { font-size: 15pt; font-weight: 800; color: #005786; letter-spacing: 0.04em; }
        .bogen .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 12pt; border: 1px solid #000; }
        .bogen .meta > div { border-bottom: 1px solid #000; padding: 4pt 6pt; }
        .bogen .meta label { display: block; font-size: 8pt; color: #000; margin-bottom: 1pt; font-weight: 700; }
        .bogen .meta .ro { font-size: 9.5pt; }
        .bogen .kb-label { font-size: 11pt; font-weight: 700; color: #c00000; display: block; margin-top: 10pt; }
        .bogen .report { border: 1px solid #000; min-height: 90pt; padding: 6pt 8pt; font-size: 9.5pt; white-space: pre-wrap; margin-top: 4pt; }
        .bogen table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 10pt; }
        .bogen th, .bogen td { border: 1px solid #000; padding: 3pt 4pt; text-align: left; vertical-align: middle; }
        .bogen th.scale, .bogen td.c { text-align: center; width: 34pt; }
        .bogen thead th { font-size: 7.5pt; background: #fff; }
        .bogen .sec td { background: #eee; font-weight: 800; font-size: 8.5pt; letter-spacing: 0.04em; }
        .bogen-why { margin-top: 10pt; }
        .bogen-why label { font-size: 8.5pt; font-weight: 700; color: #5b7386; display: block; }
        .bogen-why .box { border: 1px solid #000; min-height: 30pt; padding: 4pt 6pt; font-size: 9pt; margin-top: 2pt; white-space: pre-wrap; }
        .bogen-sig { display: flex; justify-content: space-between; margin-top: 30pt; font-size: 8.5pt; }
        .bogen-sig .line { width: 200pt; border-top: 1pt solid #000; padding-top: 2pt; }
        .sig-script { font-family: "Snell Roundhand","Segoe Script","Brush Script MT",cursive; font-size: 11pt; }
        .bogen-pf { margin-top: 18pt; display: flex; justify-content: space-between; font-size: 7.5pt; color: #333; }
      `}</style>

      <div className="print:hidden mb-4">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Bogen drucken
        </Button>
      </div>

      <div className="bogen-ph">
        <div className="rev">Revision 0<br />Stand: 07.2018</div>
        <div className="ptitle">Schulungsbewertungsbogen</div>
        <div className="logo">WIGGERS</div>
      </div>

      <div className="meta">
        <div><label>Titel der Maßnahme</label><div className="ro">{trainingTitle}</div></div>
        <div><label>Veranstalter</label><div className="ro">Sanitätshaus Wiggers (interne Schulung)</div></div>
        <div><label>Datum</label><div className="ro">{formatDate(fb.confirmedAt ?? completedAt)}</div></div>
        <div><label>Ort</label><div className="ro">Online / Selbstlerneinheit</div></div>
        <div><label>Name des Teilnehmers / der Teilnehmerin</label><div className="ro">{userName}</div></div>
        <div><label>Abteilung</label><div className="ro">&nbsp;</div></div>
      </div>

      <label className="kb-label">Kurzbericht</label>
      <div className="report">{fb.shortReport}</div>

      <table>
        <thead>
          <tr>
            <th></th>
            <th className="scale">1<br /><small>Sehr gut</small></th>
            <th className="scale">2</th>
            <th className="scale">3</th>
            <th className="scale">4</th>
            <th className="scale">5</th>
            <th className="scale">6<br /><small>Sehr schlecht</small></th>
            <th className="scale">entfällt</th>
          </tr>
        </thead>
        <tbody>
          <tr className="sec"><td colSpan={8}>Organisation</td></tr>
          {ORG_ITEMS.map((i) => (
            <RatingRow key={i.key} label={i.label} value={fb.organizationRatings[i.key]} na={fb.organizationRatingsNa?.[i.key]} />
          ))}
          <tr className="sec"><td colSpan={8}>Veranstaltung</td></tr>
          {EVENT_ITEMS.map((i) => (
            <RatingRow key={i.key} label={i.label} value={fb.eventRatings[i.key]} />
          ))}
        </tbody>
      </table>

      {showWhy && (
        <div className="bogen-why">
          <label>Ich habe eine 5 / 6 vergeben weil:</label>
          <div className="box">{fb.badRatingReason}</div>
        </div>
      )}

      <div className="bogen-sig">
        <div><div className="line">Oldenburg, {formatDate(fb.confirmedAt ?? completedAt)}</div>Ort, Datum</div>
        <div><div className="line"><span className="sig-script">{userName}</span> · digital bestätigt am {formatDate(fb.confirmedAt)}</div>Unterschrift Teilnehmer / Teilnehmerin</div>
      </div>

      <div className="bogen-pf">
        <span>6 2 0 Schulungsbewertungsbogen</span>
        <span>Seite 1 von 1</span>
        <span>Rev. 0 · Stand 07.2018</span>
      </div>
    </div>
  );
}
