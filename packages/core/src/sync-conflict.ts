import type { Page } from "./page";

/**
 * Pure same-page conflict detector (FR-9). Returns `true` only when BOTH the
 * local and remote copies of a page were edited (by `updatedAt`) after
 * `lastSyncedAt` — the last successfully synced checkpoint for that page id
 * (see `SyncEngine`'s internal checkpoint map). Returns `false` when only one
 * side changed since that checkpoint: an ordinary, non-conflicting update
 * that the newer side should simply overwrite the older one with.
 *
 * Whole-page `updatedAt` comparison only. This intentionally does not
 * special-case a Build log's `moves[]` append feed — a later task (Task 14)
 * merges the move feed by append-union instead of ever routing it through
 * this preserve-both conflict path. `detectConflict` itself stays
 * page-type-agnostic; it applies as-is to Notes/Presets pages and to a Build
 * log's `sketch` field, and Task 14 is expected to exclude `moves[]` from
 * whatever `updatedAt` comparison feeds this function, not to change this
 * function.
 */
export function detectConflict(local: Page, remote: Page, lastSyncedAt: string): boolean {
  return local.updatedAt > lastSyncedAt && remote.updatedAt > lastSyncedAt;
}
