import { useCallback, useEffect, useState } from "react";
import { ProjectRepository, type Project } from "@otocho/core";
import { projectsRepo } from "./repository";

export interface UseProjects {
  projects: Project[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Project>;
}

/**
 * Project list state backed by a {@link ProjectRepository}. Pass a repository
 * to inject storage (e.g. in tests); defaults to the app's IndexedDB-backed one.
 */
export function useProjects(repo: ProjectRepository = projectsRepo): UseProjects {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setProjects(await repo.list());
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string) => {
      const project = await repo.create({ name });
      await refresh();
      return project;
    },
    [repo, refresh],
  );

  return { projects, loading, refresh, create };
}
