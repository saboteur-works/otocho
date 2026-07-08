// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { createNotesPage } from "@otocho/core";
import { NotesPage } from "./NotesPage";

function makePage() {
  return {
    ...createNotesPage(
      { projectId: "p", title: "My notes", order: 0 },
      { id: "page1", now: () => "2026-01-01T00:00:00.000Z" },
    ),
    body: "",
  } as import("@otocho/core").NotesPage;
}

describe("NotesPage", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders the page title and body", () => {
    const page = { ...makePage(), body: "hello world" };
    render(<NotesPage page={page} onSave={vi.fn()} />);
    expect(screen.getByText("My notes")).toBeTruthy();
    expect(screen.getByDisplayValue("hello world")).toBeTruthy();
  });

  it("shows a placeholder when body is empty", () => {
    render(<NotesPage page={makePage()} onSave={vi.fn()} />);
    expect(screen.getByPlaceholderText(/type anything/i)).toBeTruthy();
  });

  it("calls onSave after the debounce delay", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NotesPage page={makePage()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/notes body/i), { target: { value: "a" } });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0](makePage()).body).toBe("a");
  });

  it("debounces: only calls onSave once for rapid keystrokes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NotesPage page={makePage()} onSave={onSave} />);

    const ta = screen.getByLabelText(/notes body/i);
    fireEvent.change(ta, { target: { value: "a" } });
    fireEvent.change(ta, { target: { value: "ab" } });
    fireEvent.change(ta, { target: { value: "abc" } });

    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0](makePage()).body).toBe("abc");
  });

  it("shows Saving… then Saved indicator", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NotesPage page={makePage()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/notes body/i), { target: { value: "x" } });
    expect(screen.getByText("Saving…")).toBeTruthy();

    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("resets body when a different page is shown", () => {
    const pageA = { ...makePage(), body: "page A content", id: "a" };
    const pageB = { ...makePage(), body: "page B content", id: "b", title: "B" };
    const { rerender } = render(<NotesPage page={pageA} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("page A content")).toBeTruthy();

    rerender(<NotesPage page={pageB} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("page B content")).toBeTruthy();
  });
});
