/**
 * Split Landchecker / inspection adverse-site text into individual overlay names.
 * Input is typically semicolon- or newline-separated (from extract).
 */
export function parseOverlayList(raw: string | undefined | null): string[] {
  if (!raw || !String(raw).trim()) return [];
  const parts = String(raw)
    .split(/[;\n]+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.length > 1);

  // Dedupe case-insensitively, preserve first spelling
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    // Skip items already covered by dedicated 6.3 / 6.4 sections
    if (/\bflood\b/i.test(p) && !/obstacle|limitation|overlay/i.test(p)) continue;
    if (/\bbushfire\b|\bbush\s*fire\b/i.test(p)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Start numbering for overlay sub-sections under Site Details (after 6.4 Bushfire). */
export function overlaySectionNumber(index: number): string {
  // 6.5, 6.6, 6.7 ...
  return `6.${5 + index}`;
}
