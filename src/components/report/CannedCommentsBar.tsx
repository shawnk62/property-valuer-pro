import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  appendCannedText,
  deleteCannedComment,
  groupCannedByLabel,
  listCannedComments,
  saveCannedComment,
  updateCannedComment,
  type CannedComment,
  type NarrativeSectionKey,
} from "@/lib/narrative/cannedComments";

export function CannedCommentsBar({
  section,
  currentText,
  selectedText,
  onApply,
}: {
  section: NarrativeSectionKey;
  currentText: string;
  /** Highlighted text in the block textarea. Preferred source when saving. */
  selectedText?: string;
  onApply: (nextText: string) => void;
}) {
  const [open, setOpen] = useState<"insert" | "save" | "manage" | null>(null);
  const [items, setItems] = useState<CannedComment[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    try {
      const list = await listCannedComments(section);
      setItems(list);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, [section]);

  const filtered = items.filter((c) => {
    if (!query.trim()) return true;
    const q = query.trim().toLocaleLowerCase("en-AU");
    return (
      c.label.toLocaleLowerCase("en-AU").includes(q) ||
      c.body.toLocaleLowerCase("en-AU").includes(q)
    );
  });
  const groups = groupCannedByLabel(filtered);

  function insert(comment: CannedComment) {
    onApply(appendCannedText(currentText, comment.body));
    setOpen(null);
    toast.success(`Inserted “${comment.label}”`);
  }

  const snippet = (selectedText ?? "").trim() || currentText.trim();
  const savingSelection = Boolean((selectedText ?? "").trim());

  async function handleSave() {
    setBusy(true);
    try {
      await saveCannedComment(section, saveLabel, snippet);
      setSaveLabel("");
      setOpen(null);
      await refresh();
      toast.success(
        savingSelection
          ? "Saved highlighted text as canned comment"
          : "Saved canned comment for this section",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save comment");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCannedComment(id);
    await refresh();
  }

  async function handleRename(id: string, label: string) {
    await updateCannedComment(id, { label });
    await refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(open === "insert" ? null : "insert")}
        className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        Insert canned
      </button>
      <button
        type="button"
        onClick={() => setOpen(open === "save" ? null : "save")}
        className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        Save as canned
      </button>
      {items.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(open === "manage" ? null : "manage")}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Manage
        </button>
      ) : null}

      {open === "insert" ? (
        <div className="basis-full rounded-md border border-border bg-card p-2 shadow-sm">
          {items.length > 6 ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search label or text"
              className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          ) : null}
          {groups.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No canned comments for this section yet. Write the paragraph, then Save as canned.
            </p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => insert(item)}
                          className="w-full rounded px-1.5 py-1 text-left text-xs text-foreground hover:bg-accent"
                        >
                          {preview(item.body)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {open === "save" ? (
        <div className="basis-full rounded-md border border-border bg-card p-2 shadow-sm">
          <p className="mb-1.5 text-xs text-muted-foreground">
            Highlight the sentences to save, then open this panel. Same label groups
            with existing comments.
            {!savingSelection
              ? " No highlight — the whole block will be saved."
              : " Saving the highlighted excerpt only."}
          </p>
          {snippet ? (
            <p className="mb-2 max-h-20 overflow-y-auto rounded bg-muted/50 px-2 py-1 text-xs leading-snug text-foreground">
              {preview(snippet)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[10rem] flex-1 text-xs">
              Label
              <input
                type="text"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="e.g. Flood"
                className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy || !snippet}
              onClick={() => void handleSave()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      {open === "manage" ? (
        <div className="basis-full max-h-64 space-y-2 overflow-y-auto rounded-md border border-border bg-card p-2 shadow-sm">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ul className="mt-1 space-y-2">
                {group.items.map((item) => (
                  <ManageRow
                    key={item.id}
                    item={item}
                    onRename={(label) => void handleRename(item.id, label)}
                    onDelete={() => void handleDelete(item.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function preview(body: string): string {
  const line = body.trim().replace(/\s+/g, " ");
  return line.length > 110 ? `${line.slice(0, 107)}…` : line;
}

function ManageRow({
  item,
  onRename,
  onDelete,
}: {
  item: CannedComment;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  return (
    <li className="rounded border border-border px-2 py-1.5">
      <p className="text-xs leading-snug text-foreground">{preview(item.body)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label.trim() && label.trim() !== item.label) onRename(label);
          }}
          className="min-w-[8rem] flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-xs"
          aria-label="Label"
        />
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
