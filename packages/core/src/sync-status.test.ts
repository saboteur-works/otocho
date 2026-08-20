import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine } from "./sync-engine";

/** Minimal local {@link StoragePort} stand-in — mirrors the one in
 * `sync-engine.test.ts`/`sync-retry.test.ts`, kept local to this file so
 * status tests don't touch Task 7/8's fixtures. */
class MemoryStorage {
  private records = new Map<string, { id: string; [k: string]: unknown }>();

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  async list<T extends { id: string }>(collection: string): Promise<T[]> {
    return [...this.records.entries()]
      .filter(([k]) => k.startsWith(`${collection}/`))
      .map(([, r]) => ({ ...r }) as T);
  }
  async get<T extends { id: string }>(collection: string, id: string): Promise<T | null> {
    const r = this.records.get(this.key(collection, id));
    return r ? (({ ...r }) as T) : null;
  }
  async put<T extends { id: string }>(collection: string, record: T): Promise<void> {
    this.records.set(this.key(collection, record.id), { ...record });
  }
  async remove(collection: string, id: string): Promise<void> {
    this.records.delete(this.key(collection, id));
  }
}

const COLLECTION = "pages";

function record(id: string, updatedAt: string) {
  return { id, updatedAt, title: `record ${id}` };
}

describe("SyncEngine.getStatus (Task 9, FR-12/FR-13, D-6)", () => {
  let local: MemoryStorage;
  let remote: MemoryStorage;
  let engine: SyncEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    local = new MemoryStorage();
    remote = new MemoryStorage();
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  it("reports synced with no cause when nothing has failed", () => {
    engine = new SyncEngine({ local, remote });
    expect(engine.getStatus()).toEqual({ synced: true });
  });

  it("reports unsynced with an out-of-space cause for a Dropbox insufficient_space failure", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    vi.spyOn(remote, "put").mockRejectedValue(
      new Error(
        'Dropbox request to https://content.dropboxapi.com/2/files/upload failed (409): {"error_summary": "path/insufficient_space/..."}',
      ),
    );
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);

    expect(engine.getStatus()).toEqual({ synced: false, cause: "out-of-space" });
  });

  it("reports unsynced with an auth-failure cause for an HTTP 401 failure", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    vi.spyOn(remote, "put").mockRejectedValue(
      new Error("Dropbox request to https://content.dropboxapi.com/2/files/upload failed (401): invalid_access_token"),
    );
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);

    expect(engine.getStatus()).toEqual({ synced: false, cause: "auth-failure" });
  });

  it("reports unsynced with no cause for an unclassifiable failure (e.g. plain network error)", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    vi.spyOn(remote, "put").mockRejectedValue(new Error("network down"));
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);

    expect(engine.getStatus()).toEqual({ synced: false, cause: undefined });
  });

  it("returns to synced with no cause once the failure clears", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    let attempts = 0;
    const originalPut = remote.put.bind(remote);
    vi.spyOn(remote, "put").mockImplementation(async (collection: string, r: { id: string }) => {
      attempts += 1;
      if (attempts === 1) throw new Error("(401) invalid_access_token");
      await originalPut(collection, r);
    });
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);
    expect(engine.getStatus()).toEqual({ synced: false, cause: "auth-failure" });

    await engine.retryNow();
    expect(engine.getStatus()).toEqual({ synced: true });
  });
});
