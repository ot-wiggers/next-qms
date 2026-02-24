import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function DevicesPage() {
  return (
    <PlaceholderPage
      title="Prüfmittel & Geräte"
      description="Verwaltung und Kalibrierung von Prüfmitteln und Messgeräten."
      workflows={[
        "Prüfmittel/Gerät erfassen",
        "Kalibrierplan erstellen",
        "Kalibrierung durchführen und dokumentieren",
        "Kalibrierzertifikat hinterlegen",
        "Überwachung der Kalibrierfristen",
      ]}
      entities={["Geräte", "Kalibrierungen", "Kalibrierzertifikate", "Kalibrierpläne"]}
      expectedAvailability="Phase 4"
    />
  );
}
