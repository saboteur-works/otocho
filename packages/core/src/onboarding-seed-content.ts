/**
 * Example project seed content — the first-launch onboarding example.
 * See specs/features/onboarding-example.md (FR-1, FR-5, FR-6, D-2).
 *
 * Pure: builds a `Project` and its three `Page`s in memory using only the
 * existing core factories/transforms (`createProject`, `createNotesPage`/
 * `createBuildLogPage`/`createPresetPage`, `appendMove`, `createPresetDevice`
 * + `addDevice`, `createPresetParam` + `addParam`) — never by hand-
 * constructing a `Page`/`Project` object. Callers (the seed orchestration,
 * Task 3) are responsible for persisting the result through the real
 * repositories.
 */
import {
  addDevice,
  addParam,
  appendMove,
  createBuildLogPage,
  createNotesPage,
  createPresetDevice,
  createPresetPage,
  createPresetParam,
  type BuildLogPage,
  type NotesPage,
  type PresetPage,
} from "./page";
import { createProject, type Project } from "./project";

const EXAMPLE_PROJECT_NAME = "Midnight Drive — example";

function nowIso(): string {
  return new Date().toISOString();
}

function defaultGenerateId(): string {
  return (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
}

export type BuildExampleProjectSeedOptions = {
  /** Override the clock used for every timestamp in the seed. */
  now?: () => string;
  /** Override the id generator used for every id in the seed. */
  generateId?: () => string;
};

export interface ExampleProjectSeed {
  project: Project;
  notesPage: NotesPage;
  buildLogPage: BuildLogPage;
  presetsPage: PresetPage;
}

/**
 * Assemble the example project and its three pages, deterministically when
 * `now`/`generateId` are injected. Content dramatizes the durable-memory
 * hook (FR-6): the DAW project file was lost, and this notebook is the only
 * surviving record of the session.
 */
export function buildExampleProjectSeed(
  options: BuildExampleProjectSeedOptions = {},
): ExampleProjectSeed {
  const now = options.now ?? nowIso;
  const generateId = options.generateId ?? defaultGenerateId;

  const project = createProject(
    { name: EXAMPLE_PROJECT_NAME },
    { id: generateId(), now },
  );

  const notesPage = createNotesPageWithBody(project.id, now, generateId);
  const buildLogPage = createBuildLogPageWithMoves(project.id, now, generateId);
  const presetsPage = createPresetsPageWithDevice(project.id, now, generateId);

  return { project, notesPage, buildLogPage, presetsPage };
}

function createNotesPageWithBody(
  projectId: string,
  now: () => string,
  generateId: () => string,
): NotesPage {
  const base = createNotesPage(
    { projectId, title: "Notes", order: 0 },
    { id: generateId(), now },
  );
  return {
    ...base,
    body:
      "My laptop got swapped at a session last week and the Midnight Drive " +
      "Ableton project went with it — no backup, no stems. This notebook is " +
      "the only surviving record of that session. Everything I remembered " +
      "about the arrangement and the Lead synth patch is written down below " +
      "so I can rebuild it from scratch if the file never turns up.",
  };
}

function createBuildLogPageWithMoves(
  projectId: string,
  now: () => string,
  generateId: () => string,
): BuildLogPage {
  let page = createBuildLogPage(
    { projectId, title: "Build log", order: 1 },
    { id: generateId(), now },
  );
  page = {
    ...page,
    sketch:
      "Slow-building night-drive groove: four-on-the-floor kick, a wide " +
      "sidechained pad, and a bright lead synth carrying the melody. " +
      "Arrangement builds from a sparse intro into a full chorus around bar 33.",
  };
  page = appendMove(page, "Sidechained the pad to the kick for headroom.", {
    id: generateId(),
    now,
  });
  page = appendMove(page, "Swapped the lead synth patch for something brighter.", {
    id: generateId(),
    now,
  });
  page = appendMove(page, "Automated a filter sweep into the chorus at bar 33.", {
    id: generateId(),
    now,
  });
  return page;
}

function createPresetsPageWithDevice(
  projectId: string,
  now: () => string,
  generateId: () => string,
): PresetPage {
  let page = createPresetPage(
    { projectId, title: "Lead synth", order: 2 },
    { id: generateId(), now },
  );
  const device = createPresetDevice(
    { name: "Serum", settings: "Saw + sub oscillator, unison 4, detune 12%." },
    { id: generateId() },
  );
  page = addDevice(page, device, { now });

  const cutoffParam = createPresetParam({ key: "cutoff", value: "62%" }, { id: generateId() });
  page = addParam(page, device.id, cutoffParam, { now });

  const resonanceParam = createPresetParam(
    { key: "resonance", value: "18%" },
    { id: generateId() },
  );
  page = addParam(page, device.id, resonanceParam, { now });

  return page;
}
