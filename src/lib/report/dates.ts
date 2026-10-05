const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function padYear(year: number): number {
  if (year < 100) return year + 2000;
  return year;
}

function fromParts(day: number, monthIndex: number, year: number): string | null {
  if (!Number.isFinite(day) || !Number.isFinite(monthIndex) || !Number.isFinite(year)) return null;
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const y = padYear(year);
  if (y < 1800 || y > 2200) return null;
  return `${day} ${MONTHS[monthIndex]}, ${y}`;
}

/**
 * Narrative / certificate dates: "9 September, 2026".
 * Does not change sale dates on adjustment or sales-comparison grids.
 */
export function formatNarrativeDate(raw: string | undefined | null): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  const already = s.match(
    /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})$/i,
  );
  if (already) {
    const day = parseInt(already[1]!, 10);
    const monthName = already[2]!;
    const year = parseInt(already[3]!, 10);
    const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
    return fromParts(day, monthIndex, year) || s;
  }

  const shortMonth = s.match(
    /^(\d{1,2})[/-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[/-](\d{2,4})$/i,
  );
  if (shortMonth) {
    const monthIndex = MONTHS.findIndex((m) => m.toLowerCase().startsWith(shortMonth[2]!.toLowerCase()));
    return fromParts(parseInt(shortMonth[1]!, 10), monthIndex, parseInt(shortMonth[3]!, 10)) || s;
  }

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    return fromParts(parseInt(dmy[1]!, 10), parseInt(dmy[2]!, 10) - 1, parseInt(dmy[3]!, 10)) || s;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return fromParts(parseInt(iso[3]!, 10), parseInt(iso[2]!, 10) - 1, parseInt(iso[1]!, 10)) || s;
  }

  const long = s.match(
    /(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (long) {
    const monthIndex = MONTHS.findIndex((m) => m.toLowerCase() === long[2]!.toLowerCase());
    return fromParts(parseInt(long[1]!, 10), monthIndex, parseInt(long[3]!, 10)) || s;
  }

  return s;
}

export function formatNarrativeDateOr(raw: string | undefined | null, fallback: string): string {
  return formatNarrativeDate(raw) || fallback;
}
