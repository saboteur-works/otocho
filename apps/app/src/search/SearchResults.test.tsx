// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SearchResult } from "@otocho/core";
import { SearchResults } from "./SearchResults";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    snippet: "kick drum tuning",
    role: "body",
    pageId: "page-1",
    pageTitle: "Notes",
    projectId: "project-1",
    projectName: "Alpha",
    ...overrides,
  };
}

describe("SearchResults", () => {
  it("renders the empty state when a query has no matches", () => {
    render(<SearchResults results={[]} query="ambisonic" />);
    expect(screen.getByText('No matches for "ambisonic".')).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("renders every result as a flat list in the given order", () => {
    const results: SearchResult[] = [
      result({ pageId: "page-1", pageTitle: "Notes", projectName: "Alpha", snippet: "kick drum tuning", role: "body" }),
      result({ pageId: "page-2", pageTitle: "Rack", projectName: "Beta", snippet: "Reverb Amount", role: "param-key" }),
    ];

    render(<SearchResults results={results} query="kick" />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Alpha");
    expect(items[0].textContent).toContain("Notes");
    expect(items[0].textContent).toContain("kick drum tuning");
    expect(items[1].textContent).toContain("Beta");
    expect(items[1].textContent).toContain("Rack");
    expect(items[1].textContent).toContain("Reverb Amount");
  });

  it("shows human-readable role labels for every SearchIndexRole", () => {
    const results: SearchResult[] = [
      result({ pageId: "p1", role: "body" }),
      result({ pageId: "p2", role: "sketch" }),
      result({ pageId: "p3", role: "move" }),
      result({ pageId: "p4", role: "track-name" }),
      result({ pageId: "p5", role: "device-name" }),
      result({ pageId: "p6", role: "device-settings" }),
      result({ pageId: "p7", role: "param-key" }),
      result({ pageId: "p8", role: "param-value" }),
    ];

    render(<SearchResults results={results} query="x" />);

    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Sketch")).toBeTruthy();
    expect(screen.getByText("Move")).toBeTruthy();
    expect(screen.getByText("Track name")).toBeTruthy();
    expect(screen.getByText("Device name")).toBeTruthy();
    expect(screen.getByText("Device settings")).toBeTruthy();
    expect(screen.getByText("Param key")).toBeTruthy();
    expect(screen.getByText("Param value")).toBeTruthy();
  });

  it("calls onSelect with the chosen result when a row is activated", async () => {
    const results: SearchResult[] = [
      result({ pageId: "page-1", pageTitle: "Notes", projectName: "Alpha" }),
      result({ pageId: "page-2", pageTitle: "Rack", projectName: "Beta" }),
    ];
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<SearchResults results={results} query="kick" onSelect={onSelect} />);

    await user.click(screen.getAllByRole("button")[1]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(results[1]);
  });
});
