// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectRepository } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { ProjectView } from "./ProjectView";

function renderAt(repo: ProjectRepository, id: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${id}`]}>
      <Routes>
        <Route path="/" element={<div>All projects home</div>} />
        <Route path="/projects/:id" element={<ProjectView repo={repo} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectView", () => {
  it("shows the project and marks it opened on mount", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    const created = await repo.create({ name: "My track" });
    const openSpy = vi.spyOn(repo, "open");

    renderAt(repo, created.id);

    expect(await screen.findByText("My track")).toBeTruthy();
    expect(openSpy).toHaveBeenCalledWith(created.id);
  });

  it("reports a missing project", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    renderAt(repo, "does-not-exist");

    await waitFor(() =>
      expect(screen.getByText(/could not be found/i)).toBeTruthy(),
    );
  });

  it("renames the project in place, keeping its id", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    const created = await repo.create({ name: "Old name" });
    const renameSpy = vi.spyOn(repo, "rename");
    renderAt(repo, created.id);

    await screen.findByText("Old name");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    const input = screen.getByLabelText("Project name");
    await userEvent.clear(input);
    await userEvent.type(input, "New name");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(renameSpy).toHaveBeenCalledWith(created.id, "New name");
    expect(await screen.findByText("New name")).toBeTruthy();
    expect(screen.queryByText("Old name")).toBeNull();
    expect((await repo.get(created.id))?.id).toBe(created.id);
  });

  it("keeps the project when delete is cancelled", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    const created = await repo.create({ name: "Keep me" });
    const deleteSpy = vi.spyOn(repo, "softDelete");
    renderAt(repo, created.id);

    await screen.findByText("Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect((await repo.get(created.id))?.deletedAt).toBeNull();
  });

  it("soft-deletes on confirm and returns to the list", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    const created = await repo.create({ name: "Bye" });
    renderAt(repo, created.id);

    await screen.findByText("Bye");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(screen.getByText("All projects home")).toBeTruthy());
    const stored = await repo.get(created.id);
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).not.toBeNull();
  });
});
