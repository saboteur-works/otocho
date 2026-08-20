import { Link } from "react-router-dom";
import type { Page } from "@otocho/core";
import { Button } from "@otocho/ui";
import { useConflicts, type ConflictSide, type UseConflictsOptions } from "./useConflicts";

export interface ConflictResolutionProps {
  conflictsOptions?: UseConflictsOptions;
}

/**
 * FR-11 / D-1's in-app conflict-resolution surface, reachable at `/conflicts`.
 * Lists every pending `PageConflict` and shows both preserved versions of the
 * page side by side in full, each with its own "keep this one" action. Also
 * handles the FR-16 / D-2 delete-vs-edit case with no special UI: a
 * tombstoned side is labeled "Deleted" and choosing it soft-deletes the page,
 * same as choosing any other side keeps that side's full content (including
 * its `deletedAt` state) — see {@link useConflicts}.
 */
export function ConflictResolution({ conflictsOptions }: ConflictResolutionProps = {}) {
  const { conflicts, loading, resolve } = useConflicts(conflictsOptions);

  if (loading) return null;

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/"
        className="font-mono text-xs uppercase tracking-label text-fg-tertiary hover:text-fg-primary"
      >
        ← All projects
      </Link>

      <h2 className="font-display text-2xl font-bold tracking-heading text-fg-primary">
        Conflicts
      </h2>

      {conflicts.length === 0 ? (
        <p className="text-fg-tertiary">No pending conflicts.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {conflicts.map((conflict) => (
            <li
              key={conflict.id}
              className="flex flex-col gap-3 rounded-md border border-brand-rule bg-brand-black p-4"
            >
              <p className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
                {conflict.local.title || conflict.remote.title}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <VersionCard
                  side="local"
                  page={conflict.local}
                  onKeep={() => void resolve(conflict.id, "local")}
                />
                <VersionCard
                  side="remote"
                  page={conflict.remote}
                  onKeep={() => void resolve(conflict.id, "remote")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface VersionCardProps {
  side: ConflictSide;
  page: Page;
  onKeep: () => void;
}

function VersionCard({ side, page, onKeep }: VersionCardProps) {
  const label = side === "local" ? "Local" : "Remote";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-brand-rule p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
          {label}
          {page.deletedAt ? " — deleted" : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Keep ${label.toLowerCase()} version`}
          onClick={onKeep}
        >
          Keep this one
        </Button>
      </div>
      <p className="text-fg-secondary">{page.title}</p>
      <pre className="whitespace-pre-wrap break-words text-xs text-fg-tertiary">
        {JSON.stringify(pageContent(page), null, 2)}
      </pre>
    </div>
  );
}

/** The full content fields for a page's type, for the D-1 side-by-side view. */
function pageContent(page: Page): unknown {
  switch (page.type) {
    case "notes":
      return { body: page.body };
    case "build-log":
      return { sketch: page.sketch, moves: page.moves };
    case "presets":
      return { devices: page.devices };
  }
}
