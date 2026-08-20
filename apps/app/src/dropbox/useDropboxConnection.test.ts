// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  DropboxConnectionRepository,
  SyncEngine,
  createDropboxConnection,
  createPage,
  createProject,
  type SyncEngineDeps,
} from "@otocho/core";
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

  it("connect() migrates every pre-existing local project and page into Dropbox (end to end, via a real SyncEngine)", async () => {
    const auth = makeAuth();
    const resolveAccountId = vi.fn().mockResolvedValue("account-42");

    const localStorage = new MemoryStorage();
    const project = createProject({ name: "My Project" });
    await localStorage.put("projects", project);
    const page = createPage("notes", { projectId: project.id });
    await localStorage.put("pages", page);

    // Swap the hook's `DropboxStorageAdapter` remote for an in-memory one so
    // the push's effect can be observed without hitting the network — the
    // hook still constructs the real remote and passes it through untouched.
    const remoteStorage = new MemoryStorage();
    const createSyncEngine = vi
      .fn()
      .mockImplementation((deps: SyncEngineDeps) => new SyncEngine({ ...deps, remote: remoteStorage }));

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId, localStorage, createSyncEngine }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(createSyncEngine).toHaveBeenCalledWith(
      expect.objectContaining({ local: localStorage }),
    );
    expect(await remoteStorage.list("projects")).toEqual([project]);
    expect(await remoteStorage.list("pages")).toEqual([page]);
  });

  it("connect() pushes every pre-existing local project and page via SyncEngine.pushCollection, for both collections", async () => {
    const auth = makeAuth();
    const resolveAccountId = vi.fn().mockResolvedValue("account-42");

    const localStorage = new MemoryStorage();
    const project = createProject({ name: "My Project" });
    await localStorage.put("projects", project);
    const page = createPage("notes", { projectId: project.id });
    await localStorage.put("pages", page);

    const pushCollection = vi.fn().mockResolvedValue(undefined);
    const createSyncEngine = vi.fn().mockReturnValue({ pushCollection } as unknown as SyncEngine);

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId, localStorage, createSyncEngine }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(pushCollection).toHaveBeenCalledWith("projects");
    expect(pushCollection).toHaveBeenCalledWith("pages");
    expect(pushCollection).toHaveBeenCalledTimes(2);
  });

  it("a partially-failed migration push leaves all local records untouched (no rollback, no special error path)", async () => {
    const auth = makeAuth();
    const resolveAccountId = vi.fn().mockResolvedValue("account-42");

    const localStorage = new MemoryStorage();
    const project = createProject({ name: "My Project" });
    await localStorage.put("projects", project);
    const page = createPage("notes", { projectId: project.id });
    await localStorage.put("pages", page);

    // Simulate the push failing partway through (e.g. the "pages" push fails
    // after "projects" already succeeded).
    const pushCollection = vi.fn().mockImplementation((collection: string) => {
      if (collection === "pages") {
        return Promise.reject(new Error("network interrupted"));
      }
      return Promise.resolve();
    });
    const createSyncEngine = vi.fn().mockReturnValue({ pushCollection } as unknown as SyncEngine);

    const { result } = renderHook(() =>
      useDropboxConnection({ repo, auth, resolveAccountId, localStorage, createSyncEngine }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    // The connection itself still succeeded (migration failure isn't a
    // special-cased error path per D-3) and local data is untouched.
    expect(result.current.connection?.accountId).toBe("account-42");
    expect(await localStorage.list("projects")).toEqual([project]);
    expect(await localStorage.list("pages")).toEqual([page]);
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
