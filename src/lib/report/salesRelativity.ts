/**
 * Compare each comparable sale price to the valuation statement amount and
 * attach a standard relativity phrase to comments.
 */
const INFERIOR = "Overall inferior to the subject";
const SUPERIOR = "Overall superior to the subject";
const COMPARABLE = "Overall comparable to the subject";

const PHRASES = [INFERIOR, SUPERIOR, COMPARABLE];

export function parseMoney(raw: string): number | null {
  if (!raw || !String(raw).trim()) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function stripRelativityPhrase(comments: string): string {
  let out = comments ?? "";
  for (const p of PHRASES) {
    out = out.replace(new RegExp(`\\s*${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?`, "gi"), "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export function relativityPhrase(salePrice: string, valueAmount: string): string | null {
  const sale = parseMoney(salePrice);
  const value = parseMoney(valueAmount);
  if (sale == null || value == null) return null;
  if (sale < value) return INFERIOR;
  if (sale > value) return SUPERIOR;
  return COMPARABLE;
}

/** Merge relativity phrase into comments without duplicating it. */
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

export function applyRelativityToSales<
  T extends { salePrice: string; comments: string },
>(sales: T[], valueAmount: string): T[] {
  return sales.map((s) => ({
    ...s,
    comments: withRelativityComment(s.comments, s.salePrice, valueAmount),
  }));
}
