// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AUTOSAVE_DELAY_MS, useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle with the initial value", () => {
    const { result } = renderHook(() => useAutosave("hello", vi.fn(), "k1"));
    const [value, , saveState] = result.current;
    expect(value).toBe("hello");
    expect(saveState).toBe("idle");
  });

  it("saves the latest value after the debounce delay and reports Saved", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave("", save, "k1"));

    act(() => result.current[1]("a"));
    expect(result.current[2]).toBe("saving");
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("a");
    expect(result.current[2]).toBe("saved");
  });

  it("debounces rapid edits into a single save of the last value", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave("", save, "k1"));

    act(() => result.current[1]("a"));
    act(() => result.current[1]("ab"));
    act(() => result.current[1]("abc"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc");
  });

  it("reports 'error' when the debounced save rejects, instead of sticking on 'saving'", async () => {
    const save = vi.fn().mockRejectedValue(new Error("write failed"));
    const { result } = renderHook(() => useAutosave("", save, "k1"));

    act(() => result.current[1]("a"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current[2]).toBe("error");
  });

  it("does not report 'saved' when a slow save resolves after a newer edit", async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>((r) => {
      resolveFirst = r;
    });
    const save = vi.fn().mockReturnValueOnce(first).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave("", save, "k1"));

    act(() => result.current[1]("a"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(result.current[2]).toBe("saving");

    // A newer keystroke arrives before the first (slow) save resolves.
    act(() => result.current[1]("ab"));
    expect(result.current[2]).toBe("saving");

    // The stale first save resolving must not flip the indicator to "saved".
    await act(async () => {
      resolveFirst();
      await first;
    });
    expect(result.current[2]).toBe("saving");
  });

  it("flushes a pending edit on unmount so the last keystrokes are not dropped", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave("", save, "k1"));

    act(() => result.current[1]("draft"));
    expect(save).not.toHaveBeenCalled();

    unmount();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("draft");
  });

  it("flushes the previous record's pending edit when resetKey changes, without a duplicate on timer", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ initial, key }) => useAutosave(initial, save, key),
      { initialProps: { initial: "old body", key: "page-a" } },
    );

    act(() => result.current[1]("edited old"));
    expect(save).not.toHaveBeenCalled();

    // Switch to a different page: the pending edit must flush against page-a.
    rerender({ initial: "new body", key: "page-b" });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("edited old");

    // Local state adopts the new record and drops back to idle.
    expect(result.current[0]).toBe("new body");
    expect(result.current[2]).toBe("idle");

    // The dead timer must not fire a second, stale save.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("re-adopts the initial value on resetKey change even with no pending edit", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ initial, key }) => useAutosave(initial, save, key),
      { initialProps: { initial: "a body", key: "page-a" } },
    );

    rerender({ initial: "b body", key: "page-b" });

    expect(save).not.toHaveBeenCalled();
    expect(result.current[0]).toBe("b body");
    expect(result.current[2]).toBe("idle");
  });
});
