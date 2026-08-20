// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DropboxConnectionRepository, createDropboxConnection } from "@otocho/core";
import type { DropboxAuthPort, DropboxTokens } from "@otocho/storage";
import { MemoryStorage } from "../testing/memory-storage";
import { useDropboxConnection } from "./useDropboxConnection";

const TOKENS: DropboxTokens = {
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-xyz",
  expiresAt: 1_000_000,
};

function makeAuth(overrides: Partial<DropboxAuthPort> = {}): DropboxAuthPort {
  return {
    authorize: vi.fn().mockResolvedValue(TOKENS),
    ...overrides,
  };
}

describe("useDropboxConnection", () => {
  let repo: DropboxConnectionRepository;

  beforeEach(() => {
    repo = new DropboxConnectionRepository({ storage: new MemoryStorage() });
  });

  it("starts with no connection and loading true, then loading false once the initial read resolves", async () => {
    const auth = makeAuth();
    const resolveAccountId = vi.fn();

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.connection).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.connection).toBeNull();
  });

  it("loads an existing connection marker from the repo", async () => {
    const existing = createDropboxConnection("account-1", TOKENS);
    await repo.save(existing);
    const auth = makeAuth();

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId: vi.fn() }),
    );

    await waitFor(() => expect(result.current.connection).toEqual(existing));
  });

  it("connect() runs the auth flow, resolves the account id, and persists the connection", async () => {
    const auth = makeAuth();
    const resolveAccountId = vi.fn().mockResolvedValue("account-42");

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(auth.authorize).toHaveBeenCalledTimes(1);
    expect(resolveAccountId).toHaveBeenCalledWith(TOKENS);
    expect(result.current.connection?.accountId).toBe("account-42");
    expect(result.current.connecting).toBe(false);

    const persisted = await repo.get();
    expect(persisted?.accountId).toBe("account-42");
  });

  it("connect() surfaces an error and leaves no connection when authorize() rejects", async () => {
    const auth = makeAuth({ authorize: vi.fn().mockRejectedValue(new Error("popup blocked")) });
    const resolveAccountId = vi.fn();

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBe("popup blocked");
    expect(result.current.connection).toBeNull();
    expect(resolveAccountId).not.toHaveBeenCalled();
  });

  it("disconnect() clears the connection marker via the repo, without touching anything else", async () => {
    const existing = createDropboxConnection("account-1", TOKENS);
    await repo.save(existing);
    const auth = makeAuth();

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId: vi.fn() }),
    );
    await waitFor(() => expect(result.current.connection).toEqual(existing));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connection).toBeNull();
    expect(await repo.get()).toBeNull();
  });
});
