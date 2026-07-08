import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { ProjectsHome } from "./projects/ProjectsHome";
import { ProjectView } from "./projects/ProjectView";
import { TrashView } from "./projects/TrashView";

export function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col">
        <header className="mx-auto w-full max-w-2xl flex-shrink-0 px-6 pb-8 pt-16 flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
            音帳 — sound notebook
          </p>
          <Link to="/" className="w-fit">
            <h1 className="font-display text-4xl font-bold tracking-display text-fg-primary">
              Otocho
            </h1>
          </Link>
        </header>

        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <NarrowContent>
                  <ProjectsHome />
                </NarrowContent>
              }
            />
            <Route path="/projects/:id" element={<WideContent><ProjectView /></WideContent>} />
            <Route
              path="/trash"
              element={
                <NarrowContent>
                  <TrashView />
                </NarrowContent>
              }
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

function NarrowContent({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-6 pb-16">{children}</div>;
}

function WideContent({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 pb-16">{children}</div>;
}
