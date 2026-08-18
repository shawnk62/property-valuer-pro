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
