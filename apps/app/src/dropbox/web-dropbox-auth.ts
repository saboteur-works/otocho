/**
 * `WebDropboxAuth` — the web build's `DropboxAuthPort` implementation
 * (FR-2, FR-3). Drives the full PKCE authorization-code round trip: builds
 * Dropbox's authorize URL from Task 2's PKCE helpers, hands off to an
 * injectable redirect mechanism to capture the `code` Dropbox returns, and
 * exchanges that code for tokens via Dropbox's token endpoint.
 *
 * The OAuth redirect URI is supplied by the caller (not hardcoded) so it can
 * differ between local dev and a deployed build, per FR-3 — this class makes
 * no assumption about which host it's running on.
 */
import type { DropboxAuthPort, DropboxTokens } from "@otocho/storage";
import { buildTokenExchangeRequest, deriveCodeChallenge, generateCodeVerifier } from "@otocho/storage";

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";

/** Shape of a successful response from Dropbox's `/oauth2/token` endpoint. */
interface DropboxTokenResponse {
  access_token: string;
  refresh_token: string;
  /** Seconds until `access_token` expires, per Dropbox's OAuth guide. */
  expires_in: number;
}

export interface WebDropboxAuthConfig {
  clientId: string;
  /**
   * The OAuth redirect URI this app is registered under with Dropbox. Must
   * differ between local dev and a deployed build, so it is supplied here
   * rather than hardcoded.
   */
  redirectUri: string;
  /**
   * Starts the platform redirect mechanism for `authorizeUrl` and resolves
   * with the `code` query param once Dropbox has redirected back into the
   * app. Defaults to a popup window that the app's redirect route posts the
   * code back from via `window.opener.postMessage`. Injectable so tests can
   * stub the redirect round trip without a real browser navigation.
   */
  openAuthorizeWindow?: (authorizeUrl: string) => Promise<string>;
  /** Injectable `fetch` implementation, defaulting to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable clock, defaulting to `Date.now`. */
  now?: () => number;
}

/**
 * Web platform implementation of `DropboxAuthPort` (see
 * `packages/storage/src/dropbox-auth-port.ts`). Constructed with the app's
 * Dropbox client id and its registered redirect URI.
 */
export class WebDropboxAuth implements DropboxAuthPort {
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly openAuthorizeWindow: (authorizeUrl: string) => Promise<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(config: WebDropboxAuthConfig) {
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
    this.openAuthorizeWindow = config.openAuthorizeWindow ?? defaultOpenAuthorizeWindow;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? Date.now;
  }

  async authorize(): Promise<DropboxTokens> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    const authorizeUrl = this.buildAuthorizeUrl(codeChallenge);

    const code = await this.openAuthorizeWindow(authorizeUrl);

    return this.exchangeCodeForTokens(code, codeVerifier);
  }

  /** Exposed for testing the exact PKCE authorize URL this class builds. */
  buildAuthorizeUrl(codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      // Required by Dropbox to receive a refresh_token alongside the
      // short-lived access token — DropboxTokens always carries both.
      token_access_type: "offline",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<DropboxTokens> {
    const body = buildTokenExchangeRequest({
      code,
      codeVerifier,
      clientId: this.clientId,
      redirectUri: this.redirectUri,
    });

    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      throw new Error(`Dropbox token exchange failed with status ${response.status}`);
    }

    const payload = (await response.json()) as DropboxTokenResponse;

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: this.now() + payload.expires_in * 1000,
    };
  }
}

/**
 * Default redirect mechanism: opens a popup on `authorizeUrl` and waits for
 * the app's redirect route (loaded inside that popup once Dropbox redirects
 * back to `redirectUri`) to post the captured `code` back via
 * `window.opener.postMessage({ source: "otocho-dropbox-auth", code })`.
 */
function defaultOpenAuthorizeWindow(authorizeUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(authorizeUrl, "otocho-dropbox-auth", "width=480,height=720");
    if (!popup) {
      reject(new Error("Unable to open the Dropbox authorization window (popup blocked?)."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; code?: string } | undefined;
      if (!data || data.source !== "otocho-dropbox-auth" || !data.code) {
        return;
      }
      window.removeEventListener("message", handleMessage);
      popup.close();
      resolve(data.code);
    };

    window.addEventListener("message", handleMessage);
  });
}
