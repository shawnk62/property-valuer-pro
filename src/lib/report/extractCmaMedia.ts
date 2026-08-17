/**
 * Extract Cotality CMA sales map + comparable front photos from a PDF (browser).
 *
 * Observed Cotality structure (verified against real CMA PDFs):
 * - "Map: Sales" page → one large map image (often ~1566×2048)
 * - "Comparable Sales" pages → three ~768×512 listing photos; the first in
 *   paint order is the street/front elevation; a wider strip is the inset map
 *
 * Returns JPEG data URLs so Preview and Word export work without extra uploads.
 */

export type CmaMediaExtract = {
  /** Sales map image (data URL), or null if not found. */
  salesMapUrl: string | null;
  /**
   * Front elevation photos in document order (same order as Comparable Sales
   * pages, which matches the sale list in the CMA).
   */
  frontPhotoUrls: string[];
};

type PdfImageObj = {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8ClampedArray | Uint8Array;
};

function pageText(items: { str?: string }[]): string {
  return items
    .map((it) => String(it.str ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadImageObj(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  name: string,
): Promise<PdfImageObj | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (obj: PdfImageObj | null) => {
      if (settled) return;
      settled = true;
      resolve(obj);
    };
    try {
      page.objs.get(name, (obj: PdfImageObj) => {
        if (obj && obj.width && obj.data) done(obj);
        else done(null);
      });
    } catch {
      done(null);
      return;
    }
    setTimeout(() => done(null), 1500);
  });
}

/** Convert a pdf.js decoded image object to a JPEG data URL. */
function imageObjToDataUrl(img: PdfImageObj, quality = 0.82): string | null {
  if (typeof document === "undefined") return null;
  if (!img.width || !img.height || !img.data) return null;

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.createImageData(img.width, img.height);
  const src = img.data;
  const dst = imageData.data;
  const pixels = img.width * img.height;
  const kind = img.kind ?? 0;

  if (kind === 2 || src.length === pixels * 3) {
    // RGB_24BPP
    let si = 0;
    let di = 0;
    for (let p = 0; p < pixels; p++) {
      dst[di++] = src[si++]!;
      dst[di++] = src[si++]!;
      dst[di++] = src[si++]!;
      dst[di++] = 255;
    }
  } else if (kind === 3 || src.length === pixels * 4) {
    // RGBA_32BPP
    for (let i = 0; i < pixels * 4; i++) dst[i] = src[i]!;
  } else if (kind === 1 || src.length === pixels) {
    // grayscale
    let di = 0;
    for (let p = 0; p < pixels; p++) {
      const v = src[p]!;
      dst[di++] = v;
      dst[di++] = v;
      dst[di++] = v;
      dst[di++] = 255;
    }
  } else {
    return null;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", quality);
}

async function imagesOnPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OPS: any,
): Promise<{ name: string; img: PdfImageObj }[]> {
  const ops = await page.getOperatorList();
  const names: string[] = [];
  for (let k = 0; k < ops.fnArray.length; k++) {
    if (ops.fnArray[k] === OPS.paintImageXObject) {
      const n = ops.argsArray[k]?.[0];
      if (n) names.push(String(n));
    }
  }
  // Preserve first-seen order; skip duplicate paints of the same XObject
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    ordered.push(n);
  }

  const out: { name: string; img: PdfImageObj }[] = [];
  for (const name of ordered) {
    const img = await loadImageObj(page, name);
    if (img?.width && img?.height && img.data) out.push({ name, img });
  }
  return out;
}

function isLikelyFrontPhoto(img: PdfImageObj): boolean {
  const w = img.width;
  const h = img.height;
  if (w < 400 || h < 280) return false;
  const aspect = w / h;
  // Property listing photos are landscape ~1.3–1.7; exclude logos and wide inset maps
  if (aspect < 1.15 || aspect > 1.9) return false;
  const area = w * h;
  if (area < 150_000 || area > 1_200_000) return false;
  return true;
}

function isLikelyMapImage(img: PdfImageObj): boolean {
  const w = img.width;
  const h = img.height;
  if (w < 600 || h < 600) return false;
  const area = w * h;
  // Full-page map is the dominant image on the Map: Sales page
  return area >= 800_000;
}

/**
 * Extract sales map + ordered front photos from a Cotality CMA PDF.
 */
export async function extractCmaMediaFromPdf(file: File): Promise<CmaMediaExtract> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  let salesMapUrl: string | null = null;
  const frontPhotoUrls: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = pageText(content.items as { str?: string }[]);
    const lower = text.toLowerCase();

    const isMapPage = /map\s*:\s*sales/i.test(text) || (/map/i.test(text) && /sales/i.test(text) && !/comparable\s+sales/i.test(text));
    const isCompPage = /comparable\s+sales/i.test(text);

    if (!isMapPage && !isCompPage) continue;

    const images = await imagesOnPage(page, pdfjs.OPS);

    if (isMapPage && !salesMapUrl) {
      let best: PdfImageObj | null = null;
      let bestArea = 0;
      for (const { img } of images) {
        if (!isLikelyMapImage(img)) continue;
        const area = img.width * img.height;
        if (area > bestArea) {
          bestArea = area;
          best = img;
        }
      }
      // Fallback: absolute largest image on the map page
      if (!best) {
        for (const { img } of images) {
          const area = img.width * img.height;
          if (area > bestArea) {
            bestArea = area;
            best = img;
          }
        }
      }
      if (best) {
        salesMapUrl = imageObjToDataUrl(best, 0.78);
      }
    }

    if (isCompPage) {
      // First listing-style photo in paint order = front elevation
      const front = images.find(({ img }) => isLikelyFrontPhoto(img));
      if (front) {
        const url = imageObjToDataUrl(front.img, 0.82);
        if (url) frontPhotoUrls.push(url);
      }
    }
  }

  return { salesMapUrl, frontPhotoUrls };
}
