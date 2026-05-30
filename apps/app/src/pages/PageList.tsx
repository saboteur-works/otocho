import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ClipboardList,
  FileText,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@otocho/ui";
import { PAGE_TYPES, type Page, type PageType } from "@otocho/core";

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  notes: "Notes",
  "build-log": "Build log",
  presets: "Presets",
};

const PAGE_TYPE_ICONS: Record<PageType, React.ElementType> = {
  notes: FileText,
  "build-log": ClipboardList,
  presets: SlidersHorizontal,
};

export interface PageListProps {
  pages: Page[];
  selectedId: string | null;
  onSelect: (page: Page) => void;
  onCreate: (type: PageType) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function PageList({
  pages,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: PageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startRename(page: Page) {
    setDraft(page.title);
    setEditingId(page.id);
  }

  function submitRename(e: FormEvent, id: string) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length > 0) onRename(id, trimmed);
    setEditingId(null);
  }

  function cancelRename() {
    setEditingId(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") cancelRename();
  }

  return (
    <nav aria-label="Pages" className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
          Pages
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-fg-tertiary hover:text-fg-primary"
              aria-label="Add page"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PAGE_TYPES.map((type) => {
              const Icon = PAGE_TYPE_ICONS[type];
              return (
                <DropdownMenuItem key={type} onClick={() => onCreate(type)}>
                  <Icon className="h-3.5 w-3.5 text-fg-tertiary" />
                  {PAGE_TYPE_LABELS[type]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {pages.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-fg-tertiary">No pages yet.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {pages.map((page) => {
            const Icon = PAGE_TYPE_ICONS[page.type];
            const isActive = page.id === selectedId;
            const isEditing = page.id === editingId;

            return (
              <li key={page.id}>
                {isEditing ? (
                  <form
                    onSubmit={(e) => submitRename(e, page.id)}
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <Input
                      aria-label="Page title"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={onKeyDown}
                      onBlur={() => cancelRename()}
                      className="h-6 py-0 text-xs"
                    />
                  </form>
                ) : (
                  <div
                    className={[
                      "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      "transition-colors",
                      isActive
                        ? "border-l-2 border-fg-primary bg-surface-hover pl-[6px] text-fg-primary"
                        : "border-l-2 border-transparent pl-[6px] text-fg-secondary hover:bg-surface-hover hover:text-fg-primary",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                      onClick={() => onSelect(page)}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-fg-tertiary" />
                      <span className="truncate">{page.title}</span>
                    </button>

                    <PageRowMenu
                      onRename={() => startRename(page)}
                      onDelete={() => onDelete(page.id)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

function PageRowMenu({
  onRename,
  onDelete,
}: {
  onRename: () => void;
  onDelete: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Page actions"
          className={[
            "flex-shrink-0 rounded p-0.5 text-fg-tertiary",
            "opacity-0 transition-opacity",
            "group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100",
            "hover:text-fg-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
