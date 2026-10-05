import type { ComparableSale } from "./types";

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "at", "by",
  "from", "with", "this", "that", "was", "were", "is", "are", "be", "as",
  "it", "its", "about", "between", "now", "used",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function sourceNoteBlobs(sales: ComparableSale[]): string[] {
  return sales
    .flatMap((s) => [s.comments, s.workingNotes])
    .map((t) => (t ?? "").trim())
    .filter(Boolean);
}

function fromSourceNotes(sentence: string, blobs: string[]): boolean {
  const sentenceWords = words(sentence);
  if (sentenceWords.length < 6) return false;
  const noteWords = new Set(blobs.flatMap(words));
  if (noteWords.size === 0) return false;
  const hits = sentenceWords.filter((w) => noteWords.has(w)).length;
  return hits / sentenceWords.length >= 0.7;
}

/**
 * Source notes and working notes are internal. They must not appear on a
 * printed Shawn report, including by paraphrase of a stored note.
 */
export function withoutSourceNotes(text: string, sales: ComparableSale[]): string {
  const blobs = sourceNoteBlobs(sales);
  if (!text.trim() || blobs.length === 0) return text;
  const kept = text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !fromSourceNotes(sentence, blobs))
        .join(" ")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return kept.join("\n\n");
}

/** Printed sale comment. Working-grid narrative, then the comment field. */
export function printedSaleComment(sale: ComparableSale): string {
  return sale.narrative?.trim() || sale.comments?.trim() || "";
}
