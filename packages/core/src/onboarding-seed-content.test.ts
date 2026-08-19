import { describe, expect, it } from "vitest";
import { buildExampleProjectSeed } from "./onboarding-seed-content";

/** Monotonic ISO clock and stable id generator for deterministic assertions. */
function fixtures() {
  let tick = 0;
  const base = Date.UTC(2026, 0, 1);
  const now = () => new Date(base + tick++ * 1000).toISOString();
  let n = 0;
  const generateId = () => `seed-${++n}`;
  return { now, generateId };
}

describe("buildExampleProjectSeed", () => {
  it("builds a project and one page of each type", () => {
    const seed = buildExampleProjectSeed(fixtures());
    expect(seed.project.name).toBe("Midnight Drive — example");
    expect(seed.notesPage.type).toBe("notes");
    expect(seed.notesPage.projectId).toBe(seed.project.id);
    expect(seed.buildLogPage.type).toBe("build-log");
    expect(seed.buildLogPage.projectId).toBe(seed.project.id);
    expect(seed.presetsPage.type).toBe("presets");
    expect(seed.presetsPage.projectId).toBe(seed.project.id);
  });

  it("satisfies every FR-6 non-empty-field requirement", () => {
    const seed = buildExampleProjectSeed(fixtures());

    expect(seed.notesPage.body.trim().length).toBeGreaterThan(0);
    expect(seed.buildLogPage.sketch.trim().length).toBeGreaterThan(0);
    expect(seed.buildLogPage.moves.length).toBeGreaterThanOrEqual(1);
    for (const move of seed.buildLogPage.moves) {
      expect(move.text.trim().length).toBeGreaterThan(0);
    }
    expect(seed.presetsPage.devices.length).toBeGreaterThanOrEqual(1);
    const device = seed.presetsPage.devices[0];
    expect(device.name.trim().length).toBeGreaterThan(0);
    expect(device.params.length).toBeGreaterThanOrEqual(1);
    const param = device.params[0];
    expect(param.key.trim().length).toBeGreaterThan(0);
    expect(param.value.trim().length).toBeGreaterThan(0);
  });

  it("frames the durable-memory hook: DAW file lost, this record survives", () => {
    const seed = buildExampleProjectSeed(fixtures());
    const body = seed.notesPage.body.toLowerCase();
    expect(body).toMatch(/lost|swapped/);
    expect(body).toMatch(/only surviving record|survives|survived/);
  });

  it("scopes the Presets page to the Lead synth track via its title", () => {
    const seed = buildExampleProjectSeed(fixtures());
    expect(seed.presetsPage.title).toBe("Lead synth");
  });

  it("has 2-3 timestamped Build log moves that read as reconstructable steps", () => {
    const seed = buildExampleProjectSeed(fixtures());
    expect(seed.buildLogPage.moves.length).toBeGreaterThanOrEqual(2);
    expect(seed.buildLogPage.moves.length).toBeLessThanOrEqual(3);
    for (const move of seed.buildLogPage.moves) {
      expect(move.at.length).toBeGreaterThan(0);
    }
  });

  it("produces byte-identical output across two calls with the same injected options", () => {
    const first = buildExampleProjectSeed(fixtures());
    const second = buildExampleProjectSeed(fixtures());
    expect(second).toEqual(first);
  });

  it("never hand-constructs ids — every id comes from the injected generator", () => {
    const { now, generateId } = fixtures();
    const seed = buildExampleProjectSeed({ now, generateId });
    expect(seed.project.id).toBe("seed-1");
    expect(seed.notesPage.id).toBe("seed-2");
    expect(seed.buildLogPage.id).toBe("seed-3");
  });
});
