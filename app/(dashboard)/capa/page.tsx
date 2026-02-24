import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function CapaPage() {
  return (
    <PlaceholderPage
      title="CAPA — Korrektur- & Vorbeugemaßnahmen"
      description="Verwaltung von Corrective and Preventive Actions zur systematischen Problemlösung."
      workflows={[
        "CAPA aus verschiedenen Quellen anlegen (Audit, Reklamation, Schulung)",
        "Ursachenanalyse durchführen",
        "Maßnahmen definieren und zuweisen",
        "Wirksamkeit der Maßnahmen prüfen",
        "CAPA abschließen",
      ]}
      entities={["CAPA-Maßnahmen", "Ursachenanalysen", "Wirksamkeitsprüfungen"]}
      expectedAvailability="Phase 4"
    />
  );
}
