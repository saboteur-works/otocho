import { useState, type FormEvent } from "react";
import { Button, Input } from "@otocho/ui";
import type { Project } from "@otocho/core";

export interface CreateProjectProps {
  onCreate: (name: string) => Promise<Project>;
  onCreated?: (project: Project) => void;
}

/** Inline create: a name field + submit, no modal (FR-9). Two interactions. */
export function CreateProject({ onCreate, onCreated }: CreateProjectProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmed.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const project = await onCreate(trimmed);
      setName("");
      onCreated?.(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          aria-label="New project name"
          placeholder="Name a new project…"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={submitting}
        />
        <Button type="submit" disabled={trimmed.length === 0 || submitting}>
          Create
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
