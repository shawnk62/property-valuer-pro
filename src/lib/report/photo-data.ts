/**
 * iPhone 12+ camera JPEGs/HEICs are Display P3 and often Smart HDR:
 * Photos.app / Finder apply the gain map + ICC profile; a raw <img> or PDF
 * print of the same file shows the darker SDR base and looks muddy.
 *
 * Decode with the browser's colour-managed path and bake an sRGB JPEG so
 * Preview, print-to-PDF and Word match what the valuer saw in Photos.
 * Falls back to the original file if decode is unavailable.
 */
const REPORT_PHOTO_MAX_EDGE = 2560;
const REPORT_PHOTO_JPEG_QUALITY = 0.92;

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

async function decodePhoto(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
        colorSpaceConversion: "default",
      });
    } catch {
      /* HEIC or HDR decode can fail here on some browsers — try <img>. */
    }
  }
  return loadHtmlImage(file);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error("JPEG encode failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function preparePhotoForReport(file: File): Promise<File> {
  if (!file || file.size <= 0) return file;
  if (typeof document === "undefined") return file;

  try {
    const source = await decodePhoto(file);
    const srcW = source.width;
    const srcH = source.height;
    if (!srcW || !srcH) {
      if ("close" in source) source.close();
      return file;
    }

    const scale = Math.min(1, REPORT_PHOTO_MAX_EDGE / Math.max(srcW, srcH));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" });
    if (!ctx) {
      if ("close" in source) source.close();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, outW, outH);
    if ("close" in source) source.close();

    let blob = await canvasToJpegBlob(canvas, REPORT_PHOTO_JPEG_QUALITY);
    if (blob.size > 9.5 * 1024 * 1024) {
      blob = await canvasToJpegBlob(canvas, 0.82);
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Convert a File to a data URL so photos work in Preview/Word without Supabase Storage. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
        return;
      }
      reject(new Error("Could not read image as data URL"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

/** True for URLs that can be shown after reload (not blob:). */
export function isPersistablePhotoUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || url.startsWith("data:image/");
}

/** Convert a data: URL to a File for Storage upload (cross-device sync). */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error("Could not read image data");
  const blob = await res.blob();
  if (!blob.size) throw new Error("Image data is empty");
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return new File([blob], filename, { type });
}
