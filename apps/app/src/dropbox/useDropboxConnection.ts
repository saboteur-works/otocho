import { useCallback, useEffect, useState } from "react";
import {
  createDropboxConnection,
  type DropboxConnection,
  DropboxConnectionRepository,
  SyncEngine,
  type SyncEngineDeps,
} from "@otocho/core";
import { DropboxStorageAdapter, type DropboxAuthPort, type DropboxTokens, type StoragePort } from "@otocho/storage";
import { WebStorageAdapter } from "@otocho/storage/web";
import { dropboxAuth, dropboxConnectionRepo } from "./repository";

/** Collections migrated into Dropbox on first connection (FR-4, FR-5). */
const MIGRATED_COLLECTIONS = ["projects", "pages"];

/** The app's shared, IndexedDB-backed local storage port, used as the
 * migration push's local side (default; tests inject `MemoryStorage`). */
const defaultLocalStorage = new WebStorageAdapter();

const ACCOUNT_URL = "https://api.dropboxapi.com/2/users/get_current_account";

/** Shape of the fields this app reads from Dropbox's `get_current_account`. */
interface DropboxAccountResponse {
  account_id: string;
}

/**
 * Resolves the Dropbox account id for the given tokens, so the connection
 * marker (`DropboxConnection.accountId`) records which account is connected.
 * Exposed so callers (tests, `useDropboxConnection`) can inject a stub
 * `fetch` instead of hitting the real Dropbox API.
 */
export async function fetchDropboxAccountId(
  tokens: DropboxTokens,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(ACCOUNT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: "null",
  });

  if (!response.ok) {
    throw new Error(`Dropbox account lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as DropboxAccountResponse;
  return payload.account_id;
}

export interface UseDropboxConnectionOptions {
  repo?: DropboxConnectionRepository;
  auth?: DropboxAuthPort;
  /** Injectable so tests can stub the Dropbox account-lookup HTTP call. */
  resolveAccountId?: (tokens: DropboxTokens) => Promise<string>;
  /** The local `StoragePort` migrated projects/pages are read from. Defaults
   * to the app's shared `WebStorageAdapter`; tests inject `MemoryStorage`. */
  localStorage?: StoragePort;
  /** Injectable so tests can stub the `SyncEngine` construction and observe
   * (or fail) `pushCollection` without a real Dropbox connection. */
  createSyncEngine?: (deps: SyncEngineDeps) => SyncEngine;
}

export interface UseDropboxConnection {
  /** `null` before any connection is loaded/present, or after disconnect. */
  connection: DropboxConnection | null;
  /** `true` until the initial `repo.get()` read resolves. */
  loading: boolean;
  /** `true` while an `authorize()` round trip is in flight. */
  connecting: boolean;
  /** Set when the last `connect()` attempt failed; cleared on the next attempt. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Wraps {@link DropboxConnectionRepository} for the connect/disconnect UI
 * (FR-2, FR-15). `connect()` drives the injected `DropboxAuthPort`'s full
 * OAuth PKCE round trip, resolves the connected account id, and persists the
 * resulting `DropboxConnection` marker. `disconnect()` only clears that
 * marker (`DropboxConnectionRepository.clear()`) — per D-4, local project/page
 * data is the continuous source of truth and is never touched here.
 */
export function useDropboxConnection(options: UseDropboxConnectionOptions = {}): UseDropboxConnection {
  const {
    repo = dropboxConnectionRepo,
    auth = dropboxAuth,
    resolveAccountId = fetchDropboxAccountId,
    localStorage = defaultLocalStorage,
    createSyncEngine = (deps: SyncEngineDeps) => new SyncEngine(deps),
  } = options;

  const [connection, setConnection] = useState<DropboxConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void repo.get().then((existing) => {
      if (!cancelled) {
        setConnection(existing);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repo]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const tokens = await auth.authorize();
      const accountId = await resolveAccountId(tokens);
      const saved = await repo.save(createDropboxConnection(accountId, tokens));
      setConnection(saved);

      // Migrate existing local projects/pages into Dropbox via the ordinary
      // sync path (FR-4, FR-5, D-3): no bespoke migration function, progress
      // UI, or rollback — a push that's interrupted partway just leaves the
      // unsent records "not yet synced", to be picked up by the same
      // retry/interval mechanism as any other sync gap.
      const remote = new DropboxStorageAdapter({
        getAccessToken: () => saved.tokens.accessToken,
      });
      // `pushCollection` doesn't require the engine to be `start()`ed (that
      // only gates the debounce/pull loop, out of scope here — a later task
      // wires an app-lifetime engine for ongoing sync); constructing it is
      // enough to drive this one-off migration push.
      const engine = createSyncEngine({ local: localStorage, remote });
      await Promise.allSettled(
        MIGRATED_COLLECTIONS.map((collection) => engine.pushCollection(collection)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Dropbox.");
    } finally {
      setConnecting(false);
    }
  }, [auth, createSyncEngine, localStorage, repo, resolveAccountId]);

  const disconnect = useCallback(async () => {
    await repo.clear();
    setConnection(null);
  }, [repo]);

  return { connection, loading, connecting, error, connect, disconnect };
}
