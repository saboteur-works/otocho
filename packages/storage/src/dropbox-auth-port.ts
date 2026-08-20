/**
 * DropboxAuthPort — the OAuth PKCE connect seam (FR-2, FR-3). One
 * implementation per platform, mirroring how `StoragePort` (`port.ts`) is
 * one persistence implementation per platform.
 *
 * The interface makes no assumption about *how* the authorization redirect
 * happens: a web implementation might open a hosted redirect URI in the
 * current window/a popup, while desktop/mobile implementations register a
 * custom scheme or universal link. Nothing here hardcodes a
 * loopback-localhost redirect — that choice belongs entirely to each
 * platform's implementation of `authorize()`.
 */
export interface DropboxTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds at which `accessToken` expires. */
  expiresAt: number;
}

export interface DropboxAuthPort {
  /**
   * Runs the platform's OAuth PKCE authorization-code flow end to end
   * (redirect, user consent, and token exchange) and resolves with the
   * resulting tokens. Implementations own their own redirect handling;
   * callers of this port never need to know which mechanism was used.
   */
  authorize(): Promise<DropboxTokens>;
}
