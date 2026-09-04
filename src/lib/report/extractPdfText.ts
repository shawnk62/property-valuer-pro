/**
 * Client-side PDF text extraction via pdfjs-dist.
 * Reconstructs strings from glyph items using each item's width and height.
 * A fixed pixel gap was dropping or splitting letters on Landchecker PDFs.
 */

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

function ligatureFix(s: string): string {
  return s
    .replace(/\u0000/g, "")
    .replace(/\u00AD/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/\uFB05/g, "ft")
    .replace(/\uFB06/g, "st");
}

function pageTextFromItems(rawItems: unknown[]): string {
  const items: Array<{
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
    eol: boolean;
  }> = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const it = raw as PdfTextItem;
    const str = ligatureFix(String(it.str ?? ""));
    if (!str) continue;
    const tr = Array.isArray(it.transform) ? it.transform : [];
    const x = typeof tr[4] === "number" ? tr[4] : 0;
    const y = typeof tr[5] === "number" ? tr[5] : 0;
    const h =
      typeof it.height === "number" && it.height > 0
        ? it.height
        : Math.abs(typeof tr[3] === "number" ? tr[3] : typeof tr[0] === "number" ? tr[0] : 8);
    const w =
      typeof it.width === "number" && it.width > 0
        ? it.width
        : Math.max(h * 0.4 * Math.max(1, str.replace(/\s/g, "").length), 0);
    items.push({ str, x, y, w, h, eol: it.hasEOL === true });
  }

  if (items.length === 0) return "";

  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: typeof items[] = [];
  for (const it of items) {
    const lastLine = lines[lines.length - 1];
    const sample = lastLine?.[0];
    const tol = Math.max(2, Math.min(sample?.h ?? it.h, it.h) * 0.6);
    if (sample && Math.abs(sample.y - it.y) <= tol) {
      lastLine!.push(it);
    } else {
      lines.push([it]);
    }
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = "";
      let prev: (typeof line)[0] | null = null;
      for (const cur of line) {
        if (!prev) {
          out += cur.str;
          prev = cur;
          if (cur.eol) out += "\n";
          continue;
        }
        const prevEnd = prev.x + prev.w;
        const gap = cur.x - prevEnd;
        const spaceW = Math.max(prev.h, cur.h) * 0.28;
        if (gap > spaceW && !/^\s/.test(cur.str) && !/\s$/.test(out)) {
          out += " ";
        }
        out += cur.str;
        prev = cur;
        if (cur.eol) out += "\n";
      }
      return out.replace(/[ \t]{2,}/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(pageTextFromItems(content.items as unknown[]));
  }

  let text = pages
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = text
    .replace(/(\d)\s*,\s*(\d{3})\b/g, "$1,$2")
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*m\s*[²2]\b/gi, "$1m2")
    .replace(/(\d[\d,]*(?:\.\d+)?m)\s+[²2]\b/gi, "$1m2")
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*m²/gi, "$1m2")
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm)\b/gi, "$1m2")
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:ha|hectares?)\b/gi, "$1ha");

  return text;
}
