// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { PageRepository, ProjectRepository, type NotesPage } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { useSearch } from "./useSearch";

/**
 * A monotonically increasing clock so ordering-sensitive assertions (project
 * recency) don't depend on real wall-clock gaps between fast, synchronous
 * calls within the same millisecond.
 */
function makeClock(): () => string {
  let counter = 0;
  return () => new Date(counter++).toISOString();
}

function makeRepos() {
  const storage = new MemoryStorage();
  const now = makeClock();
  return {
    projectsRepo: new ProjectRepository({ storage, now }),
    pagesRepo: new PageRepository({ storage, now }),
  };
}

describe("useSearch", () => {
  it("returns no results and does no work for an empty or whitespace query", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    const listSpy = vi.spyOn(projectsRepo, "list");
    const listAllSpy = vi.spyOn(pagesRepo, "listAll");

    const { result } = renderHook(() => useSearch({ projectsRepo, pagesRepo, debounceMs: 0 }));

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);

    act(() => result.current.setQuery("   "));

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(listSpy).not.toHaveBeenCalled();
    expect(listAllSpy).not.toHaveBeenCalled();
  });

  it("finds matches across all active projects and their pages, sorted by project recency then page order", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();

    const projectA = await projectsRepo.create({ name: "Alpha" });
    const projectB = await projectsRepo.create({ name: "Beta" });
    // Reopen B so it's more recent than A.
    await projectsRepo.open(projectB.id);

    const pageA1 = await pagesRepo.create(projectA.id, "notes", "A1");
    await pagesRepo.mutate(pageA1.id, (p) => ({ ...(p as NotesPage), body: "kick drum tuning" }));

    const pageB1 = await pagesRepo.create(projectB.id, "notes", "B1");
    await pagesRepo.mutate(pageB1.id, (p) => ({ ...(p as NotesPage), body: "unrelated" }));

    const pageB2 = await pagesRepo.create(projectB.id, "notes", "B2");
    await pagesRepo.mutate(pageB2.id, (p) => ({ ...(p as NotesPage), body: "kick sample pack" }));

    const { result } = renderHook(() => useSearch({ projectsRepo, pagesRepo, debounceMs: 0 }));

    act(() => result.current.setQuery("kick"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.results).toHaveLength(2);
    // projectB is more recent, so its match should come before projectA's.
    expect(result.current.results.map((r) => r.pageId)).toEqual([pageB2.id, pageA1.id]);
  });

  it("excludes pages belonging to soft-deleted projects", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();

    const project = await projectsRepo.create({ name: "Gone" });
    const page = await pagesRepo.create(project.id, "notes", "Note");
    await pagesRepo.mutate(page.id, (p) => ({ ...(p as NotesPage), body: "kick drum" }));
    await projectsRepo.softDelete(project.id);

    const { result } = renderHook(() => useSearch({ projectsRepo, pagesRepo, debounceMs: 0 }));

    act(() => result.current.setQuery("kick"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual([]);
  });
});
