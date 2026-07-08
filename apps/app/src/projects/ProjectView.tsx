import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PageRepository,
  ProjectRepository,
  type Page,
  type PageType,
} from "@otocho/core";
import { NotesPage as NotesPageEditor } from "../pages/NotesPage";
import { BuildLogPage as BuildLogPageEditor } from "../pages/BuildLogPage";
import { PresetPage as PresetPageEditor } from "../pages/PresetPage";
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
import { pagesRepo } from "../pages/repository";
import { PageList } from "../pages/PageList";
import { usePages } from "../pages/usePages";
import type { Project } from "@otocho/core";

type Status = "loading" | "found" | "missing";

export interface ProjectViewProps {
  repo?: ProjectRepository;
  pageRepo?: PageRepository;
}

export function ProjectView({
  repo = projectsRepo,
  pageRepo = pagesRepo,
}: ProjectViewProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const { pages, loading, create, rename, reorder, mutatePage, deletePage } = usePages(
    id ?? "",
    pageRepo,
  );

  useEffect(() => {
    if (!id) { setStatus("missing"); return; }
    let active = true;
    repo.open(id).then(
      (opened) => { if (active) { setProject(opened); setStatus("found"); } },
      () => { if (active) setStatus("missing"); },
    );
    return () => { active = false; };
  }, [id, repo]);

  // Select the first page on initial load, or when pages change and nothing is selected.
  useEffect(() => {
    if (pages.length > 0 && (selectedPageId === null || !pages.find((p) => p.id === selectedPageId))) {
      setSelectedPageId(pages[0].id);
    }
    if (pages.length === 0) setSelectedPageId(null);
  }, [pages, selectedPageId]);

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

  async function handleCreate(type: PageType) {
    const page = await create(type);
    setSelectedPageId(page.id);
  }

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 px-4">
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-label text-fg-tertiary hover:text-fg-primary"
        >
          ← All projects
        </Link>
      </div>

      {status === "loading" ? <p className="px-4 text-fg-tertiary">Loading…</p> : null}
      {status === "missing" ? (
        <p role="alert" className="px-4 text-fg-secondary">
          That project could not be found.
        </p>
      ) : null}

      {status === "found" && project ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 px-4">
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
                  <Button type="submit" disabled={draft.trim().length === 0}>Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">{error}</p>
                ) : null}
              </form>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold tracking-heading text-fg-primary">
                  {project.name}
                </h2>
                <Button variant="outline" size="sm" onClick={startEditing}>Rename</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{project.name}" will move to Trash, where you can restore it.
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
              </>
            )}
          </div>

          {loading ? (
            <p className="px-4 text-fg-tertiary">Loading pages…</p>
          ) : (
            <div className="flex gap-0 rounded-lg border border-brand-rule overflow-hidden">
              <aside className="w-52 flex-shrink-0 border-r border-brand-rule bg-brand-black p-3">
                <PageList
                  pages={pages}
                  selectedId={selectedPageId}
                  onSelect={(page) => setSelectedPageId(page.id)}
                  onCreate={handleCreate}
                  onRename={rename}
                  onDelete={deletePage}
                  onReorder={reorder}
                />
              </aside>

              <div className="flex flex-1 flex-col p-6">
                <PageContent page={selectedPage} onMutate={mutatePage} />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PageContent({
  page,
  onMutate,
}: {
  page: Page | null;
  onMutate: <P extends Page>(id: string, transform: (page: P) => P) => Promise<void>;
}) {
  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-fg-tertiary">Add a page to get started.</p>
      </div>
    );
  }

  // `page` is narrowed by `type` in each branch, so the editors and their
  // transforms are fully typed — no casts needed.
  if (page.type === "notes") {
    return <NotesPageEditor page={page} onSave={(t) => onMutate(page.id, t)} />;
  }

  if (page.type === "build-log") {
    return <BuildLogPageEditor page={page} onSave={(t) => onMutate(page.id, t)} />;
  }

  return <PresetPageEditor page={page} onSave={(t) => onMutate(page.id, t)} />;
}
