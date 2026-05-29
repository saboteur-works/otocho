import { useCallback, useEffect, useState } from "react";
import { ProjectRepository, type Project } from "@otocho/core";
import { projectsRepo } from "./repository";

export interface UseTrash {
  deleted: Project[];
  loading: boolean;
  refresh: () => Promise<void>;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
}

/** Soft-deleted projects with restore + permanent-removal actions. */
export function useTrash(repo: ProjectRepository = projectsRepo): UseTrash {
  const [deleted, setDeleted] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setDeleted(await repo.listDeleted());
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restore = useCallback(
    async (id: string) => {
      await repo.restore(id);
      await refresh();
    },
    [repo, refresh],
  );

  const purge = useCallback(
    async (id: string) => {
      await repo.purge(id);
      await refresh();
    },
    [repo, refresh],
  );

  return { deleted, loading, refresh, restore, purge };
}
