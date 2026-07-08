import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@otocho/ui";
import { appendMove, editMove, removeMove, type BuildLogPage as BuildLogPageType, type Move } from "@otocho/core";
import { useAutosave } from "./useAutosave";

export interface BuildLogPageProps {
  page: BuildLogPageType;
  onSave: (transform: (page: BuildLogPageType) => BuildLogPageType) => Promise<void>;
}

export function BuildLogPage({ page, onSave }: BuildLogPageProps) {
  const [sketch, setSketch, sketchSaveState] = useAutosave(
    page.sketch,
    (value) => onSave((p) => ({ ...p, sketch: value })),
    page.id,
  );
  const [quickAdd, setQuickAdd] = useState("");
  const quickAddRef = useRef<HTMLTextAreaElement>(null);

  async function handleAppend() {
    const text = quickAdd.trim();
    if (text.length === 0) return;
    setQuickAdd("");
    await onSave((p) => appendMove(p, text));
    quickAddRef.current?.focus();
  }

  function handleQuickAddKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleAppend();
    }
  }

  async function handleEditMove(moveId: string, text: string) {
    await onSave((p) => editMove(p, moveId, text));
  }

  async function handleDeleteMove(moveId: string) {
    await onSave((p) => removeMove(p, moveId));
  }

  const sketchLabel =
    sketchSaveState === "saving" ? "Saving…" : sketchSaveState === "saved" ? "Saved" : null;

  const groupedMoves = useMemo(() => groupMovesByDay(page.moves), [page.moves]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Sketch section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
            Sketch
          </span>
          {sketchLabel ? (
            <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
              {sketchLabel}
            </span>
          ) : null}
        </div>
        <textarea
          aria-label="Sketch"
          value={sketch}
          onChange={(e) => setSketch(e.target.value)}
          placeholder="Arrangement ideas, references, anything…"
          rows={5}
          className={[
            "resize-none rounded-md bg-otocho-canvas p-3",
            "font-sans text-sm leading-relaxed text-fg-primary placeholder:text-fg-tertiary",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          ].join(" ")}
        />
      </div>

      {/* Move feed */}
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
          Moves
        </span>

        <div className="flex flex-1 flex-col overflow-y-auto rounded-md border border-brand-rule">
          {/* Move list */}
          <div className="flex-1 overflow-y-auto">
            {groupedMoves.length === 0 ? (
              <p className="p-4 text-center text-xs text-fg-tertiary">No moves yet.</p>
            ) : (
              groupedMoves.map(({ key, day, moves }) => (
                <div key={key}>
                  <div className="sticky top-0 flex items-center gap-2 bg-brand-black px-3 py-1">
                    <div className="h-px flex-1 bg-brand-rule" />
                    <span className="font-mono text-xs text-fg-tertiary">{day}</span>
                    <div className="h-px flex-1 bg-brand-rule" />
                  </div>
                  {moves.map((move) => (
                    <MoveItem
                      key={move.id}
                      move={move}
                      onEdit={handleEditMove}
                      onDelete={handleDeleteMove}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Quick-add */}
          <div className="flex items-end gap-2 border-t border-brand-rule bg-brand-black p-2">
            <textarea
              ref={quickAddRef}
              aria-label="Add a move"
              value={quickAdd}
              onChange={(e) => setQuickAdd(e.target.value)}
              onKeyDown={handleQuickAddKeyDown}
              placeholder="Add a move… (Enter to append, Shift+Enter for newline)"
              rows={1}
              className={[
                "flex-1 resize-none rounded-md bg-otocho-canvas px-3 py-2",
                "font-sans text-sm text-fg-primary placeholder:text-fg-tertiary",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              ].join(" ")}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Append move"
              disabled={quickAdd.trim().length === 0}
              onClick={() => void handleAppend()}
              className="shrink-0 text-fg-tertiary hover:text-fg-primary"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MoveItemProps {
  move: Move;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function MoveItem({ move, onEdit, onDelete }: MoveItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(move.text);

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      await onEdit(move.id, trimmed);
    }
    setEditing(false);
  }

  function cancelEdit(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setDraft(move.text);
      setEditing(false);
    }
  }

  return (
    <div className="group flex items-start gap-3 px-3 py-2 hover:bg-surface-hover">
      <span className="shrink-0 font-mono text-xs text-fg-tertiary pt-0.5">
        {formatTime(move.at)}
      </span>

      {editing ? (
        <form onSubmit={submitEdit} className="flex flex-1 flex-col gap-1">
          <textarea
            aria-label="Edit move"
            autoFocus
            value={draft}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={cancelEdit}
            className={[
              "w-full resize-none rounded bg-otocho-canvas px-2 py-1",
              "font-sans text-sm text-fg-primary",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            ].join(" ")}
          />
          <div className="flex gap-1">
            <Button type="submit" size="sm" disabled={draft.trim().length === 0}>Save</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setDraft(move.text); setEditing(false); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="flex-1 whitespace-pre-wrap text-sm text-fg-primary">{move.text}</p>
          <MoveMenu
            onEdit={() => { setDraft(move.text); setEditing(true); }}
            onDelete={() => onDelete(move.id)}
            moveText={move.text}
          />
        </>
      )}
    </div>
  );
}

function MoveMenu({
  onEdit,
  onDelete,
  moveText,
}: {
  onEdit: () => void;
  onDelete: () => Promise<void>;
  moveText: string;
}) {
  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Move actions"
            className={[
              "shrink-0 rounded p-0.5 text-fg-tertiary",
              "opacity-0 transition-opacity group-hover:opacity-100",
              "focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            ].join(" ")}
          >
            <span className="font-mono text-xs">⋯</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this move?</AlertDialogTitle>
          <AlertDialogDescription>
            "{moveText.slice(0, 60)}{moveText.length > 60 ? "…" : ""}" will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onDelete()}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso));
}

function formatDay(iso: string): string {
  return DAY_FORMAT.format(new Date(iso));
}

/** Stable per-calendar-day key (year included) so the same day across years never collides. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupMovesByDay(moves: Move[]): { key: string; day: string; moves: Move[] }[] {
  const groups: { key: string; day: string; moves: Move[] }[] = [];
  for (const move of moves) {
    const key = dayKey(move.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.moves.push(move);
    } else {
      groups.push({ key, day: formatDay(move.at), moves: [move] });
    }
  }
  return groups;
}
