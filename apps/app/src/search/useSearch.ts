import { useEffect, useState } from "react";
import {
  buildSearchIndex,
  byOrder,
  PageRepository,
  ProjectRepository,
  searchIndex,
  type Page,
  type Project,
  type SearchResult,
} from "@otocho/core";
import { pagesRepo, projectsRepo } from "./repository";

/** Debounce delay for live-typing search, in milliseconds. */
const DEFAULT_DEBOUNCE_MS = 200;

export interface UseSearchOptions {
  projectsRepo?: ProjectRepository;
  pagesRepo?: PageRepository;
  /** Debounce delay before querying on each keystroke. Defaults to 200ms; set to 0 in tests. */
  debounceMs?: number;
}

export interface UseSearch {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  loading: boolean;
}

/**
 * Sort pages to match the ordering contract `searchIndex` relies on: grouped
 * by project in the same order `projects` is in (project recency, per
 * {@link ProjectRepository.list}), then by each page's `order` within its
 * project (see {@link byOrder}). Pages whose project isn't in `projects`
 * (e.g. it's soft-deleted) sort last — `buildSearchIndex` skips them anyway.
 */
function sortPagesForIndex(pages: Page[], projects: Project[]): Page[] {
  const projectIndex = new Map(projects.map((project, index) => [project.id, index]));
  return [...pages].sort((a, b) => {
    const aIndex = projectIndex.get(a.projectId) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = projectIndex.get(b.projectId) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return byOrder(a, b);
  });
}

/**
 * Search state across all active projects and their pages (FR-1, FR-2),
 * backed by {@link ProjectRepository} and {@link PageRepository}. Pass
 * repositories to inject storage (e.g. in tests); defaults to the app's
 * IndexedDB-backed singletons.
 *
 * An empty or whitespace-only query performs no data-fetch and returns no
 * results (FR-1, D-3).
 */
export function useSearch(options: UseSearchOptions = {}): UseSearch {
  const {
    projectsRepo: projects = projectsRepo,
    pagesRepo: pages = pagesRepo,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      // D-3: no default "recent" set, no data-fetch.
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      void (async () => {
        const [projectList, pageList] = await Promise.all([projects.list(), pages.listAll()]);
        if (cancelled) return;

        const sortedPages = sortPagesForIndex(pageList, projectList);
        const entries = buildSearchIndex(projectList, sortedPages);
        const matches = searchIndex(entries, trimmed);

        if (cancelled) return;
        setResults(matches);
        setLoading(false);
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, projects, pages, debounceMs]);

  return { query, setQuery, results, loading };
}
