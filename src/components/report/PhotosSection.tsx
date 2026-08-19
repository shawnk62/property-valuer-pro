import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { fileToDataUrl } from "@/lib/report/photo-data";
import { deleteReportPhoto, uploadReportPhoto } from "@/lib/report/photo-storage";
import { MAP_SLOTS, PHOTO_SLOTS, type PhotoSlot, type ReportPhoto } from "@/lib/report/types";

function newId() {
  return `photo-${Math.random().toString(36).slice(2, 10)}`;
}

function PhotoCard({
  photo,
  slotLabel,
  uploading,
  onFile,
  onCaption,
  onRemove,
}: {
  photo: ReportPhoto | undefined;
  slotLabel: string;
  uploading?: boolean;
  onFile: (file: File) => void;
  onCaption: (caption: string) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{slotLabel}</span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (uploading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
      >
        {photo?.url ? (
          <img
            src={photo.url}
            alt={photo.caption || slotLabel}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-4 text-center">
            {uploading ? "Reading…" : "Drop an image here, or tap to choose"}
          </span>
        )}
        {uploading && photo?.url ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm font-medium text-foreground">
            Saving…
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      <input
        value={photo?.caption ?? slotLabel}
        onChange={(e) => onCaption(e.target.value)}
        placeholder="Caption"
        className="mt-3 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function PhotosSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setPhotos } = controller;
  const photos = draft.photos;
  const inspectionId = draft.inspectionId;
  const extraInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

  function markUploading(id: string, on: boolean) {
    setUploadingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /**
   * 1) Always attach a data: URL so Photos + Preview + localStorage work without Storage.
   * 2) Optionally upgrade to Supabase HTTPS when the bucket is available.
   */
  async function attachPhoto(opts: {
    file: File;
    slot: PhotoSlot | null;
    caption: string;
    replaceId?: string;
  }) {
    if (!opts.file || opts.file.size <= 0) {
      toast.error("The selected file is empty.");
      return;
    }

    const photoId = opts.replaceId ?? newId();
    markUploading(photoId, true);

    try {
      const dataUrl = await fileToDataUrl(opts.file);

      setPhotos((prev) => {
        const entry: ReportPhoto = {
          id: photoId,
          slot: opts.slot,
          caption: opts.caption,
          url: dataUrl,
        };
        if (opts.slot) {
          return [...prev.filter((p) => p.slot !== opts.slot && p.id !== photoId), entry];
        }
        if (opts.replaceId) {
          return prev.map((p) => (p.id === opts.replaceId ? { ...entry, storagePath: p.storagePath } : p));
        }
        return [...prev.filter((p) => p.id !== photoId), entry];
      });

      // Best-effort cloud upgrade — does not remove the data URL on failure.
      try {
        const existingPath = photos.find((p) => p.id === opts.replaceId)?.storagePath;
        if (existingPath) {
          await deleteReportPhoto(existingPath);
        }
        const { url, storagePath } = await uploadReportPhoto({
          inspectionId,
          photoId,
          file: opts.file,
        });
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? {
                  ...p,
                  url,
                  storagePath,
                  caption: opts.caption || p.caption,
                }
              : p,
          ),
        );
      } catch {
        // Preview already has data: URL. Cloud optional.
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read image");
    } finally {
      markUploading(photoId, false);
    }
  }

  function upsertSlotCaption(slot: PhotoSlot, label: string, caption: string) {
    setPhotos((prev) => {
      const existing = prev.find((p) => p.slot === slot);
      if (existing) {
        return prev.map((p) => (p.id === existing.id ? { ...p, caption } : p));
      }
      return [...prev, { id: newId(), slot, caption, url: "" }];
    });
  }

  async function onSlotFile(slot: PhotoSlot, label: string, file: File) {
    const existing = photos.find((p) => p.slot === slot);
    await attachPhoto({
      file,
      slot,
      caption: existing?.caption || label,
      replaceId: existing?.id,
    });
  }

  async function removePhoto(photo: ReportPhoto) {
    try {
      await deleteReportPhoto(photo.storagePath);
    } catch {
      // ignore
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  function onExtraFilesSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name),
    );
    if (files.length === 0) {
      toast.error("No image files selected");
      return;
    }
    void (async () => {
      for (const file of files) {
        await attachPhoto({
          file,
          slot: null,
          caption: file.name.replace(/\.[^.]+$/, ""),
        });
      }
    })();
  }

  const extras = photos.filter((p) => p.slot === null);

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Subject photographs</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Front, street, interior and other inspection photos. Empty slots are omitted from the
          exported report. Uploads sync via Storage when available.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PHOTO_SLOTS.map(({ slot, label }) => {
          const photo = photos.find((p) => p.slot === slot);
          return (
            <PhotoCard
              key={slot}
              slotLabel={label}
              photo={photo}
              uploading={photo ? uploadingIds.has(photo.id) : false}
              onFile={(file) => void onSlotFile(slot, label, file)}
              onCaption={(caption) => upsertSlotCaption(slot, label, caption)}
              onRemove={photo?.url ? () => void removePhoto(photo) : undefined}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => extraInputRef.current?.click()}
          className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Add photo
        </button>
        <span className="text-sm text-muted-foreground">
          Additional images with custom captions (multiple allowed).
        </span>
        <input
          ref={extraInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onExtraFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {extras.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {extras.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              slotLabel={photo.caption || `Extra ${index + 1}`}
              photo={photo}
              uploading={uploadingIds.has(photo.id)}
              onFile={(file) =>
                void attachPhoto({
                  file,
                  slot: null,
                  caption: photo.caption,
                  replaceId: photo.id,
                })
              }
              onCaption={(caption) =>
                setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)))
              }
              onRemove={() => void removePhoto(photo)}
            />
          ))}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Maps &amp; overlays</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop screenshots from the Landchecker Property Report (site dimensions, zoning, flood,
          bushfire, etc.). Only slots with an image are included in Preview and Word export —
          empty map slots never print.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MAP_SLOTS.map(({ slot, label }) => {
          const photo = photos.find((p) => p.slot === slot);
          return (
            <PhotoCard
              key={slot}
              slotLabel={label}
              photo={photo}
              uploading={photo ? uploadingIds.has(photo.id) : false}
              onFile={(file) => void onSlotFile(slot, label, file)}
              onCaption={(caption) => upsertSlotCaption(slot, label, caption)}
              onRemove={photo?.url ? () => void removePhoto(photo) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
