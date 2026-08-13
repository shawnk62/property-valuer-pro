/**
 * Report-type configuration for multi-product support.
 * Default config preserves the existing Purchase behaviour exactly.
 * Stamp Duty - Phil follows the attached Peterson samples as definitive.
 */

export type ReportTypeId = "default" | "stamp-duty-phil";

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
}

export const REPORT_TYPE_CONFIGS: ReportTypeConfig[] = [
  {
    id: "stamp-duty-phil",
    match: "Stamp Duty - Phil",
    coverSubtitle: "Stamp Duty Valuation Report",
    defaultPurpose:
      "Determine the market value of the property for Stamp Duty purposes.",
    instructionsTitle: "Instructions and Purpose of Valuation",
  },
];

/** Exact current Purchase / generic behaviour */
export const DEFAULT_REPORT_TYPE_CONFIG: ReportTypeConfig = {
  id: "default",
  match: "*",
  coverSubtitle: "Residential Valuation Report",
  defaultPurpose: "",
  instructionsTitle: "Instructions and Purpose of Valuation",
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
