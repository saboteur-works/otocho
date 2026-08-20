import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchIndex, type SearchIndexEntry, type SearchIndexRole } from "./search";
import type { BuildLogPage, NotesPage, Page, PresetPage } from "./page";
import type { Project } from "./project";
import { buildExampleProjectSeed } from "./onboarding-seed-content";

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
    deletedAt: null,
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
    deletedAt: null,
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
    deletedAt: null,
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

describe("searchIndex", () => {
  it("returns an empty array for an empty query", () => {
    const proj = project();
    const entries = buildSearchIndex([proj], [notesPage()]);
    expect(searchIndex(entries, "")).toEqual([]);
  });

  it("returns an empty array for a whitespace-only query", () => {
    const proj = project();
    const entries = buildSearchIndex([proj], [notesPage()]);
    expect(searchIndex(entries, "   ")).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const proj = project();
    const entries = buildSearchIndex([proj], [notesPage({ body: "Some Notes Body" })]);

    expect(searchIndex(entries, "notes body")).toHaveLength(1);
    expect(searchIndex(entries, "NOTES BODY")).toHaveLength(1);
    expect(searchIndex(entries, "NoTeS")).toHaveLength(1);
  });

  it("matches substrings, not just exact whole-field equality", () => {
    const proj = project();
    const entries = buildSearchIndex([proj], [notesPage({ body: "a longer sentence with detune inside it" })]);

    const results = searchIndex(entries, "detune");
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toContain("detune");
    // Confirm it is not requiring the whole field to equal the query.
    expect("a longer sentence with detune inside it").not.toBe("detune");
  });

  it("finds matches across multiple fields on a single page", () => {
    const proj = project();
    const page = presetPage({
      title: "Cutoff Lead",
      devices: [
        {
          id: "dev1",
          name: "Cutoff Rack",
          settings: "no match here",
          params: [{ id: "p1", key: "Cutoff", value: "8.2kHz" }],
        },
      ],
    });
    const entries = buildSearchIndex([proj], [page]);

    const results = searchIndex(entries, "cutoff");
    const roles = results.map((r) => r.role).sort();
    expect(roles).toEqual(["device-name", "param-key", "track-name"].sort());
    for (const result of results) {
      expect(result.pageId).toBe(page.id);
      expect(result.projectId).toBe(proj.id);
      expect(result.projectName).toBe(proj.name);
    }
  });

  it("finds matches across multiple projects", () => {
    const projA = project({ id: "projA", name: "Project A" });
    const projB = project({ id: "projB", name: "Project B" });
    const pageA = notesPage({ id: "pageA", projectId: "projA", body: "reverb tail" });
    const pageB = notesPage({ id: "pageB", projectId: "projB", body: "reverb decay" });

    const entries = buildSearchIndex([projA, projB], [pageA, pageB]);
    const results = searchIndex(entries, "reverb");

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.projectId)).toEqual(["projA", "projB"]);
  });

  it("orders results by project recency (input array order) then page order within a project", () => {
    // Projects passed newest-first, simulating ProjectRepository.list() (project recency order).
    const projRecent = project({ id: "projRecent", name: "Recent Project" });
    const projOlder = project({ id: "projOlder", name: "Older Project" });

    const pageOlderFirst = notesPage({
      id: "page-older-a",
      projectId: "projOlder",
      order: 0,
      body: "match token first",
    });
    const pageOlderSecond = buildLogPage({
      id: "page-older-b",
      projectId: "projOlder",
      order: 1,
      sketch: "match token second",
      moves: [],
    });
    const pageRecentFirst = notesPage({
      id: "page-recent-a",
      projectId: "projRecent",
      order: 0,
      body: "match token third",
    });

    // Pages pre-sorted by project recency then page order, as buildSearchIndex's caller must supply.
    const entries = buildSearchIndex(
      [projRecent, projOlder],
      [pageRecentFirst, pageOlderFirst, pageOlderSecond],
    );

    const results = searchIndex(entries, "match token");

    expect(results.map((r) => r.pageId)).toEqual(["page-recent-a", "page-older-a", "page-older-b"]);
  });

  it("does not group results by project, page, or role", () => {
    const proj = project();
    const page = presetPage({
      title: "match one",
      devices: [
        {
          id: "dev1",
          name: "match two",
          settings: "match three",
          params: [{ id: "p1", key: "match four", value: "unrelated" }],
        },
      ],
    });
    const entries = buildSearchIndex([proj], [page]);
    const results = searchIndex(entries, "match");

    // Flat list in input (entry) order — not grouped/sorted by role.
    expect(results.map((r) => r.role)).toEqual([
      "track-name",
      "device-name",
      "device-settings",
      "param-key",
    ]);
  });

  it("includes snippet, page title, role, and project name for each result (FR-5)", () => {
    const proj = project({ name: "My Project" });
    const page = notesPage({ title: "My Notes", body: "some content about a filter sweep" });
    const entries = buildSearchIndex([proj], [page]);

    const results = searchIndex(entries, "filter sweep");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      role: "body",
      pageId: page.id,
      pageTitle: "My Notes",
      projectId: proj.id,
      projectName: "My Project",
    });
    expect(results[0].snippet).toContain("filter sweep");
  });

  it("does not mutate the input entries", () => {
    const proj = project();
    const entries = buildSearchIndex([proj], [notesPage({ body: "some match here" })]);
    const snapshot = JSON.parse(JSON.stringify(entries));

    searchIndex(entries, "match");

    expect(entries).toEqual(snapshot);
  });
});

describe("onboarding example project is searchable (FR-7)", () => {
  // No Search-specific integration work — the example project/pages are
  // built with the same core factories as any project/page, so they must
  // flow through buildSearchIndex/searchIndex unmodified.
  const { project: exampleProject, notesPage: exampleNotesPage, buildLogPage: exampleBuildLogPage, presetsPage: examplePresetsPage } =
    buildExampleProjectSeed({
      now: () => "2026-01-01T00:00:00.000Z",
      generateId: (() => {
        let n = 0;
        return () => `example-id-${n++}`;
      })(),
    });

  const entries = buildSearchIndex(
    [exampleProject],
    [exampleNotesPage, exampleBuildLogPage, examplePresetsPage],
  );

  it("finds the example project via a substring of the Notes page body", () => {
    const results = searchIndex(entries, "only surviving record");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.projectId === exampleProject.id)).toBe(true);
    expect(results.some((r) => r.role === "body" && r.pageId === exampleNotesPage.id)).toBe(true);
  });

  it("finds the example project via a substring of a Build log move's text", () => {
    const move = exampleBuildLogPage.moves[0];
    expect(move).toBeDefined();

    const results = searchIndex(entries, move.text.slice(0, 20));

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.projectId === exampleProject.id)).toBe(true);
    expect(
      results.some((r) => r.role === "move" && r.pageId === exampleBuildLogPage.id),
    ).toBe(true);
  });

  it("finds the example project via the Presets device name", () => {
    const device = examplePresetsPage.devices[0];
    expect(device).toBeDefined();

    const results = searchIndex(entries, device.name);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.projectId === exampleProject.id)).toBe(true);
    expect(
      results.some((r) => r.role === "device-name" && r.pageId === examplePresetsPage.id),
    ).toBe(true);
  });
});
