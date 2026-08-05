"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Award, ArrowLeft } from "lucide-react";

function formatDate(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Zentrale Nachweis-Übersicht für die Auditierung (qmb/admin):
 *  alle E-Learning-Abschlüsse mit Bogen- und Zertifikats-Verweis. */
export default function NachweisePage() {
  const rows = useQuery(api.elearning.nachweise);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/trainings" aria-label="Zurück zu Schulungen"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Schulungsnachweise</h1>
          <p className="text-sm text-muted-foreground">
            E-Learning-Abschlüsse mit Bewertungsbogen und Zertifikat — Grundlage für interne und externe Audits.
            Alle Dokumente sind aus den gespeicherten Daten jederzeit reproduzierbar.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Abschlüsse</CardTitle>
          <CardDescription>{rows === undefined ? "Lädt …" : `${rows.length} Nachweis(e)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows === undefined ? null : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen E-Learning-Schulungen.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Mitarbeiter/in</th>
                    <th className="py-2 pr-4 font-medium">Schulung</th>
                    <th className="py-2 pr-4 font-medium">Abgeschlossen</th>
                    <th className="py-2 pr-4 font-medium">Ergebnis</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Auffrischung bis</th>
                    <th className="py-2 font-medium">Nachweise</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.participantId)} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{r.userName}</td>
                      <td className="py-2 pr-4">{r.trainingTitle}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.completedAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {r.score !== null ? `${r.score} / ${r.maxScore}` : "—"}
                      </td>
                      <td className="py-2 pr-4">{r.status}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.validUntil)}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {r.feedbackId ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/trainings/feedback/${r.feedbackId}/print`}>
                                <FileText className="h-3.5 w-3.5" /> Bogen
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground self-center">Bogen ausstehend</span>
                          )}
                          {r.certificateId ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/trainings/certificates/${r.certificateId}/print`}>
                                <Award className="h-3.5 w-3.5" /> Zertifikat
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
