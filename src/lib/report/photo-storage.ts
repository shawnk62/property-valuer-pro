import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const REPORT_PHOTOS_BUCKET = "report-photos";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

/**
 * Upload a report photo to Supabase Storage.
 * Path: `{userId}/{inspectionId}/{photoId}.{ext}`
 * Returns durable public URL + storage path.
 */
export async function uploadReportPhoto(opts: {
  inspectionId: string;
  photoId: string;
  file: File;
}): Promise<{ url: string; storagePath: string }> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to upload photos.");

  const ext = extensionFor(opts.file);
  const storagePath = `${user.id}/${opts.inspectionId}/${opts.photoId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(REPORT_PHOTOS_BUCKET)
    .upload(storagePath, opts.file, {
      cacheControl: "3600",
      upsert: true,
      contentType: opts.file.type || "image/jpeg",
    });

  if (uploadError) {
    const msg = uploadError.message || "Upload failed";
    if (/bucket|not found|404/i.test(msg)) {
      throw new Error(
        `Storage bucket "${REPORT_PHOTOS_BUCKET}" is missing. Create it in Supabase (Storage → New bucket, public, name: report-photos) and add policies for authenticated upload/read.`,
      );
    }
    throw new Error(msg);
  }

  const { data } = supabase.storage.from(REPORT_PHOTOS_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    throw new Error("Upload succeeded but no public URL was returned.");
  }

  return { url: data.publicUrl, storagePath };
}

/** Best-effort delete; ignores missing objects. */
export async function deleteReportPhoto(storagePath: string | undefined): Promise<void> {
  if (!storagePath || !isSupabaseConfigured) return;
  await supabase.storage.from(REPORT_PHOTOS_BUCKET).remove([storagePath]);
}
