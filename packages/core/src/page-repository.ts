import type { StoragePort } from "@otocho/storage";
import {
  byOrder,
  createPage,
  newId,
  type CreatePageOptions,
  type Page,
  type PageType,
} from "./page";

const COLLECTION = "pages";

export interface PageRepositoryDeps {
  storage: StoragePort;
  now?: () => string;
  generateId?: () => string;
}

/**
 * Persists and retrieves pages through an injected {@link StoragePort}.
 * One record per page keeps sync conflicts page-scoped (FR-12).
 * All reads and writes are project-scoped.
 */
export class PageRepository {
  private readonly storage: StoragePort;
  private readonly now: () => string;
  private readonly generateId: () => string;
  /** Tail of the in-flight mutation chain per page id (see {@link mutate}). */
  private readonly mutations = new Map<string, Promise<unknown>>();

  constructor(deps: PageRepositoryDeps) {
    this.storage = deps.storage;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.generateId = deps.generateId ?? newId;
  }

  async create(
    projectId: string,
    type: PageType,
    title?: string,
  ): Promise<Page> {
    const siblings = await this.list(projectId);
    const order = siblings.length > 0 ? siblings[siblings.length - 1].order + 1 : 0;
    const options: CreatePageOptions = { id: this.generateId(), now: this.now };
    const page = createPage(type, { projectId, title, order }, options);
    await this.storage.put(COLLECTION, page);
    return page;
  }

  async get(id: string): Promise<Page | null> {
    return this.storage.get<Page>(COLLECTION, id);
  }

  /** Pages belonging to a project, sorted by `order` then creation time (FR-3). */
  async list(projectId: string): Promise<Page[]> {
    const all = await this.storage.list<Page>(COLLECTION);
    return all.filter((p) => p.projectId === projectId).sort(byOrder);
  }

  async rename(id: string, title: string): Promise<Page> {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error("Page title is required.");
    }
    // Route through the serialized merge write so a rename fired while a field
    // autosave is in flight merges onto the freshest record instead of
    // clobbering the just-typed body/params (see {@link mutate}).
    return this.mutate(id, (page) => ({ ...page, title: trimmed }));
  }

  /**
   * Reorder a page to `newIndex` within its project's page list (FR-3).
   * Rewrites `order` on the moved page and any siblings whose position
   * changed, keeping values contiguous.
   */
  async reorder(id: string, newIndex: number): Promise<Page[]> {
    const page = await this.require(id);
    const siblings = await this.list(page.projectId);
    const fromIndex = siblings.findIndex((p) => p.id === id);
    if (fromIndex === -1) throw new Error(`Page ${id} missing from its project list.`);

    const clamped = Math.max(0, Math.min(newIndex, siblings.length - 1));
    if (fromIndex === clamped) return siblings;

    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(clamped, 0, moved);

    const updated: Page[] = [];
    for (let i = 0; i < reordered.length; i++) {
      const p = reordered[i];
      if (p.order !== i) {
        // Merge the new order through the serialized write path, so a
        // concurrent field autosave on this page isn't clobbered by a stale
        // full-record snapshot (see {@link mutate}).
        updated.push(await this.mutate(p.id, (fresh) => ({ ...fresh, order: i })));
      } else {
        updated.push(p);
      }
    }
    return updated;
  }

  /** Persist updated page content. `updatedAt` is always refreshed. */
  async update(page: Page): Promise<Page> {
    await this.require(page.id);
    return this.save({ ...page, updatedAt: this.now() });
  }

  /**
   * Serialized read-merge-write. Reads the freshest stored record, applies a
   * pure transform, refreshes `updatedAt`, and persists the result. Mutations
   * to the same page id run strictly one at a time, so concurrent edits — a
   * debounced field save racing an immediate change, or two field edits in
   * flight together — each merge onto the latest record instead of clobbering
   * it. One record per page keeps this page-scoped (FR-12).
   */
  async mutate(id: string, transform: (page: Page) => Page): Promise<Page> {
    const prior = this.mutations.get(id) ?? Promise.resolve();
    const result = prior.then(
      () => this.applyMutation(id, transform),
      () => this.applyMutation(id, transform),
    );
    // Keep the per-id chain alive but swallowed, so one failure doesn't reject
    // the next queued mutation.
    this.mutations.set(id, result.then(undefined, () => undefined));
    return result;
  }

  private async applyMutation(id: string, transform: (page: Page) => Page): Promise<Page> {
    const current = await this.require(id);
    return this.save({ ...transform(current), updatedAt: this.now() });
  }

  async delete(id: string): Promise<void> {
    await this.require(id);
    await this.storage.remove(COLLECTION, id);
  }

  private async require(id: string): Promise<Page> {
    const page = await this.get(id);
    if (!page) throw new Error(`Page not found: ${id}`);
    return page;
  }

  private async save(page: Page): Promise<Page> {
    await this.storage.put(COLLECTION, page);
    return page;
  }
}
