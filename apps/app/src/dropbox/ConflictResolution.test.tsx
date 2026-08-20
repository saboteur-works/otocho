// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PageConflictRepository, PageRepository, type Page, type PageConflict } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { ConflictResolution } from "./ConflictResolution";

function notesPage(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    projectId: "proj-1",
    type: "notes",
    title: "Notes page",
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

/**
 * Exercises the full Task 15 done_when contract: both an ordinary
 * edit-vs-edit conflict and a delete-vs-edit conflict (FR-16, D-2), each
 * resolved through the rendered UI's "keep this one" action.
 */
describe("ConflictResolution", () => {
  it("lists pending conflicts with both versions shown in full, and resolves each via its own action", async () => {
    const storage = new MemoryStorage();
    const conflictRepo = new PageConflictRepository({ storage });
    const pageRepo = new PageRepository({ storage });

    // Ordinary edit-vs-edit conflict: both sides active, differing content.
    const editLocal = notesPage("edit-1", { title: "Local edit", body: "local body" });
    const editRemote = notesPage("edit-1", { title: "Remote edit", body: "remote body" });
    await storage.put("pages", editLocal);
    await conflictRepo.save(makeConflict("edit-1", editLocal, editRemote));

    // Delete-vs-edit conflict: remote deleted, local edited (FR-16/D-2).
    const delLocal = notesPage("del-1", { title: "Kept edit", body: "still here" });
    const delRemote = notesPage("del-1", {
      title: "Kept edit",
      body: "still here",
      deletedAt: "2024-06-02T00:00:00.000Z",
    });
    await storage.put("pages", delLocal);
    await conflictRepo.save(makeConflict("del-1", delLocal, delRemote));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConflictResolution conflictsOptions={{ conflictRepo, pageRepo }} />
      </MemoryRouter>,
    );

    // Both versions of both conflicts are shown in full.
    await waitFor(() => expect(screen.getAllByText("Local edit").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Remote edit").length).toBeGreaterThan(0);
    expect(screen.getByText(/local body/)).toBeTruthy();
    expect(screen.getByText(/remote body/)).toBeTruthy();

    // Resolve the edit-vs-edit conflict: keep the remote side.
    const editItem = screen.getAllByText("Local edit")[0].closest("li")!;
    await user.click(
      within(editItem).getByRole("button", { name: /keep remote version/i }),
    );

    await waitFor(async () => {
      expect(await conflictRepo.get("edit-1")).toBeNull();
    });
    const editResolved = await pageRepo.get("edit-1");
    expect(editResolved?.title).toBe("Remote edit");
    expect((editResolved as Page & { body: string }).body).toBe("remote body");
    expect(editResolved?.deletedAt).toBeNull();

    // Resolve the delete-vs-edit conflict: keep the deleted (remote) side.
    const delItems = screen.getAllByText("Kept edit");
    const delItem = delItems[0].closest("li")!;
    await user.click(
      within(delItem).getByRole("button", { name: /keep remote version/i }),
    );

    await waitFor(async () => {
      expect(await conflictRepo.get("del-1")).toBeNull();
    });
    const delResolved = await pageRepo.get("del-1");
    expect(delResolved?.deletedAt).not.toBeNull();
  });
});
