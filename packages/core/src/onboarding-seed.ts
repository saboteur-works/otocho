/**
 * Onboarding seed orchestration — creates the first-launch example project
 * and its three pages, exactly once. See specs/features/onboarding-example.md
 * (FR-1, FR-3, FR-5).
 *
 * The marker's presence (D-1) is authoritative for "already seeded" (FR-3):
 * a repeat call after a marker exists is a no-op, and every write goes
 * through the existing repositories — never `StoragePort` directly (FR-5).
 */
import type { BuildLogPage, NotesPage, PresetPage } from "./page";
import { buildExampleProjectSeed } from "./onboarding-seed-content";
import type { OnboardingMarker } from "./onboarding";
import type { OnboardingRepository } from "./onboarding-repository";
import type { PageRepository } from "./page-repository";
import type { ProjectRepository } from "./project-repository";

export interface SeedOnboardingExampleDeps {
  projects: ProjectRepository;
  pages: PageRepository;
  onboarding: OnboardingRepository;
}

/**
 * Seed the example project on first launch (FR-1). If an onboarding marker
 * already exists, this is a no-op — no project, no pages, no marker write
 * (FR-3). Otherwise it builds the seed content, persists the project and its
 * three pages through their repositories, and finally records the marker.
 */
export async function seedOnboardingExample(
  deps: SeedOnboardingExampleDeps,
): Promise<OnboardingMarker | null> {
  const existing = await deps.onboarding.getMarker();
  if (existing) {
    return null;
  }

  const seed = buildExampleProjectSeed();

  const project = await deps.projects.create({ name: seed.project.name });

  const notesCreated = await deps.pages.create(project.id, "notes", seed.notesPage.title);
  await deps.pages.mutate(notesCreated.id, (page) =>
    applyNotesSeed(page as NotesPage, seed.notesPage),
  );

  const buildLogCreated = await deps.pages.create(
    project.id,
    "build-log",
    seed.buildLogPage.title,
  );
  await deps.pages.mutate(buildLogCreated.id, (page) =>
    applyBuildLogSeed(page as BuildLogPage, seed.buildLogPage),
  );

  const presetsCreated = await deps.pages.create(project.id, "presets", seed.presetsPage.title);
  await deps.pages.mutate(presetsCreated.id, (page) =>
    applyPresetsSeed(page as PresetPage, seed.presetsPage),
  );

  return deps.onboarding.markSeeded(project.id);
}

/**
 * Per-install in-flight guard for {@link seedOnboardingExample} (FR-4). A
 * plain "read marker, if absent create" has a race window between two
 * concurrent callers both reading "absent" before either writes; this caches
 * the in-flight seeding promise keyed by the `deps.onboarding` repository
 * instance, so repeated calls sharing the same deps (e.g. two mounts racing
 * on first load) share one execution instead of each racing the marker
 * check. Calls with a different `deps.onboarding` instance (a different
 * install/test) get their own independent guard.
 */
const inFlight = new WeakMap<OnboardingRepository, Promise<OnboardingMarker | null>>();

/**
 * Guarded entry point for seeding (FR-4). Prefer this over calling
 * {@link seedOnboardingExample} directly from app code; it delegates to the
 * same logic but collapses concurrent callers sharing the same
 * `deps.onboarding` instance into a single in-flight execution.
 */
export function ensureOnboardingSeeded(
  deps: SeedOnboardingExampleDeps,
): Promise<OnboardingMarker | null> {
  const existing = inFlight.get(deps.onboarding);
  if (existing) {
    return existing;
  }

  const run = seedOnboardingExample(deps).finally(() => {
    if (inFlight.get(deps.onboarding) === run) {
      inFlight.delete(deps.onboarding);
    }
  });
  inFlight.set(deps.onboarding, run);
  return run;
}

function applyNotesSeed(page: NotesPage, seeded: NotesPage): NotesPage {
  return { ...page, body: seeded.body };
}

function applyBuildLogSeed(page: BuildLogPage, seeded: BuildLogPage): BuildLogPage {
  return { ...page, sketch: seeded.sketch, moves: seeded.moves };
}

function applyPresetsSeed(page: PresetPage, seeded: PresetPage): PresetPage {
  return { ...page, devices: seeded.devices };
}
