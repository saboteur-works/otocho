import { DropboxConnectionRepository } from "@otocho/core";
import type { DropboxAuthPort } from "@otocho/storage";
import { WebStorageAdapter } from "@otocho/storage/web";
import { WebDropboxAuth } from "./web-dropbox-auth";

/** The app's shared, IndexedDB-backed Dropbox connection-marker repository. */
export const dropboxConnectionRepo = new DropboxConnectionRepository({
  storage: new WebStorageAdapter(),
});

/**
 * The app's shared `DropboxAuthPort` implementation (FR-2, FR-3). The client
 * id and redirect URI are read from Vite env vars so they can differ between
 * local dev and a deployed build without touching this file — set
 * `VITE_DROPBOX_CLIENT_ID` / `VITE_DROPBOX_REDIRECT_URI` in the app's `.env`.
 * Left unset in test/dev environments where Dropbox isn't configured; the
 * connect control still mounts, it just fails the auth call until configured.
 */
const defaultRedirectUri =
  typeof window !== "undefined" ? `${window.location.origin}/dropbox/callback` : "";

export const dropboxAuth: DropboxAuthPort = new WebDropboxAuth({
  clientId: import.meta.env.VITE_DROPBOX_CLIENT_ID ?? "",
  redirectUri: import.meta.env.VITE_DROPBOX_REDIRECT_URI ?? defaultRedirectUri,
});
