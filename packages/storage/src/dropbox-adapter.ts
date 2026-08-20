import type { StoragePort, StoredRecord } from "./port";

const APP_ROOT = "/otocho";

const UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";
const LIST_FOLDER_URL = "https://api.dropboxapi.com/2/files/list_folder";
const LIST_FOLDER_CONTINUE_URL = "https://api.dropboxapi.com/2/files/list_folder/continue";
const DELETE_URL = "https://api.dropboxapi.com/2/files/delete_v2";

export interface DropboxAccessTokenSupplier {
  getAccessToken(): string | Promise<string>;
}

interface DropboxListFolderEntry {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  path_lower?: string;
}

interface DropboxListFolderResult {
  entries: DropboxListFolderEntry[];
  cursor: string;
  has_more: boolean;
}

/**
 * Dropbox-backed {@link StoragePort} implementation (FR-6). Stores one JSON
 * file per record at `/otocho/<collection>/<id>.json`, mirroring
 * `WebStorageAdapter`'s file-per-record model but against Dropbox's HTTP
 * file API instead of IndexedDB.
 *
 * Deliberately not wired into any app-level repository singleton — only the
 * sync engine talks to this adapter. Token lifecycle (refresh-on-expiry) is
 * out of scope here: `getAccessToken()` is called fresh for every request,
 * and callers own keeping it valid.
 */
export class DropboxStorageAdapter implements StoragePort {
  constructor(
    private readonly tokens: DropboxAccessTokenSupplier,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    return this.tokens.getAccessToken();
  }

  private recordPath(collection: string, id: string): string {
    return `${APP_ROOT}/${collection}/${id}.json`;
  }

  private folderPath(collection: string): string {
    return `${APP_ROOT}/${collection}`;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Dropbox request to ${url} failed (${response.status}): ${body}`);
    }
    return response;
  }

  async put<T extends StoredRecord>(collection: string, record: T): Promise<void> {
    const token = await this.accessToken();
    await this.request(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: this.recordPath(collection, record.id),
          mode: "overwrite",
          mute: true,
        }),
      },
      body: JSON.stringify(record),
    });
  }

  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | null> {
    const token = await this.accessToken();
    let response: Response;
    try {
      response = await this.fetchImpl(DOWNLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: this.recordPath(collection, id) }),
        },
      });
    } catch {
      return null;
    }
    if (response.status === 409) {
      // Dropbox returns 409 with a path/not_found error for a missing file.
      return null;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Dropbox request to ${DOWNLOAD_URL} failed (${response.status}): ${body}`);
    }
    const text = await response.text();
    return JSON.parse(text) as T;
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    const token = await this.accessToken();
    const path = this.folderPath(collection);

    let result: DropboxListFolderResult;
    try {
      const response = await this.request(LIST_FOLDER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path, recursive: false }),
      });
      result = (await response.json()) as DropboxListFolderResult;
    } catch (error) {
      // A collection folder that doesn't exist yet (no records ever put)
      // yields an empty list, matching WebStorageAdapter's contract.
      if (error instanceof Error && /path\/not_found/.test(error.message)) {
        return [];
      }
      throw error;
    }

    const entries: DropboxListFolderEntry[] = [...result.entries];
    let cursor = result.cursor;
    let hasMore = result.has_more;
    while (hasMore) {
      const response = await this.request(LIST_FOLDER_CONTINUE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cursor }),
      });
      const page = (await response.json()) as DropboxListFolderResult;
      entries.push(...page.entries);
      cursor = page.cursor;
      hasMore = page.has_more;
    }

    const ids = entries
      .filter((entry) => entry[".tag"] === "file" && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -".json".length));

    const records = await Promise.all(ids.map((id) => this.get<T>(collection, id)));
    return records.filter((record) => record !== null) as T[];
  }

  async remove(collection: string, id: string): Promise<void> {
    const token = await this.accessToken();
    try {
      await this.request(DELETE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: this.recordPath(collection, id) }),
      });
    } catch (error) {
      // Removing a record that was never written is a no-op, matching
      // WebStorageAdapter's delete-of-missing-key contract.
      if (error instanceof Error && /path_lookup\/not_found|path\/not_found/.test(error.message)) {
        return;
      }
      throw error;
    }
  }
}
