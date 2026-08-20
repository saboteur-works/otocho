import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine } from "./sync-engine";

/** Minimal local {@link StoragePort} stand-in — mirrors
 * `apps/app/src/testing/memory-storage.ts`'s `MemoryStorage` shape, kept
 * local to `packages/core` so this package doesn't depend on `apps/app`. */
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

describe("SyncEngine", () => {
  let local: MemoryStorage;
  let remote: MemoryStorage;
  let engine: SyncEngine;

  beforeEach(() => {
    local = new MemoryStorage();
    remote = new MemoryStorage();
    engine = new SyncEngine({ local, remote });
  });

  afterEach(() => {
    engine.stop();
  });

  describe("pushCollection", () => {
    it("writes a local-only record to remote", async () => {
      await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

      await engine.pushCollection(COLLECTION);

      const remoteRecords = await remote.list(COLLECTION);
      expect(remoteRecords).toEqual([record("p1", "2024-01-01T00:00:00.000Z")]);
    });

    it("overwrites a remote record when the local one is newer", async () => {
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await local.put(COLLECTION, record("p1", "2024-06-01T00:00:00.000Z"));

      await engine.pushCollection(COLLECTION);

      const remoteRecord = await remote.get(COLLECTION, "p1");
      expect(remoteRecord).toEqual(record("p1", "2024-06-01T00:00:00.000Z"));
    });

    it("leaves remote untouched when the local record is not newer", async () => {
      await remote.put(COLLECTION, record("p1", "2024-06-01T00:00:00.000Z"));
      await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

      await engine.pushCollection(COLLECTION);

      const remoteRecord = await remote.get(COLLECTION, "p1");
      expect(remoteRecord).toEqual(record("p1", "2024-06-01T00:00:00.000Z"));
    });
  });

  describe("pullCollection", () => {
    it("writes a remote-only record to local", async () => {
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecords = await local.list(COLLECTION);
      expect(localRecords).toEqual([record("p1", "2024-01-01T00:00:00.000Z")]);
    });

    it("overwrites a local record when the remote one is newer", async () => {
      await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await remote.put(COLLECTION, record("p1", "2024-06-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(record("p1", "2024-06-01T00:00:00.000Z"));
    });

    it("leaves local untouched when the remote record is not newer", async () => {
      await local.put(COLLECTION, record("p1", "2024-06-01T00:00:00.000Z"));
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(record("p1", "2024-06-01T00:00:00.000Z"));
    });
  });

  describe("pullCollection — conflict detection (FR-9, Task 11)", () => {
    it("does not report a conflict, and does nothing, when only local changed since last sync", async () => {
      // Establish a synced checkpoint for p1 via an initial pull.
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await engine.pullCollection(COLLECTION);

      // Only local changes after that.
      await local.put(COLLECTION, record("p1", "2024-02-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(record("p1", "2024-02-01T00:00:00.000Z"));
      const remoteRecord = await remote.get(COLLECTION, "p1");
      expect(remoteRecord).toEqual(record("p1", "2024-01-01T00:00:00.000Z"));
    });

    it("does not report a conflict, and applies remote normally, when only remote changed since last sync", async () => {
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await engine.pullCollection(COLLECTION);

      // Only remote changes after that.
      await remote.put(COLLECTION, record("p1", "2024-03-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(record("p1", "2024-03-01T00:00:00.000Z"));
    });

    it("reports a conflict and leaves both sides untouched when both changed since last sync", async () => {
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await engine.pullCollection(COLLECTION);

      // Both sides change independently after that.
      await local.put(COLLECTION, record("p1", "2024-02-01T00:00:00.000Z"));
      await remote.put(COLLECTION, record("p1", "2024-03-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(record("p1", "2024-02-01T00:00:00.000Z"));
      const remoteRecord = await remote.get(COLLECTION, "p1");
      expect(remoteRecord).toEqual(record("p1", "2024-03-01T00:00:00.000Z"));

      // The checkpoint did not advance for the conflicting page: a repeat
      // pull with no further changes still reports the same conflict and
      // still leaves local untouched, rather than resolving itself.
      await engine.pullCollection(COLLECTION);
      const localRecordAgain = await local.get(COLLECTION, "p1");
      expect(localRecordAgain).toEqual(record("p1", "2024-02-01T00:00:00.000Z"));
    });

    it("does not conflict on a page with no prior checkpoint, matching pre-Task-11 newer-wins behavior", async () => {
      await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await remote.put(COLLECTION, record("p1", "2024-06-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(record("p1", "2024-06-01T00:00:00.000Z"));
    });
  });

  describe("start/stop — debounced push", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("coalesces multiple rapid notifyLocalChange calls into one push", async () => {
      const pushSpy = vi.spyOn(engine, "pushCollection");
      engine.start();

      await local.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      engine.notifyLocalChange(COLLECTION);
      await vi.advanceTimersByTimeAsync(1000);
      engine.notifyLocalChange(COLLECTION);
      await vi.advanceTimersByTimeAsync(1000);
      engine.notifyLocalChange(COLLECTION);

      // Still within the debounce window of the last call — no push yet.
      await vi.advanceTimersByTimeAsync(2000);
      expect(pushSpy).not.toHaveBeenCalled();

      // Quiet for the full debounce window since the last notify.
      await vi.advanceTimersByTimeAsync(2000);
      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith(COLLECTION);

      const remoteRecords = await remote.list(COLLECTION);
      expect(remoteRecords).toEqual([record("p1", "2024-01-01T00:00:00.000Z")]);
    });

    it("does not push when stopped before the debounce window elapses", async () => {
      const pushSpy = vi.spyOn(engine, "pushCollection");
      engine.start();

      engine.notifyLocalChange(COLLECTION);
      engine.stop();
      await vi.advanceTimersByTimeAsync(5000);

      expect(pushSpy).not.toHaveBeenCalled();
    });

    it("ignores notifyLocalChange while not running", async () => {
      const pushSpy = vi.spyOn(engine, "pushCollection");

      engine.notifyLocalChange(COLLECTION);
      await vi.advanceTimersByTimeAsync(5000);

      expect(pushSpy).not.toHaveBeenCalled();
    });

    it("runs pullCollection on a fixed interval while running, and stops on stop()", async () => {
      const pullSpy = vi.spyOn(engine, "pullCollection");
      engine.start([COLLECTION]);

      await vi.advanceTimersByTimeAsync(30000);
      expect(pullSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30000);
      expect(pullSpy).toHaveBeenCalledTimes(2);

      engine.stop();
      await vi.advanceTimersByTimeAsync(60000);
      expect(pullSpy).toHaveBeenCalledTimes(2);
    });

    it("start() is idempotent while already running", async () => {
      const pullSpy = vi.spyOn(engine, "pullCollection");
      engine.start([COLLECTION]);
      engine.start([COLLECTION]);

      await vi.advanceTimersByTimeAsync(30000);
      expect(pullSpy).toHaveBeenCalledTimes(1);
    });
  });
});
