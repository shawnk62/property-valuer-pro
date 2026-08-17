/**
 * Report-type configuration for multi-product support.
 * Stamp Duty - Phil and CGT - Phil share the Peterson cover / section layout.
 * Stamp Duty uses compact sale notes; CGT uses fuller comparison narratives.
 */

export type ReportTypeId = "default" | "stamp-duty-phil" | "cgt-phil";

export interface ReportTypeConfig {
  id: ReportTypeId;
  /** Value of prop_assignment that selects this config */
  match: string | string[];
  /** Small line under the main "Valuation Summary" heading */
  coverSubtitle: string;
  /** Default purpose sentence used in section 1 / cover when appropriate */
  defaultPurpose: string;
  /** Optional override for the Instructions & Purpose section title */
  instructionsTitle?: string;
  /**
   * Sale evidence narrative style.
   * - compact: ~45-word Phil stamp-duty notes
   * - detailed: 2–5 sentence comparison (CGT and general)
   */
  saleNarrativeStyle: "compact" | "detailed";
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
  },
  {
    id: "cgt-phil",
    match: ["CGT - Phil", "CGT Phil"],
    coverSubtitle: "Capital Gains Tax Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for Capital Gains Tax purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
    saleNarrativeStyle: "detailed",
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

/** Phil-family layout: cover photo page + numbered sections like the samples. */
export function isPhilReportType(id: ReportTypeId | string): boolean {
  return id === "stamp-duty-phil" || id === "cgt-phil";
}
