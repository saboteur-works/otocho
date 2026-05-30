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

  it("deletes a page and removes it from the list", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const pageId = result.current.pages[0].id;
    await act(async () => { await result.current.deletePage(pageId); });

    expect(result.current.pages).toHaveLength(0);
  });

  it("updatePage persists changes and reflects them in the list", async () => {
    const repo = makeRepo();
    await repo.create("proj1", "notes", "My notes");
    const { result } = renderHook(() => usePages("proj1", repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const page = result.current.pages[0];
    const updated = { ...page, body: "new body" } as import("@otocho/core").NotesPage;
    await act(async () => { await result.current.updatePage(updated); });

    expect((result.current.pages[0] as import("@otocho/core").NotesPage).body).toBe("new body");
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
