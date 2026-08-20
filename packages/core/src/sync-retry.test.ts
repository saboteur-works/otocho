import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine } from "./sync-engine";

/** Minimal local {@link StoragePort} stand-in — mirrors the one in
 * `sync-engine.test.ts`, kept local to this file so retry tests can also
 * swap in a rejecting `remote` without touching Task 7's fixtures. */
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

describe("SyncEngine — retry policy (FR-14, D-5)", () => {
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

  it("schedules a retry with exponentially increasing delay across consecutive failures", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    const putSpy = vi.spyOn(remote, "put").mockRejectedValue(new Error("network down"));
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000); // default debounceMs — first push attempt fires
    expect(putSpy).toHaveBeenCalledTimes(1);

    // First automatic retry fires after the base delay (1000ms).
    await vi.advanceTimersByTimeAsync(999);
    expect(putSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(putSpy).toHaveBeenCalledTimes(2);

    // Second automatic retry fires after double the delay (2000ms), not 1000ms again.
    await vi.advanceTimersByTimeAsync(1999);
    expect(putSpy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(putSpy).toHaveBeenCalledTimes(3);

    // Third automatic retry fires after quadruple the base delay (4000ms).
    await vi.advanceTimersByTimeAsync(3999);
    expect(putSpy).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(putSpy).toHaveBeenCalledTimes(4);
  });

  it("caps the backoff delay at a maximum instead of growing unboundedly", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 5000 });
    const putSpy = vi.spyOn(remote, "put").mockRejectedValue(new Error("network down"));
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);
    expect(putSpy).toHaveBeenCalledTimes(1);

    // Delays: 1000, 2000, 4000, then capped at 5000 from here on.
    await vi.advanceTimersByTimeAsync(1000); // retry #1 (1000ms)
    expect(putSpy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000); // retry #2 (2000ms)
    expect(putSpy).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000); // retry #3 (4000ms)
    expect(putSpy).toHaveBeenCalledTimes(4);

    // Next delay would be 8000ms uncapped, but the max is 5000ms.
    await vi.advanceTimersByTimeAsync(4999);
    expect(putSpy).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(putSpy).toHaveBeenCalledTimes(5);

    // Delay stays capped at 5000ms for a further failure, not growing further.
    await vi.advanceTimersByTimeAsync(4999);
    expect(putSpy).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(putSpy).toHaveBeenCalledTimes(6);
  });

  it("retryNow bypasses the backoff delay and succeeds once the failure clears", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    let attempts = 0;
    const originalPut = remote.put.bind(remote);
    vi.spyOn(remote, "put").mockImplementation(async (collection: string, r: { id: string }) => {
      attempts += 1;
      if (attempts <= 2) throw new Error("network down");
      await originalPut(collection, r);
    });
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);
    expect(attempts).toBe(1);

    // Manual retry now, well before the scheduled backoff timer would fire.
    await engine.retryNow();
    expect(attempts).toBe(2);

    const remoteAfterSecondFailure = await remote.list(COLLECTION);
    expect(remoteAfterSecondFailure).toEqual([]);

    // Third attempt (via retryNow again) succeeds — the mock stops rejecting.
    await engine.retryNow();
    expect(attempts).toBe(3);

    const remoteRecords = await remote.list(COLLECTION);
    expect(remoteRecords).toEqual([record("p1", "2024-01-01T00:00:00.000Z")]);
  });

  it("never drops the local record across repeated failed sync attempts", async () => {
    engine = new SyncEngine({ local, remote, retryBaseMs: 1000, retryMaxMs: 60000 });
    vi.spyOn(remote, "put").mockRejectedValue(new Error("network down"));
    engine.start();
    await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

    engine.notifyLocalChange(COLLECTION);
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    // The local record that failed to sync is still present and unmodified,
    // eligible for the next retry attempt.
    const localRecords = await local.list(COLLECTION);
    expect(localRecords).toEqual([record("p1", "2024-01-01T00:00:00.000Z")]);
  });
});
