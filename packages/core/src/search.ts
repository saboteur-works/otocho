/**
 * Search index construction — pure, no I/O (FR-10, FR-11). See
 * specs/features/search.md.
 *
 * The field inventory below is fixed and closed (FR-3): it must track the
 * `Page` discriminated union in ./page.ts (see the `PageBase`/`NotesPage`/
 * `BuildLogPage`/`PresetPage` interfaces around lines 17-71) field for field.
 * If page.ts's shape changes, update this inventory to match — do not add
 * fields here beyond what FR-3 enumerates:
 *   - Notes: `body`
 *   - Build log: `sketch`, each `moves[].text`
 *   - Presets: `title` (track name), each `devices[].name`,
 *     `devices[].settings`, each `devices[].params[].key`/`.value`
 *
 * `Project.name` is never indexed as a field (D-1) — it is carried on each
 * entry only as context for display/scoping.
 */

import type { Page } from "./page";
import type { Project } from "./project";

/** Which field on a page an indexed entry was extracted from (FR-4). */
export type SearchIndexRole =
  | "body"
  | "sketch"
  | "move"
  | "track-name"
  | "device-name"
  | "device-settings"
  | "param-key"
  | "param-value";

/** One indexable field value, flattened and tagged with its origin (FR-3, FR-4). */
export interface SearchIndexEntry {
  /** The searchable text for this field. Never empty. */
  value: string;
  /** Which field this entry came from. */
  role: SearchIndexRole;
  pageId: string;
  pageTitle: string;
  projectId: string;
  /** Context only — never itself matchable (D-1). */
  projectName: string;
}

function pushEntry(
  entries: SearchIndexEntry[],
  value: string,
  role: SearchIndexRole,
  page: Page,
  project: Project,
): void {
  if (value.length === 0) return;
  entries.push({
    value,
    role,
    pageId: page.id,
    pageTitle: page.title,
    projectId: project.id,
    projectName: project.name,
  });
}

/**
 * Build a flat, role-tagged search index from projects and pages (FR-3, FR-4,
 * FR-10). Pure: takes plain arrays, returns a plain array, does no I/O and
 * mutates nothing (FR-11). Pages whose owning project is missing from
 * `projects` are skipped, since there is no project context to attach.
 */
export function buildSearchIndex(projects: Project[], pages: Page[]): SearchIndexEntry[] {
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const entries: SearchIndexEntry[] = [];

  for (const page of pages) {
    const project = projectsById.get(page.projectId);
    if (!project) continue;

    switch (page.type) {
      case "notes": {
        pushEntry(entries, page.body, "body", page, project);
        break;
      }
      case "build-log": {
        pushEntry(entries, page.sketch, "sketch", page, project);
        for (const move of page.moves) {
          pushEntry(entries, move.text, "move", page, project);
        }
        break;
      }
      case "presets": {
        pushEntry(entries, page.title, "track-name", page, project);
        for (const device of page.devices) {
          pushEntry(entries, device.name, "device-name", page, project);
          pushEntry(entries, device.settings, "device-settings", page, project);
          for (const param of device.params) {
            pushEntry(entries, param.key, "param-key", page, project);
            pushEntry(entries, param.value, "param-value", page, project);
          }
        }
        break;
      }
    }
  }

  return entries;
}

/** How many characters of context to keep on each side of a match in a snippet. */
const SNIPPET_CONTEXT_CHARS = 30;

/** One matched result, carrying everything FR-5 requires to render a row plus navigation targets. */
export interface SearchResult {
  /** A bounded excerpt of `value` around the match, for display (FR-5). */
  snippet: string;
  /** Which field the match came from (FR-5). */
  role: SearchIndexRole;
  pageId: string;
  pageTitle: string;
  projectId: string;
  projectName: string;
}

/**
 * Extract a bounded, recognizable snippet of `value` around the first
 * occurrence of `query` (case-insensitive). Adds an ellipsis when the
 * snippet is truncated on either side.
 */
function extractSnippet(value: string, query: string): string {
  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerValue.indexOf(lowerQuery);
  if (matchIndex === -1) return value;

  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(value.length, matchIndex + query.length + SNIPPET_CONTEXT_CHARS);

  const prefix = start > 0 ? "…" : "";
  const suffix = end < value.length ? "…" : "";

  return `${prefix}${value.slice(start, end)}${suffix}`;
}

/**
 * Query the index built by `buildSearchIndex` for case-insensitive substring
 * matches (FR-7). Pure and read-only: takes a plain array, returns a plain
 * array, does no I/O and mutates nothing (FR-10, FR-11).
 *
 * An empty or whitespace-only query returns no results — there is no default
 * "recent" set (D-3). Results are never grouped or truncated (FR-8, D-5):
 * they are a flat list, ordered by project recency then page order within a
 * project. `searchIndex` never reorders — it relies on `entries` already
 * being in that order end-to-end, which holds as long as `entries` was built
 * by `buildSearchIndex` from a `pages` array pre-sorted by project recency
 * then page order (the caller's responsibility).
 */
export function searchIndex(entries: SearchIndexEntry[], query: string): SearchResult[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) return [];

  const lowerQuery = trimmedQuery.toLowerCase();
  const results: SearchResult[] = [];

  for (const entry of entries) {
    if (!entry.value.toLowerCase().includes(lowerQuery)) continue;
    results.push({
      snippet: extractSnippet(entry.value, trimmedQuery),
      role: entry.role,
      pageId: entry.pageId,
      pageTitle: entry.pageTitle,
      projectId: entry.projectId,
      projectName: entry.projectName,
    });
  }

  return results;
}
