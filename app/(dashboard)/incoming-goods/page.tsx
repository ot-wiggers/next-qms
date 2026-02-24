import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function IncomingGoodsPage() {
  return (
    <PlaceholderPage
      title="Wareneingang & Stichproben"
      description="Wareneingangsprüfung mit Stichprobenverfahren nach AQL-Standard."
      workflows={[
        "Wareneingang erfassen",
        "Stichprobenumfang berechnen (AQL)",
        "Prüfung durchführen und dokumentieren",
        "Ware freigeben oder sperren",
        "Lieferantenbewertung aktualisieren",
      ]}
      entities={["Wareneingänge", "Stichproben", "Prüfprotokolle", "Lieferantenbewertung"]}
      expectedAvailability="Phase 4"
    />
  );
}
