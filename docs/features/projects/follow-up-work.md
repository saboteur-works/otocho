# Projects — Follow-up Work

Deferred items discovered during implementation, with context for future work.

## 2026-05-25 — Task 1 (Project repository + durable persistence)

- **OPFS not implemented; IndexedDB chosen.** `WebStorageAdapter` uses IndexedDB
  (async, well-supported, fits the async `StoragePort`). The tasks doc mentioned
  "OPFS/IndexedDB". Revisit OPFS only if true file-per-page *blob* storage is needed
  — most relevant when Dropbox sync (FR-11/12) lands and per-page files must map to
  real files for conflict scoping. IndexedDB is sufficient until then.

- **Transaction resolves on request success, not transaction completion.**
  `WebStorageAdapter.run()` resolves on `request.onsuccess`. Real IndexedDB auto-commits
  the transaction immediately after, so this is safe in practice, but resolving on
  `tx.oncomplete` for writes would be a stricter durability guarantee. Low priority.

- **Desktop/mobile storage adapters still stubbed.** Only the web (IndexedDB) adapter
  exists. Electron (node fs) and Capacitor (Filesystem) adapters implement the same
  `StoragePort` and are tracked with the platform-wrapper work, not the Projects feature.

- **`crypto.randomUUID` accessed via a `globalThis` cast** in `packages/core/src/project.ts`
  to keep `core` DOM-/node-types-free. Works on all target runtimes (browser, Node 19+,
  Capacitor). If `core` ever gains a types lib that includes `crypto`, simplify the cast.

## 2026-05-25 — Task 2 (Create project)

- ~~**"Opens it on success" (FR-3) is a placeholder.**~~ **Resolved 2026-05-25 (Task 3):**
  `App.tsx` is now a `HashRouter`; creating or opening a project navigates to `/projects/:id`
  (`ProjectView`). The local `openProject` state was removed.

- **React Router v7 future-flag warnings** appear in tests (`v7_startTransition`,
  `v7_relativeSplatPath`). Harmless on v6; opt into the flags (or upgrade to v7) when convenient.

- **`HashRouter` chosen for cross-platform** (web + Electron `file://` + Capacitor without
  server route config). If the web target later wants clean URLs, revisit `BrowserRouter`
  with the appropriate desktop/mobile handling.

- **No Storybook story for `Input` yet.** `Button` has stories; `Input` was added without one.
  Add a story for design-system coverage when convenient (not blocking).
