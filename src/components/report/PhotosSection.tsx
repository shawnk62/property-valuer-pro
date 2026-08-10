import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { deleteReportPhoto, uploadReportPhoto } from "@/lib/report/photo-storage";
import { PHOTO_SLOTS, type PhotoSlot, type ReportPhoto } from "@/lib/report/types";

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
            {uploading ? "Uploading…" : "Drop an image here, or tap to choose"}
          </span>
        )}
        {uploading && photo?.url ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm font-medium text-foreground">
            Uploading…
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

  async function uploadAndAttach(opts: {
    file: File;
    slot: PhotoSlot | null;
    caption: string;
    replaceId?: string;
  }) {
    const photoId = opts.replaceId ?? newId();
    const snapshot = photos;
    const existing = opts.replaceId
      ? snapshot.find((p) => p.id === opts.replaceId)
      : undefined;

    const previewUrl = URL.createObjectURL(opts.file);
    const optimistic: ReportPhoto = {
      id: photoId,
      slot: opts.slot,
      caption: opts.caption,
      url: previewUrl,
      storagePath: existing?.storagePath,
    };

    if (opts.replaceId) {
      setPhotos(snapshot.map((p) => (p.id === opts.replaceId ? optimistic : p)));
    } else {
      setPhotos([...snapshot, optimistic]);
    }

    markUploading(photoId, true);
    try {
      if (existing?.storagePath) {
        await deleteReportPhoto(existing.storagePath);
      }
      const { url, storagePath } = await uploadReportPhoto({
        inspectionId,
        photoId,
        file: opts.file,
      });
      URL.revokeObjectURL(previewUrl);

      const saved: ReportPhoto = {
        id: photoId,
        slot: opts.slot,
        caption: opts.caption,
        url,
        storagePath,
      };

      // Merge against latest controller state via snapshot + saved id
      const latest = controller.draft.photos;
      const without = latest.filter((p) => p.id !== photoId && p.id !== opts.replaceId);
      if (opts.slot) {
        // Ensure only one photo per fixed slot
        setPhotos([
          ...without.filter((p) => p.slot !== opts.slot),
          saved,
        ]);
      } else {
        setPhotos([...without, saved]);
      }
      toast.success("Photo uploaded");
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      if (opts.replaceId && existing) {
        setPhotos(
          controller.draft.photos.map((p) => (p.id === photoId ? existing : p)),
        );
      } else {
        setPhotos(controller.draft.photos.filter((p) => p.id !== photoId));
      }
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      markUploading(photoId, false);
    }
  }

  function upsertSlotCaption(slot: PhotoSlot, label: string, caption: string) {
    const existing = photos.find((p) => p.slot === slot);
    if (existing) {
      setPhotos(photos.map((p) => (p.id === existing.id ? { ...p, caption } : p)));
      return;
    }
    setPhotos([...photos, { id: newId(), slot, caption, url: "" }]);
  }

  async function onSlotFile(slot: PhotoSlot, label: string, file: File) {
    const existing = photos.find((p) => p.slot === slot);
    await uploadAndAttach({
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
    setPhotos(photos.filter((p) => p.id !== photo.id));
  }

  const extras = photos.filter((p) => p.slot === null);

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Photo annexure</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Photos are stored in Supabase and stay attached to this report across sessions.
          Captions print beneath each image in Annexure 2 and in the Word export.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PHOTO_SLOTS.map(({ slot, label }) => {
          const photo = photos.find((p) => p.slot === slot);
          const uploadingKey = photo?.id;
          return (
            <PhotoCard
              key={slot}
              slotLabel={label}
              photo={photo}
              uploading={uploadingKey ? uploadingIds.has(uploadingKey) : false}
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
          Additional images with custom captions.
        </span>
        <input
          ref={extraInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const file of files) {
              void uploadAndAttach({ file, slot: null, caption: "" });
            }
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
                void uploadAndAttach({
                  file,
                  slot: null,
                  caption: photo.caption,
                  replaceId: photo.id,
                })
              }
              onCaption={(caption) =>
                setPhotos(photos.map((p) => (p.id === photo.id ? { ...p, caption } : p)))
              }
              onRemove={() => void removePhoto(photo)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
