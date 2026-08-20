// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { PageRepository } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { usePages } from "./usePages";

function makeRepo() {
  return new PageRepository({ storage: new MemoryStorage() });
}

describe("usePages", () => {
  it("loads pages for a project", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes", "My notes");

    const { result } = renderHook(() => usePages("proj1", repo));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.pages[0].title).toBe("My notes");
  });

  it("creates a page and adds it to the list", async () => {
    const repo = makeRepo();
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.create("notes", "New note");
    });

    expect(result.current.pages).toHaveLength(1);
    expect(result.current.pages[0].id).toBe(created?.id);
  });

  it("renames a page and refreshes the list", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes", "Old");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const pageId = result.current.pages[0].id;
    await act(async () => { await result.current.rename(pageId, "New"); });

    expect(result.current.pages[0].title).toBe("New");
  });

  it("soft-deletes a page, removing it from the list without removing the storage record", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const pageId = result.current.pages[0].id;
    await act(async () => { await result.current.deletePage(pageId); });

    expect(result.current.pages).toHaveLength(0);
    const stillStored = await repo.get(pageId);
    expect(stillStored).not.toBeNull();
    expect(stillStored?.deletedAt).not.toBeNull();
  });

  it("mutatePage persists changes and reflects them in the list", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes", "My notes");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const pageId = result.current.pages[0].id;
    await act(async () => {
      await result.current.mutatePage<import("@otocho/core").NotesPage>(pageId, (p) => ({
        ...p,
        body: "new body",
      }));
    });

    expect((result.current.pages[0] as import("@otocho/core").NotesPage).body).toBe("new body");
  });

  it("mutatePage serializes concurrent edits so neither clobbers the other", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "presets", "Chain");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const pageId = result.current.pages[0].id;
    await act(async () => {
      await Promise.all([
        result.current.mutatePage<import("@otocho/core").PresetPage>(pageId, (p) => ({
          ...p,
          title: "Renamed",
        })),
        result.current.mutatePage<import("@otocho/core").PresetPage>(pageId, (p) => ({
          ...p,
          devices: [...p.devices, { id: "d1", name: "Comp", settings: "", params: [] }],
        })),
      ]);
    });

    const page = result.current.pages[0] as import("@otocho/core").PresetPage;
    expect(page.title).toBe("Renamed");
    expect(page.devices).toHaveLength(1);
  });

  it("reorders pages and reflects the new order", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes", "A");
    await repo.create("proj1", "build-log", "B");
    await repo.create("proj1", "presets", "C");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const idA = result.current.pages[0].id;
    await act(async () => { await result.current.reorder(idA, 2); });

    expect(result.current.pages.map((p) => p.title)).toEqual(["B", "C", "A"]);
  });

  it("isolates pages by project", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes", "A");
    await repo.create("proj2", "notes", "B");

    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pages).toHaveLength(1);
    expect(result.current.pages[0].title).toBe("A");
  });
});
