import { Link } from "react-router-dom";
import type { ProjectRepository } from "@otocho/core";
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
} from "@otocho/ui";
import { useTrash } from "./useTrash";

export interface TrashViewProps {
  repo?: ProjectRepository;
}

/** Trash: soft-deleted projects, each restorable or permanently removable. */
export function TrashView({ repo }: TrashViewProps) {
  const { deleted, restore, purge } = useTrash(repo);

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/"
        className="font-mono text-xs uppercase tracking-label text-fg-tertiary hover:text-fg-primary"
      >
        ← All projects
      </Link>

      <h2 className="font-display text-2xl font-bold tracking-heading text-fg-primary">
        Trash
      </h2>

      {deleted.length === 0 ? (
        <p className="text-fg-tertiary">Trash is empty.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deleted.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between gap-3 rounded-md border border-brand-rule bg-brand-black px-4 py-3"
            >
              <span className="text-fg-secondary">{project.name}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void restore(project.id)}>
                  Restore
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete forever
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{project.name}” forever?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the project. It cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void purge(project.id)}>
                        Delete permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
