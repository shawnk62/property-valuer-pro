/**
 * Extract Cotality CMA sales map + comparable front photos from a PDF (browser).
 *
 * Cotality structure (verified on real CMAs):
 * - "Map: Sales" page → large map image (~1566×2048 RGB)
 * - "Comparable Sales" pages → ~768×512 listing photos; first in paint order
 *   is the street/front elevation; a wider strip is the inset location map
 *
 * Returns JPEG data URLs for Preview / Word without a separate upload step.
 */

export type CmaMediaExtract = {
  salesMapUrl: string | null;
  /** Front elevations in Comparable Sales page order (matches sale list). */
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

/**
 * Load a decoded image XObject from the page.
 * Must use the callback form — sync get throws while the worker is still decoding.
 * Large map bitmaps can take several seconds; do not time out aggressively.
 */
function loadImageObj(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  name: string,
): Promise<PdfImageObj | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (obj: PdfImageObj | null) => {
      if (settled) return;
      settled = true;
      resolve(obj);
    };

    // Long ceiling only — never treat "still decoding" as failure at 1.5s
    const timer = setTimeout(() => finish(null), 20_000);

    try {
      page.objs.get(name, (obj: PdfImageObj | null) => {
        clearTimeout(timer);
        if (obj && obj.width > 0 && obj.height > 0 && obj.data && obj.data.length > 0) {
          finish(obj);
        } else {
          finish(null);
        }
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/**
 * Convert pdf.js image object → JPEG data URL, optionally downscaled.
 * Downscaling keeps localStorage / draft size workable for the sales map.
 */
function imageObjToDataUrl(
  img: PdfImageObj,
  opts?: { quality?: number; maxEdge?: number },
): string | null {
  if (typeof document === "undefined") return null;
  if (!img.width || !img.height || !img.data) return null;

  const quality = opts?.quality ?? 0.8;
  const maxEdge = opts?.maxEdge ?? 1600;

  const srcW = img.width;
  const srcH = img.height;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  // Decode full-res into an intermediate canvas, then scale if needed
  const full = document.createElement("canvas");
  full.width = srcW;
  full.height = srcH;
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return null;

  const imageData = fullCtx.createImageData(srcW, srcH);
  const src = img.data;
  const dst = imageData.data;
  const pixels = srcW * srcH;
  const kind = img.kind ?? 0;

  if (kind === 2 || src.length === pixels * 3) {
    let si = 0;
    let di = 0;
    for (let p = 0; p < pixels; p++) {
      dst[di++] = src[si++]!;
      dst[di++] = src[si++]!;
      dst[di++] = src[si++]!;
      dst[di++] = 255;
    }
  } else if (kind === 3 || src.length === pixels * 4) {
    for (let i = 0; i < pixels * 4; i++) dst[i] = src[i]!;
  } else if (kind === 1 || src.length === pixels) {
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

  fullCtx.putImageData(imageData, 0, 0);

  if (scale >= 0.999) {
    return full.toDataURL("image/jpeg", quality);
  }

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return full.toDataURL("image/jpeg", quality);
  outCtx.drawImage(full, 0, 0, outW, outH);
  return out.toDataURL("image/jpeg", quality);
}

async function imagesOnPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OPS: any,
): Promise<{ name: string; img: PdfImageObj }[]> {
  const ops = await page.getOperatorList();
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < ops.fnArray.length; k++) {
    if (ops.fnArray[k] !== OPS.paintImageXObject) continue;
    const n = ops.argsArray[k]?.[0];
    if (!n) continue;
    const name = String(n);
    if (seen.has(name)) continue;
    seen.add(name);
    ordered.push(name);
  }

  const out: { name: string; img: PdfImageObj }[] = [];
  for (const name of ordered) {
    const img = await loadImageObj(page, name);
    if (img) out.push({ name, img });
  }
  return out;
}

function isLikelyFrontPhoto(img: PdfImageObj): boolean {
  const w = img.width;
  const h = img.height;
  if (w < 400 || h < 280) return false;
  const aspect = w / h;
  // Listing photos ~1.3–1.7; exclude logos and wide inset maps (~2.3+)
  if (aspect < 1.15 || aspect > 1.9) return false;
  const area = w * h;
  if (area < 150_000 || area > 1_200_000) return false;
  return true;
}

function isLikelyMapImage(img: PdfImageObj): boolean {
  const w = img.width;
  const h = img.height;
  if (w < 500 || h < 500) return false;
  return w * h >= 600_000;
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

    const isMapPage =
      /map\s*:\s*sales/i.test(text) ||
      (/\bmap\b/i.test(text) && /\bsales\b/i.test(text) && !/comparable\s+sales/i.test(text));
    const isCompPage = /comparable\s+sales/i.test(text);

    if (!isMapPage && !isCompPage) continue;

    const images = await imagesOnPage(page, pdfjs.OPS);
    if (images.length === 0) {
      console.warn(`[CMA media] page ${i}: classified but no image XObjects decoded`);
      continue;
    }

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
        salesMapUrl = imageObjToDataUrl(best, { quality: 0.75, maxEdge: 1400 });
        if (!salesMapUrl) {
          console.warn("[CMA media] map image decoded but canvas conversion failed");
        }
      }
    }

    if (isCompPage) {
      const front = images.find(({ img }) => isLikelyFrontPhoto(img));
      if (front) {
        const url = imageObjToDataUrl(front.img, { quality: 0.82, maxEdge: 1000 });
        if (url) frontPhotoUrls.push(url);
        else console.warn(`[CMA media] page ${i}: front photo conversion failed`);
      } else {
        // Fallback: largest landscape image that is not the inset map strip
        let fallback: PdfImageObj | null = null;
        let bestArea = 0;
        for (const { img } of images) {
          const area = img.width * img.height;
          const aspect = img.width / img.height;
          if (aspect < 1.1 || aspect > 2.0) continue;
          if (area < 80_000) continue;
          if (area > bestArea && area < 1_500_000) {
            bestArea = area;
            fallback = img;
          }
        }
        if (fallback) {
          const url = imageObjToDataUrl(fallback, { quality: 0.82, maxEdge: 1000 });
          if (url) frontPhotoUrls.push(url);
        } else {
          console.warn(`[CMA media] page ${i}: no front-photo candidate among ${images.length} images`);
        }
      }
    }
  }

  console.info(
    `[CMA media] map=${salesMapUrl ? "yes" : "no"} fronts=${frontPhotoUrls.length}`,
  );
  return { salesMapUrl, frontPhotoUrls };
}
