import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { ProjectsHome } from "./projects/ProjectsHome";
import { ProjectView } from "./projects/ProjectView";
import { TrashView } from "./projects/TrashView";

export function App() {
  return (
    <HashRouter>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
            音帳 — sound notebook
          </p>
          <Link to="/" className="w-fit">
            <h1 className="font-display text-4xl font-bold tracking-display text-fg-primary">
              Otocho
            </h1>
          </Link>
        </header>

        <Routes>
          <Route path="/" element={<ProjectsHome />} />
          <Route path="/projects/:id" element={<ProjectView />} />
          <Route path="/trash" element={<TrashView />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
