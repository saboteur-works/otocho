/**
 * Dropbox OAuth PKCE mechanics (RFC 7636) — pure, platform-agnostic.
 *
 * These helpers only compute the values a PKCE authorization-code flow
 * needs (the code verifier, its S256 challenge, and the token-exchange
 * request shape). No network call is made here — platform implementations
 * of `DropboxAuthPort` (see `dropbox-auth-port.ts`) drive the actual
 * redirect and token exchange, reusing this shared math.
 */

const UNRESERVED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * Generates a cryptographically random PKCE code verifier per RFC 7636 §4.1:
 * 43-128 characters from the unreserved character set [A-Za-z0-9-._~].
 *
 * Uses a 64-byte random source (86 base64url characters before trimming),
 * comfortably within the spec's length bounds.
 */
export function generateCodeVerifier(): string {
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);

  let verifier = "";
  for (const byte of randomBytes) {
    verifier += UNRESERVED_CHARS[byte % UNRESERVED_CHARS.length];
  }
  return verifier;
}

/**
 * Derives the PKCE code challenge from a verifier using the S256 method
 * (RFC 7636 §4.2): challenge = base64url(sha256(verifier)), no padding.
 */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Parameters needed to build a Dropbox PKCE authorization-code token exchange request. */
export interface DropboxTokenExchangeParams {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}

/**
 * The body of a Dropbox OAuth2 `/token` authorization-code-with-PKCE
 * exchange request, per Dropbox's OAuth guide and RFC 7636 §4.5. This
 * function only shapes the request payload — it does not perform the
 * network call; platform implementations POST this to Dropbox's token
 * endpoint.
 */
export function buildTokenExchangeRequest(
  params: DropboxTokenExchangeParams,
): Record<string, string> {
  return {
    code: params.code,
    grant_type: "authorization_code",
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
  };
}
