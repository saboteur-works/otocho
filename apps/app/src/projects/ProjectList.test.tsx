// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@otocho/core";
import { ProjectList } from "./ProjectList";

function project(id: string, name: string): Project {
  const ts = "2026-01-01T00:00:00.000Z";
  return { id, name, createdAt: ts, updatedAt: ts, lastOpenedAt: ts, deletedAt: null };
}

describe("ProjectList", () => {
  it("shows the empty state when there are no projects", () => {
    render(<ProjectList projects={[]} onOpen={() => {}} />);
    expect(screen.getByText("No projects yet.")).toBeTruthy();
  });

  it("renders duplicate-named projects as distinct rows", () => {
    render(
      <ProjectList
        projects={[project("a", "Same"), project("b", "Same")]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Same" })).toHaveLength(2);
  });

  it("calls onOpen with the clicked project", async () => {
    const onOpen = vi.fn();
    render(
      <ProjectList
        projects={[project("a", "Alpha"), project("b", "Beta")]}
        onOpen={onOpen}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onOpen).toHaveBeenCalledWith(project("b", "Beta"));
  });
});
