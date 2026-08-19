import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import { OnboardingRepository } from "./onboarding-repository";

/** In-memory StoragePort fake for fast, deterministic repository tests. */
class MemoryStorage implements StoragePort {
  private data = new Map<string, Map<string, StoredRecord>>();

  private bucket(collection: string): Map<string, StoredRecord> {
    let b = this.data.get(collection);
    if (!b) {
      b = new Map();
      this.data.set(collection, b);
    }
    return b;
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    return [...this.bucket(collection).values()].map((r) => ({ ...r }) as T);
  }
  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | null> {
    const r = this.bucket(collection).get(id);
    return r ? ({ ...r }) as T : null;
  }
  async put<T extends StoredRecord>(collection: string, record: T): Promise<void> {
    this.bucket(collection).set(record.id, { ...record });
  }
  async remove(collection: string, id: string): Promise<void> {
    this.bucket(collection).delete(id);
  }
}

function fixtures() {
  let tick = 0;
  const base = Date.UTC(2026, 0, 1);
  const now = () => new Date(base + tick++ * 1000).toISOString();
  return { now };
}

function makeRepo(storage: StoragePort = new MemoryStorage()) {
  return new OnboardingRepository({ storage, ...fixtures() });
}

describe("OnboardingRepository", () => {
  let repo: OnboardingRepository;

  beforeEach(() => {
    repo = makeRepo();
  });

  it("returns null for getMarker() on a fresh store", async () => {
    expect(await repo.getMarker()).toBeNull();
  });

  it("markSeeded persists and returns the exact shape", async () => {
    const marker = await repo.markSeeded("project-1");
    expect(marker).toEqual({
      id: "onboarding-seed",
      seededAt: expect.any(String),
      exampleProjectId: "project-1",
    });
  });

  it("round-trips the same record through a second getMarker() call", async () => {
    const marker = await repo.markSeeded("project-1");
    const fetched = await repo.getMarker();
    expect(fetched).toEqual(marker);
  });
});

describe("OnboardingRepository reload across restart", () => {
  it("reads a marked-seeded record back from a fresh repository over the same store", async () => {
    const storage = new MemoryStorage();
    const marker = await new OnboardingRepository({ storage, ...fixtures() }).markSeeded(
      "project-1",
    );

    const reloaded = await new OnboardingRepository({ storage }).getMarker();
    expect(reloaded).toEqual(marker);
  });
});
