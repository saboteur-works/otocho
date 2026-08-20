import { describe, expect, it, vi } from "vitest";
import { DropboxStorageAdapter } from "./dropbox-adapter";

interface Doc {
  id: string;
  value: string;
}

/**
 * A minimal in-memory fake of the Dropbox HTTP file API surface this
 * adapter talks to (upload / download / list_folder / list_folder/continue
 * / delete_v2). No live network call is made in these tests — `fetch` is
 * fully replaced by this fake.
 */
function createFakeDropboxFetch() {
  const files = new Map<string, string>(); // path -> raw JSON body

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;

    if (url.endsWith("/files/upload")) {
      const arg = JSON.parse(headers["Dropbox-API-Arg"]);
      files.set(arg.path, String(init?.body ?? ""));
      return new Response(JSON.stringify({ path_lower: arg.path }), { status: 200 });
    }

    if (url.endsWith("/files/download")) {
      const arg = JSON.parse(headers["Dropbox-API-Arg"]);
      const body = files.get(arg.path);
      if (body === undefined) {
        return new Response(
          JSON.stringify({ error_summary: "path/not_found/...", error: { ".tag": "path", path: { ".tag": "not_found" } } }),
          { status: 409 },
        );
      }
      return new Response(body, { status: 200 });
    }

    if (url.endsWith("/files/list_folder")) {
      const { path } = JSON.parse(String(init?.body ?? "{}"));
      const prefix = `${path}/`;
      const hasFolder = [...files.keys()].some((p) => p.startsWith(prefix));
      if (!hasFolder) {
        return new Response(
          JSON.stringify({ error_summary: "path/not_found/...", error: { ".tag": "path", path: { ".tag": "not_found" } } }),
          { status: 409 },
        );
      }
      const entries = [...files.keys()]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
        .map((p) => ({ ".tag": "file" as const, name: p.slice(prefix.length), path_lower: p }));
      return new Response(JSON.stringify({ entries, cursor: "c1", has_more: false }), { status: 200 });
    }

    if (url.endsWith("/files/list_folder/continue")) {
      return new Response(JSON.stringify({ entries: [], cursor: "c1", has_more: false }), { status: 200 });
    }

    if (url.endsWith("/files/delete_v2")) {
      const { path } = JSON.parse(String(init?.body ?? "{}"));
      if (!files.has(path)) {
        return new Response(
          JSON.stringify({
            error_summary: "path_lookup/not_found/...",
            error: { ".tag": "path_lookup", path_lookup: { ".tag": "not_found" } },
          }),
          { status: 409 },
        );
      }
      files.delete(path);
      return new Response(JSON.stringify({}), { status: 200 });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  });

  return { fetchImpl: fetchImpl as unknown as typeof fetch, files };
}

describe("DropboxStorageAdapter", () => {
  it("round-trips put / get with exact JSON fidelity", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    const record: Doc = { id: "a", value: "hello" };
    await adapter.put<Doc>("docs", record);

    expect(await adapter.get<Doc>("docs", "a")).toEqual({ id: "a", value: "hello" });
  });

  it("writes to /otocho/<collection>/<id>.json via the upload endpoint", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    await adapter.put<Doc>("projects", { id: "p1", value: "x" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://content.dropboxapi.com/2/files/upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Dropbox-API-Arg": JSON.stringify({
            path: "/otocho/projects/p1.json",
            mode: "overwrite",
            mute: true,
          }),
        }),
      }),
    );
  });

  it("list() returns multiple records for a collection, scoped to that collection's folder", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    await adapter.put<Doc>("projects", { id: "p1", value: "x" });
    await adapter.put<Doc>("projects", { id: "p2", value: "y" });
    await adapter.put<Doc>("pages", { id: "g1", value: "z" });

    const ids = (await adapter.list<Doc>("projects")).map((d) => d.id).sort();
    expect(ids).toEqual(["p1", "p2"]);
    expect(await adapter.list<Doc>("pages")).toHaveLength(1);
  });

  it("list() on a never-written collection returns an empty array", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    expect(await adapter.list<Doc>("nonexistent")).toEqual([]);
  });

  it("remove() then get() returns null", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    await adapter.put<Doc>("docs", { id: "a", value: "hello" });
    await adapter.remove("docs", "a");

    expect(await adapter.get<Doc>("docs", "a")).toBeNull();
  });

  it("remove() of a never-written record is a no-op (does not throw)", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    await expect(adapter.remove("docs", "never-existed")).resolves.toBeUndefined();
  });

  it("get() for an id that was never written returns null", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const adapter = new DropboxStorageAdapter({ getAccessToken: () => "token-1" }, fetchImpl);

    expect(await adapter.get<Doc>("docs", "never-existed")).toBeNull();
  });

  it("calls the injected access-token supplier per request", async () => {
    const { fetchImpl } = createFakeDropboxFetch();
    const getAccessToken = vi.fn().mockResolvedValue("dynamic-token");
    const adapter = new DropboxStorageAdapter({ getAccessToken }, fetchImpl);

    await adapter.put<Doc>("docs", { id: "a", value: "x" });
    await adapter.get<Doc>("docs", "a");

    expect(getAccessToken).toHaveBeenCalledTimes(2);
  });
});
