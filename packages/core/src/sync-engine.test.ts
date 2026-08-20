import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine } from "./sync-engine";
import { PageConflictRepository } from "./page-conflict-repository";

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

  describe("pullCollection — preserve both versions on conflict (FR-10, Task 12)", () => {
    it("records a pending conflict with both versions, recoverable independently of local storage", async () => {
      const conflictRepo = new PageConflictRepository({ storage: local });
      const conflictEngine = new SyncEngine({ local, remote, pageConflictRepository: conflictRepo });

      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await conflictEngine.pullCollection(COLLECTION);

      const localBeforeConflict = record("p1", "2024-02-01T00:00:00.000Z");
      await local.put(COLLECTION, localBeforeConflict);
      const remoteAtConflict = record("p1", "2024-03-01T00:00:00.000Z");
      await remote.put(COLLECTION, remoteAtConflict);

      await conflictEngine.pullCollection(COLLECTION);

      // Local was left untouched by the conflict...
      const localRecord = await local.get(COLLECTION, "p1");
      expect(localRecord).toEqual(localBeforeConflict);

      // ...and the conflict record recovers both the local and remote
      // versions, so neither edit was silently dropped.
      const conflict = await conflictRepo.get("p1");
      expect(conflict).not.toBeNull();
      expect(conflict?.local).toEqual(localBeforeConflict);
      expect(conflict?.remote).toEqual(remoteAtConflict);
      expect(typeof conflict?.detectedAt).toBe("string");
    });

    it("defaults to a PageConflictRepository over local when none is provided", async () => {
      await remote.put(COLLECTION, record("p1", "2024-01-01T00:00:00.000Z"));
      await engine.pullCollection(COLLECTION);

      await local.put(COLLECTION, record("p1", "2024-02-01T00:00:00.000Z"));
      await remote.put(COLLECTION, record("p1", "2024-03-01T00:00:00.000Z"));

      await engine.pullCollection(COLLECTION);

      const conflicts = await new PageConflictRepository({ storage: local }).list();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe("p1");
    });
  });

  describe("pullCollection — Build log moves[] append-union merge (FR-8, Task 14)", () => {
    function buildLogPage(
      id: string,
      updatedAt: string,
      moves: { id: string; at: string; text: string }[],
      sketch = "",
    ) {
      return {
        id,
        projectId: "proj-1",
        type: "build-log" as const,
        title: "Build log",
        order: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt,
        deletedAt: null,
        sketch,
        moves,
      };
    }

    it("merges disjoint move sets from both clients into the union", async () => {
      const localMove = { id: "m-local", at: "2024-02-01T00:00:00.000Z", text: "local move" };
      const remoteMove = { id: "m-remote", at: "2024-03-01T00:00:00.000Z", text: "remote move" };

      // Establish a synced checkpoint via an initial pull, then diverge.
      await remote.put(COLLECTION, buildLogPage("bl1", "2024-01-01T00:00:00.000Z", []));
      await engine.pullCollection(COLLECTION);

      await local.put(
        COLLECTION,
        buildLogPage("bl1", "2024-02-01T00:00:00.000Z", [localMove]),
      );
      await remote.put(
        COLLECTION,
        buildLogPage("bl1", "2024-03-01T00:00:00.000Z", [remoteMove]),
      );

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get<ReturnType<typeof buildLogPage>>(COLLECTION, "bl1");
      expect(localRecord?.moves.map((m) => m.id).sort()).toEqual(["m-local", "m-remote"]);
    });

    it("dedupes a move id present on both sides into exactly one entry", async () => {
      const sharedMove = { id: "m-shared", at: "2024-01-15T00:00:00.000Z", text: "shared move" };
      const localOnly = { id: "m-local", at: "2024-02-01T00:00:00.000Z", text: "local move" };
      const remoteOnly = { id: "m-remote", at: "2024-03-01T00:00:00.000Z", text: "remote move" };

      await remote.put(COLLECTION, buildLogPage("bl1", "2024-01-01T00:00:00.000Z", [sharedMove]));
      await engine.pullCollection(COLLECTION);

      await local.put(
        COLLECTION,
        buildLogPage("bl1", "2024-02-01T00:00:00.000Z", [sharedMove, localOnly]),
      );
      await remote.put(
        COLLECTION,
        buildLogPage("bl1", "2024-03-01T00:00:00.000Z", [sharedMove, remoteOnly]),
      );

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get<ReturnType<typeof buildLogPage>>(COLLECTION, "bl1");
      const ids = localRecord?.moves.map((m) => m.id) ?? [];
      expect(ids.filter((id) => id === "m-shared")).toHaveLength(1);
      expect(ids.sort()).toEqual(["m-local", "m-remote", "m-shared"]);
    });

    it("still reports an ordinary conflict for a same-page sketch difference when moves[] don't diverge", async () => {
      const move = { id: "m1", at: "2024-01-15T00:00:00.000Z", text: "a move" };

      await remote.put(
        COLLECTION,
        buildLogPage("bl1", "2024-01-01T00:00:00.000Z", [move], "original sketch"),
      );
      await engine.pullCollection(COLLECTION);

      // Both sides edit only `sketch` after the checkpoint; moves[] is
      // identical on both sides — not a moves-union case.
      await local.put(
        COLLECTION,
        buildLogPage("bl1", "2024-02-01T00:00:00.000Z", [move], "local sketch"),
      );
      await remote.put(
        COLLECTION,
        buildLogPage("bl1", "2024-03-01T00:00:00.000Z", [move], "remote sketch"),
      );

      await engine.pullCollection(COLLECTION);

      const localRecord = await local.get<ReturnType<typeof buildLogPage>>(COLLECTION, "bl1");
      // Local's sketch is left untouched — not overwritten by remote, and
      // not silently merged — matching Task 11's conflict-skip behavior.
      expect(localRecord?.sketch).toBe("local sketch");
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
