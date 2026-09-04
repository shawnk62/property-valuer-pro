const DB_NAME = "ppv-photo-blobs-v1";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

export function photoBlobKey(inspectionId: string, photoId: string): string {
  return `${inspectionId}::${photoId}`;
}

export async function putPhotoBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.objectStore(STORE).put(blob, key);
    });
  } finally {
    db.close();
  }
}

export async function getPhotoBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
    });
  } finally {
    db.close();
  }
}

export async function deletePhotoBlob(key: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
        tx.objectStore(STORE).delete(key);
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

export async function objectUrlFromPhotoBlob(key: string): Promise<string | null> {
  const blob = await getPhotoBlob(key).catch(() => null);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
