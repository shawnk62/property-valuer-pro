/**
 * The uploaded schema carries no `required` flags, so mandatory fields are
 * configured here. Edit this list to change validation — never edit the schema.
 * Keys must be schema field names.
 */
export const REQUIRED_FIELDS: string[] = [
  // Section 1 — Property Identification & Inspection Details
  "prop_address",
  "prop_suburb",
  "prop_state",
  "prop_postcode",
  "prop_assignment",
  "insp_date",
  "insp_valuer",
  // Section 6 — Overall Condition Summary & Sign-off
  "overall_cond",
];

export const REQUIRED_SET = new Set(REQUIRED_FIELDS);
