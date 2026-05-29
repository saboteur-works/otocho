import { Link, useNavigate } from "react-router-dom";
import type { Project } from "@otocho/core";
import { CreateProject } from "./CreateProject";
import { ProjectList } from "./ProjectList";
import { useProjects } from "./useProjects";

export function ProjectsHome() {
  const navigate = useNavigate();
  const { projects, create } = useProjects();

  const open = (project: Project) => navigate(`/projects/${project.id}`);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-brand-dim bg-brand-surface p-6">
      <h2 className="font-sans text-lg font-medium text-fg-primary">Projects</h2>
      <CreateProject onCreate={create} onCreated={open} />
      <ProjectList projects={projects} onOpen={open} />
      <Link
        to="/trash"
        className="w-fit text-sm text-fg-tertiary hover:text-fg-primary"
      >
        Trash
      </Link>
    </section>
  );
}
