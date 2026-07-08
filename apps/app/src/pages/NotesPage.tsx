import type { NotesPage as NotesPageType } from "@otocho/core";
import { saveStateLabel, useAutosave } from "./useAutosave";

export interface NotesPageProps {
  page: NotesPageType;
  onSave: (transform: (page: NotesPageType) => NotesPageType) => Promise<void>;
}

export function NotesPage({ page, onSave }: NotesPageProps) {
  const [body, setBody, saveState] = useAutosave(
    page.body,
    (value) => onSave((p) => ({ ...p, body: value })),
    page.id,
  );

  const saveLabel = saveStateLabel(saveState);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-fg-primary">{page.title}</h3>
        {saveLabel ? (
          <span
            className={[
              "font-mono text-xs uppercase tracking-label",
              saveState === "error" ? "text-destructive" : "text-fg-tertiary",
            ].join(" ")}
          >
            {saveLabel}
          </span>
        ) : null}
      </div>

      <textarea
        aria-label="Notes body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
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
