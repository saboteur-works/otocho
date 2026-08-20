import { useState } from "react";
import { Button } from "@otocho/ui";
import { useSyncStatus, type SyncStatusVisibleCause, type UseSyncStatusOptions } from "./useSyncStatus";

/** D-6's "why" detail text per specific cause. */
const CAUSE_DETAIL: Record<SyncStatusVisibleCause, string> = {
  disconnected: "Dropbox isn't connected.",
  "auth-failure": "Dropbox authentication failed — reconnect to resume syncing.",
  "out-of-space": "Your Dropbox account is out of space.",
};

export interface SyncStatusBannerProps {
  statusOptions?: UseSyncStatusOptions;
}

/**
 * FR-13's always-visible "not synced" warning, with D-6's two-tier detail:
 * a generic message is shown whenever sync is unavailable (disconnected,
 * auth failure, or Dropbox out-of-space — FR-12), and an expandable "why"
 * affordance reveals the specific cause when `SyncEngine`'s status surface
 * carries one, or says nothing more specific when it doesn't. Renders
 * nothing while sync is working. This component only reads sync status via
 * `useSyncStatus` — it never gates or otherwise affects ordinary
 * project/page CRUD through `useProjects`/`usePages` (FR-12).
 */
export function SyncStatusBanner({ statusOptions }: SyncStatusBannerProps = {}) {
  const { visible, cause, retryNow } = useSyncStatus(statusOptions);
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  const detail = cause ? CAUSE_DETAIL[cause] : undefined;

  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-2xl flex-col gap-1 px-6 font-mono text-xs uppercase tracking-label text-fg-tertiary"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>Not synced — changes aren&apos;t backed up to Dropbox.</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide details" : "Why?"}
        </Button>
        {cause && cause !== "disconnected" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void retryNow()}>
            Retry sync now
          </Button>
        ) : null}
      </div>
      {expanded ? <span>{detail ?? "No further detail is available."}</span> : null}
    </div>
  );
}
