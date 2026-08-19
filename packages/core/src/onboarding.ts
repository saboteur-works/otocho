/**
 * Onboarding seed marker — records that the first-launch example project has
 * been seeded. See specs/features/onboarding-example.md (D-1, FR-2).
 *
 * The marker's presence, not the example project's, is authoritative for
 * "already seeded" (FR-3): a later deletion of the example project must
 * never be mistaken for "never seeded".
 */
export interface OnboardingMarker {
  id: "onboarding-seed";
  seededAt: string;
  exampleProjectId: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type CreateOnboardingMarkerOptions = {
  /** Override the clock used for the `seededAt` timestamp. */
  now?: () => string;
};

export function createOnboardingMarker(
  exampleProjectId: string,
  options: CreateOnboardingMarkerOptions = {},
): OnboardingMarker {
  const trimmed = exampleProjectId.trim();
  if (trimmed.length === 0) {
    throw new Error("An onboarding marker requires an exampleProjectId.");
  }
  const ts = (options.now ?? nowIso)();
  return {
    id: "onboarding-seed",
    seededAt: ts,
    exampleProjectId: trimmed,
  };
}
