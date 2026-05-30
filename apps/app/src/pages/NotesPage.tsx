import { useEffect, useRef, useState } from "react";
import type { NotesPage as NotesPageType } from "@otocho/core";

const AUTOSAVE_DELAY_MS = 400;

type SaveState = "idle" | "saving" | "saved";

export interface NotesPageProps {
  page: NotesPageType;
  onSave: (body: string) => Promise<void>;
}

export function NotesPage({ page, onSave }: NotesPageProps) {
  const [body, setBody] = useState(page.body);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the page id so we reset local state when a different page is selected.
  const pageIdRef = useRef(page.id);

  useEffect(() => {
    if (page.id !== pageIdRef.current) {
      pageIdRef.current = page.id;
      setBody(page.body);
      setSaveState("idle");
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [page.id, page.body]);

  function handleChange(value: string) {
    setBody(value);
    setSaveState("saving");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await onSave(value);
      setSaveState("saved");
    }, AUTOSAVE_DELAY_MS);
  }

  // Clean up any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : null;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-fg-primary">{page.title}</h3>
        {saveLabel ? (
          <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
            {saveLabel}
          </span>
        ) : null}
      </div>

      <textarea
        aria-label="Notes body"
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Type anything…"
        className={[
          "flex-1 resize-none rounded-md bg-otocho-canvas p-4",
          "font-sans text-sm leading-relaxed text-fg-primary placeholder:text-fg-tertiary",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ].join(" ")}
      />
    </div>
  );
}
