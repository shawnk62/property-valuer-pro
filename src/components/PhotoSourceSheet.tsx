/**
 * Phone-friendly source picker. capture="environment" skips the iOS library
 * sheet, so tiles open this first; the chosen button then clicks the matching
 * file input in the same tap.
 */
export function PhotoSourceSheet({
  open,
  title = "Add photo",
  onClose,
  onCamera,
  onLibrary,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-1 pb-2 text-sm font-semibold text-foreground">{title}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onCamera();
              onClose();
            }}
          >
            Take photo
          </button>
          <button
            type="button"
            className="rounded-md border border-input bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
            onClick={() => {
              onLibrary();
              onClose();
            }}
          >
            Photo library
          </button>
          <button
            type="button"
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
