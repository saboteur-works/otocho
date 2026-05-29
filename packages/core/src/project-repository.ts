import type { StoragePort } from "@otocho/storage";
import {
  byRecency,
  createProject,
  isDeleted,
  newProjectId,
  type NewProjectInput,
  type Project,
} from "./project";

const COLLECTION = "projects";

export interface ProjectRepositoryDeps {
  storage: StoragePort;
  /** Clock for mutation timestamps. Defaults to the system clock. */
  now?: () => string;
  /** Id generator for new projects. Defaults to a UUID. */
  generateId?: () => string;
}

/**
 * Persists and retrieves projects through an injected {@link StoragePort},
 * so the same logic runs on every platform (web, desktop, mobile) and behind
 * future sync. Identity is the stable `id`; names may collide.
 */
export class ProjectRepository {
  private readonly storage: StoragePort;
  private readonly now: () => string;
  private readonly generateId: () => string;

  constructor(deps: ProjectRepositoryDeps) {
    this.storage = deps.storage;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.generateId = deps.generateId ?? newProjectId;
  }

  async create(input: NewProjectInput): Promise<Project> {
    const project = createProject(input, { id: this.generateId(), now: this.now });
    await this.storage.put(COLLECTION, project);
    return project;
  }

  async get(id: string): Promise<Project | null> {
    return this.storage.get<Project>(COLLECTION, id);
  }

  /** Active projects, most-recently-opened first (FR-4). */
  async list(): Promise<Project[]> {
    const all = await this.storage.list<Project>(COLLECTION);
    return all.filter((p) => !isDeleted(p)).sort(byRecency);
  }

  /** Soft-deleted projects, most-recently-opened first (trash view, FR-8). */
  async listDeleted(): Promise<Project[]> {
    const all = await this.storage.list<Project>(COLLECTION);
    return all.filter(isDeleted).sort(byRecency);
  }

  /** Mark a project as opened, advancing recency without editing content. */
  async open(id: string): Promise<Project> {
    const project = await this.require(id);
    return this.save({ ...project, lastOpenedAt: this.now() });
  }

  async rename(id: string, name: string): Promise<Project> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("Project name is required.");
    }
    const project = await this.require(id);
    return this.save({ ...project, name: trimmed, updatedAt: this.now() });
  }

  async softDelete(id: string): Promise<Project> {
    const project = await this.require(id);
    const ts = this.now();
    return this.save({ ...project, deletedAt: ts, updatedAt: ts });
  }

  async restore(id: string): Promise<Project> {
    const project = await this.require(id);
    return this.save({ ...project, deletedAt: null, updatedAt: this.now() });
  }

  /** Permanent, irreversible removal. */
  async purge(id: string): Promise<void> {
    await this.storage.remove(COLLECTION, id);
  }

  private async require(id: string): Promise<Project> {
    const project = await this.get(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }
    return project;
  }

  private async save(project: Project): Promise<Project> {
    await this.storage.put(COLLECTION, project);
    return project;
  }
}
