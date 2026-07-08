import { useCallback, useEffect, useRef, useState } from "react";

export const AUTOSAVE_DELAY_MS = 400;

export type SaveState = "idle" | "saving" | "saved" | "error";

/** The quiet indicator text for a save state, or `null` when idle. */
export function saveStateLabel(state: SaveState): string | null {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Couldn't save";
    default:
      return null;
  }
}

/**
 * Debounced autosave for a single free-text field.
 *
 * Returns `[value, onChange, saveState]`. Edits are persisted
 * `AUTOSAVE_DELAY_MS` after the last keystroke via `save`, which receives the
 * latest value. A pending edit is flushed synchronously when the component
 * unmounts and when `resetKey` changes (e.g. the selected page or device
 * switches), so the last keystrokes are never dropped — the `save` closure
 * captured at edit time still targets the record being edited.
 *
 * `save` should route through a merge write (see {@link PageRepository.mutate})
 * so a flush merges onto the freshest stored record rather than clobbering a
 * concurrent change.
 */
export function useAutosave(
  initial: string,
  save: (value: string) => Promise<void> | void,
  resetKey: string,
): [string, (value: string) => void, SaveState] {
  const [value, setValue] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The pending save, captured at edit time so it targets the right record.
  const pendingRef = useRef<(() => Promise<void> | void) | null>(null);
  // Bumped on every edit and on reset. A save only updates the indicator while
  // it is still the latest, so a slow save can't report "Saved" over newer
  // keystrokes, nor report across a page switch.
  const editSeq = useRef(0);

  const runPending = useCallback((report: boolean) => {
    const run = pendingRef.current;
    if (!run) return;
    pendingRef.current = null;
    const seq = editSeq.current;
    const done = Promise.resolve(run());
    if (report) {
      done.then(
        () => {
          if (seq === editSeq.current) setSaveState("saved");
        },
        () => {
          if (seq === editSeq.current) setSaveState("error");
        },
      );
    } else {
      // Flush on unmount/switch: persist and forget, but swallow rejections so
      // a failed write can't surface as an unhandled promise rejection.
      done.catch(() => {});
    }
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    runPending(false);
  }, [runPending]);

  const change = useCallback(
    (next: string) => {
      setValue(next);
      setSaveState("saving");
      editSeq.current += 1;
      pendingRef.current = () => save(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runPending(true);
      }, AUTOSAVE_DELAY_MS);
    },
    [save, runPending],
  );

  // Flush the previous record's pending edit and reset local state on switch.
  const keyRef = useRef(resetKey);
  useEffect(() => {
    if (keyRef.current === resetKey) return;
    keyRef.current = resetKey;
    flush();
    // Invalidate any in-flight save from the previous record so its resolution
    // can't overwrite the fresh "idle" state with a stale "Saved"/"error".
    editSeq.current += 1;
    setValue(initial);
    setSaveState("idle");
  }, [resetKey, initial, flush]);

  // Flush on unmount so the last keystrokes are persisted.
  useEffect(() => flush, [flush]);

  return [value, change, saveState];
}
