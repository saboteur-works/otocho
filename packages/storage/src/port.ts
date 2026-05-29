/**
 * StoragePort — the persistence seam. One implementation per platform
 * (web: OPFS/IndexedDB, desktop: node fs, mobile: Capacitor Filesystem).
 *
 * Records are stored one-per-document within a collection, mirroring the
 * file-per-page model so sync conflicts (a later feature) stay record-scoped.
 */
export interface StoredRecord {
  id: string;
}

export interface StoragePort {
  list<T extends StoredRecord>(collection: string): Promise<T[]>;
  get<T extends StoredRecord>(collection: string, id: string): Promise<T | null>;
  put<T extends StoredRecord>(collection: string, record: T): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}
