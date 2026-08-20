import { describe, expect, it } from "vitest";
import { detectConflict } from "./sync-conflict";
import { createNotesPage, type NotesPage } from "./page";

function page(id: string, updatedAt: string): NotesPage {
  return {
    ...createNotesPage({ projectId: "proj-1" }, { id, now: () => "2024-01-01T00:00:00.000Z" }),
    updatedAt,
  };
}

describe("detectConflict", () => {
  it("returns false when only the local copy changed since the last sync", () => {
    const local = page("p1", "2024-02-01T00:00:00.000Z");
    const remote = page("p1", "2024-01-01T00:00:00.000Z");

    expect(detectConflict(local, remote, "2024-01-01T00:00:00.000Z")).toBe(false);
  });

  it("returns false when only the remote copy changed since the last sync", () => {
    const local = page("p1", "2024-01-01T00:00:00.000Z");
    const remote = page("p1", "2024-03-01T00:00:00.000Z");

    expect(detectConflict(local, remote, "2024-01-01T00:00:00.000Z")).toBe(false);
  });

  it("returns true when both copies changed since the last sync", () => {
    const local = page("p1", "2024-02-01T00:00:00.000Z");
    const remote = page("p1", "2024-03-01T00:00:00.000Z");

    expect(detectConflict(local, remote, "2024-01-01T00:00:00.000Z")).toBe(true);
  });

  it("returns false when neither copy changed since the last sync", () => {
    const local = page("p1", "2024-01-01T00:00:00.000Z");
    const remote = page("p1", "2024-01-01T00:00:00.000Z");

    expect(detectConflict(local, remote, "2024-01-01T00:00:00.000Z")).toBe(false);
  });

  // FR-16, Task 13: a soft delete stamps `updatedAt` the same as any other
  // edit (see `PageRepository.softDelete`), so the existing whole-page
  // `updatedAt` comparison already treats "one side deleted, the other
  // edited, both since last sync" as a conflict with no special-casing of
  // `deletedAt` needed.
  it("returns true when one side was soft-deleted and the other was edited since the last sync", () => {
    const local = {
      ...page("p1", "2024-02-01T00:00:00.000Z"),
      deletedAt: "2024-02-01T00:00:00.000Z",
    };
    const remote = page("p1", "2024-03-01T00:00:00.000Z");

    expect(detectConflict(local, remote, "2024-01-01T00:00:00.000Z")).toBe(true);
  });

  it("returns false when only one side was soft-deleted and the other did not change since the last sync", () => {
    const local = {
      ...page("p1", "2024-02-01T00:00:00.000Z"),
      deletedAt: "2024-02-01T00:00:00.000Z",
    };
    const remote = page("p1", "2024-01-01T00:00:00.000Z");

    expect(detectConflict(local, remote, "2024-01-01T00:00:00.000Z")).toBe(false);
  });
});
