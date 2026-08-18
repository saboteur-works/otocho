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
