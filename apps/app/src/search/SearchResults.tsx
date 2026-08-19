import type { SearchIndexRole, SearchResult } from "@otocho/core";

export interface SearchResultsProps {
  /** Matches from `searchIndex`, already in display order (FR-8, D-4) — never re-sorted here. */
  results: SearchResult[];
  /** The query the results were computed for, used to render the no-match message. */
  query: string;
}

/** Human-readable label for each `SearchIndexRole` (display-only — the underlying role tag is untouched). */
const ROLE_LABELS: Record<SearchIndexRole, string> = {
  body: "Body",
  sketch: "Sketch",
  move: "Move",
  "track-name": "Track name",
  "device-name": "Device name",
  "device-settings": "Device settings",
  "param-key": "Param key",
  "param-value": "Param value",
};

/**
 * The search overlay's results surface: a flat list of matches, one row per
 * result, in the order `searchIndex` returns (FR-8, D-4 — no grouping, no
 * re-sorting). Every row shows the owning project name, the page title, a
 * human-readable match role label, and the matched snippet (FR-4, FR-5). No
 * pagination, truncation, or cap: the full result set always renders (FR-8,
 * D-5). When there are no matches, shows the terse no-match line (FR-5, D-2).
 */
export function SearchResults({ results, query }: SearchResultsProps) {
  if (results.length === 0) {
    return <p className="text-fg-tertiary">No matches for &quot;{query}&quot;.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {results.map((result, index) => (
        <li
          key={`${result.pageId}-${result.role}-${index}`}
          className="rounded-md border border-brand-rule bg-brand-black px-4 py-3 text-left"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-fg-tertiary">
            <span>
              {result.projectName} · {result.pageTitle}
            </span>
            <span className="font-mono uppercase tracking-label">
              {ROLE_LABELS[result.role]}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-secondary">{result.snippet}</p>
        </li>
      ))}
    </ul>
  );
}
