// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OnboardingRepository, PageRepository, ProjectRepository } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { ProjectsHome } from "./ProjectsHome";

function makeRepos() {
  const storage = new MemoryStorage();
  return {
    projects: new ProjectRepository({ storage }),
    pages: new PageRepository({ storage }),
    onboarding: new OnboardingRepository({ storage }),
  };
}

describe("ProjectsHome", () => {
  it("renders the CreateProject CTA immediately, before the seed check resolves", () => {
    const repos = makeRepos();

    render(
      <MemoryRouter>
        <ProjectsHome {...repos} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.getByLabelText("New project name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("shows the seeded example project in the list once seeding resolves (FR-10)", async () => {
    const repos = makeRepos();

    render(
      <MemoryRouter>
        <ProjectsHome {...repos} />
      </MemoryRouter>,
    );

    await waitFor(async () => {
      const projects = await repos.projects.list();
      expect(projects).toHaveLength(1);
    });

    const [example] = await repos.projects.list();
    expect(await screen.findByText(example.name)).toBeTruthy();
  });
});
