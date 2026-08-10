import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const REPORT_PHOTOS_BUCKET = "report-photos";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/heic" || file.type === "image/heif") return "heic";
  return "jpg";
}

function contentTypeFor(file: File): string {
  if (file.type && file.type.startsWith("image/")) return file.type;
  const ext = extensionFor(file);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "image/jpeg";
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

  if (!opts.file || opts.file.size <= 0) {
    throw new Error("The selected file is empty. Choose a different image.");
  }

  // Cap matches bucket file_size_limit (10 MB) in setup SQL.
  if (opts.file.size > 10 * 1024 * 1024) {
    throw new Error("Image is larger than 10 MB. Compress or resize it, then try again.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to upload photos.");

  const ext = extensionFor(opts.file);
  const contentType = contentTypeFor(opts.file);
  const storagePath = `${user.id}/${opts.inspectionId}/${opts.photoId}.${ext}`;

  // Read bytes explicitly — some browsers hand Storage an empty body if File is passed directly.
  const buffer = await opts.file.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error("Could not read image data from the selected file.");
  }
  const body = new Blob([buffer], { type: contentType });

  const { error: uploadError } = await supabase.storage
    .from(REPORT_PHOTOS_BUCKET)
    .upload(storagePath, body, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });

  if (uploadError) {
    const msg = uploadError.message || "Upload failed";
    if (/bucket|not found|404/i.test(msg)) {
      throw new Error(
        `Storage bucket "${REPORT_PHOTOS_BUCKET}" is missing. In Supabase → SQL Editor (Valuer Pro phase 1), run the report-photos setup SQL.`,
      );
    }
    if (/row-level security|rls|policy|not authorized|403|401/i.test(msg)) {
      throw new Error(
        "Upload blocked by storage permissions. Run the report-photos policy SQL while signed into the same Supabase project as the app.",
      );
    }
    if (/no content provided/i.test(msg)) {
      throw new Error(
        "Upload failed (empty body). Try another image format (JPEG/PNG), or confirm the report-photos bucket exists.",
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
