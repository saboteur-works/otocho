import type { StoragePort } from "@otocho/storage";
import type { Page } from "./page";

const COLLECTION = "page-conflicts";

/**
 * A pending same-page conflict (FR-9, FR-10, Task 11/12): `SyncEngine`
 * detects that both the local and remote copies of a page changed since the
 * last synced checkpoint, and rather than silently overwriting either side,
 * records both versions here so a later resolution step (Task 15) can offer
 * the user a choice. Keyed by page id — at most one pending conflict per
 * page at a time; a fresh conflict on the same page overwrites the prior
 * record via `save`.
 */
export interface PageConflict {
  id: string;
  local: Page;
  remote: Page;
  detectedAt: string;
}

export interface PageConflictRepositoryDeps {
  storage: StoragePort;
  /** Clock for callers that want a default `detectedAt`. Not used directly
   * by this repository — `SyncEngine` stamps `detectedAt` itself — but kept
   * for parity with the other `*Repository` constructor shapes. */
  now?: () => string;
}

/**
 * Persists and retrieves pending page conflicts through an injected
 * {@link StoragePort}, on its own `page-conflicts` collection (not
 * `app-meta` — unlike the onboarding-seed/Dropbox-connection markers, there
 * can be many pending conflicts at once, one per conflicted page id, so this
 * repository is a plain multi-record collection rather than a single
 * fixed-id marker).
 */
export class PageConflictRepository {
  private readonly storage: StoragePort;

  constructor(deps: PageConflictRepositoryDeps) {
    this.storage = deps.storage;
    // `now` is accepted for parity with the other repository constructor
    // shapes; every PageConflict this repository persists is already fully
    // built (including `detectedAt`) by the caller, so this repository has
    // no internal clock use of its own.
  }

  async save(conflict: PageConflict): Promise<PageConflict> {
    await this.storage.put(COLLECTION, conflict);
    return conflict;
  }

  async get(pageId: string): Promise<PageConflict | null> {
    return this.storage.get<PageConflict>(COLLECTION, pageId);
  }

  async list(): Promise<PageConflict[]> {
    return this.storage.list<PageConflict>(COLLECTION);
  }

  async remove(pageId: string): Promise<void> {
    await this.storage.remove(COLLECTION, pageId);
  }
}
