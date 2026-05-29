import type { StoragePort, StoredRecord } from "@otocho/storage";

/** In-memory {@link StoragePort} for tests — no IndexedDB required. */
export class MemoryStorage implements StoragePort {
  private records = new Map<string, StoredRecord>();

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    return [...this.records.entries()]
      .filter(([k]) => k.startsWith(`${collection}/`))
      .map(([, r]) => ({ ...r }) as T);
  }
  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | null> {
    const r = this.records.get(this.key(collection, id));
    return r ? (({ ...r }) as T) : null;
  }
  async put<T extends StoredRecord>(collection: string, record: T): Promise<void> {
    this.records.set(this.key(collection, record.id), { ...record });
  }
  async remove(collection: string, id: string): Promise<void> {
    this.records.delete(this.key(collection, id));
  }
}
