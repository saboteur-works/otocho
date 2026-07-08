import { useCallback, useEffect, useState } from "react";
import { PageRepository, type Page, type PageType } from "@otocho/core";
import { pagesRepo } from "./repository";

export interface UsePages {
  pages: Page[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (type: PageType, title?: string) => Promise<Page>;
  rename: (id: string, title: string) => Promise<void>;
  reorder: (id: string, newIndex: number) => Promise<void>;
  /**
   * Apply a pure transform to a page through a serialized merge write, so
   * concurrent edits don't clobber each other (see PageRepository.mutate).
   */
  mutatePage: <P extends Page>(id: string, transform: (page: P) => P) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
}

/**
 * Page list state for a single project, backed by a {@link PageRepository}.
 * Pass a repository to inject storage (e.g. in tests); defaults to the
 * app's IndexedDB-backed one.
 */
export function usePages(
  projectId: string,
  repo: PageRepository = pagesRepo,
): UsePages {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPages(await repo.list(projectId));
    setLoading(false);
  }, [projectId, repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (type: PageType, title?: string) => {
      const page = await repo.create(projectId, type, title);
      await refresh();
      return page;
    },
    [projectId, repo, refresh],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      await repo.rename(id, title);
      await refresh();
    },
    [repo, refresh],
  );

  const reorder = useCallback(
    async (id: string, newIndex: number) => {
      // reorder returns the full, newly-ordered sibling list — use it directly
      // instead of a second full-collection read.
      setPages(await repo.reorder(id, newIndex));
    },
    [repo],
  );

  const mutatePage = useCallback(
    async <P extends Page>(id: string, transform: (page: P) => P) => {
      const updated = await repo.mutate(id, transform as unknown as (page: Page) => Page);
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [repo],
  );

  const deletePage = useCallback(
    async (id: string) => {
      await repo.delete(id);
      await refresh();
    },
    [repo, refresh],
  );

  return { pages, loading, refresh, create, rename, reorder, mutatePage, deletePage };
}
