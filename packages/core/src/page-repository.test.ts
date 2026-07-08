import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import { PageRepository } from "./page-repository";
import {
  addDevice,
  createPresetDevice,
  type NotesPage,
  type Page,
  type PresetPage,
} from "./page";

class MemoryStorage implements StoragePort {
  private data = new Map<string, Map<string, StoredRecord>>();

  private bucket(collection: string): Map<string, StoredRecord> {
    let b = this.data.get(collection);
    if (!b) { b = new Map(); this.data.set(collection, b); }
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

function fixtures() {
  let tick = 0;
  const base = Date.UTC(2026, 0, 1);
  const now = () => new Date(base + tick++ * 1000).toISOString();
  let n = 0;
  const generateId = () => `pg${++n}`;
  return { now, generateId };
}

function makeRepo(storage: StoragePort = new MemoryStorage()) {
  return new PageRepository({ storage, ...fixtures() });
}

describe("PageRepository", () => {
  let repo: PageRepository;

  beforeEach(() => { repo = makeRepo(); });

  it("creates a page and reads it back", async () => {
    const page = await repo.create("proj1", "notes", "Mix ideas");
    expect(page.id).toBe("pg1");
    expect(page.projectId).toBe("proj1");
    expect(page.type).toBe("notes");
    expect(page.title).toBe("Mix ideas");
    expect(page.order).toBe(0);

    const fetched = await repo.get(page.id);
    expect(fetched).toEqual(page);
  });

  it("falls back to a default title when none is given", async () => {
    const page = await repo.create("proj1", "build-log");
    expect(page.title).toBe("Build log");
  });

  it("assigns ascending order values to successive pages", async () => {
    const a = await repo.create("proj1", "notes");
    const b = await repo.create("proj1", "build-log");
    const c = await repo.create("proj1", "presets");
    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
    expect(c.order).toBe(2);
  });

  it("pages from different projects are isolated", async () => {
    await repo.create("proj1", "notes");
    await repo.create("proj2", "notes");
    const proj1Pages = await repo.list("proj1");
    expect(proj1Pages).toHaveLength(1);
    expect(proj1Pages[0].projectId).toBe("proj1");
  });

  it("lists pages in order, not insertion order", async () => {
    const a = await repo.create("proj1", "notes");
    const b = await repo.create("proj1", "build-log");
    const c = await repo.create("proj1", "presets");
    const ids = (await repo.list("proj1")).map((p) => p.id);
    expect(ids).toEqual([a.id, b.id, c.id]);
  });

  it("returns null for a missing page", async () => {
    expect(await repo.get("nope")).toBeNull();
  });

  it("renames: title + updatedAt change, id + type do not", async () => {
    const page = await repo.create("proj1", "notes", "Old name");
    const renamed = await repo.rename(page.id, "  New name  ");
    expect(renamed.id).toBe(page.id);
    expect(renamed.type).toBe(page.type);
    expect(renamed.title).toBe("New name");
    expect(renamed.updatedAt > page.updatedAt).toBe(true);
  });

  it("rename rejects empty title", async () => {
    const page = await repo.create("proj1", "notes");
    await expect(repo.rename(page.id, "   ")).rejects.toThrow(/title is required/i);
  });

  it("rename throws for a missing page", async () => {
    await expect(repo.rename("nope", "X")).rejects.toThrow(/not found/i);
  });

  it("update persists content changes and advances updatedAt", async () => {
    const repo = makeRepo();
    const page = await repo.create("proj1", "notes", "My notes");
    const withBody = { ...page, body: "some text" } as import("./page").NotesPage;
    const updated = await repo.update(withBody);
    expect(updated.updatedAt > page.updatedAt).toBe(true);
    const fetched = await repo.get(page.id);
    expect((fetched as import("./page").NotesPage).body).toBe("some text");
  });

  it("update throws for a missing page", async () => {
    const repo = makeRepo();
    const page = await repo.create("proj1", "notes");
    await repo.delete(page.id);
    await expect(repo.update(page)).rejects.toThrow(/not found/i);
  });

  it("deletes a page permanently", async () => {
    const page = await repo.create("proj1", "notes");
    await repo.delete(page.id);
    expect(await repo.get(page.id)).toBeNull();
    expect(await repo.list("proj1")).toHaveLength(0);
  });

  it("delete throws for a missing page", async () => {
    await expect(repo.delete("nope")).rejects.toThrow(/not found/i);
  });
});

describe("PageRepository.reorder", () => {
  async function threePages(repo: PageRepository): Promise<Page[]> {
    const a = await repo.create("proj1", "notes", "A");
    const b = await repo.create("proj1", "build-log", "B");
    const c = await repo.create("proj1", "presets", "C");
    return [a, b, c];
  }

  it("moves a page to a new index and updates order values", async () => {
    const repo = makeRepo();
    const [a, , c] = await threePages(repo);
    // Move A (index 0) to index 2 → [B, C, A]
    await repo.reorder(a.id, 2);
    const listed = await repo.list("proj1");
    expect(listed.map((p) => p.title)).toEqual(["B", "C", "A"]);
    expect(listed.map((p) => p.order)).toEqual([0, 1, 2]);
    // C should also have a fresh updatedAt (its order changed from 2→1)
    const cFetched = await repo.get(c.id);
    expect(cFetched!.order).toBe(1);
  });

  it("moves a page earlier", async () => {
    const repo = makeRepo();
    const [, , c] = await threePages(repo);
    // Move C (index 2) to index 0 → [C, A, B]
    await repo.reorder(c.id, 0);
    const listed = await repo.list("proj1");
    expect(listed.map((p) => p.title)).toEqual(["C", "A", "B"]);
  });

  it("no-op when index unchanged", async () => {
    const repo = makeRepo();
    const [a] = await threePages(repo);
    const before = await repo.list("proj1");
    await repo.reorder(a.id, 0);
    const after = await repo.list("proj1");
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
  });

  it("clamps out-of-bounds index to last", async () => {
    const repo = makeRepo();
    const [a] = await threePages(repo);
    await repo.reorder(a.id, 99);
    const listed = await repo.list("proj1");
    expect(listed.map((p) => p.title)).toEqual(["B", "C", "A"]);
  });
});

describe("PageRepository.mutate", () => {
  it("applies a transform against the freshest stored record", async () => {
    const repo = makeRepo();
    const page = await repo.create("proj1", "notes", "Notes");
    const saved = await repo.mutate(page.id, (p) => ({ ...p, title: "Renamed" }));
    expect(saved.title).toBe("Renamed");
    expect((await repo.get(page.id))?.title).toBe("Renamed");
  });

  it("serializes concurrent mutations so neither clobbers the other", async () => {
    const repo = makeRepo();
    const page = await repo.create("proj1", "presets", "Chain");

    // Fired together: without per-id serialization both would read the original
    // record and the second write would drop the first's change.
    await Promise.all([
      repo.mutate(page.id, (p) => ({ ...p, title: "Renamed" })),
      repo.mutate(page.id, (p) => addDevice(p as PresetPage, createPresetDevice({}, { id: "d1" }))),
    ]);

    const after = (await repo.get(page.id)) as PresetPage;
    expect(after.title).toBe("Renamed");
    expect(after.devices.map((d) => d.id)).toEqual(["d1"]);
  });

  it("rename merges with a concurrent field mutation instead of clobbering it", async () => {
    const repo = makeRepo();
    const page = await repo.create("proj1", "notes", "Notes");
    // A rename fired while an autosave is in flight must not drop the body,
    // and vice versa — both route through the serialized merge write.
    await Promise.all([
      repo.rename(page.id, "New title"),
      repo.mutate(page.id, (p) => ({ ...(p as NotesPage), body: "typed" })),
    ]);
    const after = (await repo.get(page.id)) as NotesPage;
    expect(after.title).toBe("New title");
    expect(after.body).toBe("typed");
  });

  it("reorder merges a concurrent field edit rather than clobbering it", async () => {
    const repo = makeRepo();
    const a = await repo.create("proj1", "notes", "A");
    await repo.create("proj1", "build-log", "B");
    // Drag-reorder A while its body autosave is in flight: A ends up reordered
    // AND keeps the typed body.
    await Promise.all([
      repo.reorder(a.id, 1),
      repo.mutate(a.id, (p) => ({ ...(p as NotesPage), body: "edited" })),
    ]);
    const after = (await repo.get(a.id)) as NotesPage;
    expect(after.order).toBe(1);
    expect(after.body).toBe("edited");
  });

  it("keeps the per-id chain alive after a failed mutation", async () => {
    const repo = makeRepo();
    const page = await repo.create("proj1", "notes", "Notes");
    await expect(
      repo.mutate(page.id, () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // A later mutation on the same id still runs.
    const saved = await repo.mutate(page.id, (p) => ({ ...p, title: "After" }));
    expect(saved.title).toBe("After");
  });
});

describe("PageRepository reload across restart", () => {
  it("reads a created page back from a fresh repository over the same store", async () => {
    const storage = new MemoryStorage();
    const created = await new PageRepository({ storage, ...fixtures() }).create(
      "proj1",
      "notes",
      "Survives restart",
    );
    const reloaded = await new PageRepository({ storage }).get(created.id);
    expect(reloaded).toEqual(created);
  });
});
