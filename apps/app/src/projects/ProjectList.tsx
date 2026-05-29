import type { Project } from "@otocho/core";

export interface ProjectListProps {
  projects: Project[];
  onOpen: (project: Project) => void;
}

/** Active projects, one openable row each. Order is decided by the caller (recency). */
export function ProjectList({ projects, onOpen }: ProjectListProps) {
  if (projects.length === 0) {
    return <p className="text-fg-tertiary">No projects yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {projects.map((project) => (
        <li key={project.id}>
          <button
            type="button"
            onClick={() => onOpen(project)}
            className="w-full rounded-md border border-brand-rule bg-brand-black px-4 py-3 text-left text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {project.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
