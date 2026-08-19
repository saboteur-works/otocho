import type { StoragePort } from "@otocho/storage";
import { createOnboardingMarker, type OnboardingMarker } from "./onboarding";

const COLLECTION = "app-meta";
const MARKER_ID = "onboarding-seed";

export interface OnboardingRepositoryDeps {
  storage: StoragePort;
  /** Clock for the `seededAt` timestamp. Defaults to the system clock. */
  now?: () => string;
}

/**
 * Persists and retrieves the onboarding seed marker through an injected
 * {@link StoragePort}, on the `app-meta` collection (D-1). The marker's
 * presence, not the example project's, is authoritative for "already
 * seeded" (FR-3).
 */
export class OnboardingRepository {
  private readonly storage: StoragePort;
  private readonly now: () => string;

  constructor(deps: OnboardingRepositoryDeps) {
    this.storage = deps.storage;
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async getMarker(): Promise<OnboardingMarker | null> {
    return this.storage.get<OnboardingMarker>(COLLECTION, MARKER_ID);
  }

  async markSeeded(exampleProjectId: string): Promise<OnboardingMarker> {
    const marker = createOnboardingMarker(exampleProjectId, { now: this.now });
    await this.storage.put(COLLECTION, marker);
    return marker;
  }
}
