import { ProjectRepository } from "@otocho/core";
import { WebStorageAdapter } from "@otocho/storage/web";

/** The app's shared, IndexedDB-backed project repository. */
export const projectsRepo = new ProjectRepository({ storage: new WebStorageAdapter() });
