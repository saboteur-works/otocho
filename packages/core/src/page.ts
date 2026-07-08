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

/** Options for pure content transforms that only stamp `updatedAt`. */
export type TransformOptions = { now?: () => string };

/**
 * Edit an existing move's text (FR-7). The move keeps its id and original
 * timestamp; only the text changes. Empty text is rejected. Pure; a no-op if
 * no move matches `moveId`.
 */
export function editMove(
  page: BuildLogPage,
  moveId: string,
  text: string,
  options: TransformOptions = {},
): BuildLogPage {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("A move requires text.");
  }
  if (!page.moves.some((m) => m.id === moveId)) return page;
  return {
    ...page,
    moves: page.moves.map((m) => (m.id === moveId ? { ...m, text: trimmed } : m)),
    updatedAt: (options.now ?? nowIso)(),
  };
}

/** Remove a move from the feed. Pure; a no-op if `moveId` is absent. */
export function removeMove(
  page: BuildLogPage,
  moveId: string,
  options: TransformOptions = {},
): BuildLogPage {
  if (!page.moves.some((m) => m.id === moveId)) return page;
  return {
    ...page,
    moves: page.moves.filter((m) => m.id !== moveId),
    updatedAt: (options.now ?? nowIso)(),
  };
}

export type NewPresetDeviceInput = { name?: string; settings?: string; params?: PresetParam[] };

/** Create a device for a preset chain. Deterministic id via the options bag. */
export function createPresetDevice(
  input: NewPresetDeviceInput = {},
  options: { id?: string } = {},
): PresetDevice {
  return {
    id: options.id ?? newId(),
    name: (input.name ?? "").trim() || "New device",
    settings: input.settings ?? "",
    params: input.params ?? [],
  };
}

/** Append a device to the chain (FR-8). Pure. */
export function addDevice(
  page: PresetPage,
  device: PresetDevice,
  options: TransformOptions = {},
): PresetPage {
  return { ...page, devices: [...page.devices, device], updatedAt: (options.now ?? nowIso)() };
}

/** Patch a device's own fields (name/settings). Pure; a no-op if absent. */
export function updateDevice(
  page: PresetPage,
  deviceId: string,
  patch: Partial<Omit<PresetDevice, "id">>,
  options: TransformOptions = {},
): PresetPage {
  if (!page.devices.some((d) => d.id === deviceId)) return page;
  return {
    ...page,
    devices: page.devices.map((d) => (d.id === deviceId ? { ...d, ...patch } : d)),
    updatedAt: (options.now ?? nowIso)(),
  };
}

/** Remove a device from the chain. Pure; a no-op if absent. */
export function removeDevice(
  page: PresetPage,
  deviceId: string,
  options: TransformOptions = {},
): PresetPage {
  if (!page.devices.some((d) => d.id === deviceId)) return page;
  return {
    ...page,
    devices: page.devices.filter((d) => d.id !== deviceId),
    updatedAt: (options.now ?? nowIso)(),
  };
}

/**
 * Move device `fromId` to the current position of `toId` in the chain (FR-8).
 * Pure; a no-op if either id is missing or they're already the same position.
 */
export function reorderDevices(
  page: PresetPage,
  fromId: string,
  toId: string,
  options: TransformOptions = {},
): PresetPage {
  const from = page.devices.findIndex((d) => d.id === fromId);
  const to = page.devices.findIndex((d) => d.id === toId);
  if (from === -1 || to === -1 || from === to) return page;
  const devices = [...page.devices];
  const [moved] = devices.splice(from, 1);
  devices.splice(to, 0, moved);
  return { ...page, devices, updatedAt: (options.now ?? nowIso)() };
}

export type NewPresetParamInput = { key?: string; value?: string };

/** Create a key=value parameter row. Deterministic id via the options bag. */
export function createPresetParam(
  input: NewPresetParamInput = {},
  options: { id?: string } = {},
): PresetParam {
  return { id: options.id ?? newId(), key: input.key ?? "", value: input.value ?? "" };
}

/** Append a parameter row to a device. Pure; a no-op if the device is absent. */
export function addParam(
  page: PresetPage,
  deviceId: string,
  param: PresetParam,
  options: TransformOptions = {},
): PresetPage {
  return mapDeviceParams(page, deviceId, (params) => [...params, param], options);
}

/** Patch a parameter's key/value. Pure; a no-op if device or param is absent. */
export function updateParam(
  page: PresetPage,
  deviceId: string,
  paramId: string,
  patch: Partial<Omit<PresetParam, "id">>,
  options: TransformOptions = {},
): PresetPage {
  return mapDeviceParams(
    page,
    deviceId,
    (params) =>
      params.some((p) => p.id === paramId)
        ? params.map((p) => (p.id === paramId ? { ...p, ...patch } : p))
        : params,
    options,
  );
}

/** Remove a parameter row from a device. Pure; a no-op if absent. */
export function removeParam(
  page: PresetPage,
  deviceId: string,
  paramId: string,
  options: TransformOptions = {},
): PresetPage {
  return mapDeviceParams(
    page,
    deviceId,
    (params) =>
      params.some((p) => p.id === paramId) ? params.filter((p) => p.id !== paramId) : params,
    options,
  );
}

function mapDeviceParams(
  page: PresetPage,
  deviceId: string,
  fn: (params: PresetParam[]) => PresetParam[],
  options: TransformOptions,
): PresetPage {
  const device = page.devices.find((d) => d.id === deviceId);
  if (!device) return page;
  const params = fn(device.params);
  if (params === device.params) return page;
  return {
    ...page,
    devices: page.devices.map((d) => (d.id === deviceId ? { ...d, params } : d)),
    updatedAt: (options.now ?? nowIso)(),
  };
}
