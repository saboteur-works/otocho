/**
 * Dropbox connection marker — records whether this device is connected to a
 * Dropbox account for BYOS sync, and with which tokens. See
 * specs/features/dropbox-sync.md.
 *
 * Mirrors the onboarding-seed marker pattern (onboarding.ts): a small
 * `{ id, ... }` type + factory, persisted on the shared `app-meta`
 * collection via a thin repository (dropbox-connection-repository.ts).
 */
import type { DropboxTokens } from "@otocho/storage";

export interface DropboxConnection {
  id: "dropbox-connection";
  connectedAt: string;
  accountId: string;
  tokens: DropboxTokens;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type CreateDropboxConnectionOptions = {
  /** Override the clock used for the `connectedAt` timestamp. */
  now?: () => string;
};

export function createDropboxConnection(
  accountId: string,
  tokens: DropboxTokens,
  options: CreateDropboxConnectionOptions = {},
): DropboxConnection {
  const trimmed = accountId.trim();
  if (trimmed.length === 0) {
    throw new Error("A Dropbox connection requires an accountId.");
  }
  const ts = (options.now ?? nowIso)();
  return {
    id: "dropbox-connection",
    connectedAt: ts,
    accountId: trimmed,
    tokens,
  };
}
