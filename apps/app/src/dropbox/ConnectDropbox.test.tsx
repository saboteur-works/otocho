// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropboxConnectionRepository, createDropboxConnection } from "@otocho/core";
import type { DropboxAuthPort, DropboxTokens } from "@otocho/storage";
import { MemoryStorage } from "../testing/memory-storage";
import { ConnectDropbox } from "./ConnectDropbox";

const TOKENS: DropboxTokens = {
  accessToken: "access-token-abc",
  refreshToken: "refresh-token-xyz",
  expiresAt: 1_000_000,
};

function makeAuth(): DropboxAuthPort {
  return { authorize: vi.fn().mockResolvedValue(TOKENS) };
}

describe("ConnectDropbox", () => {
  let repo: DropboxConnectionRepository;

  beforeEach(() => {
    repo = new DropboxConnectionRepository({ storage: new MemoryStorage() });
  });

  it("shows a Connect Dropbox control when no connection exists, reachable with no other precondition", async () => {
    render(
      <ConnectDropbox
        connectionOptions={{ repo, auth: makeAuth(), resolveAccountId: vi.fn() }}
      />,
    );

    expect(await screen.findByRole("button", { name: /connect dropbox/i })).toBeTruthy();
  });

  it("starts the connect flow and shows a disconnect control once connected", async () => {
    const user = userEvent.setup();
    const auth = makeAuth();
    const resolveAccountId = vi.fn().mockResolvedValue("account-42");

    render(<ConnectDropbox connectionOptions={{ repo, auth, resolveAccountId }} />);

    const connectButton = await screen.findByRole("button", { name: /connect dropbox/i });
    await user.click(connectButton);

    expect(auth.authorize).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /disconnect/i })).toBeTruthy();
    expect(screen.getByText(/dropbox connected/i)).toBeTruthy();
  });

  it("disconnects by clearing the connection marker via the repo", async () => {
    const user = userEvent.setup();
    await repo.save(createDropboxConnection("account-1", TOKENS));

    render(
      <ConnectDropbox
        connectionOptions={{ repo, auth: makeAuth(), resolveAccountId: vi.fn() }}
      />,
    );

    const disconnectButton = await screen.findByRole("button", { name: /disconnect/i });
    await user.click(disconnectButton);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect dropbox/i })).toBeTruthy(),
    );
    expect(await repo.get()).toBeNull();
  });
});
