/**
 * Compare each comparable sale price to the valuation statement amount and
 * attach a standard overall relativity phrase (deterministic — not AI).
 *
 * Rule (outside AI):
 * - sale price > valuation → Overall superior to the subject
 * - sale price < valuation → Overall inferior to the subject
 * - equal                   → Overall comparable to the subject
 */
const INFERIOR = "Overall inferior to the subject";
const SUPERIOR = "Overall superior to the subject";
const COMPARABLE = "Overall comparable to the subject";

const PHRASES = [INFERIOR, SUPERIOR, COMPARABLE];

/** Matches trailing / embedded overall phrases so they can be replaced cleanly. */
const OVERALL_RE =
  /\s*Overall\s+(?:inferior|superior|comparable)\s+to\s+the\s+subject\.?\s*/gi;

export function parseMoney(raw: string): number | null {
  if (!raw || !String(raw).trim()) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function stripRelativityPhrase(text: string): string {
  return String(text ?? "")
    .replace(OVERALL_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Deterministic overall phrase from sale price vs valuation amount.
 * Returns null when either figure is missing/unparseable.
 */
export function relativityPhrase(salePrice: string, valueAmount: string): string | null {
  const sale = parseMoney(salePrice);
  const value = parseMoney(valueAmount);
  if (sale == null || value == null) return null;
  if (sale < value) return INFERIOR;
  if (sale > value) return SUPERIOR;
  return COMPARABLE;
}

/** Merge overall phrase into comments without duplicating it. */
export function withRelativityComment(
  comments: string,
  salePrice: string,
  valueAmount: string,
): string {
  const base = stripRelativityPhrase(comments);
  const phrase = relativityPhrase(salePrice, valueAmount);
  if (!phrase) return base;
  return base ? `${base} ${phrase}` : phrase;
}

/**
 * Ensure a sales-evidence narrative ends with the deterministic overall phrase.
 * Strips any prior overall clause first so re-runs stay clean.
 */
export function withRelativityNarrative(
  narrative: string,
  salePrice: string,
  valueAmount: string,
): string {
  const base = stripRelativityPhrase(narrative);
  const phrase = relativityPhrase(salePrice, valueAmount);
  if (!phrase) return base;
  if (!base) return `${phrase}.`;
  // Avoid double-period if the base already ends with punctuation
  const needsSpace = !/[\s]$/.test(base);
  const joiner = needsSpace ? " " : "";
  return `${base}${joiner}${phrase}.`.replace(/\.\./g, ".");
}

export type SaleWithRelativityFields = {
  salePrice: string;
  comments: string;
  narrative?: string;
};

/**
 * Apply overall superior/inferior/comparable from sale price vs valuation
 * to both comments and narrative (when present).
 */
export function applyRelativityToSales<T extends SaleWithRelativityFields>(
  sales: T[],
  valueAmount: string,
): T[] {
  return sales.map((s) => {
    const comments = withRelativityComment(s.comments, s.salePrice, valueAmount);
    const next: T = { ...s, comments };
    if (typeof s.narrative === "string" && s.narrative.trim()) {
      next.narrative = withRelativityNarrative(s.narrative, s.salePrice, valueAmount);
    }
    return next;
  });
}

export { INFERIOR, SUPERIOR, COMPARABLE, PHRASES };
