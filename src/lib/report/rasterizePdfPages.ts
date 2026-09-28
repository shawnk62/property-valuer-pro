/**
 * Render each page of a PDF to a JPEG File for annex printing.
 * Uses the same pdf.js worker as CMA import.
 */
export async function rasterizePdfPages(
  file: File,
  opts: { maxPages?: number; scale?: number } = {},
): Promise<File[]> {
  const maxPages = opts.maxPages ?? 20;
  const scale = opts.scale ?? 2;
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  if (!data.byteLength) throw new Error("The PDF is empty.");

  const doc = await pdfjs.getDocument({ data }).promise;
  const count = Math.min(doc.numPages, maxPages);
  const pages: File[] = [];

  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render the PDF page.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob || blob.size <= 0) continue;
    pages.push(
      new File([blob], `title-page-${i}.jpg`, { type: "image/jpeg" }),
    );
  }

  if (pages.length === 0) {
    throw new Error("Could not read any pages from that PDF.");
  }
  return pages;
}

export function isPdfFile(file: File | null | undefined): file is File {
  if (!file || file.size <= 0) return false;
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}
