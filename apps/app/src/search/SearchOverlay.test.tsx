// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PageRepository, ProjectRepository, type BuildLogPage, type NotesPage } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { ProjectView } from "../projects/ProjectView";
import { SearchOverlay, type SearchOverlayProps } from "./SearchOverlay";

function renderOverlay(props: SearchOverlayProps = {}) {
  return render(
    <MemoryRouter>
      <SearchOverlay {...props} />
    </MemoryRouter>,
  );
}

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
    renderOverlay({ searchOptions: { projectsRepo, pagesRepo, debounceMs: 0 } });

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

    renderOverlay({ searchOptions: { projectsRepo, pagesRepo, debounceMs: 0 } });
    await openOverlay();

    expect(listSpy).not.toHaveBeenCalled();
    expect(listAllSpy).not.toHaveBeenCalled();
  });

  it("drives useSearch as the user types, replacing the static prompt", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();

    const project = await projectsRepo.create({ name: "Alpha" });
    const page = await pagesRepo.create(project.id, "notes", "Notes");
    await pagesRepo.mutate(page.id, (p) => ({ ...(p as NotesPage), body: "kick drum tuning" }));

    renderOverlay({ searchOptions: { projectsRepo, pagesRepo, debounceMs: 0 } });
    const user = await openOverlay();

    await user.type(screen.getByRole("textbox"), "kick");

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
    await screen.findByText("kick drum tuning", { exact: false });
    expect(screen.getByText("Alpha", { exact: false })).toBeTruthy();
  });

  it("dismisses on Escape without navigating", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    renderOverlay({ searchOptions: { projectsRepo, pagesRepo, debounceMs: 0 } });
    const user = await openOverlay();

    expect(screen.getByText("Type to search your projects and pages.")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
  });

  it("dismisses on overlay click without navigating", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();
    renderOverlay({ searchOptions: { projectsRepo, pagesRepo, debounceMs: 0 } });
    await openOverlay();

    expect(screen.getByText("Type to search your projects and pages.")).toBeTruthy();

    const overlay = document.querySelector(".fixed.inset-0.bg-black\\/70");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);

    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
  });

  it("navigates to the matching non-first page's editor and closes the overlay on selection (FR-6)", async () => {
    const { projectsRepo, pagesRepo } = makeRepos();

    const project = await projectsRepo.create({ name: "Alpha" });
    await pagesRepo.create(project.id, "notes", "First notes");
    const buildLogPage = await pagesRepo.create(project.id, "build-log", "Second build log");
    await pagesRepo.mutate(buildLogPage.id, (p) => ({
      ...(p as BuildLogPage),
      sketch: "kick drum tuning",
    }));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <div>
          <SearchOverlay searchOptions={{ projectsRepo, pagesRepo, debounceMs: 0 }} />
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route
              path="/projects/:id"
              element={<ProjectView repo={projectsRepo} pageRepo={pagesRepo} />}
            />
          </Routes>
        </div>
      </MemoryRouter>,
    );

    const user = await openOverlay();
    await user.type(screen.getByRole("textbox"), "kick");

    const resultButton = await screen.findByText("kick drum tuning", { exact: false });
    await user.click(resultButton);

    // The overlay is gone (navigation closed it).
    expect(screen.queryByText("Type to search your projects and pages.")).toBeNull();
    expect(screen.queryByPlaceholderText("Search projects and pages…")).toBeNull();

    // The build-log page's editor is showing, not the notes page (the first page).
    expect(await screen.findByLabelText("Sketch")).toBeTruthy();
    expect(screen.queryByLabelText("Notes body")).toBeNull();
  });
});
