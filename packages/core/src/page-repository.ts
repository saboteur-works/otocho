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
    const page = await this.require(id);
    return this.save({ ...page, title: trimmed, updatedAt: this.now() });
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

    const ts = this.now();
    const updated: Page[] = [];
    for (let i = 0; i < reordered.length; i++) {
      const p = reordered[i];
      if (p.order !== i) {
        const saved = await this.save({ ...p, order: i, updatedAt: ts });
        updated.push(saved);
      } else {
        updated.push(p);
      }
    }
    return updated;
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
