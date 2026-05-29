/**
 * Project — the organizing spine of Otocho. See docs/features/projects/spec.md.
 * Identity is the stable `id`; `name` is mutable and may collide across projects.
 */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  /** Soft-delete marker; null when active. Restorable until permanent removal. */
  deletedAt: string | null;
}

export type NewProjectInput = {
  name: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** Generate a stable, name-independent identifier via the Web Crypto global
 * (available in browsers, Node 19+, Deno, Bun) — no platform lib assumed. */
export function newProjectId(): string {
  return (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
}

export type CreateProjectOptions = {
  /** Override the generated id (e.g. for deterministic tests). */
  id?: string;
  /** Override the clock used for the creation timestamps. */
  now?: () => string;
};

export function createProject(
  input: NewProjectInput,
  options: CreateProjectOptions = {},
): Project {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Project name is required.");
  }
  const ts = (options.now ?? nowIso)();
  return {
    id: options.id ?? newProjectId(),
    name,
    createdAt: ts,
    updatedAt: ts,
    lastOpenedAt: ts,
    deletedAt: null,
  };
}

export function isDeleted(project: Project): boolean {
  return project.deletedAt !== null;
}

/** Most-recently-opened first; the default list order (FR-4). */
export function byRecency(a: Project, b: Project): number {
  return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
}
