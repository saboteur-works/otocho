import { describe, expect, it } from "vitest";
import {
  appendMove,
  byOrder,
  createBuildLogPage,
  createNotesPage,
  createPage,
  createPresetPage,
  PAGE_TYPES,
  type BuildLogPage,
  type Page,
} from "./page";

/** Monotonic ISO clock and stable id generator for deterministic assertions. */
function fixtures() {
  let tick = 0;
  const base = Date.UTC(2026, 0, 1);
  const now = () => new Date(base + tick++ * 1000).toISOString();
  let n = 0;
  const id = () => `x${++n}`;
  return { now, id };
}

describe("page factories", () => {
  it("creates a Notes page with shared base + empty body", () => {
    const f = fixtures();
    const page = createNotesPage(
      { projectId: "proj1", title: "Mix ideas", order: 2 },
      { id: f.id(), now: f.now },
    );
    expect(page).toEqual({
      id: "x1",
      projectId: "proj1",
      type: "notes",
      title: "Mix ideas",
      order: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      body: "",
    });
    expect(page.createdAt).toBe(page.updatedAt);
  });

  it("creates a Build log with an empty sketch and no moves", () => {
    const page = createBuildLogPage({ projectId: "proj1" });
    expect(page.type).toBe("build-log");
    expect(page.sketch).toBe("");
    expect(page.moves).toEqual([]);
  });

  it("creates a Preset page with no devices", () => {
    const page = createPresetPage({ projectId: "proj1" });
    expect(page.type).toBe("presets");
    expect(page.devices).toEqual([]);
  });

  it("falls back to a per-type default title when none/blank is given", () => {
    expect(createNotesPage({ projectId: "p" }).title).toBe("Notes");
    expect(createBuildLogPage({ projectId: "p" }).title).toBe("Build log");
    expect(createPresetPage({ projectId: "p", title: "   " }).title).toBe("New track");
  });

  it("defaults order to 0 when unspecified", () => {
    expect(createNotesPage({ projectId: "p" }).order).toBe(0);
  });

  it("requires an owning projectId", () => {
    expect(() => createNotesPage({ projectId: "  " })).toThrow(/projectId/i);
  });

  it("createPage dispatches on type and covers every PAGE_TYPE", () => {
    for (const type of PAGE_TYPES) {
      expect(createPage(type, { projectId: "p" }).type).toBe(type);
    }
  });
});

describe("byOrder", () => {
  it("sorts by order, breaking ties by creation time", () => {
    const f = fixtures();
    const a = createNotesPage({ projectId: "p", order: 1 }, { id: f.id(), now: f.now });
    const b = createNotesPage({ projectId: "p", order: 0 }, { id: f.id(), now: f.now });
    const c = createNotesPage({ projectId: "p", order: 0 }, { id: f.id(), now: f.now });
    const sorted = [a, b, c].sort(byOrder).map((p) => p.id);
    // order 0 first (b before c by createdAt tie-break), then order 1 (a).
    expect(sorted).toEqual([b.id, c.id, a.id]);
  });
});

describe("appendMove", () => {
  function buildLog(): BuildLogPage {
    return createBuildLogPage(
      { projectId: "p" },
      { id: "page1", now: () => "2026-01-01T00:00:00.000Z" },
    );
  }

  it("appends a timestamped, id'd move and advances updatedAt", () => {
    const page = buildLog();
    const next = appendMove(page, "  sidechain to kick  ", {
      id: "m1",
      now: () => "2026-01-02T00:00:00.000Z",
    });
    expect(next.moves).toEqual([
      { id: "m1", at: "2026-01-02T00:00:00.000Z", text: "sidechain to kick" },
    ]);
    expect(next.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    // pure: original untouched
    expect(page.moves).toEqual([]);
  });

  it("appends in order, newest last", () => {
    const f = fixtures();
    let page = buildLog();
    page = appendMove(page, "first", { id: f.id(), now: f.now });
    page = appendMove(page, "second", { id: f.id(), now: f.now });
    expect(page.moves.map((m) => m.text)).toEqual(["first", "second"]);
  });

  it("rejects empty move text", () => {
    expect(() => appendMove(buildLog(), "   ")).toThrow(/text/i);
  });
});

describe("discriminated union", () => {
  it("narrows by type", () => {
    const pages: Page[] = [
      createNotesPage({ projectId: "p" }),
      createBuildLogPage({ projectId: "p" }),
      createPresetPage({ projectId: "p" }),
    ];
    const notes = pages.find((p) => p.type === "notes");
    // type narrowing makes `body` reachable without a cast
    expect(notes && "body" in notes).toBe(true);
  });
});
