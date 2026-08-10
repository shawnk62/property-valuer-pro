import { useRef } from "react";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { PHOTO_SLOTS, type PhotoSlot, type ReportPhoto } from "@/lib/report/types";

function newId() {
  return `photo-${Math.random().toString(36).slice(2, 10)}`;
}

function PhotoCard({
  photo,
  slotLabel,
  onFile,
  onCaption,
  onRemove,
}: {
  photo: ReportPhoto | undefined;
  slotLabel: string;
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
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className="flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        {photo?.url ? (
          <img
            src={photo.url}
            alt={photo.caption || slotLabel}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-4 text-center">Drop an image here, or tap to choose</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
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
  const extraInputRef = useRef<HTMLInputElement>(null);

  function upsertSlot(slot: PhotoSlot, label: string, patch: Partial<ReportPhoto>) {
    const existing = photos.find((p) => p.slot === slot);
    if (existing) {
      setPhotos(photos.map((p) => (p.id === existing.id ? { ...p, ...patch } : p)));
      return;
    }
    setPhotos([
      ...photos,
      { id: newId(), slot, caption: label, url: "", ...patch },
    ]);
  }

  const extras = photos.filter((p) => p.slot === null);

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Photo annexure</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Six fixed caption slots followed by any additional photographs. Captions print
          beneath each image in Annexure 2.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PHOTO_SLOTS.map(({ slot, label }) => (
          <PhotoCard
            key={slot}
            slotLabel={label}
            photo={photos.find((p) => p.slot === slot)}
            onFile={(file) =>
              upsertSlot(slot, label, { url: URL.createObjectURL(file) })
            }
            onCaption={(caption) => upsertSlot(slot, label, { caption })}
          />
        ))}
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
            if (files.length === 0) return;
            setPhotos([
              ...photos,
              ...files.map((file) => ({
                id: newId(),
                slot: null,
                caption: "",
                url: URL.createObjectURL(file),
              })),
            ]);
            e.target.value = "";
          }}
        />
      </div>

      {extras.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {extras.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              slotLabel={`Additional photo ${index + 1}`}
              photo={photo}
              onFile={(file) =>
                setPhotos(
                  photos.map((p) =>
                    p.id === photo.id ? { ...p, url: URL.createObjectURL(file) } : p,
                  ),
                )
              }
              onCaption={(caption) =>
                setPhotos(photos.map((p) => (p.id === photo.id ? { ...p, caption } : p)))
              }
              onRemove={() => setPhotos(photos.filter((p) => p.id !== photo.id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
