const DB_NAME = 'aetherterra_sessions';
const STORE = 'slots';

export interface SessionRecord {
  savedAt: number;
  title: string;
  bytes: ArrayBuffer;
  slot?: 'a' | 'b';
}

const memoryFallbackSlots = new Map<'a' | 'b', SessionRecord>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putSession(slot: 'a' | 'b', rec: SessionRecord): Promise<void> {
  const safeCopy: SessionRecord = {
    savedAt: rec.savedAt,
    title: rec.title,
    bytes: rec.bytes.slice(0),
    slot,
  };

  if (!hasIndexedDb()) {
    memoryFallbackSlots.set(slot, safeCopy);
    return;
  }

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(safeCopy, slot);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    memoryFallbackSlots.delete(slot);
  } catch (err) {
    memoryFallbackSlots.set(slot, safeCopy);
    throw err;
  } finally {
    db.close();
  }
}

export async function loadNewestSession(): Promise<SessionRecord | null> {
  if (!hasIndexedDb()) {
    const a = memoryFallbackSlots.get('a');
    const b = memoryFallbackSlots.get('b');
    const candidates: SessionRecord[] = [];
    if (a) candidates.push({ ...a, slot: 'a' });
    if (b) candidates.push({ ...b, slot: 'b' });
    return candidates.sort((x, y) => y.savedAt - x.savedAt)[0] ?? null;
  }

  const db = await openDb();
  try {
    const get = (k: 'a' | 'b') =>
      new Promise<SessionRecord | undefined>((res, rej) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
        r.onsuccess = () => {
          const val = r.result as SessionRecord | undefined;
          res(val ? { ...val, slot: k } : undefined);
        };
        r.onerror = () => rej(r.error);
      });
    const [a, b] = await Promise.all([get('a'), get('b')]);
    return (
      [a, b]
        .filter((x): x is SessionRecord => !!x && typeof x.savedAt === 'number')
        .sort((x, y) => y.savedAt - x.savedAt)[0] ?? null
    );
  } finally {
    db.close();
  }
}

/**
 * Returns the slot ('a' or 'b') that should be written next so that the newest
 * existing session is never overwritten first after a page reload.
 */
export function nextOppositeSlot(latestSlot?: 'a' | 'b' | null): 'a' | 'b' {
  return latestSlot === 'a' ? 'b' : 'a';
}

export async function clearSessions(): Promise<void> {
  memoryFallbackSlots.clear();
  if (!hasIndexedDb()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
