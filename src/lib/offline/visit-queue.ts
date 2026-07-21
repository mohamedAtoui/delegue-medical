/**
 * Offline-resilient visit submission.
 *
 * A visit is submitted with a single POST. If the network is unavailable (the
 * délégué lost connection), the payload is stored in IndexedDB and retried
 * automatically when the connection returns (see useVisitSync). The chronometer
 * itself runs entirely client-side, so timing is never blocked by the network.
 */

const DB_NAME = "handson-offline";
const STORE = "pending_visits";
const DB_VERSION = 1;

export interface PendingVisit {
  id: string;
  payload: unknown;
  queuedAt: number;
}

const PENDING_EVENT = "handson:pending-visits-changed";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

function emitChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PENDING_EVENT));
  }
}

export function onPendingChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PENDING_EVENT, cb);
  return () => window.removeEventListener(PENDING_EVENT, cb);
}

export async function enqueueVisit(payload: unknown): Promise<void> {
  if (!hasIDB()) return;
  const item: PendingVisit = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    payload,
    queuedAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(item));
  emitChanged();
}

export async function pendingCount(): Promise<number> {
  if (!hasIDB()) return 0;
  try {
    return await tx<number>("readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

async function getAll(): Promise<PendingVisit[]> {
  if (!hasIDB()) return [];
  try {
    return (await tx<PendingVisit[]>("readonly", (s) => s.getAll())) || [];
  } catch {
    return [];
  }
}

async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  emitChanged();
}

/**
 * Try to POST every queued visit. Successful (2xx) and permanently-rejected
 * (4xx — a retry can't fix a bad payload) items are removed; 5xx / network
 * errors are kept for the next attempt.
 */
export async function syncPendingVisits(): Promise<{
  synced: number;
  dropped: number;
  remaining: number;
}> {
  const items = await getAll();
  let synced = 0;
  let dropped = 0;
  for (const item of items) {
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await remove(item.id);
        synced++;
      } else if (res.status >= 400 && res.status < 500) {
        // Bad payload — retrying won't help; drop it so it can't wedge the queue.
        await remove(item.id);
        dropped++;
      }
      // 5xx: keep for retry.
    } catch {
      // Still offline — stop; the online listener will retry.
      break;
    }
  }
  return { synced, dropped, remaining: await pendingCount() };
}
