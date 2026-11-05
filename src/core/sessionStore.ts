const DB_NAME = 'aetherterra_sessions';
const STORE = 'slots';

export interface SessionRecord {
  savedAt: number;
  title: string;
  bytes: ArrayBuffer;
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
  };
  memoryFallbackSlots.set(slot, safeCopy);

  if (!hasIndexedDb()) {
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
  } finally {
    db.close();
  }
}

export async function loadNewestSession(): Promise<SessionRecord | null> {
  if (!hasIndexedDb()) {
    const fallbackList = [memoryFallbackSlots.get('a'), memoryFallbackSlots.get('b')].filter(
      (x): x is SessionRecord => !!x
    );
    return fallbackList.sort((x, y) => y.savedAt - x.savedAt)[0] ?? null;
  }

  const db = await openDb();
  try {
    const get = (k: 'a' | 'b') =>
      new Promise<SessionRecord | undefined>((res, rej) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
        r.onsuccess = () => res(r.result as SessionRecord | undefined);
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
