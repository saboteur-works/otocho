// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ProjectRepository } from "@otocho/core";
import { MemoryStorage } from "../testing/memory-storage";
import { useProjects } from "./useProjects";

describe("useProjects", () => {
  it("creates a project and reflects it in the active list", async () => {
    const repo = new ProjectRepository({ storage: new MemoryStorage() });
    const { result } = renderHook(() => useProjects(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projects).toHaveLength(0);

    await act(async () => {
      await result.current.create("Track");
    });

    expect(result.current.projects.map((p) => p.name)).toEqual(["Track"]);
  });
});
