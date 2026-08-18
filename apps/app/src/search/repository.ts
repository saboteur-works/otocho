import { pagesRepo } from "../pages/repository";
import { projectsRepo } from "../projects/repository";

/**
 * The app's shared repositories for search — reuses the same singleton,
 * IndexedDB-backed repositories the projects/pages features use, so search
 * reads live data (FR-2).
 */
export { pagesRepo, projectsRepo };
