// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageRepository, ProjectRepository, type NotesPage } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { SearchOverlay } from "./SearchOverlay";

function makeRepos() {
  const storage = new MemoryStorage();
  let counter = 0;
  const now = () => new Date(counter++).toISOString();
  return {
    projectsRepo: new ProjectRepository({ storage, now }),
    pagesRepo: new PageRepository({ storage, now }),
  };
}

async function openOverlay() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Search" }));
  return user;
}

describe("SearchOverlay", () => {
  it("is closed by default and shows only the static prompt before any query is typed", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    render(<SearchOverlay searchOptions={{ projectsRepo, pagesRepo, debounceMs: 0 }} />);

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();

    await openOverlay();

    expect(screen.getByText("Type to search your projects and pages.")).toBeTruthy();
    // No recent-items or suggested-content rendering of any kind.
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("does not fetch from repositories before a query is typed", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    const listSpy = vi.spyOn(projectsRepo, "list");
    const listAllSpy = vi.spyOn(pagesRepo, "listAll");

    render(<SearchOverlay searchOptions={{ projectsRepo, pagesRepo, debounceMs: 0 }} />);
    await openOverlay();

    expect(listSpy).not.toHaveBeenCalled();
    expect(listAllSpy).not.toHaveBeenCalled();
  });

  it("drives useSearch as the user types, replacing the static prompt", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();

    const project = await projectsRepo.create({ name: "Alpha" });
    const page = await pagesRepo.create(project.id, "notes", "Notes");
    await pagesRepo.mutate(page.id, (p) => ({ ...(p as NotesPage), body: "kick drum tuning" }));

    render(<SearchOverlay searchOptions={{ projectsRepo, pagesRepo, debounceMs: 0 }} />);
    const user = await openOverlay();

    await user.type(screen.getByRole("textbox"), "kick");

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
    await screen.findByText("1 result");
  });

  it("dismisses on Escape without navigating", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    render(<SearchOverlay searchOptions={{ projectsRepo, pagesRepo, debounceMs: 0 }} />);
    const user = await openOverlay();

    expect(screen.getByText("Type to search your projects and pages.")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
  });

  it("dismisses on overlay click without navigating", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    render(<SearchOverlay searchOptions={{ projectsRepo, pagesRepo, debounceMs: 0 }} />);
    await openOverlay();

    expect(screen.getByText("Type to search your projects and pages.")).toBeTruthy();

    const overlay = document.querySelector(".fixed.inset-0.bg-black\\/70");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
  });
});
