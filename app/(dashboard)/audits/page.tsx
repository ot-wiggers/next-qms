import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function AuditsPage() {
  return (
    <PlaceholderPage
      title="Interne Audits"
      description="Planung, Durchführung und Nachverfolgung interner Audits gemäß ISO 13485 Kap. 8.2.2."
      workflows={[
        "Audit-Jahresplanung erstellen",
        "Audit durchführen und dokumentieren",
        "Findings erfassen und bewerten",
        "Korrekturmaßnahmen ableiten (→ CAPA)",
        "Audit abschließen und Bericht erstellen",
      ]}
      entities={["Audits", "Audit-Findings", "Audit-Berichte", "Auditoren-Qualifikation"]}
      expectedAvailability="Phase 4"
    />
  );
}
