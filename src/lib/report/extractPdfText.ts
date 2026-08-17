/**
 * Client-side PDF text extraction via pdfjs-dist.
 * Keeps large Cotality CMA PDFs in the browser — never POST the whole file to the server.
 *
 * Reconstructs reading order by grouping text items into lines (shared Y) then
 * sorting left-to-right. Plain space-join of all tokens scrambles multi-column
 * Cotality pages and breaks address + Sold Price pairing.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Vite resolves the worker asset URL
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = [];

    for (const raw of content.items) {
      if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
      const str = String((raw as { str: string }).str ?? "").trim();
      if (!str) continue;
      // pdf.js transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const tr =
        "transform" in raw && Array.isArray((raw as { transform?: number[] }).transform)
          ? ((raw as { transform: number[] }).transform as number[])
          : null;
      const x = tr && typeof tr[4] === "number" ? tr[4] : 0;
      const y = tr && typeof tr[5] === "number" ? tr[5] : 0;
      items.push({ str, x, y });
    }

    if (items.length === 0) {
      pages.push("");
      continue;
    }

    // Cluster into lines by Y (pdf Y grows upward; tolerance ~2–3 pt)
    const Y_TOL = 2.5;
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Item[][] = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last[0]!.y - it.y) <= Y_TOL) {
        last.push(it);
      } else {
        lines.push([it]);
      }
    }

    const lineTexts = lines.map((line) => {
      line.sort((a, b) => a.x - b.x);
      // Join tokens; insert space when gap is large enough to be a word break
      let out = line[0]!.str;
      for (let j = 1; j < line.length; j++) {
        const prev = line[j - 1]!;
        const cur = line[j]!;
        const gap = cur.x - (prev.x + prev.str.length * 4); // rough width estimate
        if (gap > 1.5 || !/[A-Za-z0-9]$/.test(out) || !/^[A-Za-z0-9]/.test(cur.str)) {
          out += " " + cur.str;
        } else {
          // tight run (same word split across glyphs)
          out += cur.str;
        }
      }
      return out.replace(/[ \t]{2,}/g, " ").trim();
    });

    pages.push(lineTexts.filter(Boolean).join("\n"));
  }

  return pages
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
