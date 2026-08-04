export type NarrativeStatus = "pending" | "writing" | "done" | "failed" | "edited";

export interface NarrativeBlock {
  key: string;
  heading: string;
  status: NarrativeStatus;
  text: string;
  model?: string;
  generatedAt?: string;
  error?: string;
}

export interface NarrativeState {
  blocks: NarrativeBlock[];
  startedAt?: string;
  completedAt?: string;
}

export const NARRATIVE_BLOCKS = [
  { key: "location", heading: "Location & Neighbourhood" },
  { key: "site", heading: "Site Details" },
  { key: "improvements-construction", heading: "Improvements — Construction" },
  { key: "improvements-internal", heading: "Improvements — Internal" },
  { key: "services", heading: "Building Services" },
  { key: "external", heading: "External Areas & Ancillary" },
  { key: "overall", heading: "Overall Condition & Remarks" },
] as const;
