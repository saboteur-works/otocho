// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DropboxConnectionRepository, SyncEngine, createDropboxConnection } from "@otocho/core";
import type { DropboxTokens } from "@otocho/storage";
import { MemoryStorage } from "../testing/memory-storage";
import { useSyncStatus } from "./useSyncStatus";

const TOKENS: DropboxTokens = {
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-xyz",
  expiresAt: 1_000_000,
};

describe("useSyncStatus", () => {
  let repo: DropboxConnectionRepository;

  beforeEach(() => {
    repo = new DropboxConnectionRepository({ storage: new MemoryStorage() });
  });

  it("starts not visible while the initial connection read is loading", () => {
    const { result } = renderHook(() => useSyncStatus({ repo, engine: null }));
    expect(result.current.visible).toBe(false);
  });

  it("is visible with a disconnected cause when no DropboxConnection marker exists (FR-12, FR-13, D-6)", async () => {
    const { result } = renderHook(() => useSyncStatus({ repo, engine: null }));

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.cause).toBe("disconnected");
  });

  it("is not visible when connected and the injected engine reports synced", async () => {
    await repo.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });

    const { result } = renderHook(() => useSyncStatus({ repo, engine }));

    await waitFor(() => expect(result.current.visible).toBe(false));
  });

  it("is visible with the injected engine's specific cause once it fails (FR-13, D-6)", async () => {
    await repo.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });
    vi.spyOn(engine, "getStatus").mockReturnValue({ synced: false, cause: "out-of-space" });

    const { result } = renderHook(() => useSyncStatus({ repo, engine, pollIntervalMs: 5 }));

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.cause).toBe("out-of-space");
  });

  it("is visible with no further cause when the injected engine's failure isn't classifiable (D-6)", async () => {
    await repo.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });
    vi.spyOn(engine, "getStatus").mockReturnValue({ synced: false });

    const { result } = renderHook(() => useSyncStatus({ repo, engine }));

    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.cause).toBeUndefined();
  });

  it("retryNow() calls the injected engine's retryNow", async () => {
    await repo.save(createDropboxConnection("account-1", TOKENS));
    const engine = new SyncEngine({ local: new MemoryStorage(), remote: new MemoryStorage() });
    const retryNowSpy = vi.spyOn(engine, "retryNow").mockResolvedValue(undefined);

    const { result } = renderHook(() => useSyncStatus({ repo, engine }));
    await waitFor(() => expect(result.current.visible).toBe(false));

    await act(async () => {
      await result.current.retryNow();
    });

    expect(retryNowSpy).toHaveBeenCalledTimes(1);
  });

  it("retryNow() is a no-op while disconnected (no engine to retry against)", async () => {
    const { result } = renderHook(() => useSyncStatus({ repo, engine: null }));
    await waitFor(() => expect(result.current.cause).toBe("disconnected"));

    // Should resolve without throwing, and without a retryable engine to call.
    await act(async () => {
      await result.current.retryNow();
    });
  });
});
