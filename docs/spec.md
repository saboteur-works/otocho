# Product Spec: Otocho

**Milestone scope:** MVP only (v1 and v2 requirements are deferred — see Out of Scope)
**Status:** Draft
**Source concept:** Otocho (音帳, "sound-notebook") — a DAW-agnostic notebook and idea sketchpad for audio projects

## Overview

Otocho is a notebook organized around projects, where each project holds purpose-built pages rather than blank documents. It gives DAW users a structured home — outside the DAW — for the context they otherwise lose track of: the settings that made a sound work, the sequence of moves that made a track come together, and the loose notes around a project. Because content lives outside the DAW and syncs across machines, it doubles as durable project memory that survives even when a DAW project file is lost, corrupted, or stranded on another computer. The MVP is deliberately DAW-agnostic and manual-entry: it never reads or parses DAW files, keeping it usable with any DAW.

## Goals

- A producer can create a project and populate it with purpose-built pages (Notes, Build log, Presets).
- A producer can record how a track came together — arrangement/idea sketch plus the sequence of moves — in a Build log.
- A producer can capture track-scoped plugin/parameter settings on a preset page and find them later.
- A producer can access an up-to-date copy of their notebook on desktop, web, and mobile, with content synced.
- A producer can retrieve any past setting, note, or move by searching across all projects and pages.
- The product delivers all MVP value via manual entry, with no DAW integration required.

## Non-goals

- Not a DAW, multitrack arranger, sequencer, audio editor, or plugin host; the MVP plays no audio or MIDI.
- Not a DAW integration — the MVP does not read, parse, or import DAW project files.
- Not a general-purpose note app or wiki — pages are purpose-built, not blank canvases.
- Not collaborative — no sharing, export, or multiplayer in the MVP (deferred to v2).
- Not a hosted backend — Otocho runs no first-party sync/storage server; sync rides on the user's own cloud storage (BYOS).
- Not a sample/loop marketplace.
- Explicitly deferred from MVP: the Sketch page, to-do page, reference page, mobile quick-capture inbox, and templates (all v1); sharing/export, cross-project preset library, audience page packs, and rich linking (all v2).

## Users

**Producers / musicians (primary, MVP target)**
People whose primary creative tool is a DAW and who accumulate more project context (settings, arrangement ideas, moves, notes) than the DAW comfortably holds.
**Key need:** A reliable place outside the DAW to record and re-find how their work was made, across machines.
**Success looks like:** They reopen a months-old project's pages and instantly recover the chain and the moves — even without the original DAW file.

**Podcasters (secondary, deferred)** — plan episodes and track recording-chain settings. Not an MVP target; the general data model should fit them later without a rebuild.

**Sound designers (secondary, deferred)** — maintain patch/preset libraries and per-project briefs. Served later via the same data model and post-MVP page packs.

## User Stories

**Producers / musicians**
- US-1 [MVP] As a producer, I want to create a project so I have one home for everything about a track.
- US-2 [MVP] As a producer, I want to add purpose-built pages (Notes, Build log, Presets) to a project so each kind of information has the right shape.
- US-3 [MVP] As a producer, I want free-form Notes so I can jot any thought quickly.
- US-4 [MVP] As a producer, I want to record arrangement ideas and the sequence of moves in a Build log so I can remember and repeat how I made a track.
- US-5 [MVP] As a producer, I want to capture named plugin/parameter settings on a track-scoped preset page so I can recall and reuse a chain.
- US-6 [MVP] As a producer, I want my notebook synced across desktop, web, and mobile so my context is available wherever I work.
- US-7 [MVP] As a producer, I want my records to persist independently of the DAW file so I don't lose them when a project is lost or corrupted.
- US-8 [MVP] As a producer, I want to search across all projects and pages so I can retrieve a past setting or idea fast.
- US-9 [MVP] As a producer, I want capture to be near-frictionless so I'll actually fill pages mid-session.
- US-10 [MVP] As a producer, I want to see what Otocho is for the moment I open it, so I understand the value without having to build anything first.
- US-11 [MVP] As a producer, I want to start using Otocho immediately and connect my own cloud storage when I'm ready, so there's no signup wall and my data stays mine.

## Functional Requirements

### MVP Requirements

**Projects & pages**
1. Users MUST be able to create, rename, and delete projects. [US-1]
2. A project MUST be able to contain multiple pages of mixed types. [US-2]
3. The system MUST provide exactly three page types at MVP: Notes, Build log, and Presets. [US-2]
4. Users MUST be able to add, rename, reorder, and delete pages within a project. [US-2]
5. Notes pages MUST support free-form text entry. [US-3]
6. Build log pages MUST present two sections on one page: (a) an editable free-form sketch area for arrangement/ideas, and (b) an append-only, timestamped move feed with a persistent inline quick-add input. [US-4][US-9]
7. Preset pages MUST be scoped to a single named track and MUST hold an ordered chain of devices; each device MUST have a name and an optional free-text settings field, and MUST allow optionally adding structured key-value parameter rows. [US-5]
8. A project MUST support multiple preset pages (e.g., one per track). [US-5]

**Capture friction**
9. Adding or editing content MUST be possible via inline entry without leaving the page or opening a modal; the Build log move feed MUST support single-action quick-append. [US-9]
10. Creating a new page from within a project MUST take no more than two interactions (choose type → page created). [US-2][US-9]

**Sync & persistence**
11. A single user's projects and pages MUST sync across their desktop, web, and mobile clients via integration with one third-party cloud-storage provider's API (Dropbox at MVP); Otocho MUST NOT operate a first-party sync/storage backend. [US-6][US-7]
12. Project data MUST be stored as one file per page (so sync conflicts stay scoped to a single page), and the Build log move feed MUST be stored as an append list that merges by union of entries. On a same-page concurrent edit, the system MUST preserve both versions and surface the conflict in-app for the user to reconcile, and MUST NOT silently discard either edit. [US-6][US-7]
13. Otocho clients MUST be available on desktop, web, and mobile. The mobile client MUST support viewing and searching all content plus light capture (appending to Notes, appending Build log moves, and creating a quick note or project); it MAY omit structured authoring such as assembling preset chains, which MUST remain available on desktop. [US-6][US-8]
14. All project content MUST be stored independently of any DAW project file and remain fully accessible if that file is lost, corrupted, or on another machine. [US-7]

**Search**
15. Users MUST be able to search across all projects and pages and open any matching result. [US-8]
16. Search MUST cover Notes text, Build log entries, and preset field names and values. [US-8]

**DAW-agnostic / manual**
17. The product MUST deliver all MVP functionality via manual entry and MUST NOT require, read, parse, or import any DAW file. [US-1–US-8]

**Onboarding & storage connection**
18. On first launch, the app MUST present a prefilled, explorable, searchable example project that demonstrates each page type and includes content illustrating the durable-memory benefit, and MUST offer a clear action to create the user's first project. [US-10]
19. The app MUST be fully usable storing data locally before any cloud connection; it MUST allow the user to connect Dropbox later to enable sync/backup, and on connection MUST migrate existing local data to the connected storage. [US-11][US-7]
20. If connected storage is disconnected, fails authentication, or is out of space, the app MUST continue working from local data, MUST warn the user that changes are not being synced/backed up, and MUST NOT lose or silently drop changes (retrying when possible). [US-11][US-7]

## Constraints

- **Capture must beat a text file.** Entering a Build-log move or preset value must be measurably faster and lighter than a plain text file, or those pages go unused.
- **First-session value.** Value must be obvious in the first session (incumbents are free); the example project (FR-18) and no-signup local-first start (FR-19) serve this.
- **BYOS, no backend.** Sync rides on the user's cloud storage via a provider API (Dropbox at MVP); Otocho runs no servers and owns the merge/conflict logic on top of the provider's file sync.
- **File-per-page, merge-friendly format.** One file per page keeps conflicts page-scoped; the move feed is append-only (union merge). A CRDT for the sketch field is a post-MVP upgrade if conflicts prove painful.
- **Extensible page-type schema.** A flexible block/field schema so new page types (v1/v2) are cheap to add.
- **Cross-platform & DAW-agnostic.** Desktop, web, and mobile are all in MVP scope; no reading or parsing of DAW files.

## Decisions (Resolved Open Questions)

No open questions block the MVP — all were resolved during speccing, recorded here for traceability.

- **OQ-1 Preset page (FR-7):** hybrid — ordered device chain, each device a name + optional free-text, with opt-in key-value rows.
- **OQ-2 Build log (FR-6):** one page, two sections — editable sketch canvas + append-only timestamped move feed with quick-add.
- **OQ-3 Sync & pricing (FR-11):** sync in MVP, free, via BYOS (Dropbox API first, no backend); monetization deferred to collaboration/capacity.
- **OQ-4 Mobile depth (FR-13):** reduced — full read/search + light capture; preset-chain authoring stays on desktop.
- **OQ-5 Onboarding (FR-18):** first launch opens a prefilled, searchable example project dramatizing the durable-memory hook, plus a "create your first project" action.
- **OQ-6 Data/conflict model (FR-12):** file-per-page + append-union move feed; same-page concurrent edits use last-write-wins with in-app conflict surfacing (no silent loss); CRDT deferred.
- **OQ-7 Dropbox UX (FR-19/20):** local-first, connect-later; migrate local data on connect; disconnect/auth-fail/out-of-space keep working locally with a "not backed up" warning and no data loss.

## Out of Scope (Deferred)

- [v1] — Sketch page: piano-roll for MIDI ideas, built-in instrument playback, and audio-file playback.
- [v1] — Mix/edit to-do page.
- [v1] — Mobile quick-capture into an inbox.
- [v1] — Reference page (links, images, file paths, reference tracks).
- [v1] — Templates per page type.
- [v2] — Page/project sharing and export.
- [v2] — Cross-project preset library.
- [v2] — Audience-tailored page packs (podcast planner, sound-design brief).
- [v2] — Rich linking between pages/projects.
- [Post-MVP] — Additional BYOS providers beyond Dropbox (Google Drive, iCloud, OneDrive).
- [Post-MVP] — DAW data ingestion options (open-format export ingestion, screenshot-to-preset extraction, clipboard/drag capture, native project-file parsing, companion plugin/bridge). Related concept open questions (Sketch-page feature line, audio/MIDI engine choice, sharing model, ingestion option ranking) are deferred with their milestones.
