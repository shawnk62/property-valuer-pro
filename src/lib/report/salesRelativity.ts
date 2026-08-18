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
 * Collapse accidental letter-spaced runs, e.g. "R e m o d e l e d" → "Remodeled".
 * Multi-word runs are re-segmented with a small valuation vocabulary so spaces
 * return between real words ("Remodeled kitchen and baths").
 */
const RESEGMENT_WORDS = [
  "remodeled",
  "remodelled",
  "kitchen",
  "kitchens",
  "bath",
  "baths",
  "bathroom",
  "bathrooms",
  "ensuite",
  "and",
  "with",
  "the",
  "new",
  "fully",
  "partially",
  "updated",
  "original",
  "inferior",
  "superior",
  "similar",
  "slightly",
  "overall",
  "subject",
  "comparable",
  "location",
  "elevated",
  "quieter",
  "land",
  "area",
  "living",
  "built",
  "car",
  "garage",
  "carport",
  "brick",
  "tile",
  "lowset",
  "highset",
  "midset",
];

function resegmentJoinedLetters(joined: string): string {
  const lower = joined.toLowerCase();
  const parts: string[] = [];
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    // Prefer longer dictionary words first
    const sorted = [...RESEGMENT_WORDS].sort((a, b) => b.length - a.length);
    for (const w of sorted) {
      if (lower.startsWith(w, i)) {
        parts.push(joined.slice(i, i + w.length));
        i += w.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      let j = i + 1;
      while (j <= lower.length) {
        const rest = lower.slice(j);
        if (sorted.some((w) => rest.startsWith(w)) || j === lower.length) {
          parts.push(joined.slice(i, j));
          i = j;
          break;
        }
        j += 1;
      }
    }
  }
  return parts.filter(Boolean).join(" ");
}

export function collapseSpacedLetters(text: string): string {
  if (!text) return text;
  return String(text).replace(/(?:\b[A-Za-z0-9]\s+){5,}[A-Za-z0-9]\b/g, (m) => {
    const joined = m.replace(/\s+/g, "");
    if (joined.length >= 10) return resegmentJoinedLetters(joined);
    return joined;
  });
}

/** Normalise narrative/comment text before save or display. */
export function cleanSaleProse(text: string): string {
  return collapseSpacedLetters(String(text ?? "").replace(/\s{2,}/g, " ")).trim();
}

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
  /** When true, narrative is valuer-owned — do not rewrite on each keystroke. */
  narrativeManual?: boolean;
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
    // Manual narratives are not rewritten while typing (prevents cursor jumps /
    // letter-spacing sanitiser fighting the keyboard).
    if (s.narrativeManual) return next;
    if (typeof s.narrative === "string" && s.narrative.trim()) {
      next.narrative = withRelativityNarrative(s.narrative, s.salePrice, valueAmount);
    }
    return next;
  });
}

export { INFERIOR, SUPERIOR, COMPARABLE, PHRASES };
