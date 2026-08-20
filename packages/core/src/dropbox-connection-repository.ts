import type { StoragePort } from "@otocho/storage";
import { type DropboxConnection } from "./dropbox-connection";

const COLLECTION = "app-meta";
const CONNECTION_ID = "dropbox-connection";

export interface DropboxConnectionRepositoryDeps {
  storage: StoragePort;
  /** Clock for the `connectedAt` timestamp. Defaults to the system clock. */
  now?: () => string;
}

/**
 * Persists and retrieves the Dropbox connection marker through an injected
 * {@link StoragePort}, on the `app-meta` collection — mirroring
 * OnboardingRepository. Tokens are stored plain-text in the local record;
 * no bespoke encryption layer beyond what Dropbox itself provides.
 */
export class DropboxConnectionRepository {
  private readonly storage: StoragePort;

  constructor(deps: DropboxConnectionRepositoryDeps) {
    this.storage = deps.storage;
    // `now` is accepted for parity with OnboardingRepository's constructor
    // shape; save() persists an already-built DropboxConnection (whose
    // connectedAt is set by createDropboxConnection), so this repository has
    // no internal clock use of its own.
  }

  async get(): Promise<DropboxConnection | null> {
    return this.storage.get<DropboxConnection>(COLLECTION, CONNECTION_ID);
  }

  async save(connection: DropboxConnection): Promise<DropboxConnection> {
    await this.storage.put(COLLECTION, connection);
    return connection;
  }

  async clear(): Promise<void> {
    await this.storage.remove(COLLECTION, CONNECTION_ID);
  }
}
