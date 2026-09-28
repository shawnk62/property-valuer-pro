/** Drop a heading the model copied into the narrative when the report already prints that heading. */
export function stripLeadingHeading(text: string, heading: string): string {
  const raw = String(text ?? "").replace(/^\uFEFF/, "");
  if (!raw.trim() || !heading.trim()) return raw;
  const label = heading
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const re = new RegExp(`^\\s*(?:\\d+(?:\\.\\d+)*\\.?\\s+)?${label}\\s*(?:\\n+|:\\s*)`, "i");
  return raw.replace(re, "").trimStart();
}
