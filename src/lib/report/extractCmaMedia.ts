/**
 * Extract Cotality CMA sales map + comparable front photos (browser).
 *
 * Console showed image XObjects not decoding in the Vite/browser pdf.js build
 * ("classified but no image XObjects decoded"). Primary path is therefore
 * page.render → canvas crop, which always works when the page paints.
 *
 * Cotality layout (verified):
 * - Map: Sales page → full-page map
 * - Comparable Sales page → front elevation is the upper-left listing photo
 */

export type CmaMediaExtract = {
  salesMapUrl: string | null;
  /** Front elevations in Comparable Sales page order (matches sale list). */
  frontPhotoUrls: string[];
};

function pageText(items: { str?: string }[]): string {
  return items
    .map((it) => String(it.str ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Render a PDF page to a canvas at the given scale. */
async function renderPageToCanvas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  scale: number,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // pdf.js v4 render API
  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    // v4 optional canvas factory not required when canvasContext is provided
  });
  await renderTask.promise;
  return canvas;
}

/** Crop a region (fractions 0–1 of source) into a JPEG data URL. */
function cropToDataUrl(
  source: HTMLCanvasElement,
  region: { x0: number; y0: number; x1: number; y1: number },
  opts?: { quality?: number; maxEdge?: number },
): string | null {
  const quality = opts?.quality ?? 0.82;
  const maxEdge = opts?.maxEdge ?? 1200;

  const sx = Math.max(0, Math.floor(region.x0 * source.width));
  const sy = Math.max(0, Math.floor(region.y0 * source.height));
  const sw = Math.max(1, Math.floor((region.x1 - region.x0) * source.width));
  const sh = Math.max(1, Math.floor((region.y1 - region.y0) * source.height));

  let outW = sw;
  let outH = sh;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  if (scale < 0.999) {
    outW = Math.max(1, Math.round(sw * scale));
    outH = Math.max(1, Math.round(sh * scale));
  }

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
  return out.toDataURL("image/jpeg", quality);
}

/**
 * Secondary path: pull decoded image XObjects (works in some environments).
 * Kept as enrichment when render crop is coarse.
 */
async function tryXObjectImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs: any,
): Promise<{ width: number; height: number; dataUrl: string }[]> {
  if (typeof document === "undefined") return [];
  try {
    const ops = await page.getOperatorList();
    const OPS = pdfjs.OPS;
    const paintOp =
      OPS?.paintImageXObject ??
      OPS?.paintImageXObjectRepeat ??
      null;
    // Collect names even if OPS enum is missing — scan numeric fn ids later if needed
    const names: string[] = [];
    const seen = new Set<string>();
    for (let k = 0; k < ops.fnArray.length; k++) {
      const fn = ops.fnArray[k];
      const isPaint =
        (paintOp != null && fn === paintOp) ||
        (OPS && fn === OPS.paintImageXObject);
      if (!isPaint) continue;
      const n = ops.argsArray[k]?.[0];
      if (!n) continue;
      const name = String(n);
      if (seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }

    const out: { width: number; height: number; dataUrl: string }[] = [];
    for (const name of names) {
      const img: {
        width?: number;
        height?: number;
        kind?: number;
        data?: Uint8Array | Uint8ClampedArray;
      } | null = await new Promise((resolve) => {
        let done = false;
        const finish = (v: typeof img) => {
          if (done) return;
          done = true;
          resolve(v);
        };
        const t = setTimeout(() => finish(null), 12_000);
        try {
          page.objs.get(name, (obj: typeof img) => {
            clearTimeout(t);
            finish(obj && obj.width && obj.data ? obj : null);
          });
        } catch {
          clearTimeout(t);
          finish(null);
        }
      });
      if (!img?.width || !img.height || !img.data) continue;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      const imageData = ctx.createImageData(img.width, img.height);
      const src = img.data;
      const dst = imageData.data;
      const pixels = img.width * img.height;
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
      } else {
        continue;
      }
      ctx.putImageData(imageData, 0, 0);

      // Downscale large bitmaps
      const maxEdge = 1400;
      const sc = Math.min(1, maxEdge / Math.max(img.width, img.height));
      if (sc < 0.999) {
        const small = document.createElement("canvas");
        small.width = Math.round(img.width * sc);
        small.height = Math.round(img.height * sc);
        const sctx = small.getContext("2d");
        if (sctx) {
          sctx.drawImage(canvas, 0, 0, small.width, small.height);
          out.push({
            width: img.width,
            height: img.height,
            dataUrl: small.toDataURL("image/jpeg", 0.8),
          });
          continue;
        }
      }
      out.push({
        width: img.width,
        height: img.height,
        dataUrl: canvas.toDataURL("image/jpeg", 0.8),
      });
    }
    return out;
  } catch (err) {
    console.warn("[CMA media] XObject path failed", err);
    return [];
  }
}

function isFrontPhotoSize(w: number, h: number): boolean {
  if (w < 400 || h < 280) return false;
  const aspect = w / h;
  if (aspect < 1.15 || aspect > 1.9) return false;
  const area = w * h;
  return area >= 150_000 && area <= 1_200_000;
}

function isMapSize(w: number, h: number): boolean {
  return w >= 500 && h >= 500 && w * h >= 600_000;
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
      (/\bmap\b/i.test(text) &&
        /\bsales\b/i.test(text) &&
        !/comparable\s+sales/i.test(text));
    const isCompPage = /comparable\s+sales/i.test(text);
    if (!isMapPage && !isCompPage) continue;

    // ---- Try XObject images first (when the browser build decodes them) ----
    const xobjs = await tryXObjectImages(page, pdfjs);

    if (isMapPage && !salesMapUrl) {
      const mapCandidate = xobjs
        .filter((x) => isMapSize(x.width, x.height))
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (mapCandidate) {
        salesMapUrl = mapCandidate.dataUrl;
      } else {
        // Render full page and take the content area (drop thin header/footer)
        const canvas = await renderPageToCanvas(page, 1.25);
        if (canvas) {
          salesMapUrl = cropToDataUrl(
            canvas,
            { x0: 0.03, y0: 0.06, x1: 0.97, y1: 0.92 },
            { quality: 0.75, maxEdge: 1400 },
          );
        }
      }
      if (!salesMapUrl) {
        console.warn(`[CMA media] page ${i}: map page but no map image produced`);
      }
    }

    if (isCompPage) {
      const frontX = xobjs.find((x) => isFrontPhotoSize(x.width, x.height));
      if (frontX) {
        frontPhotoUrls.push(frontX.dataUrl);
      } else {
        // Cotality detail card: front elevation is upper-left photo block
        // under the address/price header. Crop that region from the rendered page.
        const canvas = await renderPageToCanvas(page, 1.5);
        if (canvas) {
          const url = cropToDataUrl(
            canvas,
            // Tuned from Cotality CMA page screenshots:
            // header ~0–0.14, photo grid starts ~0.15, left photo ~left half,
            // height covers the exterior shot without the lower interior/map.
            { x0: 0.04, y0: 0.14, x1: 0.50, y1: 0.48 },
            { quality: 0.82, maxEdge: 1000 },
          );
          if (url) {
            frontPhotoUrls.push(url);
          } else {
            console.warn(`[CMA media] page ${i}: front photo crop failed`);
          }
        } else {
          console.warn(`[CMA media] page ${i}: page render failed`);
        }
      }
    }
  }

  console.info(
    `[CMA media] map=${salesMapUrl ? "yes" : "no"} fronts=${frontPhotoUrls.length}`,
  );
  return { salesMapUrl, frontPhotoUrls };
}
