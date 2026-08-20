import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import { OnboardingRepository } from "./onboarding-repository";
import { PageRepository } from "./page-repository";
import { ProjectRepository } from "./project-repository";
import { ensureOnboardingSeeded, seedOnboardingExample } from "./onboarding-seed";
import type { BuildLogPage, PresetPage } from "./page";

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

describe("seedOnboardingExample", () => {
  let storage: MemoryStorage;
  let projects: ProjectRepository;
  let pages: PageRepository;
  let onboarding: OnboardingRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    projects = new ProjectRepository({ storage });
    pages = new PageRepository({ storage });
    onboarding = new OnboardingRepository({ storage });
  });

  it("creates one project, three pages (one per type), and a marker on first call", async () => {
    const marker = await seedOnboardingExample({ projects, pages, onboarding });
    expect(marker).not.toBeNull();

    const allProjects = await projects.list();
    expect(allProjects).toHaveLength(1);
    const project = allProjects[0];
    expect(marker!.exampleProjectId).toBe(project.id);

    const projectPages = await pages.list(project.id);
    expect(projectPages).toHaveLength(3);

    const notesPage = projectPages.find((p) => p.type === "notes");
    const buildLogPage = projectPages.find((p) => p.type === "build-log") as
      | BuildLogPage
      | undefined;
    const presetsPage = projectPages.find((p) => p.type === "presets") as
      | PresetPage
      | undefined;

    expect(notesPage).toBeDefined();
    expect(buildLogPage).toBeDefined();
    expect(presetsPage).toBeDefined();

    expect(notesPage!.type === "notes" && notesPage!.body.trim().length).toBeGreaterThan(0);

    expect(buildLogPage!.sketch.trim().length).toBeGreaterThan(0);
    expect(buildLogPage!.moves.length).toBeGreaterThanOrEqual(1);
    for (const move of buildLogPage!.moves) {
      expect(move.text.trim().length).toBeGreaterThan(0);
    }

    expect(presetsPage!.devices.length).toBeGreaterThanOrEqual(1);
    const device = presetsPage!.devices[0];
    expect(device.name.trim().length).toBeGreaterThan(0);
    expect(device.params.length).toBeGreaterThanOrEqual(1);
    const param = device.params[0];
    expect(param.key.trim().length).toBeGreaterThan(0);
    expect(param.value.trim().length).toBeGreaterThan(0);

    const storedMarker = await onboarding.getMarker();
    expect(storedMarker).not.toBeNull();
    expect(storedMarker!.exampleProjectId).toBe(project.id);
  });

  it("is a no-op on a second sequential call after the marker exists (FR-3)", async () => {
    await seedOnboardingExample({ projects, pages, onboarding });

    const result = await seedOnboardingExample({ projects, pages, onboarding });
    expect(result).toBeNull();

    const allProjects = await projects.list();
    expect(allProjects).toHaveLength(1);

    const projectPages = await pages.list(allProjects[0].id);
    expect(projectPages).toHaveLength(3);

    // No marker overwrite: only one write, still pointing at the original project.
    const marker = await onboarding.getMarker();
    expect(marker).not.toBeNull();
    expect(marker!.exampleProjectId).toBe(allProjects[0].id);
  });
});

describe("ensureOnboardingSeeded (FR-4 concurrency guard)", () => {
  let storage: MemoryStorage;
  let projects: ProjectRepository;
  let pages: PageRepository;
  let onboarding: OnboardingRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    projects = new ProjectRepository({ storage });
    pages = new PageRepository({ storage });
    onboarding = new OnboardingRepository({ storage });
  });

  it("collapses concurrent calls sharing the same deps into a single seed", async () => {
    const deps = { projects, pages, onboarding };

    // Fire both calls without awaiting the first, so both race the marker
    // check before either write has landed.
    const [first, second, third] = await Promise.all([
      ensureOnboardingSeeded(deps),
      ensureOnboardingSeeded(deps),
      ensureOnboardingSeeded(deps),
    ]);

    // Exactly one caller observes the created marker; the guard means every
    // caller actually shares the same in-flight execution and its result.
    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(first).not.toBeNull();

    const allProjects = await projects.list();
    expect(allProjects).toHaveLength(1);

    const projectPages = await pages.list(allProjects[0].id);
    expect(projectPages).toHaveLength(3);

    const marker = await onboarding.getMarker();
    expect(marker).not.toBeNull();
    expect(marker!.exampleProjectId).toBe(allProjects[0].id);
  });

  it("gives calls with a different deps.onboarding instance their own independent guard", async () => {
    const otherStorage = new MemoryStorage();
    const otherDeps = {
      projects: new ProjectRepository({ storage: otherStorage }),
      pages: new PageRepository({ storage: otherStorage }),
      onboarding: new OnboardingRepository({ storage: otherStorage }),
    };
    const deps = { projects, pages, onboarding };

    const [own, other] = await Promise.all([
      ensureOnboardingSeeded(deps),
      ensureOnboardingSeeded(otherDeps),
    ]);

    expect(own).not.toBeNull();
    expect(other).not.toBeNull();
    expect(own!.exampleProjectId).not.toBe(other!.exampleProjectId);

    expect(await projects.list()).toHaveLength(1);
    expect(await otherDeps.projects.list()).toHaveLength(1);
  });
});

describe("onboarding example project is ordinary data (FR-3, FR-8)", () => {
  let storage: MemoryStorage;
  let projects: ProjectRepository;
  let pages: PageRepository;
  let onboarding: OnboardingRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    projects = new ProjectRepository({ storage });
    pages = new PageRepository({ storage });
    onboarding = new OnboardingRepository({ storage });
  });

  it("supports rename, page add/reorder/soft-delete, project soft-delete, restore, and purge identically to a user project, and purge never resurrects the seed", async () => {
    const marker = await seedOnboardingExample({ projects, pages, onboarding });
    expect(marker).not.toBeNull();
    const exampleProjectId = marker!.exampleProjectId;

    // rename() — same behavior/return shape as ProjectRepository.test.ts's
    // "renames in place" case: name + updatedAt change, id + createdAt don't.
    const before = await projects.get(exampleProjectId);
    expect(before).not.toBeNull();
    const renamed = await projects.rename(exampleProjectId, "My renamed project");
    expect(renamed.id).toBe(exampleProjectId);
    expect(renamed.createdAt).toBe(before!.createdAt);
    expect(renamed.name).toBe("My renamed project");
    expect(renamed.updatedAt >= before!.updatedAt).toBe(true);

    // PageRepository add — same shape as page-repository.test.ts's "creates a
    // page and reads it back": ascending order, correct projectId/type.
    const existingPages = await pages.list(exampleProjectId);
    expect(existingPages).toHaveLength(3);
    const added = await pages.create(exampleProjectId, "notes", "Extra notes");
    expect(added.projectId).toBe(exampleProjectId);
    expect(added.type).toBe("notes");
    expect(added.order).toBe(existingPages[existingPages.length - 1].order + 1);

    let currentPages = await pages.list(exampleProjectId);
    expect(currentPages).toHaveLength(4);

    // PageRepository.reorder — move the newly-added page to the front, same
    // as page-repository.test.ts's "moves a page to a new index" case.
    const reordered = await pages.reorder(added.id, 0);
    expect(reordered[0].id).toBe(added.id);
    expect(reordered.map((p) => p.order)).toEqual([0, 1, 2, 3]);

    // PageRepository.softDelete — same as page-repository.test.ts's
    // "softDelete sets the tombstone without removing the underlying
    // record" case.
    const softDeleted = await pages.softDelete(added.id);
    expect(softDeleted.deletedAt).not.toBeNull();
    expect(await pages.get(added.id)).not.toBeNull();
    currentPages = await pages.list(exampleProjectId);
    expect(currentPages).toHaveLength(3);

    // ProjectRepository.softDelete / restore — same as project-repository
    // .test.ts's "soft-deletes, then restores" case.
    const deleted = await projects.softDelete(exampleProjectId);
    expect(deleted.deletedAt).not.toBeNull();
    expect(await projects.get(exampleProjectId)).not.toBeNull();
    expect((await projects.listDeleted()).map((p) => p.id)).toEqual([exampleProjectId]);
    expect(await projects.list()).toHaveLength(0);

    const restored = await projects.restore(exampleProjectId);
    expect(restored.deletedAt).toBeNull();
    expect((await projects.list()).map((p) => p.id)).toEqual([exampleProjectId]);

    // ProjectRepository.purge — same as project-repository.test.ts's
    // "purges permanently" case.
    await projects.softDelete(exampleProjectId);
    await projects.purge(exampleProjectId);
    expect(await projects.get(exampleProjectId)).toBeNull();
    expect(await projects.listDeleted()).toHaveLength(0);

    // FR-3/D-4: the marker, not the project's existence, gates seeding — a
    // full purge of the example project must never cause re-seeding.
    const secondSeedResult = await seedOnboardingExample({ projects, pages, onboarding });
    expect(secondSeedResult).toBeNull();
    expect(await projects.list()).toHaveLength(0);

    const finalMarker = await onboarding.getMarker();
    expect(finalMarker).not.toBeNull();
    expect(finalMarker!.exampleProjectId).toBe(exampleProjectId);
  });
});
