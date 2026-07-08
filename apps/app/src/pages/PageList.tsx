import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  onReorder: (id: string, newIndex: number) => void;
}

export function PageList({
  pages,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: PageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Mirrors editingId synchronously so the blur fired when the input unmounts
  // (on Escape or after a submit) can tell it has already finished and not
  // re-commit a cancelled or duplicate rename.
  const editingIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small threshold distinguishes a drag from a click-to-open.
      activationConstraint: { distance: 6 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = pages.findIndex((p) => p.id === active.id);
    const toIndex = pages.findIndex((p) => p.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(String(active.id), toIndex);
    }
  }

  function startRename(page: Page) {
    editingIdRef.current = page.id;
    setDraft(page.title);
    setEditingId(page.id);
  }

  // Ends the current edit exactly once. `commit` saves the draft; the ref guard
  // ignores the second call (the unmount blur) so Escape truly cancels and a
  // submit doesn't write twice.
  function finishRename(id: string, commit: boolean) {
    if (editingIdRef.current !== id) return;
    editingIdRef.current = null;
    if (commit) {
      const trimmed = draft.trim();
      if (trimmed.length > 0) onRename(id, trimmed);
    }
    setEditingId(null);
  }

  function submitRename(e: FormEvent, id: string) {
    e.preventDefault();
    finishRename(id, true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && editingId) finishRename(editingId, false);
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-0.5">
              {pages.map((page) => (
                <SortablePageRow
                  key={page.id}
                  page={page}
                  isActive={page.id === selectedId}
                  isEditing={page.id === editingId}
                  draft={draft}
                  onSelect={onSelect}
                  onRename={startRename}
                  onDelete={onDelete}
                  onDraftChange={setDraft}
                  onSubmitRename={submitRename}
                  onKeyDown={onKeyDown}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </nav>
  );
}

interface SortablePageRowProps {
  page: Page;
  isActive: boolean;
  isEditing: boolean;
  draft: string;
  onSelect: (page: Page) => void;
  onRename: (page: Page) => void;
  onDelete: (id: string) => void;
  onDraftChange: (v: string) => void;
  onSubmitRename: (e: FormEvent, id: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

function SortablePageRow({
  page,
  isActive,
  isEditing,
  draft,
  onSelect,
  onRename,
  onDelete,
  onDraftChange,
  onSubmitRename,
  onKeyDown,
}: SortablePageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const Icon = PAGE_TYPE_ICONS[page.type];

  return (
    <li ref={setNodeRef} style={style}>
      {isEditing ? (
        <form
          onSubmit={(e) => onSubmitRename(e, page.id)}
          className="flex items-center gap-1 px-2 py-1"
        >
          <Input
            aria-label="Page title"
            autoFocus
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => onSubmitRename({ preventDefault: () => {} } as FormEvent, page.id)}
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
          {/* Drag handle — entire row is draggable via listeners/attributes */}
          <span
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab touch-none text-fg-tertiary active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripIcon />
          </span>

          <button
            type="button"
            className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            onClick={() => onSelect(page)}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-fg-tertiary" />
            <span className="truncate">{page.title}</span>
          </button>

          <PageRowMenu onRename={() => onRename(page)} onDelete={() => onDelete(page.id)} />
        </div>
      )}
    </li>
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

function GripIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3.5" cy="3" r="1" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="9" r="1" />
      <circle cx="8.5" cy="3" r="1" />
      <circle cx="8.5" cy="6" r="1" />
      <circle cx="8.5" cy="9" r="1" />
    </svg>
  );
}
