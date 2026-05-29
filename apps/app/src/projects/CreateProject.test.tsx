// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@otocho/core";
import { CreateProject } from "./CreateProject";

function fakeProject(name: string): Project {
  const ts = "2026-01-01T00:00:00.000Z";
  return { id: "p1", name, createdAt: ts, updatedAt: ts, lastOpenedAt: ts, deletedAt: null };
}

describe("CreateProject", () => {
  it("creates a project from a typed name and reports the result", async () => {
    const onCreate = vi.fn(async (name: string) => fakeProject(name));
    const onCreated = vi.fn();
    render(<CreateProject onCreate={onCreate} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText("New project name"), "My track");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledWith("My track");
    expect(onCreated).toHaveBeenCalledWith(fakeProject("My track"));
  });

  it("disables submit and ignores an empty/whitespace name", async () => {
    const onCreate = vi.fn(async (name: string) => fakeProject(name));
    render(<CreateProject onCreate={onCreate} />);
    const button = screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    const input = screen.getByLabelText("New project name");
    await userEvent.type(input, "   {Enter}");

    expect(button.disabled).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("clears the field after a successful create", async () => {
    const onCreate = vi.fn(async (name: string) => fakeProject(name));
    render(<CreateProject onCreate={onCreate} />);
    const input = screen.getByLabelText("New project name") as HTMLInputElement;

    await userEvent.type(input, "Track");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(input.value).toBe("");
  });
});
