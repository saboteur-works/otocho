import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import { ProjectRepository } from "./project-repository";

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

/** Monotonic ISO clock and stable id generator for deterministic assertions. */
function fixtures() {
  let tick = 0;
  const base = Date.UTC(2026, 0, 1);
  const now = () => new Date(base + tick++ * 1000).toISOString();
  let n = 0;
  const generateId = () => `p${++n}`;
  return { now, generateId };
}

function makeRepo(storage: StoragePort = new MemoryStorage()) {
  return new ProjectRepository({ storage, ...fixtures() });
}

describe("ProjectRepository", () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = makeRepo();
  });

  it("creates a persisted project and reads it back", async () => {
    const created = await repo.create({ name: "First track" });
    expect(created.id).toBe("p1");
    expect(created.name).toBe("First track");
    expect(created.deletedAt).toBeNull();
    expect(created.createdAt).toBe(created.updatedAt);
    expect(created.createdAt).toBe(created.lastOpenedAt);

    const fetched = await repo.get(created.id);
    expect(fetched).toEqual(created);
  });

  it("trims the name and rejects an empty one", async () => {
    const created = await repo.create({ name: "  spaced  " });
    expect(created.name).toBe("spaced");
    await expect(repo.create({ name: "   " })).rejects.toThrow(/name is required/i);
  });

  it("gives duplicate-named projects distinct ids", async () => {
    const a = await repo.create({ name: "Same" });
    const b = await repo.create({ name: "Same" });
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe(b.name);
  });

  it("returns null for a missing project", async () => {
    expect(await repo.get("nope")).toBeNull();
  });

  it("lists only active projects, most-recently-opened first", async () => {
    const a = await repo.create({ name: "A" });
    const b = await repo.create({ name: "B" });
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id, a.id]);

    await repo.open(a.id);
    expect((await repo.list()).map((p) => p.id)).toEqual([a.id, b.id]);

    await repo.softDelete(b.id);
    expect((await repo.list()).map((p) => p.id)).toEqual([a.id]);
  });

  it("open() advances lastOpenedAt without touching updatedAt", async () => {
    const created = await repo.create({ name: "Track" });
    const opened = await repo.open(created.id);
    expect(opened.lastOpenedAt > created.lastOpenedAt).toBe(true);
    expect(opened.updatedAt).toBe(created.updatedAt);
  });

  it("renames in place: name + updatedAt change, id + createdAt do not", async () => {
    const created = await repo.create({ name: "Old" });
    const renamed = await repo.rename(created.id, "New");
    expect(renamed.id).toBe(created.id);
    expect(renamed.createdAt).toBe(created.createdAt);
    expect(renamed.name).toBe("New");
    expect(renamed.updatedAt > created.updatedAt).toBe(true);

    await expect(repo.rename("missing", "X")).rejects.toThrow(/not found/i);
    await expect(repo.rename(created.id, "  ")).rejects.toThrow(/name is required/i);
  });

  it("soft-deletes, then restores", async () => {
    const created = await repo.create({ name: "Track" });
    const deleted = await repo.softDelete(created.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(await repo.get(created.id)).not.toBeNull();
    expect((await repo.listDeleted()).map((p) => p.id)).toEqual([created.id]);
    expect(await repo.list()).toHaveLength(0);

    const restored = await repo.restore(created.id);
    expect(restored.deletedAt).toBeNull();
    expect((await repo.list()).map((p) => p.id)).toEqual([created.id]);

    await expect(repo.softDelete("missing")).rejects.toThrow(/not found/i);
  });

  it("purges permanently", async () => {
    const created = await repo.create({ name: "Track" });
    await repo.softDelete(created.id);
    await repo.purge(created.id);
    expect(await repo.get(created.id)).toBeNull();
    expect(await repo.listDeleted()).toHaveLength(0);
  });
});

describe("ProjectRepository reload across restart", () => {
  it("reads a created project back from a fresh repository over the same store", async () => {
    const storage = new MemoryStorage();
    const created = await new ProjectRepository({ storage, ...fixtures() }).create({
      name: "Survives restart",
    });

    // Simulate an app restart: a brand-new repository instance, same backing store.
    const reloaded = await new ProjectRepository({ storage }).get(created.id);
    expect(reloaded).toEqual(created);
  });
});
