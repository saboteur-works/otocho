import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import type { Page } from "./page";
import { PageConflictRepository, type PageConflict } from "./page-conflict-repository";

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

function notesPage(id: string, title: string): Page {
  return {
    id,
    projectId: "proj-1",
    type: "notes",
    title,
    order: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null,
    body: "",
  };
}

function makeConflict(id: string): PageConflict {
  return {
    id,
    local: notesPage(id, "local title"),
    remote: notesPage(id, "remote title"),
    detectedAt: "2024-06-01T00:00:00.000Z",
  };
}

function makeRepo(storage: StoragePort = new MemoryStorage()) {
  return new PageConflictRepository({ storage });
}

describe("PageConflictRepository", () => {
  let repo: PageConflictRepository;

  beforeEach(() => {
    repo = makeRepo();
  });

  it("returns null for get() on a fresh store", async () => {
    expect(await repo.get("p1")).toBeNull();
  });

  it("returns an empty list on a fresh store", async () => {
    expect(await repo.list()).toEqual([]);
  });

  it("save() persists and returns the exact shape", async () => {
    const conflict = makeConflict("p1");
    const saved = await repo.save(conflict);
    expect(saved).toEqual(conflict);
  });

  it("round-trips a saved conflict through a second get() call", async () => {
    const conflict = makeConflict("p1");
    await repo.save(conflict);
    expect(await repo.get("p1")).toEqual(conflict);
  });

  it("list() returns every pending conflict, one per page id", async () => {
    const c1 = makeConflict("p1");
    const c2 = makeConflict("p2");
    await repo.save(c1);
    await repo.save(c2);

    const all = await repo.list();
    expect(all.map((c) => c.id).sort()).toEqual(["p1", "p2"]);
  });

  it("remove() clears a conflict so a subsequent get() returns null", async () => {
    const conflict = makeConflict("p1");
    await repo.save(conflict);
    await repo.remove("p1");
    expect(await repo.get("p1")).toBeNull();
  });

  it("save() overwrites a prior pending conflict for the same page id", async () => {
    await repo.save(makeConflict("p1"));
    const updated: PageConflict = {
      ...makeConflict("p1"),
      detectedAt: "2024-07-01T00:00:00.000Z",
    };
    await repo.save(updated);

    expect(await repo.get("p1")).toEqual(updated);
  });

  it("reads a saved conflict back from a fresh repository over the same store", async () => {
    const storage = new MemoryStorage();
    const conflict = makeConflict("p1");
    await new PageConflictRepository({ storage }).save(conflict);

    const reloaded = await new PageConflictRepository({ storage }).get("p1");
    expect(reloaded).toEqual(conflict);
  });
});
