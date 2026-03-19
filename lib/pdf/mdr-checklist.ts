// lib/pdf/mdr-checklist.ts

export interface MdrCheckItem {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  /** Extracted value if found */
  extractedValue?: string;
}

export interface PdfAnalysisResult {
  /** Extracted text (truncated for display) */
  textPreview: string;
  /** Total character count */
  textLength: number;
  /** Number of pages */
  pageCount: number;
  /** Extracted structured fields */
  extracted: {
    manufacturer?: string;
    productName?: string;
    udi?: string;
    notifiedBody?: string;
    certificateNumber?: string;
    regulatoryBasis?: string;
    issueDate?: string;
    signatory?: string;
  };
  /** MDR compliance checklist results */
  checklist: MdrCheckItem[];
  /** Overall compliance score (0-100) */
  complianceScore: number;
}

// Patterns for extracting fields from DoC text
const PATTERNS = {
  manufacturer: [
    /(?:hersteller|manufacturer|fabricant)[:\s]*([^\n]{3,80})/i,
    /(?:hergestellt von|manufactured by|fabriqué par)[:\s]*([^\n]{3,80})/i,
    // Common DoC pattern: "erklärt COMPANY_NAME" or "declares COMPANY_NAME"
    /(?:erklärt|declares?)\s+([A-Z][^\n]{5,60}(?:GmbH|AG|Ltd|Inc|Co\.|S\.A\.|SE)[^\n]{0,30})/i,
  ],
  productName: [
    // Pattern: "Modell / Art.Nr." line — most specific, try first
    /(?:modell|model)\s*[/\s]*(?:art\.?\s*(?:nr\.?|nummer))?[^:]*[:\s]+([A-Z][^\n/]{2,40})/i,
    /(?:produkt(?:name|bezeichnung)?|product(?:\s*name)?|produit)[:\s]*([^\n]{3,80})/i,
    /(?:medizinprodukt|medical device|dispositif médical)[:\s]*([^\n]{3,80})/i,
  ],
  udi: [
    /(?:UDI(?:-DI)?|Unique Device Identifier)[:\s]*([A-Z0-9()]{8,})/i,
    /(?:Basic UDI-DI|Basis-UDI-DI)[:\s]*([A-Z0-9()]{8,})/i,
    // Standalone UDI-DI pattern (alphanumeric, 8+ chars)
    /UDI-DI[:\s]*([A-Z0-9]{8,})/i,
  ],
  notifiedBody: [
    /(?:benannte stelle|notified body|organisme notifié)[:\s]*([^\n]{3,80})/i,
    /(?:NB[:\s]*\d{4})/i,
  ],
  certificateNumber: [
    /(?:zertifikat(?:s)?(?:nummer|nr\.?)|certificate\s*(?:number|no\.?))[:\s]*([A-Z0-9\-/.]{4,30})/i,
  ],
  regulatoryBasis: [
    /((?:EU\s*)?2017\/745|MDR)/i,
    /(93\/42\/(?:EWG|EEC)|MDD)/i,
  ],
  issueDate: [
    /(?:datum|date|ausgestellt am|issued on)[:\s]*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    /(\d{1,2}\.\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*\d{4})/i,
  ],
  signatory: [
    /(?:unterschrift|signature|unterzeichnet|signed by)[:\s]*([^\n]{3,60})/i,
    // Common: "Geschäftsführer: NAME"
    /(?:geschäftsführer|managing director|CEO)[:\s]*([^\n]{3,60})/i,
  ],
};

function extractField(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return (match[1] ?? match[0]).trim();
    }
  }
  return undefined;
}

/**
 * MDR Article 19 & Annex IV checklist for Declarations of Conformity.
 * Reference: EU Regulation 2017/745 (MDR)
 */
function buildChecklist(text: string, extracted: PdfAnalysisResult["extracted"]): MdrCheckItem[] {
  const textLower = text.toLowerCase();

  return [
    {
      id: "manufacturer_name",
      label: "Herstellerangabe",
      description: "Name und Anschrift des Herstellers (Anhang IV Nr. 1)",
      passed: !!extracted.manufacturer,
      extractedValue: extracted.manufacturer,
    },
    {
      id: "product_identification",
      label: "Produktidentifikation",
      description: "Produktname oder -bezeichnung, Handelsname (Anhang IV Nr. 3)",
      passed: !!extracted.productName,
      extractedValue: extracted.productName,
    },
    {
      id: "udi",
      label: "UDI / Basic UDI-DI",
      description: "Einmalige Produktkennung gemäß Art. 27 (Anhang IV Nr. 4)",
      passed: !!extracted.udi,
      extractedValue: extracted.udi,
    },
    {
      id: "regulatory_reference",
      label: "Regulatorische Grundlage",
      description: "Verweis auf EU 2017/745 (MDR) (Anhang IV Nr. 2)",
      passed: textLower.includes("2017/745") || textLower.includes("mdr"),
      extractedValue: extracted.regulatoryBasis,
    },
    {
      id: "product_class",
      label: "Risikoklasse",
      description: "Klassifizierung gemäß Anhang VIII (Anhang IV Nr. 5)",
      passed:
        /(?:klasse|class)\s*(I{1,3}[ab]?|1|2[ab]?|3)/i.test(text) ||
        /(?:risk\s*class|risikoklasse)/i.test(text),
      extractedValue: text.match(/(?:klasse|class)\s*(I{1,3}[ab]?)/i)?.[1],
    },
    {
      id: "conformity_statement",
      label: "Konformitätsaussage",
      description: "Erklärung, dass das Produkt den Anforderungen der MDR entspricht (Anhang IV Nr. 6)",
      passed:
        textLower.includes("konformität") ||
        textLower.includes("conformity") ||
        textLower.includes("conformité") ||
        textLower.includes("entspricht den anforderungen"),
    },
    {
      id: "applicable_gspr",
      label: "Angewandte GSPR / Normen",
      description: "Verweis auf angewandte gemeinsame Spezifikationen oder harmonisierte Normen (Anhang IV Nr. 7)",
      passed:
        textLower.includes("harmonisierte norm") ||
        textLower.includes("harmonized standard") ||
        /(?:EN|ISO)\s*\d{4,5}/i.test(text) ||
        textLower.includes("gspr") ||
        textLower.includes("annex i"),
    },
    {
      id: "notified_body",
      label: "Benannte Stelle",
      description: "Name und Kennnummer der benannten Stelle (falls zutreffend) (Anhang IV Nr. 8)",
      passed:
        !!extracted.notifiedBody ||
        /NB\s*\d{4}/i.test(text) ||
        textLower.includes("benannte stelle") ||
        textLower.includes("notified body"),
      extractedValue: extracted.notifiedBody,
    },
    {
      id: "date_and_signature",
      label: "Datum und Unterschrift",
      description: "Ort, Datum und Unterschrift des Verantwortlichen (Anhang IV Nr. 9/10)",
      passed: !!extracted.issueDate || !!extracted.signatory,
      extractedValue: extracted.issueDate
        ? `Datum: ${extracted.issueDate}${extracted.signatory ? `, Unterzeichner: ${extracted.signatory}` : ""}`
        : extracted.signatory,
    },
    {
      id: "ce_marking",
      label: "CE-Kennzeichnung",
      description: "Verweis auf CE-Kennzeichnung gemäß Art. 20",
      passed:
        /\bce\b/i.test(text) ||
        textLower.includes("ce-kennzeichnung") ||
        textLower.includes("ce marking") ||
        textLower.includes("ce-zeichen") ||
        textLower.includes("eg-konformität") ||
        textLower.includes("ec declaration") ||
        textLower.includes("eu-konformität"),
    },
  ];
}

export function analyzePdfText(text: string, pageCount: number): PdfAnalysisResult {
  const extracted: PdfAnalysisResult["extracted"] = {
    manufacturer: extractField(text, PATTERNS.manufacturer),
    productName: extractField(text, PATTERNS.productName),
    udi: extractField(text, PATTERNS.udi),
    notifiedBody: extractField(text, PATTERNS.notifiedBody),
    certificateNumber: extractField(text, PATTERNS.certificateNumber),
    regulatoryBasis: extractField(text, PATTERNS.regulatoryBasis),
    issueDate: extractField(text, PATTERNS.issueDate),
    signatory: extractField(text, PATTERNS.signatory),
  };

  const checklist = buildChecklist(text, extracted);
  const passedCount = checklist.filter((item) => item.passed).length;
  const complianceScore = Math.round((passedCount / checklist.length) * 100);

  return {
    textPreview: text.slice(0, 2000),
    textLength: text.length,
    pageCount,
    extracted,
    checklist,
    complianceScore,
  };
}
