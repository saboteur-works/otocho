/**
 * Page — a purpose-built document inside a project. See
 * docs/features/pages/spec.md and docs/features/pages/design/.
 *
 * Pages are a discriminated union over `type`. All share a base (identity,
 * owning project, title, sibling order, timestamps); each type adds its own
 * content. One record per page mirrors the file-per-page sync model so future
 * conflicts (a later feature) stay page-scoped.
 */

export type PageType = "notes" | "build-log" | "presets";

/** The three MVP page types, in the order the add-page menu offers them (FR-3). */
export const PAGE_TYPES: readonly PageType[] = ["notes", "build-log", "presets"];

interface PageBase {
  id: string;
  /** Owning project's stable id. */
  projectId: string;
  type: PageType;
  /** Rail label; for a Preset page this is the track name (design: title === track). */
  title: string;
  /** Sort key within a project. Reorder rewrites this, never array position. */
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Free-form text. The lowest-friction page. */
export interface NotesPage extends PageBase {
  type: "notes";
  body: string;
}

/** A single timestamped entry in a Build log's append-only move feed (FR-6/7). */
export interface Move {
  id: string;
  /** ISO timestamp captured at append. */
  at: string;
  text: string;
}

/** Arrangement/idea sketch plus an append-only, timestamped move feed (FR-6). */
export interface BuildLogPage extends PageBase {
  type: "build-log";
  sketch: string;
  moves: Move[];
}

/** A key=value parameter row on a device. Both sides are free text (units live in `value`). */
export interface PresetParam {
  id: string;
  key: string;
  value: string;
}

/** One device in a preset's ordered signal chain. `settings`/`params` are optional content. */
export interface PresetDevice {
  id: string;
  name: string;
  /** Optional free-text settings; "" when unused. */
  settings: string;
  /** Optional structured rows; [] when unused. */
  params: PresetParam[];
}

/** Track-scoped device chain (FR-8). The track name is the page `title`. */
export interface PresetPage extends PageBase {
  type: "presets";
  devices: PresetDevice[];
}

export type Page = NotesPage | BuildLogPage | PresetPage;

const DEFAULT_TITLES: Record<PageType, string> = {
  notes: "Notes",
  "build-log": "Build log",
  presets: "New track",
};

function nowIso(): string {
  return new Date().toISOString();
}

/** Stable, name-independent id via the Web Crypto global (browser, Node 19+, Deno, Bun). */
export function newId(): string {
  return (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
}

export type NewPageInput = {
  projectId: string;
  /** Optional starting title; falls back to a per-type default. */
  title?: string;
  /** Sibling sort key; the repository assigns this (append at end). Defaults to 0. */
  order?: number;
};

export type CreatePageOptions = {
  /** Override the generated id (e.g. for deterministic tests). */
  id?: string;
  /** Override the clock used for the creation timestamps. */
  now?: () => string;
};

function pageBase(
  type: PageType,
  input: NewPageInput,
  options: CreatePageOptions,
): PageBase {
  if (input.projectId.trim().length === 0) {
    throw new Error("A page requires an owning projectId.");
  }
  const ts = (options.now ?? nowIso)();
  const title = (input.title ?? "").trim() || DEFAULT_TITLES[type];
  return {
    id: options.id ?? newId(),
    projectId: input.projectId,
    type,
    title,
    order: input.order ?? 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function createNotesPage(input: NewPageInput, options: CreatePageOptions = {}): NotesPage {
  return { ...pageBase("notes", input, options), type: "notes", body: "" };
}

export function createBuildLogPage(
  input: NewPageInput,
  options: CreatePageOptions = {},
): BuildLogPage {
  return { ...pageBase("build-log", input, options), type: "build-log", sketch: "", moves: [] };
}

export function createPresetPage(
  input: NewPageInput,
  options: CreatePageOptions = {},
): PresetPage {
  return { ...pageBase("presets", input, options), type: "presets", devices: [] };
}

/** Create a page of any type (e.g. from the add-page dropdown). */
export function createPage(
  type: PageType,
  input: NewPageInput,
  options: CreatePageOptions = {},
): Page {
  switch (type) {
    case "notes":
      return createNotesPage(input, options);
    case "build-log":
      return createBuildLogPage(input, options);
    case "presets":
      return createPresetPage(input, options);
  }
}

/** Sibling order within a project; ties broken by creation order. The list order (FR-3). */
export function byOrder(a: Page, b: Page): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Append a move to a Build log's feed (FR-7). Pure: returns a new page.
 * Appended moves carry a stable id and an auto-captured timestamp, and are
 * never reordered. Empty text is rejected.
 */
export function appendMove(
  page: BuildLogPage,
  text: string,
  options: CreatePageOptions = {},
): BuildLogPage {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("A move requires text.");
  }
  const at = (options.now ?? nowIso)();
  const move: Move = { id: options.id ?? newId(), at, text: trimmed };
  return { ...page, moves: [...page.moves, move], updatedAt: at };
}
