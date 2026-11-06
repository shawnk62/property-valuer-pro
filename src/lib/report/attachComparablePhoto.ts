/**
 * Attach a comparable photo the same way residential sales do:
 * clone the file immediately, show it, then process and upload.
 * iOS Safari invalidates a library File if it is not read at once.
 */
import { photoBlobKey, putPhotoBlob } from "@/lib/report/photo-idb";
import { uploadReportPhoto } from "@/lib/report/photo-storage";
import { cloneImageFile, preparePhotoForReport } from "@/lib/report/photo-data";

export async function attachComparablePhoto(opts: {
  inspectionId: string;
  photoId: string;
  file: File;
}): Promise<{ photoUrl: string; photoLocalKey: string; photoStoragePath?: string; synced: boolean }> {
  const stable = await cloneImageFile(opts.file);
  const localKey = photoBlobKey(opts.inspectionId, opts.photoId);
  const localUrl = URL.createObjectURL(stable);
  await putPhotoBlob(localKey, stable);
  try {
    const prepared = await preparePhotoForReport(stable);
    await putPhotoBlob(localKey, prepared);
    const { url, storagePath } = await uploadReportPhoto({
      inspectionId: opts.inspectionId,
      photoId: opts.photoId,
      file: prepared,
    });
    return { photoUrl: url, photoLocalKey: localKey, photoStoragePath: storagePath, synced: true };
  } catch {
    return { photoUrl: localUrl, photoLocalKey: localKey, synced: false };
  }
}
