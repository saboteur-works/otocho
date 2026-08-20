// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { dropboxConnectionRepo } from "./dropbox/repository";
import { projectsRepo } from "./projects/repository";
import { pagesRepo } from "./pages/repository";

/**
 * Exercises the real app shell (App.tsx), backed by IndexedDB via
 * `fake-indexeddb/auto`, with the Task 5 Dropbox connect/disconnect control
 * mounted alongside the existing project/page CRUD surface — verifying the
 * new UI doesn't gate or otherwise affect ordinary local-data usage (FR-1,
 * FR-15, D-4).
 */
describe("App shell with Dropbox connect/disconnect mounted", () => {
  beforeEach(async () => {
    // Each test gets a clean slate: soft-delete whatever the previous test
    // (or first-launch onboarding seed) left behind — `list()`/`listAll()`
    // filter tombstoned records out, same as the app's own trash behavior —
    // and clear any connection marker, so tests don't leak IndexedDB state
    // into each other.
    const [projects, pages] = await Promise.all([projectsRepo.list(), pagesRepo.listAll()]);
    await Promise.all(projects.map((p) => projectsRepo.softDelete(p.id)));
    await Promise.all(pages.map((p) => pagesRepo.softDelete(p.id)));
    await dropboxConnectionRepo.clear();
  });

  it("is fully readable/writable against local data with no DropboxConnection present (FR-1, FR-15)", async () => {
    const user = userEvent.setup();
    render(<App />);

    // The connect control is reachable immediately, not gated on anything.
    expect(await screen.findByRole("button", { name: /connect dropbox/i })).toBeTruthy();

    // Ordinary project CRUD via useProjects works unaffected.
    const nameInput = await screen.findByLabelText(/new project name/i);
    await user.type(nameInput, "My New Album");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // CreateProject navigates straight into the new project on success, so
    // it shows up as the project view's heading, not a list row.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /my new album/i })).toBeTruthy(),
    );

    const projects = await projectsRepo.list();
    expect(projects.some((p) => p.name === "My New Album")).toBe(true);
  });

  it("does not delete or alter local project/page data on disconnect (D-4)", async () => {
    const user = userEvent.setup();

    const project = await projectsRepo.create({ name: "Existing Project" });
    const page = await pagesRepo.create(project.id, "notes", "Existing Notes");
    const { createDropboxConnection } = await import("@otocho/core");
    await dropboxConnectionRepo.save(
      createDropboxConnection("account-1", {
        accessToken: "a",
        refreshToken: "r",
        expiresAt: 0,
      }),
    );

    render(<App />);

    const disconnectButton = await screen.findByRole("button", { name: /disconnect/i });
    await user.click(disconnectButton);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect dropbox/i })).toBeTruthy(),
    );
    expect(await dropboxConnectionRepo.get()).toBeNull();

    const projectsAfter = await projectsRepo.list();
    expect(projectsAfter.find((p) => p.id === project.id)?.name).toBe("Existing Project");

    const pageAfter = await pagesRepo.get(page.id);
    expect(pageAfter?.title).toBe("Existing Notes");
  });
});
