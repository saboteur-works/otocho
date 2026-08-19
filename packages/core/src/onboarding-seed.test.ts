import { beforeEach, describe, expect, it } from "vitest";
import type { StoragePort, StoredRecord } from "@otocho/storage";
import { OnboardingRepository } from "./onboarding-repository";
import { PageRepository } from "./page-repository";
import { ProjectRepository } from "./project-repository";
import { seedOnboardingExample } from "./onboarding-seed";
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
