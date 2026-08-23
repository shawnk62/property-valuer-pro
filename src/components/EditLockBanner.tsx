import { Lock, RefreshCw, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLockAge, type EditLockInfo } from "@/lib/inspection/editLock";

type Props = {
  checking: boolean;
  canEdit: boolean;
  heldBy: EditLockInfo | null;
  setupRequired: boolean;
  onTakeOver: () => void;
  onRefresh: () => void;
};

export function EditLockBanner({
  checking,
  canEdit,
  heldBy,
  setupRequired,
  onTakeOver,
  onRefresh,
}: Props) {
  if (checking) {
    return (
      <div className="border-b border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
        Checking whether this job is being edited on another device…
      </div>
    );
  }

  if (setupRequired) {
    return (
      <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-foreground">
        Edit locking is not active yet (database columns missing). Run{" "}
        <code className="rounded bg-muted px-1">supabase-edit-lock-setup.sql</code> in Supabase
        so office and field cannot overwrite each other.
      </div>
    );
  }

  if (canEdit) return null;

  return (
    <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-foreground">
          <Lock className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Read only — another device is editing this job</p>
            <p className="text-xs text-muted-foreground">
              {heldBy
                ? `${heldBy.label} · last active ${formatLockAge(heldBy.at)}`
                : "Another device holds the edit lock."}{" "}
              Changes on this screen will not be saved until you take over or the other device
              leaves.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-3.5" />
            Check again
          </Button>
          <Button type="button" size="sm" onClick={onTakeOver}>
            <Unlock className="size-3.5" />
            Take over editing
          </Button>
        </div>
      </div>
    </div>
  );
}
