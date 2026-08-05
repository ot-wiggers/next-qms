"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

function formatDate(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Zertifikat-Druckansicht — A4 Hochformat, Wiggers-CI. Daten aus der certificates-Tabelle
 *  (Snapshot von Name/Titel zum Ausstellungszeitpunkt → jederzeit reproduzierbar). */
export default function CertificatePrintPage() {
  const params = useParams();
  const certificateId = params.certificateId as Id<"certificates">;
  const cert = useQuery(api.elearning.certificateById, { certificateId });

  if (cert === undefined) return <div className="p-6 text-sm text-muted-foreground">Lädt …</div>;
  if (cert === null) return <div className="p-6 text-sm text-muted-foreground">Zertifikat nicht gefunden.</div>;

  return (
    <div className="certwrap">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          aside, header, nav { display: none !important; }
          html, body, main { background: #fff !important; padding: 0 !important; margin: 0 !important; }
          .certwrap { padding: 0 !important; }
          .cert { box-shadow: none !important; border-radius: 0; width: 210mm; min-height: 297mm; margin: 0; }
        }
        .certwrap { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px 0; }
        .cert {
          width: 210mm; min-height: 280mm; background: #fff; color: #001f2e;
          box-shadow: 0 12px 40px rgba(0,0,0,.25); position: relative;
          padding: 22mm 20mm; box-sizing: border-box;
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
          font-family: var(--font-sans, ui-sans-serif, system-ui);
        }
        .cert .frame {
          position: absolute; inset: 9mm; border: 1.2pt solid #005786; pointer-events: none;
        }
        .cert .frame::before {
          content: ""; position: absolute; inset: 1.6mm; border: 0.4pt solid #24a3e3;
        }
        .cert .accent { position: absolute; left: 9mm; right: 9mm; bottom: 9mm; height: 2.2mm;
          background: linear-gradient(90deg, #005786 0 72%, #e31e24 72% 100%); }
        .cert .inner { position: relative; text-align: center; padding-top: 8mm; }
        .cert img.logo { height: 16mm; margin: 0 auto 10mm; display: block; }
        .cert .word { font-size: 10pt; letter-spacing: 0.42em; text-transform: uppercase; color: #5b7386; }
        .cert h1 { font-size: 34pt; font-weight: 800; color: #005786; margin: 2mm 0 0; letter-spacing: -0.01em; }
        .cert .redline { width: 26mm; height: 1.4mm; background: #e31e24; margin: 5mm auto 10mm; border-radius: 1mm; }
        .cert .lead { font-size: 11.5pt; color: #5b7386; }
        .cert .name { font-size: 24pt; font-weight: 800; margin: 5mm 0; }
        .cert .body { font-size: 11.5pt; line-height: 1.7; max-width: 130mm; margin: 0 auto; }
        .cert .body b { color: #005786; }
        .cert .facts { display: flex; justify-content: center; gap: 14mm; margin: 10mm 0 8mm; }
        .cert .facts div { text-align: center; }
        .cert .facts b { display: block; font-size: 13pt; color: #001f2e; }
        .cert .facts span { font-size: 8.5pt; color: #5b7386; text-transform: uppercase; letter-spacing: 0.08em; }
        .cert .topics { font-size: 8.5pt; color: #5b7386; line-height: 1.7; max-width: 140mm; margin: 0 auto; }
        .cert .sig { margin-top: 16mm; display: flex; justify-content: center; }
        .cert .sig .line { border-top: 1pt solid #001f2e; width: 62mm; padding-top: 2mm; font-size: 9pt; color: #5b7386; }
        .cert .legal { position: absolute; left: 0; right: 0; bottom: 15mm; text-align: center; font-size: 7.5pt; color: #8ba2b3; }
      `}</style>

      <div className="print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Zertifikat drucken
        </Button>
      </div>

      <div className="cert">
        <div className="frame" />
        <div className="accent" />
        <div className="inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/wiggers-logo.svg" alt="Sanitätshaus Wiggers" />
          <div className="word">Sanitätshaus Wiggers</div>
          <h1>Zertifikat</h1>
          <div className="redline" />
          <p className="lead">Hiermit wird bestätigt, dass</p>
          <div className="name">{cert.snapshotUserName}</div>
          <p className="body">
            die interne Schulung <b>„{cert.snapshotTrainingTitle}"</b> gemäß Art. 4 der
            Verordnung (EU) 2024/1689 (KI-Verordnung) erfolgreich abgeschlossen hat.
          </p>
          <div className="facts">
            <div><b>{formatDate(cert.issuedAt)}</b><span>Ausgestellt am</span></div>
            <div><b>{cert.score} von {cert.maxScore}</b><span>Wissenscheck</span></div>
            <div><b>{formatDate(cert.validUntil)}</b><span>Auffrischung bis</span></div>
          </div>
          <p className="topics">
            Inhalte: Rechtsgrundlage Art. 4 KI-VO · Funktionsweise generativer KI · Risiken
            (Halluzination, Bias, Phishing) · Datenschutz &amp; Gesundheitsdaten (Art. 9 DSGVO) ·
            Regeln der KI-Nutzung im Sanitätshaus · Wissenscheck
          </p>
          <div className="sig"><div className="line">Geschäftsleitung — Sanitätshaus Wiggers</div></div>
        </div>
        <div className="legal">Elektronisch erstellter Nachweis · reproduzierbar aus dem QMS (Zertifikat-ID {String(certificateId)})</div>
      </div>
    </div>
  );
}
