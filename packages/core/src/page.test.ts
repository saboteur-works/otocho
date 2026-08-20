import { describe, expect, it } from "vitest";
import {
  addDevice,
  addParam,
  appendMove,
  byOrder,
  createBuildLogPage,
  createNotesPage,
  createPage,
  createPresetDevice,
  createPresetParam,
  createPresetPage,
  editMove,
  isDeleted,
  PAGE_TYPES,
  removeDevice,
  removeMove,
  removeParam,
  reorderDevices,
  updateDevice,
  updateParam,
  type BuildLogPage,
  type Page,
  type PresetPage,
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
      deletedAt: null,
      body: "",
    });
    expect(page.createdAt).toBe(page.updatedAt);
  });

  it("sets deletedAt to null on creation", () => {
    expect(createNotesPage({ projectId: "p" }).deletedAt).toBeNull();
    expect(createBuildLogPage({ projectId: "p" }).deletedAt).toBeNull();
    expect(createPresetPage({ projectId: "p" }).deletedAt).toBeNull();
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

describe("isDeleted", () => {
  it("is false for an active page and true once deletedAt is set", () => {
    const page = createNotesPage({ projectId: "p" });
    expect(isDeleted(page)).toBe(false);
    expect(isDeleted({ ...page, deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
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

describe("move transforms", () => {
  function withMoves(): BuildLogPage {
    let page = createBuildLogPage({ projectId: "p" }, { id: "pg", now: () => "2026-01-01T00:00:00.000Z" });
    page = appendMove(page, "one", { id: "m1", now: () => "2026-01-01T01:00:00.000Z" });
    page = appendMove(page, "two", { id: "m2", now: () => "2026-01-01T02:00:00.000Z" });
    return page;
  }

  it("editMove changes only the target's text, keeping id and timestamp", () => {
    const page = withMoves();
    const next = editMove(page, "m1", "edited", { now: () => "2026-02-01T00:00:00.000Z" });
    expect(next.moves.find((m) => m.id === "m1")).toEqual({ id: "m1", at: "2026-01-01T01:00:00.000Z", text: "edited" });
    expect(next.moves.find((m) => m.id === "m2")?.text).toBe("two");
    expect(next.updatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(page.moves.find((m) => m.id === "m1")?.text).toBe("one"); // pure
  });

  it("editMove rejects empty text and is a no-op for a missing id", () => {
    const page = withMoves();
    expect(() => editMove(page, "m1", "  ")).toThrow(/text/i);
    expect(editMove(page, "nope", "x")).toBe(page);
  });

  it("removeMove drops the target and advances updatedAt; no-op when absent", () => {
    const page = withMoves();
    const next = removeMove(page, "m1", { now: () => "2026-02-01T00:00:00.000Z" });
    expect(next.moves.map((m) => m.id)).toEqual(["m2"]);
    expect(next.updatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(removeMove(page, "nope")).toBe(page);
  });
});

describe("preset transforms", () => {
  function withDevices(): PresetPage {
    let page = createPresetPage({ projectId: "p" }, { id: "pg", now: () => "2026-01-01T00:00:00.000Z" });
    page = addDevice(page, createPresetDevice({ name: "A" }, { id: "d1" }), { now: () => "2026-01-01T01:00:00.000Z" });
    page = addDevice(page, createPresetDevice({ name: "B" }, { id: "d2" }), { now: () => "2026-01-01T02:00:00.000Z" });
    return page;
  }

  it("createPresetDevice/createPresetParam apply defaults and honor the id override", () => {
    expect(createPresetDevice({}, { id: "d" })).toEqual({ id: "d", name: "New device", settings: "", params: [] });
    expect(createPresetParam({ key: "k" }, { id: "p" })).toEqual({ id: "p", key: "k", value: "" });
  });

  it("addDevice appends to the chain", () => {
    const page = withDevices();
    expect(page.devices.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("updateDevice patches one device; no-op when absent", () => {
    const page = withDevices();
    const next = updateDevice(page, "d1", { settings: "HPF" }, { now: () => "2026-03-01T00:00:00.000Z" });
    expect(next.devices.find((d) => d.id === "d1")?.settings).toBe("HPF");
    expect(next.updatedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(updateDevice(page, "nope", { settings: "x" })).toBe(page);
  });

  it("removeDevice drops one device; no-op when absent", () => {
    const page = withDevices();
    expect(removeDevice(page, "d1").devices.map((d) => d.id)).toEqual(["d2"]);
    expect(removeDevice(page, "nope")).toBe(page);
  });

  it("reorderDevices moves a device to another's position; no-op on missing/equal", () => {
    const page = withDevices();
    expect(reorderDevices(page, "d1", "d2").devices.map((d) => d.id)).toEqual(["d2", "d1"]);
    expect(reorderDevices(page, "d1", "d1")).toBe(page);
    expect(reorderDevices(page, "d1", "nope")).toBe(page);
  });

  it("addParam/updateParam/removeParam operate on the named device's params", () => {
    let page = withDevices();
    page = addParam(page, "d1", createPresetParam({ key: "HPF", value: "80" }, { id: "p1" }));
    expect(page.devices.find((d) => d.id === "d1")?.params).toEqual([{ id: "p1", key: "HPF", value: "80" }]);

    page = updateParam(page, "d1", "p1", { value: "100" });
    expect(page.devices.find((d) => d.id === "d1")?.params[0].value).toBe("100");

    page = removeParam(page, "d1", "p1");
    expect(page.devices.find((d) => d.id === "d1")?.params).toEqual([]);
  });

  it("param transforms are no-ops when the device or param is missing", () => {
    const page = withDevices();
    expect(addParam(page, "nope", createPresetParam())).toBe(page);
    expect(updateParam(page, "d1", "nope", { value: "x" })).toBe(page);
    expect(removeParam(page, "d1", "nope")).toBe(page);
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
