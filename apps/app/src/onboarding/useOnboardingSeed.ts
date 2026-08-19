import { useEffect, useState } from "react";
import {
  ensureOnboardingSeeded,
  type OnboardingRepository,
  type PageRepository,
  type ProjectRepository,
} from "@otocho/core";
import { onboardingRepo, pagesRepo, projectsRepo } from "./repository";

export interface UseOnboardingSeedOptions {
  projects?: ProjectRepository;
  pages?: PageRepository;
  onboarding?: OnboardingRepository;
}

export interface UseOnboardingSeed {
  ready: boolean;
}

/**
 * Runs the first-launch example-project seed check exactly once per mount
 * against the app's live repositories (D-6), deferring to
 * {@link ensureOnboardingSeeded}'s own per-`onboarding`-instance in-flight
 * guard (FR-4) for concurrent/duplicate invocation — this hook does no
 * concurrency handling of its own. `ready` is `false` until the underlying
 * seed check resolves, `true` after (whether or not it actually seeded
 * anything).
 */
export function useOnboardingSeed(options: UseOnboardingSeedOptions = {}): UseOnboardingSeed {
  const {
    projects = projectsRepo,
    pages = pagesRepo,
    onboarding = onboardingRepo,
  } = options;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void ensureOnboardingSeeded({ projects, pages, onboarding }).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [projects, pages, onboarding]);

  return { ready };
}
