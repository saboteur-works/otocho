import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { WebStorageAdapter } from "./web-adapter";

interface Doc {
  id: string;
  value: string;
}

function freshDb(): string {
  return `otocho-test-${Math.random().toString(36).slice(2)}`;
}

describe("WebStorageAdapter", () => {
  it("round-trips put / get / remove", async () => {
    const store = new WebStorageAdapter(freshDb());
    await store.put<Doc>("docs", { id: "a", value: "hello" });
    expect(await store.get<Doc>("docs", "a")).toEqual({ id: "a", value: "hello" });

    await store.remove("docs", "a");
    expect(await store.get<Doc>("docs", "a")).toBeNull();
  });

  it("scopes list() to its collection", async () => {
    const store = new WebStorageAdapter(freshDb());
    await store.put<Doc>("projects", { id: "p1", value: "x" });
    await store.put<Doc>("projects", { id: "p2", value: "y" });
    await store.put<Doc>("pages", { id: "g1", value: "z" });

    const ids = (await store.list<Doc>("projects")).map((d) => d.id).sort();
    expect(ids).toEqual(["p1", "p2"]);
    expect(await store.list<Doc>("pages")).toHaveLength(1);
  });

  it("persists across a new adapter instance (durable)", async () => {
    const dbName = freshDb();
    await new WebStorageAdapter(dbName).put<Doc>("docs", { id: "a", value: "kept" });

    const reopened = new WebStorageAdapter(dbName);
    expect(await reopened.get<Doc>("docs", "a")).toEqual({ id: "a", value: "kept" });
  });
});
