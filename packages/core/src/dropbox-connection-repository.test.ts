import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import { createDropboxConnection } from "./dropbox-connection";
import { DropboxConnectionRepository } from "./dropbox-connection-repository";

/** In-memory StoragePort fake for fast, deterministic repository tests. */
class MemoryStorage implements StoragePort {
  private data = new Map<string, Map<string, StoredRecord>>();

  private bucket(collection: string): Map<string, StoredRecord> {
    let b = this.data.get(collection);
    if (!b) {
      b = new Map();
      this.data.set(collection, b);
    }
    return b;
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    return [...this.bucket(collection).values()].map((r) => ({ ...r }) as T);
  }
  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | null> {
    const r = this.bucket(collection).get(id);
    return r ? ({ ...r }) as T : null;
  }
  async put<T extends StoredRecord>(collection: string, record: T): Promise<void> {
    this.bucket(collection).set(record.id, { ...record });
  }
  async remove(collection: string, id: string): Promise<void> {
    this.bucket(collection).delete(id);
  }
}

const tokens = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.UTC(2026, 0, 1),
};

function makeRepo(storage: StoragePort = new MemoryStorage()) {
  return new DropboxConnectionRepository({ storage });
}

describe("DropboxConnectionRepository", () => {
  let repo: DropboxConnectionRepository;

  beforeEach(() => {
    repo = makeRepo();
  });

  it("returns null for get() on a fresh store", async () => {
    expect(await repo.get()).toBeNull();
  });

  it("save() persists and returns the exact shape", async () => {
    const connection = createDropboxConnection("account-1", tokens, {
      now: () => "2026-01-01T00:00:00.000Z",
    });
    const saved = await repo.save(connection);
    expect(saved).toEqual(connection);
  });

  it("round-trips the saved record through a second get() call", async () => {
    const connection = createDropboxConnection("account-1", tokens);
    await repo.save(connection);
    const fetched = await repo.get();
    expect(fetched).toEqual(connection);
  });

  it("clear() removes the record so a subsequent get() returns null", async () => {
    const connection = createDropboxConnection("account-1", tokens);
    await repo.save(connection);
    await repo.clear();
    expect(await repo.get()).toBeNull();
  });

  it("reads a saved connection back from a fresh repository over the same store", async () => {
    const storage = new MemoryStorage();
    const connection = createDropboxConnection("account-1", tokens);
    await new DropboxConnectionRepository({ storage }).save(connection);

    const reloaded = await new DropboxConnectionRepository({ storage }).get();
    expect(reloaded).toEqual(connection);
  });
});
