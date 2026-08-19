import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@otocho/ui";
import type { SearchResult } from "@otocho/core";
import { SearchResults } from "./SearchResults";
import { useSearch, type UseSearchOptions } from "./useSearch";

/**
 * Search entry point, reachable from anywhere via the shared app header
 * (FR-1). Before a query is typed, shows only the static prompt line — no
 * recent-items list, suggested content, or other data-fetch/render path
 * (FR-1, D-3). Typing drives {@link useSearch}; result rows are rendered by
 * {@link SearchResults}.
 */
export interface SearchOverlayProps {
  searchOptions?: UseSearchOptions;
}

export function SearchOverlay({ searchOptions }: SearchOverlayProps = {}) {
  const { query, setQuery, results, loading } = useSearch(searchOptions);
  const hasQuery = query.trim().length > 0;
  const navigate = useNavigate();
  // Controlled so selecting a result can close the overlay from here (FR-6),
  // in addition to Radix's own Escape/overlay-click dismissal.
  const [open, setOpen] = useState(false);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    navigate(`/projects/${result.projectId}?page=${result.pageId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-mono text-xs uppercase tracking-label text-fg-tertiary hover:text-fg-primary"
        >
          Search
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl gap-4">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Input
          autoFocus
          type="text"
          placeholder="Search projects and pages…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {hasQuery ? (
          loading ? (
            <p className="text-sm text-fg-secondary">Searching…</p>
          ) : (
            <SearchResults results={results} query={query} onSelect={handleSelect} />
          )
        ) : (
          <p className="text-sm text-fg-secondary">
            Type to search your projects and pages.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
