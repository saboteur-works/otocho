import { describe, expect, it } from "vitest";
import {
  buildTokenExchangeRequest,
  deriveCodeChallenge,
  generateCodeVerifier,
} from "./dropbox-pkce";

describe("generateCodeVerifier", () => {
  it("produces a verifier within RFC 7636's 43-128 character bounds", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("only uses the unreserved character set [A-Za-z0-9-._~]", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("generates a different verifier on each call", () => {
    expect(generateCodeVerifier()).not.toEqual(generateCodeVerifier());
  });
});

describe("deriveCodeChallenge", () => {
  it("matches the RFC 7636 appendix B worked example (S256)", async () => {
    // https://www.rfc-editor.org/rfc/rfc7636#appendix-B
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    await expect(deriveCodeChallenge(verifier)).resolves.toEqual(expectedChallenge);
  });

  it("produces a base64url string with no padding", async () => {
    const challenge = await deriveCodeChallenge(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain("=");
  });

  it("is deterministic for the same verifier", async () => {
    const verifier = generateCodeVerifier();
    const first = await deriveCodeChallenge(verifier);
    const second = await deriveCodeChallenge(verifier);
    expect(first).toEqual(second);
  });

  it("produces different challenges for different verifiers", async () => {
    const a = await deriveCodeChallenge(generateCodeVerifier());
    const b = await deriveCodeChallenge(generateCodeVerifier());
    expect(a).not.toEqual(b);
  });
});

describe("buildTokenExchangeRequest", () => {
  it("shapes the Dropbox PKCE authorization-code exchange body", () => {
    const request = buildTokenExchangeRequest({
      code: "auth-code-123",
      codeVerifier: "verifier-abc",
      clientId: "client-xyz",
      redirectUri: "https://example.com/dropbox/callback",
    });

    expect(request).toEqual({
      code: "auth-code-123",
      grant_type: "authorization_code",
      code_verifier: "verifier-abc",
      client_id: "client-xyz",
      redirect_uri: "https://example.com/dropbox/callback",
    });
  });
});
