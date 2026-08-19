// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { OnboardingRepository, PageRepository, ProjectRepository } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { useOnboardingSeed } from "./useOnboardingSeed";

function makeRepos() {
  const storage = new MemoryStorage();
  return {
    projects: new ProjectRepository({ storage }),
    pages: new PageRepository({ storage }),
    onboarding: new OnboardingRepository({ storage }),
  };
}

describe("useOnboardingSeed", () => {
  it("flips ready to true once seeding resolves", async () => {
    const repos = makeRepos();

    const { result } = renderHook(() => useOnboardingSeed(repos));

    expect(result.current.ready).toBe(false);

    await waitFor(() => expect(result.current.ready).toBe(true));

    const projects = await repos.projects.list();
    expect(projects).toHaveLength(1);
  });

  it("reuses ensureOnboardingSeeded's guard across two concurrent mounts sharing the same repos, seeding exactly once", async () => {
    const repos = makeRepos();

    const first = renderHook(() => useOnboardingSeed(repos));
    const second = renderHook(() => useOnboardingSeed(repos));

    await waitFor(() => expect(first.result.current.ready).toBe(true));
    await waitFor(() => expect(second.result.current.ready).toBe(true));

    const projects = await repos.projects.list();
    expect(projects).toHaveLength(1);

    const pages = await repos.pages.listAll();
    expect(pages).toHaveLength(3);

    const marker = await repos.onboarding.getMarker();
    expect(marker?.exampleProjectId).toBe(projects[0]?.id);
  });
});
