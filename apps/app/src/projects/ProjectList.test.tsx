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

  it("renders the seeded example project with no visual distinction from an ordinary project", () => {
    // FR-11/D-5: the example project is a plain Project — no "isExample" flag
    // exists for ProjectList to consume, so its row must be indistinguishable
    // (same markup/classes) from any user-created project's row.
    render(
      <ProjectList
        projects={[project("example-1", "Midnight Drive — example"), project("b", "Alpha")]}
        onOpen={() => {}}
      />,
    );

    const exampleButton = screen.getByRole("button", { name: "Midnight Drive — example" });
    const ordinaryButton = screen.getByRole("button", { name: "Alpha" });

    // Same tag, same className, same attributes — only the text content differs.
    expect(exampleButton.tagName).toBe(ordinaryButton.tagName);
    expect(exampleButton.className).toBe(ordinaryButton.className);
    expect(exampleButton.getAttribute("type")).toBe(ordinaryButton.getAttribute("type"));
    expect(
      Array.from(exampleButton.attributes).map((a) => a.name).sort(),
    ).toEqual(Array.from(ordinaryButton.attributes).map((a) => a.name).sort());

    // outerHTML equal once the differing text content is stripped, proving
    // there's no badge/label/variant markup added around either row.
    const normalize = (html: string, name: string) => html.replace(name, "__NAME__");
    expect(normalize(exampleButton.outerHTML, "Midnight Drive — example")).toBe(
      normalize(ordinaryButton.outerHTML, "Alpha"),
    );

    const exampleRow = exampleButton.closest("li");
    const ordinaryRow = ordinaryButton.closest("li");
    expect(exampleRow?.className).toBe(ordinaryRow?.className);
  });
});
