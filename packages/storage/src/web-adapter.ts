import type { StoragePort, StoredRecord } from "./port";

const STORE = "records";
const COLLECTION_INDEX = "byCollection";

interface Entry {
  key: string;
  collection: string;
  record: StoredRecord;
}

/**
 * Web adapter — IndexedDB-backed durable storage.
 *
 * Records persist across reloads and app restarts. Every record lives in a
 * single object store keyed by `${collection}/${id}`, with an index on
 * `collection` so a collection can be listed without scanning everything.
 * This honours the file-per-record model behind the {@link StoragePort} seam;
 * sync (a later feature) layers on top of it.
 */
export class WebStorageAdapter implements StoragePort {
  private dbPromise?: Promise<IDBDatabase>;

  constructor(private readonly dbName = "otocho") {}

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "key" });
            store.createIndex(COLLECTION_INDEX, "collection", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  private async run<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private entryKey(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    const entries = await this.run<Entry[]>("readonly", (store) =>
      store.index(COLLECTION_INDEX).getAll(collection),
    );
    return entries.map((e) => e.record as T);
  }

  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | null> {
    const entry = await this.run<Entry | undefined>("readonly", (store) =>
      store.get(this.entryKey(collection, id)),
    );
    return entry ? (entry.record as T) : null;
  }

  async put<T extends StoredRecord>(collection: string, record: T): Promise<void> {
    const entry: Entry = {
      key: this.entryKey(collection, record.id),
      collection,
      record,
    };
    await this.run("readwrite", (store) => store.put(entry));
  }

  async remove(collection: string, id: string): Promise<void> {
    await this.run("readwrite", (store) => store.delete(this.entryKey(collection, id)));
  }
}
