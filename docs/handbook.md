# Otocho Handbook

*音帳 — "sound-notebook"*

Otocho is a notebook for your audio projects that lives **outside** your DAW. Instead of blank documents, each project holds purpose-built **pages** — a place to jot notes, log how a track came together, and record the plugin settings that made a sound work. It's a home for all the context a session file can't hold, and a record of your work that survives even when the DAW file doesn't.

This handbook walks through everything you can do today.

> **Where your work lives.** Otocho runs entirely in your browser and saves to it automatically — there's no account and no sign-in. Everything you type is stored locally on the machine you're using. (Cross-device sync is on the roadmap but not yet available.)

---

## The big picture

Otocho is organized in two levels:

- **Projects** — one per track, EP, episode, or whatever you're working on. Your home screen is a list of these.
- **Pages** — the contents of a project. Every page has a *type* that shapes what it's good for. You add as many as you like and arrange them in any order.

There are three page types:

| Page | What it's for |
| --- | --- |
| **Notes** | Free-form text — anything that doesn't fit the other two. |
| **Build log** | How a track came together: a running arrangement sketch plus a time-stamped feed of the *moves* you made. |
| **Presets** | Track-scoped plugin/parameter settings — a device chain you can read back later or rebuild in any DAW. |

Nothing here reads or talks to your DAW. You type things in by hand; the payoff is that it works with **any** DAW and is still readable years later.

---

## Projects

### Creating a project

On the home screen, type a name into the **"Name a new project…"** field and press **Create** (or Enter). The project opens immediately, ready for its first page.

### Opening and renaming

Click any project in the list to open it. Projects are listed **most-recently-opened first**, so what you're actively working on stays at the top.

Inside a project, click **Rename** next to the title, edit the name, and press **Save** (Escape cancels).

### Deleting and Trash

Click **Delete** on a project and it moves to **Trash** — it isn't gone yet. From the home screen, follow the **Trash** link to:

- **Restore** — put the project back on your home screen, or
- **Delete forever** — remove it permanently (this can't be undone, so Otocho asks you to confirm).

This two-step delete means an accidental click never loses work.

---

## Pages

Open a project and you'll see the **Pages** rail on the left and the current page's editor on the right.

### Adding a page

Click the **＋** at the top of the Pages rail and pick a type — **Notes**, **Build log**, or **Presets**. The new page is created, selected, and given a sensible starting title (a Notes page is titled "Notes", a Presets page "New track", and so on). Rename it any time.

### Managing pages

Each page row has a **⋯** menu with:

- **Rename** — give the page a title that means something (for a Presets page, this is the *track name*).
- **Delete** — remove the page.

To **reorder** pages, grab the dotted handle on the left of a row and drag it up or down. The order you set is the order you'll always see.

### Saving

You never press Save inside a page editor. Otocho **autosaves** as you type — a small "Saving…" / "Saved" note appears so you know it's captured. (Project and page *renames* are the one place you confirm with a Save button.)

---

## Search

Click **Search** in the header (from any screen) to open the search overlay, then start typing.

Search looks across **every project and page you have** — not just the one you're currently viewing — matching notes bodies, build-log sketches and moves, and preset track/device/parameter names and values. There's no separate "recent items" list before you type; the overlay stays quiet until you enter a query.

Results are a flat list, each row showing the project and page the match came from, which field matched (e.g. "Sketch", "Param value"), and a short snippet around the match. Click a result to jump straight to that page in its project.

Search is manual-entry, exact-substring matching (case-insensitive) — there's no fuzzy matching, ranking, or typo tolerance yet.

---

## The Notes page

The simplest page: one big text area. Click in and type anything — a stray idea, a reference link, a reminder. It saves itself as you go. Give the page a meaningful title from the **⋯ → Rename** menu so you can find it later.

Use it for whatever doesn't warrant a Build log or Presets page.

---

## The Build log page

This is where you record **how a track came together** — so months later you can remember (and repeat) exactly what worked. It has two parts.

### Sketch

The **Sketch** area at the top is a free-text scratchpad for the shape of the track: arrangement ideas, references, structure, anything. It autosaves as you type.

### Moves

Below the sketch is the **Moves** feed — a running, time-stamped log of the individual decisions you made, newest grouped under each day.

- Type into the **"Add a move…"** box at the bottom and press **Enter** to append it. Use **Shift+Enter** for a line break within a move.
- Each move is stamped with the time you added it and grouped by day, so the feed reads like a build diary.
- Hover a move and use its **⋯** menu to **Edit** or **Delete** it.

The idea is to capture moves *mid-flow* — a quick line like "swapped the reverb for a shorter plate" or "dropped the second chorus" — without breaking your stride. The log is the story of the track.

---

## The Presets page

A Presets page captures the **plugin/parameter settings for a single track** — its device chain — in a form you can read back or rebuild in any DAW. Rename the page to the track it belongs to.

### The device chain

Across the top is the **device chain**, shown left-to-right with arrows between devices (mirroring signal flow). Click **＋** to add a device. Drag devices to reorder the chain. Click a device to open its details below.

### Inside a device

Each device has:

- **A name** — click it to rename (e.g. "Pro-Q 3", "1176", "Serum"). The **✕** deletes the device.
- **Settings** — a free-text area for notes about the device: the preset name, the vibe, why it's there.
- **Parameters** — precise **key = value** pairs for the settings that matter (e.g. `threshold = -18 dB`, `ratio = 4:1`). Click **add parameter**, fill in the key and value, and use the **✕** to remove one.

Use Settings for the prose and Parameters for the exact numbers — enough to recreate the sound from scratch later.

---

## Tips

- **Rename generously.** A rail full of "Notes", "Notes", "New track" is hard to scan. Titles are how you'll find things.
- **Log moves as you make them.** The Build log earns its keep when it's filled mid-session, not reconstructed afterward.
- **One project per unit of work.** A track, an EP, a podcast episode — whatever you think of as one thing.
- **Presets are DAW-agnostic on purpose.** You're writing down human-readable settings, not saving a binary preset file — that's what lets you rebuild the sound anywhere.

---

## Good to know

- **Your data is local.** Everything is stored in the browser on the device you're using. It isn't uploaded anywhere and isn't yet synced between devices — clearing your browser's site data will remove it.
- **Deleting a project is reversible; deleting a page is not.** Projects go to Trash first; pages and moves are removed immediately (with a confirmation for destructive actions).
- **No audio, no MIDI, no DAW integration** — Otocho is a notebook, by design. It complements your DAW rather than replacing any part of it.

---

*Otocho is a [SAB/works](https://saboteur.works) product. For the product vision and roadmap, see [`concept.md`](concept.md) and [`spec.md`](spec.md).*
