/**
 * Attach a comparable photo the same way residential sales do:
 * write to IndexedDB first, show immediately, then upload.
 * If the upload fails, the photo remains on this device.
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
  const prepared = await preparePhotoForReport(stable);
  const localKey = photoBlobKey(opts.inspectionId, opts.photoId);
  await putPhotoBlob(localKey, prepared);
  const localUrl = URL.createObjectURL(prepared);
  try {
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
