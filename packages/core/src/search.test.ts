import { describe, expect, it } from "vitest";
import { buildSearchIndex, type SearchIndexEntry, type SearchIndexRole } from "./search";
import type { BuildLogPage, NotesPage, Page, PresetPage } from "./page";
import type { Project } from "./project";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj1",
    name: "My Project",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function notesPage(overrides: Partial<NotesPage> = {}): NotesPage {
  return {
    id: "page-notes",
    projectId: "proj1",
    type: "notes",
    title: "Notes",
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    body: "Some notes body",
    ...overrides,
  };
}

function buildLogPage(overrides: Partial<BuildLogPage> = {}): BuildLogPage {
  return {
    id: "page-buildlog",
    projectId: "proj1",
    type: "build-log",
    title: "Build log",
    order: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sketch: "An arrangement sketch",
    moves: [
      { id: "m1", at: "2026-01-01T00:00:00.000Z", text: "Bounced the drums" },
      { id: "m2", at: "2026-01-01T00:01:00.000Z", text: "Added a filter sweep" },
    ],
    ...overrides,
  };
}

function presetPage(overrides: Partial<PresetPage> = {}): PresetPage {
  return {
    id: "page-preset",
    projectId: "proj1",
    type: "presets",
    title: "Lead Synth",
    order: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    devices: [
      {
        id: "dev1",
        name: "Serum",
        settings: "Init patch, detuned unison",
        params: [
          { id: "p1", key: "Cutoff", value: "8.2kHz" },
          { id: "p2", key: "Resonance", value: "20%" },
        ],
      },
    ],
    ...overrides,
  };
}

function entriesByRole(entries: SearchIndexEntry[], role: SearchIndexRole): SearchIndexEntry[] {
  return entries.filter((e) => e.role === role);
}

describe("buildSearchIndex", () => {
  it("indexes a Notes page's body with role 'body'", () => {
    const proj = project();
    const page = notesPage();
    const entries = buildSearchIndex([proj], [page]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      value: "Some notes body",
      role: "body",
      pageId: page.id,
      pageTitle: page.title,
      projectId: proj.id,
      projectName: proj.name,
    });
  });

  it("indexes a Build log's sketch with role 'sketch' and each move with role 'move'", () => {
    const proj = project();
    const page = buildLogPage();
    const entries = buildSearchIndex([proj], [page]);

    const sketchEntries = entriesByRole(entries, "sketch");
    expect(sketchEntries).toHaveLength(1);
    expect(sketchEntries[0].value).toBe("An arrangement sketch");

    const moveEntries = entriesByRole(entries, "move");
    expect(moveEntries).toHaveLength(2);
    expect(moveEntries.map((e) => e.value)).toEqual(["Bounced the drums", "Added a filter sweep"]);
    for (const entry of moveEntries) {
      expect(entry.pageId).toBe(page.id);
      expect(entry.projectId).toBe(proj.id);
    }
  });

  it("indexes a Preset page's title as 'track-name', device fields, and param fields", () => {
    const proj = project();
    const page = presetPage();
    const entries = buildSearchIndex([proj], [page]);

    expect(entriesByRole(entries, "track-name")).toHaveLength(1);
    expect(entriesByRole(entries, "track-name")[0].value).toBe("Lead Synth");

    expect(entriesByRole(entries, "device-name")).toHaveLength(1);
    expect(entriesByRole(entries, "device-name")[0].value).toBe("Serum");

    expect(entriesByRole(entries, "device-settings")).toHaveLength(1);
    expect(entriesByRole(entries, "device-settings")[0].value).toBe(
      "Init patch, detuned unison",
    );

    const keyEntries = entriesByRole(entries, "param-key");
    expect(keyEntries.map((e) => e.value)).toEqual(["Cutoff", "Resonance"]);

    const valueEntries = entriesByRole(entries, "param-value");
    expect(valueEntries.map((e) => e.value)).toEqual(["8.2kHz", "20%"]);
  });

  it("covers all eight roles across a mixed set of pages", () => {
    const proj = project();
    const entries = buildSearchIndex([proj], [notesPage(), buildLogPage(), presetPage()]);
    const roles = new Set(entries.map((e) => e.role));
    const expectedRoles: SearchIndexRole[] = [
      "body",
      "sketch",
      "move",
      "track-name",
      "device-name",
      "device-settings",
      "param-key",
      "param-value",
    ];
    for (const role of expectedRoles) {
      expect(roles.has(role)).toBe(true);
    }
    expect(roles.size).toBe(expectedRoles.length);
  });

  it("produces no entry for empty-string fields", () => {
    const proj = project();
    const empty = notesPage({ body: "" });
    const emptyBuildLog = buildLogPage({ sketch: "", moves: [] });
    const emptyPreset = presetPage({
      devices: [
        {
          id: "dev-empty",
          name: "Rack",
          settings: "",
          params: [{ id: "p-empty", key: "", value: "" }],
        },
      ],
    });

    const entries = buildSearchIndex([proj], [empty, emptyBuildLog, emptyPreset]);

    expect(entriesByRole(entries, "body")).toHaveLength(0);
    expect(entriesByRole(entries, "sketch")).toHaveLength(0);
    expect(entriesByRole(entries, "move")).toHaveLength(0);
    expect(entriesByRole(entries, "device-settings")).toHaveLength(0);
    expect(entriesByRole(entries, "param-key")).toHaveLength(0);
    expect(entriesByRole(entries, "param-value")).toHaveLength(0);
    // device-name and track-name still index since those are non-empty
    expect(entriesByRole(entries, "device-name")).toHaveLength(1);
    expect(entriesByRole(entries, "track-name")).toHaveLength(1);
  });

  it("never indexes Project.name as its own matchable field", () => {
    const proj = project({ name: "Unmatchable Project Name" });
    const page = notesPage({ body: "unrelated content" });
    const entries = buildSearchIndex([proj], [page]);

    // Project name only appears as context on entries, never as a `value`.
    expect(entries.every((e) => e.value !== proj.name)).toBe(true);
    expect(entries.every((e) => e.projectName === proj.name)).toBe(true);
    // No role corresponds to a project-level field.
    const roles = entries.map((e) => e.role);
    expect(roles).not.toContain("project-name");
  });

  it("skips pages whose owning project is missing, without throwing", () => {
    const orphan = notesPage({ projectId: "missing-project" });
    const entries = buildSearchIndex([], [orphan]);
    expect(entries).toEqual([]);
  });

  it("does not mutate the input projects or pages", () => {
    const proj = project();
    const page = presetPage();
    const projSnapshot = JSON.parse(JSON.stringify(proj));
    const pageSnapshot = JSON.parse(JSON.stringify(page));

    buildSearchIndex([proj], [page]);

    expect(proj).toEqual(projSnapshot);
    expect(page).toEqual(pageSnapshot);
  });

  it("returns an empty array for empty input", () => {
    const entries: Page[] = [];
    expect(buildSearchIndex([], entries)).toEqual([]);
  });
});
