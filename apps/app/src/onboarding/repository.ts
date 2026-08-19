import { OnboardingRepository } from "@otocho/core";
import { WebStorageAdapter } from "@otocho/storage/web";
import { pagesRepo } from "../pages/repository";
import { projectsRepo } from "../projects/repository";

/** The app's shared, IndexedDB-backed onboarding-marker repository. */
export const onboardingRepo = new OnboardingRepository({ storage: new WebStorageAdapter() });

/**
 * The app's shared repositories for onboarding seeding — reuses the same
 * singleton, IndexedDB-backed project/page repositories the rest of the app
 * uses, so seeding writes land in the same place normal user data does.
 */
export { pagesRepo, projectsRepo };
