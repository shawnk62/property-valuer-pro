"use client";

/**
 * On-site subject photo capture during the inspection wizard.
 * Writes into the same report_extras.photos array the report Photos tab uses,
 * so completed inspections already populate the report without a second import.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inspectionStore } from "@/lib/inspection/storage";
import { fileToDataUrl } from "@/lib/report/photo-data";
import { deleteReportPhoto, uploadReportPhoto } from "@/lib/report/photo-storage";
import { PHOTO_SLOTS, type PhotoSlot, type ReportPhoto } from "@/lib/report/types";

function newPhotoId(): string {
  return `photo-${Math.random().toString(36).slice(2, 10)}`;
}

async function loadPhotos(inspectionId: string): Promise<ReportPhoto[]> {
  try {
    const extras = await inspectionStore.getReportExtras(inspectionId);
    const list = extras?.photos;
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && typeof p === "object" && typeof (p as ReportPhoto).url === "string")
      .map((p) => {
        const raw = p as ReportPhoto;
        return {
          id: String(raw.id || newPhotoId()),
          slot: (raw.slot as PhotoSlot | null) ?? null,
          caption: String(raw.caption || ""),
          url: String(raw.url || ""),
          ...(raw.storagePath ? { storagePath: String(raw.storagePath) } : {}),
        };
      })
      .filter((p) => p.url);
  } catch {
    return [];
  }
}

async function persistPhotos(inspectionId: string, photos: ReportPhoto[]): Promise<void> {
  const existing = (await inspectionStore.getReportExtras(inspectionId)) ?? {};
  // Keep narrative / sales / meta; only replace photos
  await inspectionStore.saveReportExtras(inspectionId, {
    ...existing,
    photos: photos.map((p) => ({
      id: p.id,
      slot: p.slot,
      caption: p.caption,
      url: p.url,
      ...(p.storagePath ? { storagePath: p.storagePath } : {}),
    })),
  });
}

type PendingCapture = {
  /** Slot being filled, or null for a new extra */
  slot: PhotoSlot | null;
  /** Existing photo id when replacing */
  replaceId?: string;
  /** Draft extra slot id when capturing from an unlabeled empty card */
  draftId?: string;
  caption: string;
  file: File;
  previewUrl: string;
};

interface Props {
  inspectionId: string;
  /** Called after OK saves a photo — parent returns user to prior form position. */
  onPhotoSaved: () => void;
  /** Close grid without capturing (Back). */
  onClose: () => void;
}

export function InspectionPhotosPanel({ inspectionId, onPhotoSaved, onClose }: Props) {
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [saving, setSaving] = useState(false);
  /** Empty extra slots waiting for a photo — label is editable before capture. */
  const [draftExtras, setDraftExtras] = useState<Array<{ id: string; label: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureTargetRef = useRef<{
    slot: PhotoSlot | null;
    replaceId?: string;
    caption: string;
    draftId?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadPhotos(inspectionId).then((list) => {
      if (cancelled) return;
      setPhotos(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  const photoForSlot = useCallback(
    (slot: PhotoSlot) => photos.find((p) => p.slot === slot && p.url),
    [photos],
  );

  const extras = photos.filter((p) => p.slot === null && p.url);

  function openCamera(opts: {
    slot: PhotoSlot | null;
    replaceId?: string;
    caption: string;
    draftId?: string;
  }) {
    captureTargetRef.current = opts;
    const input = fileRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  function onFileSelected(file: File | null) {
    const target = captureTargetRef.current;
    captureTargetRef.current = null;
    if (!file || !target) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPending({
      slot: target.slot,
      replaceId: target.replaceId,
      draftId: target.draftId,
      caption: target.caption,
      file,
      previewUrl,
    });
  }

  function cancelPending() {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  }

  async function confirmPending() {
    if (!pending || saving) return;
    setSaving(true);
    try {
      const id = pending.replaceId || newPhotoId();
      let url: string;
      let storagePath: string | undefined;
      try {
        const uploaded = await uploadReportPhoto({
          inspectionId,
          photoId: id,
          file: pending.file,
        });
        url = uploaded.url;
        storagePath = uploaded.storagePath;
      } catch (uploadErr) {
        // Hotspot / offline: keep a local data URL so the job is not lost
        console.warn("[inspection photos] cloud upload failed, using local data URL", uploadErr);
        url = await fileToDataUrl(pending.file);
        toast.message("Saved on this device only", {
          description: "Cloud upload failed — photo will sync when storage is available from the report Photos tab.",
        });
      }

      const nextPhoto: ReportPhoto = {
        id,
        slot: pending.slot,
        caption: pending.caption,
        url,
        ...(storagePath ? { storagePath } : {}),
      };

      const withoutOld = photos.filter((p) => {
        if (pending.replaceId && p.id === pending.replaceId) return false;
        if (pending.slot && p.slot === pending.slot) return false;
        return true;
      });
      const next = [...withoutOld, nextPhoto];
      setPhotos(next);
      await persistPhotos(inspectionId, next);

      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      if (pending.draftId) {
        setDraftExtras((prev) => prev.filter((d) => d.id !== pending.draftId));
      }
      toast.success("Photo saved");
      onPhotoSaved();
    } catch (err) {
      console.error("[inspection photos]", err);
      toast.error(err instanceof Error ? err.message : "Could not save photo");
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto(photo: ReportPhoto) {
    try {
      if (photo.storagePath) {
        await deleteReportPhoto(photo.storagePath).catch(() => undefined);
      }
      const next = photos.filter((p) => p.id !== photo.id);
      setPhotos(next);
      await persistPhotos(inspectionId, next);
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    }
  }

  function addExtraSlot() {
    // Create a labeled empty slot first — user names it, then taps to photograph.
    setDraftExtras((prev) => [...prev, { id: newPhotoId(), label: "" }]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Subject photos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a slot to open the camera. Review the picture, then OK to save and return to the form.
            Photos appear on the report automatically.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Back to form
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading photos…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {PHOTO_SLOTS.map(({ slot, label }) => {
            const photo = photoForSlot(slot);
            return (
              <div key={slot} className="rounded-md border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                  {photo ? (
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo)}
                      className="text-sm text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openCamera({
                      slot,
                      replaceId: photo?.id,
                      caption: photo?.caption || label,
                    })
                  }
                  className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {photo?.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || label}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-2 px-4 text-center">
                      <Camera className="size-6 opacity-70" />
                      Tap to photograph
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {extras.map((photo) => (
            <div key={photo.id} className="rounded-md border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <input
                  value={photo.caption}
                  onChange={(e) => {
                    const caption = e.target.value;
                    setPhotos((prev) =>
                      prev.map((p) => (p.id === photo.id ? { ...p, caption } : p)),
                    );
                  }}
                  onBlur={() => {
                    const caption = photo.caption.trim() || "Extra photo";
                    const next = photos.map((p) =>
                      p.id === photo.id ? { ...p, caption } : p,
                    );
                    setPhotos(next);
                    void persistPhotos(inspectionId, next);
                  }}
                  placeholder="Label"
                  aria-label="Photo label"
                  className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => void removePhoto(photo)}
                  className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  openCamera({
                    slot: null,
                    replaceId: photo.id,
                    caption: photo.caption.trim() || "Extra photo",
                  })
                }
                className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50"
              >
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="h-full w-full object-cover"
                />
              </button>
            </div>
          ))}

          {draftExtras.map((draft) => (
            <div key={draft.id} className="rounded-md border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <input
                  value={draft.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setDraftExtras((prev) =>
                      prev.map((d) => (d.id === draft.id ? { ...d, label } : d)),
                    );
                  }}
                  placeholder="Label (e.g. Ensuite)"
                  aria-label="Photo label"
                  autoFocus
                  className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraftExtras((prev) => prev.filter((d) => d.id !== draft.id))
                  }
                  className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  openCamera({
                    slot: null,
                    caption: draft.label.trim() || "Extra photo",
                    draftId: draft.id,
                  })
                }
                className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <span className="flex flex-col items-center gap-2 px-4 text-center">
                  <Camera className="size-6 opacity-70" />
                  Tap to photograph
                </span>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addExtraSlot}
            className="flex aspect-4/3 min-h-[8rem] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-card p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Plus className="size-8" />
            Add photo slot
          </button>
        </div>
      )}

      {/* Hidden camera / file input — capture prefers rear camera on phones/tablets */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onFileSelected(file);
          e.target.value = "";
        }}
      />

      {/* Review before save */}
      {pending ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-4 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
            <p className="text-sm font-medium text-foreground">
              Review — {pending.caption}
            </p>
            <div className="mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              <img
                src={pending.previewUrl}
                alt="Preview"
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                disabled={saving}
                onClick={cancelPending}
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1"
                disabled={saving}
                onClick={() => void confirmPending()}
              >
                <Check className="size-4" />
                {saving ? "Saving…" : "OK"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
