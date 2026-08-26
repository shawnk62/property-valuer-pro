/**
 * Report-type configuration for multi-product support.
 *
 * Phil and Murray family types share the Peterson cover / numbered-section layout.
 * Stamp Duty uses compact sale notes; CGT variants use detailed comparison narratives
 * with type-specific purpose and valuation-statement wording from the samples.
 */

export type ReportTypeId =
  | "default"
  | "stamp-duty-phil"
  | "cgt-phil"
  | "cgt-phil-retrospective"
  | "cgt-phil-apportionment"
  | "stamp-duty-murray"
  | "cgt-murray"
  | "cgt-murray-retrospective"
  | "cgt-murray-apportionment"
  | "family-law-murray";

export interface ReportTypeConfig {
  id: ReportTypeId;
  /** Value of prop_assignment that selects this config */
  match: string | string[];
  /** Small line under the main "Valuation Summary" heading */
  coverSubtitle: string;
  /** Default purpose text for summary §1 (may be multi-line) */
  defaultPurpose: string;
  /** Optional override for the Instructions & Purpose section title */
  instructionsTitle?: string;
  /**
   * Sale evidence narrative style.
   * - compact: ~45-word Stamp Duty Phil notes
   * - detailed: fuller CGT-style comparison paragraph
   */
  saleNarrativeStyle: "compact" | "detailed";
  /**
   * Valuation statement on the summary page.
   * - amount: show $ valueAmount
   * - see-remarks: "SEE REMARKS IN THIS REPORT" (apportionment sample)
   */
  valuationDisplay: "amount" | "see-remarks";
}

export const REPORT_TYPE_CONFIGS: ReportTypeConfig[] = [
  {
    id: "stamp-duty-phil",
    match: "Stamp Duty - Phil",
    coverSubtitle: "Stamp Duty Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for Stamp Duty purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "compact",
    valuationDisplay: "amount",
  },
  {
    id: "cgt-phil",
    match: ["CGT - Phil", "CGT Phil"],
    coverSubtitle: "Capital Gains Tax Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for Capital Gains Tax purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "amount",
  },
  {
    id: "cgt-phil-retrospective",
    match: [
      "CGT - Phil Retrospective",
      "CGT Phil Retrospective",
      "CGT - Phil (Retrospective)",
    ],
    coverSubtitle: "Retrospective Capital Gains Tax Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for retrospective capital gains tax purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "amount",
  },
  {
    id: "cgt-phil-apportionment",
    match: [
      "CGT - Phil Apportionment",
      "CGT Phil Apportionment",
      "CGT - Phil (Apportionment)",
    ],
    coverSubtitle: "Capital Gains Tax Apportionment Valuation Report",
    // Matches Laurel Road sample structure (numbered purposes).
    defaultPurpose:
      "Determine the market value of the property as follows:\n1. Apportion assessed value between curtilage with improvements and balance land;\n2. Apportion purchase price at the relevant acquisition date between curtilage with improvements and balance land.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "see-remarks",
  },
  {
    id: "stamp-duty-murray",
    match: ["Stamp Duty - Murray", "Stamp Duty Murray"],
    coverSubtitle: "Stamp Duty Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for stamp duty purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "compact",
    valuationDisplay: "amount",
  },
  {
    id: "cgt-murray",
    match: ["CGT - Murray", "CGT Murray"],
    coverSubtitle: "Capital Gains Tax Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for Capital Gains Tax purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "amount",
  },
  {
    id: "cgt-murray-retrospective",
    match: [
      "CGT - Murray Retrospective",
      "CGT Murray Retrospective",
      "CGT - Murray (Retrospective)",
    ],
    coverSubtitle: "Retrospective Capital Gains Tax Valuation Report",
    defaultPurpose:
      "Determine a retrospective market value of the property for Capital Gains Tax purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "amount",
  },
  {
    id: "cgt-murray-apportionment",
    match: [
      "CGT - Murray Apportionment",
      "CGT Murray Apportionment",
      "CGT - Murray (Apportionment)",
    ],
    coverSubtitle: "Capital Gains Tax Apportionment Valuation Report",
    defaultPurpose:
      "Determine the market value of the property as follows:\n1. Apportion assessed value between curtilage with improvements and balance land;\n2. Apportion purchase price at the relevant acquisition date between curtilage with improvements and balance land.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "see-remarks",
  },

  {
    id: "family-law-murray",
    match: [
      "Family Law - Murray",
      "Family Law Murray",
      "Singly Appointed Family Law - Murray",
      "Singly Appointed Family Law Murray",
    ],
    coverSubtitle: "Family Law Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for use in a Singly Appointed Family Law Matter.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
    valuationDisplay: "amount",
  },
];

/** Exact current Purchase / generic behaviour */
export const DEFAULT_REPORT_TYPE_CONFIG: ReportTypeConfig = {
  id: "default",
  match: "*",
  coverSubtitle: "Residential Valuation Report",
  defaultPurpose: "",
  instructionsTitle: "Instructions and Purpose of Valuation",
  saleNarrativeStyle: "detailed",
  valuationDisplay: "amount",
};

export function getReportTypeConfig(
  propAssignment: string | null | undefined,
): ReportTypeConfig {
  const value = (propAssignment || "").trim();
  for (const cfg of REPORT_TYPE_CONFIGS) {
    const matches = Array.isArray(cfg.match) ? cfg.match : [cfg.match];
    if (matches.some((m) => m === value)) {
      return cfg;
    }
  }
  return DEFAULT_REPORT_TYPE_CONFIG;
}

/**
 * Peterson-family layout (Phil or Murray): cover photo page + numbered sections
 * matching the issued samples. Function name kept for call-site compatibility.
 */
export function isPhilReportType(id: ReportTypeId | string): boolean {
  return (
    id === "stamp-duty-phil" ||
    id === "cgt-phil" ||
    id === "cgt-phil-retrospective" ||
    id === "cgt-phil-apportionment" ||
    id === "stamp-duty-murray" ||
    id === "cgt-murray" ||
    id === "cgt-murray-retrospective" ||
    id === "cgt-murray-apportionment" ||
    id === "family-law-murray"
  );
}

export function isMurrayReportType(id: ReportTypeId | string): boolean {
  return (
    id === "stamp-duty-murray" ||
    id === "cgt-murray" ||
    id === "cgt-murray-retrospective" ||
    id === "cgt-murray-apportionment" ||
    id === "family-law-murray"
  );
}

export function isCgtPhilReportType(id: ReportTypeId | string): boolean {
  return (
    id === "cgt-phil" ||
    id === "cgt-phil-retrospective" ||
    id === "cgt-phil-apportionment"
  );
}
