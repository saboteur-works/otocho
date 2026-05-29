import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Project, ProjectRepository } from "@otocho/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
} from "@otocho/ui";
import { projectsRepo } from "./repository";

type Status = "loading" | "found" | "missing";

export interface ProjectViewProps {
  repo?: ProjectRepository;
}

/**
 * Opened-project screen. Marks the project opened on mount (advancing recency),
 * shows its name with inline rename, and leaves the body as a pages placeholder.
 */
export function ProjectView({ repo = projectsRepo }: ProjectViewProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setStatus("missing");
      return;
    }
    let active = true;
    repo.open(id).then(
      (opened) => {
        if (active) {
          setProject(opened);
          setStatus("found");
        }
      },
      () => {
        if (active) setStatus("missing");
      },
    );
    return () => {
      active = false;
    };
  }, [id, repo]);

  function startEditing() {
    if (!project) return;
    setDraft(project.name);
    setError(null);
    setEditing(true);
  }

  async function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    const name = draft.trim();
    if (name.length === 0) return;
    try {
      setProject(await repo.rename(project.id, name));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename project.");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setEditing(false);
  }

  async function confirmDelete() {
    if (!project) return;
    await repo.softDelete(project.id);
    navigate("/");
  }

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/"
        className="font-mono text-xs uppercase tracking-label text-fg-tertiary hover:text-fg-primary"
      >
        ← All projects
      </Link>

      {status === "loading" ? <p className="text-fg-tertiary">Loading…</p> : null}

      {status === "missing" ? (
        <p role="alert" className="text-fg-secondary">
          That project could not be found.
        </p>
      ) : null}

      {status === "found" && project ? (
        <div className="flex flex-col gap-2">
          {editing ? (
            <form onSubmit={submitRename} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Project name"
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <Button type="submit" disabled={draft.trim().length === 0}>
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold tracking-heading text-fg-primary">
                {project.name}
              </h2>
              <Button variant="outline" size="sm" onClick={startEditing}>
                Rename
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                    <AlertDialogDescription>
                      “{project.name}” will move to Trash, where you can restore it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void confirmDelete()}>
                      Delete project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          <p className="text-fg-tertiary">Pages arrive in a later feature.</p>
        </div>
      ) : null}
    </section>
  );
}
