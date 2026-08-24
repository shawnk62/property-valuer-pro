import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { fileToDataUrl } from "@/lib/report/photo-data";
import { deleteReportPhoto, uploadReportPhoto } from "@/lib/report/photo-storage";
import { nowPhotoTimestamp } from "@/lib/inspection/photoRequirements";
import { mapSlotsForImport, PHOTO_SLOTS, type PhotoSlot, type ReportPhoto } from "@/lib/report/types";

function newId() {
  return `photo-${Math.random().toString(36).slice(2, 10)}`;
}

function isImageFile(f: File | null | undefined): f is File {
  if (!f || f.size <= 0) return false;
  if (f.type.startsWith("image/")) return true;
  // macOS / iPad screenshots sometimes arrive with an empty MIME type
  if (!f.type && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) return true;
  if (!f.type && /^image$/i.test(f.name)) return true;
  return false;
}

function imageFileFromClipboardEvent(e: React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue;
      const f = item.getAsFile();
      if (isImageFile(f)) return f;
      // Screenshot paste: type may be image/png even when getAsFile name is blank
      if (item.type.startsWith("image/")) {
        const blob = f ?? null;
        if (blob && blob.size > 0) {
          const ext = item.type.split("/")[1] || "png";
          return new File([blob], `screenshot.${ext}`, { type: item.type || "image/png" });
        }
      }
    }
  }
  const files = e.clipboardData?.files;
  if (files) {
    for (const f of Array.from(files)) {
      if (isImageFile(f)) return f;
    }
  }
  return null;
}


function PhotoCard({
  photo,
  slotLabel,
  uploading,
  onFile,
  onCaption,
  onRemove,
  labelEditable = false,
  onLabelChange,
}: {
  photo: ReportPhoto | undefined;
  slotLabel: string;
  uploading?: boolean;
  onFile: (file: File) => void;
  onCaption: (caption: string) => void;
  onRemove?: () => void;
  /** When true, the top label is an input in the same style as fixed map captions. */
  labelEditable?: boolean;
  onLabelChange?: (label: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        {labelEditable ? (
          <input
            value={slotLabel}
            onChange={(e) => onLabelChange?.(e.target.value)}
            placeholder="Label (e.g. Coastal hazard overlay)"
            aria-label="Map label"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
          />
        ) : (
          <span className="text-sm font-semibold text-foreground">{slotLabel}</span>
        )}
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

      <div
        role="button"
        tabIndex={0}
        aria-disabled={uploading || undefined}
        onClick={() => {
          if (!uploading) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (uploading) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={(e) => {
          if (uploading) return;
          const sync = imageFileFromClipboardEvent(e);
          if (sync) {
            e.preventDefault();
            e.stopPropagation();
            onFile(sync);
            return;
          }
          // Async Clipboard API fallback (some screenshot pastes omit clipboardData)
          e.preventDefault();
          e.stopPropagation();
          void (async () => {
            try {
              if (!navigator.clipboard || !("read" in navigator.clipboard)) {
                toast.error("Paste not available — click the tile and try ⌘V, or choose a file.");
                return;
              }
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const type = item.types.find((x) => x.startsWith("image/"));
                if (!type) continue;
                const blob = await item.getType(type);
                if (!blob || blob.size <= 0) continue;
                const ext = type.split("/")[1] || "png";
                onFile(new File([blob], `screenshot.${ext}`, { type }));
                return;
              }
              toast.error("No image on the clipboard", {
                description: "Copy a screenshot, click this tile, then press ⌘V.",
              });
            } catch {
              toast.error("Could not read clipboard", {
                description: "Click the tile and press ⌘V, or tap to choose a file.",
              });
            }
          })();
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).focus?.()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (uploading) return;
          const file = Array.from(e.dataTransfer.files ?? []).find((f) => isImageFile(f));
          if (file) onFile(file);
        }}
        className="relative flex aspect-4/3 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {photo?.url ? (
          <img
            src={photo.url}
            alt={photo.caption || slotLabel}
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <span className="px-4 text-center">
            {uploading
              ? "Reading…"
              : "Paste screenshot (⌘V), drop image, or tap to choose"}
          </span>
        )}
        {uploading && photo?.url ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm font-medium text-foreground">
            Saving…
          </span>
        ) : null}
      </div>
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

      {labelEditable ? null : (
        <input
          value={photo?.caption ?? slotLabel}
          onChange={(e) => onCaption(e.target.value)}
          placeholder="Caption"
          className="mt-3 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      )}
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
    kind?: "map" | "photo";
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
          capturedAt: nowPhotoTimestamp(),
          ...(opts.kind ? { kind: opts.kind } : {}),
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
      } catch (uploadErr) {
        // Keep data: URL preview, but warn — without HTTPS URL the photo will not
        // survive reopen on another device (and may be lost if local cache clears).
        console.warn("[photos] cloud upload failed", uploadErr);
        toast.message("Photo saved on this device only", {
          description:
            uploadErr instanceof Error
              ? uploadErr.message
              : "Cloud upload failed. Sign in and check report-photos storage, then re-attach to sync.",
        });
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

  const extras = photos.filter((p) => p.slot === null && p.kind !== "map");
  const extraMaps = photos.filter((p) => p.slot === null && p.kind === "map");

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
          Panels follow Landchecker Property Report order (location → aerial → zones → overlays →
          flood → bushfire → …) so you can drop maps in the same sequence as the PDF. Report
          placement is unchanged: zones in s.4, location in s.5.2, aerial in s.6.1, flood/bushfire
          in s.6.3–6.4, overlay maps in Annexure 3. Empty slots never print.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {mapSlotsForImport().map(({ slot, label }) => {
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

        {extraMaps.map((photo) => (
          <PhotoCard
            key={photo.id}
            slotLabel={photo.caption || "Additional map"}
            photo={photo}
            uploading={uploadingIds.has(photo.id)}
            labelEditable
            onLabelChange={(label) => {
              const caption = label.trim() || "Additional map";
              setPhotos((prev) =>
                prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)),
              );
            }}
            onFile={(file) =>
              void attachPhoto({
                file,
                slot: null,
                caption: photo.caption || "Additional map",
                replaceId: photo.id,
                kind: "map",
              })
            }
            onCaption={(caption) => {
              setPhotos((prev) =>
                prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)),
              );
            }}
            onRemove={() => void removePhoto(photo)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const id = newId();
            setPhotos((prev) => [
              ...prev,
              {
                id,
                slot: null,
                caption: "",
                url: "",
                kind: "map" as const,
              },
            ]);
          }}
          className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          + Add map / overlay
        </button>
        <span className="text-sm text-muted-foreground">
          Extra labeled tiles for additional overlays or maps. Empty tiles do not print.
        </span>
      </div>
    </div>
  );
}
