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
