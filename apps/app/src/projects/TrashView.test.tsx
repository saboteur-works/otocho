// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProjectRepository } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { TrashView } from "./TrashView";

function renderTrash(repo: ProjectRepository) {
  return render(
    <MemoryRouter>
      <TrashView repo={repo} />
    </MemoryRouter>,
  );
}

async function repoWithDeleted(name: string) {
  const repo = new ProjectRepository({ storage: new MemoryStorage() });
  const created = await repo.create({ name });
  await repo.softDelete(created.id);
  return { repo, id: created.id };
}

describe("TrashView", () => {
  it("shows an empty state when nothing is deleted", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    renderTrash(repo);
    expect(await screen.findByText("Trash is empty.")).toBeTruthy();
  });

  it("restores a deleted project back to active", async () => {
    const { repo, id } = await repoWithDeleted("Bring me back");
    renderTrash(repo);

    await userEvent.click(await screen.findByRole("button", { name: "Restore" }));

    await waitFor(() => expect(screen.queryByText("Bring me back")).toBeNull());
    expect((await repo.get(id))?.deletedAt).toBeNull();
  });

  it("permanently removes a project only after confirmation", async () => {
    const { repo, id } = await repoWithDeleted("Gone for good");
    const purgeSpy = vi.spyOn(repo, "purge");
    renderTrash(repo);

    await userEvent.click(await screen.findByRole("button", { name: "Delete forever" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));

    expect(purgeSpy).toHaveBeenCalledWith(id);
    await waitFor(() => expect(screen.queryByText("Gone for good")).toBeNull());
    expect(await repo.get(id)).toBeNull();
  });

  it("keeps the project when permanent deletion is cancelled", async () => {
    const { repo, id } = await repoWithDeleted("Still here");
    const purgeSpy = vi.spyOn(repo, "purge");
    renderTrash(repo);

    await userEvent.click(await screen.findByRole("button", { name: "Delete forever" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(purgeSpy).not.toHaveBeenCalled();
    expect(await repo.get(id)).not.toBeNull();
  });
});
