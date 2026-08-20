import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { ConnectDropbox } from "./dropbox/ConnectDropbox";
import { ProjectsHome } from "./projects/ProjectsHome";
import { ProjectView } from "./projects/ProjectView";
import { TrashView } from "./projects/TrashView";
import { SearchOverlay } from "./search/SearchOverlay";

export function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-2xl flex-shrink-0 flex-col gap-2 px-6 pb-8 pt-16">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-label text-fg-tertiary">
              音帳 — sound notebook
            </p>
            <div className="flex items-center gap-4">
              <ConnectDropbox />
              <SearchOverlay />
            </div>
          </div>
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
