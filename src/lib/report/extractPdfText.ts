/**
 * Client-side PDF text extraction via pdfjs-dist.
 * Keeps large Cotality CMA PDFs in the browser — never POST the whole file to the server.
 *
 * Reconstructs reading order by grouping text items into lines (shared Y) then
 * sorting left-to-right. Cotality often emits "390m2" as separate tokens
 * ("390m" + "2"); we rejoin those so area parsing works.
 */
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
    type Item = { str: string; x: number; y: number };
    const items: Item[] = [];

    for (const raw of content.items) {
      if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
      const str = String((raw as { str: string }).str ?? "").trim();
      if (!str) continue;
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
      const parts: string[] = [];
      for (let j = 0; j < line.length; j++) {
        const cur = line[j]!;
        if (j === 0) {
          parts.push(cur.str);
          continue;
        }
        const prev = line[j - 1]!;
        const gap = cur.x - prev.x;
        // Tight glyphs or unit superscript "2" after m — no space
        if (gap < 8 || /^[²2]$/.test(cur.str)) {
          parts[parts.length - 1] = parts[parts.length - 1]! + cur.str;
        } else {
          parts.push(cur.str);
        }
      }
      return parts.join(" ").replace(/[ \t]{2,}/g, " ").trim();
    });

    pages.push(lineTexts.filter(Boolean).join("\n"));
  }

  let text = pages
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Cotality: pdf.js often yields "390m 2" or "390 m 2" for 390m²
  text = text
    .replace(/(\d+)\s*m\s*[²2]\b/gi, "$1m2")
    .replace(/(\d+m)\s+[²2]\b/gi, "$1m2")
    .replace(/(\d+)\s*m²/gi, "$1m2");

  return text;
}
