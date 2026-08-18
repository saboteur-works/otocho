// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";

function renderDialog() {
  return render(
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename page</DialogTitle>
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog", () => {
  it("is closed by default and opens when the trigger is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByText("Rename page")).toBeNull();

    await user.click(screen.getByText("Open"));

    expect(screen.getByText("Rename page")).toBeTruthy();
  });

  it("closes when the close (X) button is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Rename page")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByText("Rename page")).toBeNull();
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Rename page")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Rename page")).toBeNull();
  });

  it("dismisses on overlay click", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Rename page")).toBeTruthy();

    // The overlay is portalled to document.body, so it's outside the render container.
    const overlay = document.querySelector(".fixed.inset-0.bg-black\\/70");
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);

    expect(screen.queryByText("Rename page")).toBeNull();
  });

  it("does not render the close button when showCloseButton is false", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>No close button</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByText("Open"));

    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });
});
