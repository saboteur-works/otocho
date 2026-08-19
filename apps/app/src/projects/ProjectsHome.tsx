import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  OnboardingRepository,
  PageRepository,
  Project,
  ProjectRepository,
} from "@otocho/core";
import { CreateProject } from "./CreateProject";
import { ProjectList } from "./ProjectList";
import { useProjects } from "./useProjects";
import { projectsRepo as defaultProjectsRepo } from "./repository";
import { useOnboardingSeed } from "../onboarding/useOnboardingSeed";

export interface ProjectsHomeProps {
  projects?: ProjectRepository;
  pages?: PageRepository;
  onboarding?: OnboardingRepository;
}

/**
 * Renders the heading and the {@link CreateProject} CTA immediately, on
 * every render, independent of onboarding-seed state (FR-9) — the create
 * handler talks to the project repository directly, not through
 * {@link useProjects}, so it never waits on the seed check either.
 *
 * The project list itself is backed by `useProjects`, whose fetch-on-mount
 * effect (`repo.list()`) is deferred by not mounting the list subtree
 * ({@link ProjectListSection}) until `useOnboardingSeed`'s `ready` flips
 * `true` — so the initial list read never races the seed write (FR-10).
 * This gating is entirely local to this component; the app shell
 * (header/routing in `App.tsx`) is unaffected (D-6).
 */
export function ProjectsHome({ projects, pages, onboarding }: ProjectsHomeProps = {}) {
  const navigate = useNavigate();
  const repo = projects ?? defaultProjectsRepo;
  const { ready } = useOnboardingSeed({ projects, pages, onboarding });

  const open = (project: Project) => navigate(`/projects/${project.id}`);
  const create = useCallback((name: string) => repo.create({ name }), [repo]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-brand-dim bg-brand-surface p-6">
      <h2 className="font-sans text-lg font-medium text-fg-primary">Projects</h2>
      <CreateProject onCreate={create} onCreated={open} />
      {ready ? <ProjectListSection repo={repo} onOpen={open} /> : null}
      <Link
        to="/trash"
        className="w-fit text-sm text-fg-tertiary hover:text-fg-primary"
      >
        Trash
      </Link>
    </section>
  );
}

interface ProjectListSectionProps {
  repo: ProjectRepository;
  onOpen: (project: Project) => void;
}

/**
 * Mounting this component is what triggers `useProjects`'s fetch-on-mount
 * effect — kept separate from `ProjectsHome` so that effect literally
 * cannot fire until the parent decides seeding has settled (FR-10).
 */
function ProjectListSection({ repo, onOpen }: ProjectListSectionProps) {
  const { projects } = useProjects(repo);
  return <ProjectList projects={projects} onOpen={onOpen} />;
}
