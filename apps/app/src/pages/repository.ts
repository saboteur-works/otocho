import { PageRepository } from "@otocho/core";
import { WebStorageAdapter } from "@otocho/storage/web";

/** The app's shared, IndexedDB-backed page repository. */
export const pagesRepo = new PageRepository({ storage: new WebStorageAdapter() });
