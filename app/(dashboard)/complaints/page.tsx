import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function ComplaintsPage() {
  return (
    <PlaceholderPage
      title="Reklamationen"
      description="Erfassung und Bearbeitung von Kundenreklamationen mit Vigilanz-Prüfung."
      workflows={[
        "Reklamation erfassen",
        "Vigilanz-Relevanz prüfen (MDR Art. 87ff.)",
        "Reklamation bewerten und klassifizieren",
        "Korrekturmaßnahmen ableiten (→ CAPA)",
        "Reklamation abschließen",
      ]}
      entities={["Reklamationen", "Vigilanz-Meldungen", "Bewertungen"]}
      expectedAvailability="Phase 4"
    />
  );
}
