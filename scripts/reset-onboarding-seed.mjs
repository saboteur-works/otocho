#!/usr/bin/env node
/**
 * Dev/QA helper for re-exercising Otocho's first-launch onboarding seed
 * (specs/features/onboarding-example.md, D-8).
 *
 * IndexedDB only exists in a browser context, so this script cannot reach
 * into a running browser's storage from Node. Instead it prints the exact
 * steps (and a paste-into-devtools-console snippet) a developer needs to
 * delete the "app-meta"/"onboarding-seed" marker record, so first-launch
 * seeding runs again on next reload.
 *
 * This script is never imported by anything under apps/app/src and is not
 * part of the Vite production build — it only runs via `pnpm reset-onboarding`.
 */

const DB_NAME = "otocho";
const STORE_NAME = "records";
const MARKER_KEY = "app-meta/onboarding-seed";

const snippet = `indexedDB.open(${JSON.stringify(DB_NAME)}).onsuccess = (openEvent) => {
  const db = openEvent.target.result;
  const tx = db.transaction(${JSON.stringify(STORE_NAME)}, "readwrite");
  tx.objectStore(${JSON.stringify(STORE_NAME)}).delete(${JSON.stringify(MARKER_KEY)});
  tx.oncomplete = () => console.log("onboarding-seed marker removed");
};`;

console.log(`
Otocho dev/QA: reset onboarding-seed
=====================================

This cannot be done from Node — IndexedDB only exists in a browser. Do one
of the following in the browser running the app:

Option A — DevTools UI
  1. Open DevTools -> Application (Chrome/Edge) or Storage (Firefox) tab.
  2. IndexedDB -> ${DB_NAME} -> ${STORE_NAME}
  3. Delete the record whose key is "${MARKER_KEY}".
  4. Reload the app.

Option B — paste into the DevTools console, then reload:

${snippet}

Full details: docs/dev-onboarding-reset.md
`);
