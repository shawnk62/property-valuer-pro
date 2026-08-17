/**
 * Client-side PDF text extraction via pdfjs-dist.
 * Keeps large Cotality CMA PDFs in the browser — never POST the whole file to the server.
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
    const chunks: string[] = [];
    for (const item of content.items) {
      if (item && typeof item === "object" && "str" in item) {
        const s = String((item as { str: string }).str ?? "").trim();
        if (s) chunks.push(s);
      }
    }
    // pdf.js often emits tokens; join with spaces then normalise
    pages.push(chunks.join(" "));
  }

  return pages
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
