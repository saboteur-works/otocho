// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createNotesPage, createBuildLogPage } from "@otocho/core";
import { PageList } from "./PageList";

function makePage(overrides = {}) {
  return createNotesPage({ projectId: "p1", title: "My notes", order: 0 }, { id: "page1", now: () => "2026-01-01T00:00:00.000Z", ...overrides });
}

describe("PageList", () => {
  it("shows a placeholder when there are no pages", () => {
    render(
      <PageList
        pages={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.getByText(/no pages yet/i)).toBeTruthy();
  });

  it("renders page rows with their titles", () => {
    const pages = [
      createNotesPage({ projectId: "p", title: "Notes", order: 0 }, { id: "a" }),
      createBuildLogPage({ projectId: "p", title: "Build log", order: 1 }, { id: "b" }),
    ];
    render(
      <PageList
        pages={pages}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.getByText("Notes")).toBeTruthy();
    expect(screen.getByText("Build log")).toBeTruthy();
  });

  it("calls onSelect when a page row is clicked", async () => {
    const onSelect = vi.fn();
    const page = makePage();
    render(
      <PageList
        pages={[page]}
        selectedId={null}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("My notes"));
    expect(onSelect).toHaveBeenCalledWith(page);
  });

  it("calls onCreate with the chosen type from the [+] dropdown", async () => {
    const onCreate = vi.fn();
    render(
      <PageList
        pages={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /add page/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /notes/i }));
    expect(onCreate).toHaveBeenCalledWith("notes");
  });

  it("enters inline rename mode and calls onRename on submit", async () => {
    const onRename = vi.fn();
    const page = makePage();
    render(
      <PageList
        pages={[page]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    // Open the ⋯ menu by clicking the actions button (make it visible via fireEvent hover)
    const actionsBtn = screen.getByRole("button", { name: /page actions/i });
    await userEvent.click(actionsBtn);
    await userEvent.click(await screen.findByRole("menuitem", { name: /rename/i }));

    const input = screen.getByLabelText(/page title/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed{Enter}");

    expect(onRename).toHaveBeenCalledWith(page.id, "Renamed");
  });

  it("calls onDelete when Delete is chosen from the ⋯ menu", async () => {
    const onDelete = vi.fn();
    const page = makePage();
    render(
      <PageList
        pages={[page]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
        onReorder={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /page actions/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(page.id);
  });

  it("applies active styling to the selected page row", () => {
    const page = makePage();
    const { container } = render(
      <PageList
        pages={[page]}
        selectedId={page.id}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    // Active row should have border-fg-primary class
    expect(container.querySelector(".border-fg-primary")).toBeTruthy();
  });

  it("cancels rename on Escape", async () => {
    const onRename = vi.fn();
    const page = makePage();
    render(
      <PageList
        pages={[page]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /page actions/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /rename/i }));

    const input = screen.getByLabelText(/page title/i);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByLabelText(/page title/i)).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });
});
