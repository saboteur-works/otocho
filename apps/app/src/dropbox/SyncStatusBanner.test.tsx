// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  DropboxConnectionRepository,
  OnboardingRepository,
  PageRepository,
  ProjectRepository,
  SyncEngine,
  createDropboxConnection,
} from "@otocho/core";
import type { DropboxTokens } from "@otocho/storage";
import { MemoryStorage } from "../testing/memory-storage";
import { ProjectsHome } from "../projects/ProjectsHome";
import { SyncStatusBanner } from "./SyncStatusBanner";

const TOKENS: DropboxTokens = {
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-xyz",
  expiresAt: 1_000_000,
};

function makeRepos() {
  const storage = new MemoryStorage();
  return {
    projects: new ProjectRepository({ storage }),
    pages: new PageRepository({ storage }),
    onboarding: new OnboardingRepository({ storage }),
    dropbox: new DropboxConnectionRepository({ storage: new MemoryStorage() }),
  };
}

describe("SyncStatusBanner", () => {
  it("renders nothing while the initial connection read is loading", () => {
    const { dropbox } = makeRepos();
    render(<SyncStatusBanner statusOptions={{ repo: dropbox, engine: null }} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("always shows a generic 'not synced' message when disconnected (FR-13 minimum)", async () => {
    const { dropbox } = makeRepos();

    render(<SyncStatusBanner statusOptions={{ repo: dropbox, engine: null }} />);

    expect(await screen.findByText(/not synced/i)).toBeTruthy();
  });

  it("expands to show the disconnected cause via the 'Why?' affordance (D-6)", async () => {
    const { dropbox } = makeRepos();
    const user = userEvent.setup();

    render(<SyncStatusBanner statusOptions={{ repo: dropbox, engine: null }} />);
    await screen.findByText(/not synced/i);

    expect(screen.queryByText(/dropbox isn't connected/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /why\?/i }));
    expect(screen.getByText(/dropbox isn't connected/i)).toBeTruthy();
  });

  it("expands to show a specific engine-reported cause (out of space) via the 'Why?' affordance (D-6)", async () => {
    const { dropbox } = makeRepos();
    await dropbox.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });
    vi.spyOn(engine, "getStatus").mockReturnValue({ synced: false, cause: "out-of-space" });
    const user = userEvent.setup();

    render(<SyncStatusBanner statusOptions={{ repo: dropbox, engine }} />);
    await screen.findByText(/not synced/i);

    await user.click(screen.getByRole("button", { name: /why\?/i }));
    expect(screen.getByText(/out of space/i)).toBeTruthy();
  });

  it("shows nothing more specific when the engine's failure isn't classifiable (D-6)", async () => {
    const { dropbox } = makeRepos();
    await dropbox.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });
    vi.spyOn(engine, "getStatus").mockReturnValue({ synced: false });
    const user = userEvent.setup();

    render(<SyncStatusBanner statusOptions={{ repo: dropbox, engine }} />);
    await screen.findByText(/not synced/i);

    await user.click(screen.getByRole("button", { name: /why\?/i }));
    expect(screen.getByText(/no further detail is available/i)).toBeTruthy();
  });

  it("renders nothing once sync is working", async () => {
    const { dropbox } = makeRepos();
    await dropbox.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });

    render(<SyncStatusBanner statusOptions={{ repo: dropbox, engine }} />);

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("ordinary project CRUD keeps working while the banner is showing a forced sync failure (FR-12)", async () => {
    const repos = makeRepos();
    await repos.dropbox.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });
    vi.spyOn(engine, "getStatus").mockReturnValue({ synced: false, cause: "auth-failure" });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SyncStatusBanner statusOptions={{ repo: repos.dropbox, engine }} />
        <ProjectsHome projects={repos.projects} pages={repos.pages} onboarding={repos.onboarding} />
      </MemoryRouter>,
    );

    await screen.findByText(/not synced/i);

    const nameInput = await screen.findByLabelText(/new project name/i);
    await user.type(nameInput, "My New Album");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(async () => {
      const projects = await repos.projects.list();
      expect(projects.some((p) => p.name === "My New Album")).toBe(true);
    });

    // The banner is still showing the forced failure — local writes worked
    // unaffected by it (FR-12).
    expect(screen.getByText(/not synced/i)).toBeTruthy();
  });
});
