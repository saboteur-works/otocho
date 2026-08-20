import { describe, expect, it } from "vitest";
import { createDropboxConnection } from "./dropbox-connection";

const tokens = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.UTC(2026, 0, 1),
};

describe("createDropboxConnection", () => {
  it("creates a connection marker with the given accountId and tokens", () => {
    const connection = createDropboxConnection("account-1", tokens, {
      now: () => "2026-01-01T00:00:00.000Z",
    });
    expect(connection).toEqual({
      id: "dropbox-connection",
      connectedAt: "2026-01-01T00:00:00.000Z",
      accountId: "account-1",
      tokens,
    });
  });

  it("trims the accountId", () => {
    const connection = createDropboxConnection("  account-1  ", tokens);
    expect(connection.accountId).toBe("account-1");
  });

  it("throws when accountId is empty", () => {
    expect(() => createDropboxConnection("   ", tokens)).toThrow();
  });

  it("defaults to the system clock for connectedAt", () => {
    const connection = createDropboxConnection("account-1", tokens);
    expect(() => new Date(connection.connectedAt)).not.toThrow();
    expect(Number.isNaN(new Date(connection.connectedAt).getTime())).toBe(false);
  });
});
