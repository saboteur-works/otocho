// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPresetPage, type PresetPage } from "@otocho/core";
import { PresetPage as PresetPageEditor } from "./PresetPage";

function makePage(overrides: Partial<PresetPage> = {}): PresetPage {
  return {
    ...createPresetPage(
      { projectId: "p", title: "Lead Vocal", order: 0 },
      { id: "page1", now: () => "2026-01-01T00:00:00.000Z" },
    ),
    ...overrides,
  };
}

function makePageWithDevices(): PresetPage {
  return makePage({
    devices: [
      { id: "d1", name: "Pro-Q 3", settings: "HPF 80Hz", params: [{ id: "p1", key: "HPF", value: "80 Hz" }] },
      { id: "d2", name: "CLA-2A", settings: "", params: [] },
    ],
  });
}

/** onSave now receives a transform; apply the first call to `base` to inspect the result. */
function firstSave(onSave: ReturnType<typeof vi.fn>, base: PresetPage): PresetPage {
  return onSave.mock.calls[0][0](base);
}

describe("PresetPage — device chain", () => {
  it("shows empty state with add prompt when no devices", () => {
    render(<PresetPageEditor page={makePage()} onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add first device/i })).toBeTruthy();
  });

  it("renders device nodes in the chain", () => {
    render(<PresetPageEditor page={makePageWithDevices()} onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pro-Q 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "CLA-2A" })).toBeTruthy();
  });

  it("adds a device and selects it", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePage()} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /add first device/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = firstSave(onSave, makePage());
    expect(saved.devices).toHaveLength(1);
    expect(saved.devices[0].name).toBe("New device");
  });

  it("[+] in chain adds a device", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /add device/i }));

    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices).toHaveLength(3);
  });

  it("selects a device on click and shows its detail", async () => {
    render(<PresetPageEditor page={makePageWithDevices()} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "CLA-2A" }));
    expect(screen.getByLabelText(/device settings/i)).toBeTruthy();
  });

  it("deletes a device after confirmation", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /delete device/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices).toHaveLength(1);
    expect(saved.devices[0].id).toBe("d2");
  });
});

describe("PresetPage — device detail", () => {
  it("shows device name, settings, and params", () => {
    render(<PresetPageEditor page={makePageWithDevices()} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/edit device name/i)).toBeTruthy();
    expect(screen.getByDisplayValue("HPF 80Hz")).toBeTruthy();
    expect(screen.getByDisplayValue("HPF")).toBeTruthy();
    expect(screen.getByDisplayValue("80 Hz")).toBeTruthy();
  });

  it("edits device name inline and saves", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText(/edit device name/i));
    const input = screen.getByLabelText(/^device name$/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Pro-Q 4{Enter}");

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices.find((d) => d.id === "d1")?.name).toBe("Pro-Q 4");
  });

  it("debounces settings autosave", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/device settings/i), { target: { value: "new settings" } });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { await vi.runAllTimersAsync(); });
    vi.useRealTimers();
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices.find((d) => d.id === "d1")?.settings).toBe("new settings");
  });

  it("adds a parameter row", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /add parameter/i }));

    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices.find((d) => d.id === "d1")?.params).toHaveLength(2);
  });

  it("updates a parameter key", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    const keyInput = screen.getByDisplayValue("HPF");
    fireEvent.change(keyInput, { target: { value: "LPF" } });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices.find((d) => d.id === "d1")?.params[0].key).toBe("LPF");
  });

  it("deletes a parameter row", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PresetPageEditor page={makePageWithDevices()} onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /delete parameter/i }));

    const saved = firstSave(onSave, makePageWithDevices());
    expect(saved.devices.find((d) => d.id === "d1")?.params).toHaveLength(0);
  });
});
