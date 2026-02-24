import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function ReportsPage() {
  return (
    <PlaceholderPage
      title="Berichte & Kennzahlen"
      description="Management-Reports und KPI-Dashboards für die Managementbewertung."
      workflows={[
        "Schulungsquote berechnen",
        "Wirksamkeitsquote der Schulungen anzeigen",
        "DoC-Ablaufstatus zusammenfassen",
        "CAPA-Statistiken erstellen",
        "Managementbewertung vorbereiten (ISO 13485 Kap. 5.6)",
      ]}
      entities={["Management-Reports", "KPI-Dashboards", "Trendanalysen"]}
      expectedAvailability="Phase 4"
    />
  );
}
