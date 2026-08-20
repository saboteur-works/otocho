import { Button } from "@otocho/ui";
import { useDropboxConnection, type UseDropboxConnectionOptions } from "./useDropboxConnection";

export interface ConnectDropboxProps {
  connectionOptions?: UseDropboxConnectionOptions;
}

/**
 * App-shell entry point for connecting/disconnecting Dropbox (FR-2, FR-15).
 * Reachable at any point after first launch — not gated behind onboarding or
 * any other precondition. Renders a "Connect Dropbox" action when no
 * connection marker is present, or a "Dropbox connected" state with a
 * "Disconnect" action once one is (per {@link useDropboxConnection}).
 */
export function ConnectDropbox({ connectionOptions }: ConnectDropboxProps = {}) {
  const { connection, loading, connecting, error, connect, disconnect } =
    useDropboxConnection(connectionOptions);

  if (loading) {
    return null;
  }

  if (connection) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-label text-fg-tertiary">
        <span>Dropbox connected</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => void disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void connect()}
        disabled={connecting}
        className="font-mono text-xs uppercase tracking-label"
      >
        {connecting ? "Connecting…" : "Connect Dropbox"}
      </Button>
      {error ? <span className="text-xs text-fg-tertiary">{error}</span> : null}
    </div>
  );
}
