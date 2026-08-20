// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { PageConflictRepository, PageRepository, type Page, type PageConflict } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { useConflicts } from "./useConflicts";

function notesPage(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    projectId: "proj-1",
    type: "notes",
    title: "Notes",
    order: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    deletedAt: null,
    body: "",
    ...overrides,
  } as Page;
}

function makeConflict(id: string, local: Page, remote: Page): PageConflict {
  return { id, local, remote, detectedAt: "2024-06-01T00:00:00.000Z" };
}

async function seed(storage: MemoryStorage, page: Page) {
  await storage.put("pages", page);
}

describe("useConflicts", () => {
  it("lists every pending conflict from PageConflictRepository", async () => {
    const storage = new MemoryStorage();
    const conflictRepo = new PageConflictRepository({ storage });
    const pageRepo = new PageRepository({ storage });

    const local = notesPage("p1", { title: "local title" });
    const remote = notesPage("p1", { title: "remote title" });
    await seed(storage, local);
    await conflictRepo.save(makeConflict("p1", local, remote));

    const { result } = renderHook(() => useConflicts({ conflictRepo, pageRepo }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conflicts.map((c) => c.id)).toEqual(["p1"]);
  });

  it("resolve(local) writes the local version and clears the conflict", async () => {
    const storage = new MemoryStorage();
    const conflictRepo = new PageConflictRepository({ storage });
    const pageRepo = new PageRepository({ storage });

    const local = notesPage("p1", { title: "local title" });
    const remote = notesPage("p1", { title: "remote title" });
    await seed(storage, local);
    await conflictRepo.save(makeConflict("p1", local, remote));

    const { result } = renderHook(() => useConflicts({ conflictRepo, pageRepo }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolve("p1", "local");
    });

    const saved = await pageRepo.get("p1");
    expect(saved?.title).toBe("local title");
    expect(await conflictRepo.get("p1")).toBeNull();
  });

  it("resolve(remote) on a delete-vs-edit conflict applies the remote's tombstone state", async () => {
    const storage = new MemoryStorage();
    const conflictRepo = new PageConflictRepository({ storage });
    const pageRepo = new PageRepository({ storage });

    const local = notesPage("p1", { title: "edited locally", deletedAt: null });
    const remote = notesPage("p1", { title: "edited locally", deletedAt: "2024-06-01T00:00:00.000Z" });
    await seed(storage, local);
    await conflictRepo.save(makeConflict("p1", local, remote));

    const { result } = renderHook(() => useConflicts({ conflictRepo, pageRepo }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolve("p1", "remote");
    });

    const saved = await pageRepo.get("p1");
    expect(saved?.deletedAt).not.toBeNull();
    expect(await conflictRepo.get("p1")).toBeNull();
  });
});
