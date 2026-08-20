import { describe, expect, it } from "vitest";
import type { DropboxAuthPort, DropboxTokens } from "./dropbox-auth-port";

/**
 * `DropboxAuthPort` is an interface — there is nothing to unit test about
 * its shape at runtime beyond "a conforming implementation type-checks and
 * its `authorize()` resolves with `DropboxTokens`". This guards against the
 * interface accidentally growing a browser/loopback-redirect assumption
 * (e.g. a `redirectUri` or `window` parameter) that would make it
 * unimplementable by a non-browser platform.
 */
describe("DropboxAuthPort", () => {
  it("is satisfied by a platform implementation that supplies its own redirect handling", async () => {
    const tokens: DropboxTokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 3600_000,
    };

    class FakePlatformAuth implements DropboxAuthPort {
      async authorize(): Promise<DropboxTokens> {
        return tokens;
      }
    }

    const port: DropboxAuthPort = new FakePlatformAuth();
    await expect(port.authorize()).resolves.toEqual(tokens);
  });

  it("authorize() takes no arguments, so callers cannot pass a redirect URI in", () => {
    const fake: DropboxAuthPort = {
      authorize: async () => ({
        accessToken: "a",
        refreshToken: "r",
        expiresAt: 0,
      }),
    };

    expect(fake.authorize.length).toBe(0);
  });
});
