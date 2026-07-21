"use client";

import { useCallback, useEffect, useState } from "react";
import {
  pendingCount,
  syncPendingVisits,
  onPendingChanged,
} from "./visit-queue";

/**
 * Tracks queued (offline) visits and drains the queue automatically when the
 * connection returns or the app is reopened. `onSynced` fires when at least one
 * queued visit was successfully sent, so the caller can refresh its list.
 */
export function useVisitSync(onSynced?: () => void) {
  const [pending, setPending] = useState(0);

  const refresh = useCallback(() => {
    pendingCount().then(setPending);
  }, []);

  const drain = useCallback(async () => {
    const r = await syncPendingVisits();
    setPending(r.remaining);
    if (r.synced > 0) onSynced?.();
    return r;
  }, [onSynced]);

  useEffect(() => {
    refresh();
    const off = onPendingChanged(refresh);
    const onOnline = () => drain();
    window.addEventListener("online", onOnline);
    // Attempt a drain on mount — covers the app being reopened after going
    // offline, and a connection that came back while the tab was closed.
    if (navigator.onLine) drain();
    return () => {
      off();
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, drain]);

  return { pending, drain };
}
