import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebDropboxAuth } from "./web-dropbox-auth";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("WebDropboxAuth", () => {
  let openAuthorizeWindow: ReturnType<typeof vi.fn>;
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openAuthorizeWindow = vi.fn().mockResolvedValue("auth-code-123");
    fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "access-token-abc",
        refresh_token: "refresh-token-xyz",
        expires_in: 14400,
      }),
    );
  });

  function makeAuth(now = () => 1_000_000) {
    return new WebDropboxAuth({
      clientId: "client-xyz",
      redirectUri: "https://app.otocho.example/dropbox/callback",
      openAuthorizeWindow,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
    });
  }

  describe("buildAuthorizeUrl", () => {
    it("includes the expected PKCE authorize query params", () => {
      const auth = makeAuth();
      const url = new URL(auth.buildAuthorizeUrl("challenge-abc"));

      expect(url.origin + url.pathname).toEqual("https://www.dropbox.com/oauth2/authorize");
      expect(url.searchParams.get("client_id")).toEqual("client-xyz");
      expect(url.searchParams.get("redirect_uri")).toEqual(
        "https://app.otocho.example/dropbox/callback",
      );
      expect(url.searchParams.get("response_type")).toEqual("code");
      expect(url.searchParams.get("code_challenge")).toEqual("challenge-abc");
      expect(url.searchParams.get("code_challenge_method")).toEqual("S256");
      expect(url.searchParams.get("token_access_type")).toEqual("offline");
    });

    it("differs when constructed with a different redirect URI (dev vs deployed)", () => {
      const devAuth = new WebDropboxAuth({
        clientId: "client-xyz",
        redirectUri: "http://localhost:5173/dropbox/callback",
        openAuthorizeWindow,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const url = new URL(devAuth.buildAuthorizeUrl("challenge-abc"));
      expect(url.searchParams.get("redirect_uri")).toEqual(
        "http://localhost:5173/dropbox/callback",
      );
    });
  });

  describe("authorize", () => {
    it("drives the redirect mechanism and exchanges the returned code for tokens", async () => {
      const auth = makeAuth(() => 1_000_000);

      const tokens = await auth.authorize();

      expect(openAuthorizeWindow).toHaveBeenCalledTimes(1);
      const [authorizeUrlArg] = openAuthorizeWindow.mock.calls[0] as [string];
      expect(authorizeUrlArg).toContain("https://www.dropbox.com/oauth2/authorize");

      expect(tokens).toEqual({
        accessToken: "access-token-abc",
        refreshToken: "refresh-token-xyz",
        expiresAt: 1_000_000 + 14_400 * 1000,
      });
    });

    it("POSTs the token-exchange request in Dropbox's expected shape", async () => {
      const auth = makeAuth();

      await auth.authorize();

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(url).toEqual("https://api.dropboxapi.com/oauth2/token");
      expect(init.method).toEqual("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });

      const body = new URLSearchParams(init.body as string);
      expect(Object.fromEntries(body.entries())).toEqual({
        code: "auth-code-123",
        grant_type: "authorization_code",
        code_verifier: expect.any(String),
        client_id: "client-xyz",
        redirect_uri: "https://app.otocho.example/dropbox/callback",
      });
    });

    it("uses a fresh, high-entropy code verifier per authorize() call", async () => {
      const auth = makeAuth();

      await auth.authorize();
      const firstBody = new URLSearchParams((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);

      await auth.authorize();
      const secondBody = new URLSearchParams((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body as string);

      expect(firstBody.get("code_verifier")).not.toEqual(secondBody.get("code_verifier"));
    });

    it("throws when the token exchange response is not ok", async () => {
      fetchImpl.mockResolvedValueOnce(jsonResponse({}, false, 401));
      const auth = makeAuth();

      await expect(auth.authorize()).rejects.toThrow(/401/);
    });

    it("propagates a rejection from the redirect mechanism (e.g. a blocked popup)", async () => {
      openAuthorizeWindow.mockRejectedValueOnce(new Error("Unable to open the Dropbox authorization window"));
      const auth = makeAuth();

      await expect(auth.authorize()).rejects.toThrow(/Unable to open/);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
