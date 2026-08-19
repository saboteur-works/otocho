# Dev/QA: resetting onboarding-seed state

This is developer-facing documentation only. It ships no code to the
production app — see `specs/features/onboarding-example.md` (D-8), which
requires the onboarding-seed reset path to add zero code to the shipped
bundle (no query param, no `import.meta.env.DEV`-gated hook, no UI).

## What "onboarding-seed" is

On first launch, Otocho seeds a single example project and writes a marker
record so it never seeds again. The marker is stored through the normal
`StoragePort` seam, in the `app-meta` collection, as a record with
`id: "onboarding-seed"` (see `packages/core/src/onboarding.ts` and
`packages/core/src/onboarding-repository.ts`).

Presence of that marker record — not presence of the example project itself
— is what "already seeded" means. Deleting the example project (even
purging it from Trash) does not reset onboarding; only removing the marker
record does.

## Where the marker actually lives in the browser

The web app's `StoragePort` implementation (`packages/storage/src/web-adapter.ts`,
`WebStorageAdapter`) is IndexedDB-backed with these exact names:

- **IndexedDB database name:** `otocho`
- **Object store name:** `records` (a single store shared by every
  collection — there is no separate object store per collection)
- **Record key format:** `${collection}/${id}`

So the onboarding marker's exact IndexedDB key is:

```
app-meta/onboarding-seed
```

## Option A — Browser DevTools (recommended, always works)

1. Open the app in your browser and open DevTools.
2. Go to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox).
3. Expand **IndexedDB → otocho → records**.
4. Find the entry whose key is `app-meta/onboarding-seed` and delete it.
   - If you'd rather not hunt for the single key, you can instead delete the
     entire `otocho` database (right-click it → Delete database). This also
     clears all local Projects/Pages data, so prefer deleting just the one
     record if you want to keep your other local data.
5. Reload the app. First-launch seeding will run again.

## Option B — DevTools console snippet

Paste this into the browser's DevTools console while the app is open, then
reload the page:

```js
indexedDB.open("otocho").onsuccess = (openEvent) => {
  const db = openEvent.target.result;
  const tx = db.transaction("records", "readwrite");
  tx.objectStore("records").delete("app-meta/onboarding-seed");
  tx.oncomplete = () => console.log("onboarding-seed marker removed");
};
```

This is a one-off console snippet a developer pastes by hand — it is never
imported by, bundled with, or executed as part of the app itself.

## Option C — `pnpm` helper

`pnpm reset-onboarding` prints the exact steps and the console snippet above
to your terminal (see `scripts/reset-onboarding-seed.mjs`). It does not and
cannot touch a running browser's IndexedDB from Node — IndexedDB only exists
in a browser context — so it is a documentation-printing convenience, not an
automated reset. Nothing under `apps/app/src` references or imports this
script, and it is not part of the Vite production build.
