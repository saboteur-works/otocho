# @otocho/desktop (stub)

Electron wrapper for Otocho. **Not yet wired** — placeholder for the phased scaffold.

When implemented, this target loads the `@otocho/app` build (dev: its Vite server;
prod: the static `dist/`) inside an Electron shell, and provides the desktop
implementation of the `@otocho/storage` `StoragePort` backed by the Node filesystem.
