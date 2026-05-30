// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBuildLogPage, appendMove, type BuildLogPage } from "@otocho/core";
import { BuildLogPage as BuildLogPageEditor } from "./BuildLogPage";

function makePage(overrides: Partial<BuildLogPage> = {}): BuildLogPage {
  return {
    ...createBuildLogPage(
      { projectId: "p", title: "My build log", order: 0 },
      { id: "page1", now: () => "2026-01-01T00:00:00.000Z" },
    ),
    ...overrides,
  };
}

function makePageWithMoves(): BuildLogPage {
  let page = makePage();
  page = appendMove(page, "sidechain to kick", {
    id: "m1",
    now: () => "2026-01-01T14:02:00.000Z",
  });
  page = appendMove(page, "+OTT 20% mix", {
    id: "m2",
    now: () => "2026-01-01T14:09:00.000Z",
  });
  return page;
}

describe("BuildLogPage — sketch", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders the sketch area with existing content", () => {
    render(<BuildLogPageEditor page={makePage({ sketch: "hi there" })} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("hi there")).toBeTruthy();
  });

  it("debounces sketch autosave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BuildLogPageEditor page={makePage()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/sketch/i), { target: { value: "abc" } });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].sketch).toBe("abc");
  });

  it("resets sketch when a different page is shown", () => {
    const pageA = makePage({ sketch: "sketch A", id: "a" });
    const pageB = makePage({ sketch: "sketch B", id: "b" });
    const { rerender } = render(<BuildLogPageEditor page={pageA} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("sketch A")).toBeTruthy();
    rerender(<BuildLogPageEditor page={pageB} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("sketch B")).toBeTruthy();
  });
});

describe("BuildLogPage — move feed", () => {
  it("shows an empty state when there are no moves", () => {
    render(<BuildLogPageEditor page={makePage()} onSave={vi.fn()} />);
    expect(screen.getByText(/no moves yet/i)).toBeTruthy();
  });

  it("renders existing moves with timestamps", () => {
    render(<BuildLogPageEditor page={makePageWithMoves()} onSave={vi.fn()} />);
    expect(screen.getByText("sidechain to kick")).toBeTruthy();
    expect(screen.getByText("+OTT 20% mix")).toBeTruthy();
  });

  it("appends a move on Enter and clears the input", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BuildLogPageEditor page={makePage()} onSave={onSave} />);

    const input = screen.getByLabelText(/add a move/i);
    await userEvent.type(input, "new move");
    await userEvent.keyboard("{Enter}");

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as BuildLogPage;
    expect(saved.moves).toHaveLength(1);
    expect(saved.moves[0].text).toBe("new move");
    expect(saved.moves[0].at).toBeTruthy();
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("Shift+Enter inserts a newline rather than appending", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BuildLogPageEditor page={makePage()} onSave={onSave} />);

    const input = screen.getByLabelText(/add a move/i);
    await userEvent.type(input, "line one");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await userEvent.type(input, "line two");

    expect(onSave).not.toHaveBeenCalled();
    expect((input as HTMLTextAreaElement).value).toContain("line one");
    expect((input as HTMLTextAreaElement).value).toContain("line two");
  });

  it("does not append an empty move", async () => {
    const onSave = vi.fn();
    render(<BuildLogPageEditor page={makePage()} onSave={onSave} />);
    await userEvent.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("[+] button appends the move", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BuildLogPageEditor page={makePage()} onSave={onSave} />);

    await userEvent.type(screen.getByLabelText(/add a move/i), "via button");
    await userEvent.click(screen.getByRole("button", { name: /append move/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0][0] as BuildLogPage).moves[0].text).toBe("via button");
  });
});

describe("BuildLogPage — move edit and delete", () => {
  it("opens inline edit mode and saves the edited text", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BuildLogPageEditor page={makePageWithMoves()} onSave={onSave} />);

    const [firstActions] = screen.getAllByRole("button", { name: /move actions/i });
    await userEvent.click(firstActions);
    await userEvent.click(await screen.findByRole("menuitem", { name: /edit/i }));

    const editInput = screen.getByLabelText(/edit move/i);
    await userEvent.clear(editInput);
    await userEvent.type(editInput, "edited text");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as BuildLogPage;
    expect(saved.moves.find((m) => m.id === "m1")?.text).toBe("edited text");
    expect(saved.moves.find((m) => m.id === "m2")?.text).toBe("+OTT 20% mix");
  });

  it("cancels edit on Escape without saving", async () => {
    const onSave = vi.fn();
    render(<BuildLogPageEditor page={makePageWithMoves()} onSave={onSave} />);

    const [firstActions] = screen.getAllByRole("button", { name: /move actions/i });
    await userEvent.click(firstActions);
    await userEvent.click(await screen.findByRole("menuitem", { name: /edit/i }));

    fireEvent.keyDown(screen.getByLabelText(/edit move/i), { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/edit move/i)).toBeNull();
  });

  it("deletes a move after confirmation", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BuildLogPageEditor page={makePageWithMoves()} onSave={onSave} />);

    const [firstActions] = screen.getAllByRole("button", { name: /move actions/i });
    await userEvent.click(firstActions);
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as BuildLogPage;
    expect(saved.moves).toHaveLength(1);
    expect(saved.moves[0].id).toBe("m2");
  });

  it("cancels delete without saving", async () => {
    const onSave = vi.fn();
    render(<BuildLogPageEditor page={makePageWithMoves()} onSave={onSave} />);

    const [firstActions] = screen.getAllByRole("button", { name: /move actions/i });
    await userEvent.click(firstActions);
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete/i }));
    await userEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("sidechain to kick")).toBeTruthy());
  });
});
