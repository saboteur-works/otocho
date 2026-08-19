import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@otocho/ui";
import { SearchResults } from "./SearchResults";
import { useSearch, type UseSearchOptions } from "./useSearch";

/**
 * Search entry point, reachable from anywhere via the shared app header
 * (FR-1). Before a query is typed, shows only the static prompt line — no
 * recent-items list, suggested content, or other data-fetch/render path
 * (FR-1, D-3). Typing drives {@link useSearch}; result rows are rendered by
 * {@link SearchResults}.
 */
export function SearchOverlay({ searchOptions }: { searchOptions?: UseSearchOptions } = {}) {
  const { query, setQuery, results, loading } = useSearch(searchOptions);
  const hasQuery = query.trim().length > 0;

  return (
    <Dialog>
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
            <SearchResults results={results} query={query} />
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
