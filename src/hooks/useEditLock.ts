import { useCallback, useEffect, useRef, useState } from "react";
import {
  EDIT_LOCK_HEARTBEAT_MS,
  formatLockAge,
  getDeviceId,
  type EditLockInfo,
} from "@/lib/inspection/editLock";
import { inspectionStore } from "@/lib/inspection/storage";

export type EditLockState = {
  /** True until first acquire attempt finishes */
  checking: boolean;
  /** This device may edit */
  canEdit: boolean;
  /** Holder when we are blocked */
  heldBy: EditLockInfo | null;
  /** SQL columns not installed yet — editing allowed, banner notes setup */
  setupRequired: boolean;
  takeOver: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Acquire a soft exclusive edit lock for this inspection (form + report).
 * Releases on unmount / pagehide when we hold the lock.
 */
export function useEditLock(inspectionId: string | undefined): EditLockState {
  const [checking, setChecking] = useState(true);
  const [canEdit, setCanEdit] = useState(true);
  const [heldBy, setHeldBy] = useState<EditLockInfo | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const heldRef = useRef(false);
  const idRef = useRef(inspectionId);
  idRef.current = inspectionId;

  const acquire = useCallback(async (force = false) => {
    const id = idRef.current;
    if (!id) {
      setChecking(false);
      return;
    }
    try {
      const result = await inspectionStore.tryAcquireEditLock(id, { force });
      if (result.setupRequired) {
        setSetupRequired(true);
        setCanEdit(true);
        setHeldBy(null);
        heldRef.current = false;
      } else if (result.ok) {
        setSetupRequired(false);
        setCanEdit(true);
        setHeldBy(null);
        heldRef.current = true;
      } else {
        setSetupRequired(false);
        setCanEdit(false);
        setHeldBy(result.lock);
        heldRef.current = false;
      }
    } catch (err) {
      console.warn("[editLock] acquire failed", err);
      // Fail open only on network errors so field work is not blocked offline-first —
      // still prefer last-write discipline when online.
      setCanEdit(true);
      setHeldBy(null);
      heldRef.current = false;
    } finally {
      setChecking(false);
    }
  }, []);

  const takeOver = useCallback(async () => {
    setChecking(true);
    await acquire(true);
  }, [acquire]);

  const refresh = useCallback(async () => {
    setChecking(true);
    await acquire(false);
  }, [acquire]);

  useEffect(() => {
    heldRef.current = false;
    setChecking(true);
    void acquire(false);

    const heartbeat = window.setInterval(() => {
      const id = idRef.current;
      if (!id || !heldRef.current) return;
      void inspectionStore.heartbeatEditLock(id);
    }, EDIT_LOCK_HEARTBEAT_MS);

    // Release only when leaving the page (not on camera / app switch — visibility
    // alone would unlock while the valuer is still on the job).
    const release = () => {
      const id = idRef.current;
      if (!id || !heldRef.current) return;
      heldRef.current = false;
      void inspectionStore.releaseEditLock(id);
    };
    window.addEventListener("pagehide", release);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [inspectionId, acquire]);

  return { checking, canEdit, heldBy, setupRequired, takeOver, refresh };
}

export { formatLockAge, getDeviceId };
