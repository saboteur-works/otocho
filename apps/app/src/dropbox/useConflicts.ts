import { useCallback, useEffect, useState } from "react";
import { PageConflictRepository, PageRepository, type Page, type PageConflict } from "@otocho/core";
import { pageConflictsRepo } from "./repository";
import { pagesRepo } from "../pages/repository";

/** Which preserved side of a conflict was chosen (D-1). */
export type ConflictSide = "local" | "remote";

export interface UseConflictsOptions {
  conflictRepo?: PageConflictRepository;
  pageRepo?: PageRepository;
}

export interface UseConflicts {
  conflicts: PageConflict[];
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Resolve a pending conflict by keeping one side in full (FR-11, D-1). The
   * chosen version's fields — including its `deletedAt` tombstone state, so
   * this also handles the delete-vs-edit case (FR-16, D-2) with no special
   * casing: keeping the tombstoned side soft-deletes the page, keeping the
   * edited side clears the tombstone — becomes the page's live record via
   * `PageRepository.mutate`, and the pending conflict record is removed.
   */
  resolve: (pageId: string, side: ConflictSide) => Promise<void>;
}

/**
 * Pending same-page conflicts (Task 12's `PageConflictRepository`), with a
 * `resolve` action for the Task 15 reconciliation surface. Mirrors the other
 * Dropbox-feature hooks' shape: an options bag with injectable repositories
 * so tests pass in-memory ones instead of the app's IndexedDB-backed
 * singletons.
 */
export function useConflicts(options: UseConflictsOptions = {}): UseConflicts {
  const { conflictRepo = pageConflictsRepo, pageRepo = pagesRepo } = options;

  const [conflicts, setConflicts] = useState<PageConflict[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setConflicts(await conflictRepo.list());
    setLoading(false);
  }, [conflictRepo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resolve = useCallback(
    async (pageId: string, side: ConflictSide) => {
      const conflict = conflicts.find((c) => c.id === pageId) ?? (await conflictRepo.get(pageId));
      if (!conflict) return;
      const chosen: Page = side === "local" ? conflict.local : conflict.remote;
      // The chosen version's entire record, tombstone state included,
      // becomes the page's live content in one write.
      await pageRepo.mutate(pageId, () => chosen);
      await conflictRepo.remove(pageId);
      await refresh();
    },
    [conflictRepo, pageRepo, conflicts, refresh],
  );

  return { conflicts, loading, refresh, resolve };
}
