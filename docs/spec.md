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

No open questions block the MVP. OQ-1 through OQ-7 were resolved during
speccing and are recorded here for traceability. OQ-3 (pricing) and OQ-8
(licensing) were revisited later and carry live "Not yet decided" and "Not yet
actioned" items — none of which gate MVP implementation, but which do need
settling before launch and before the first external contribution.

- **OQ-1 Preset page (FR-7):** hybrid — ordered device chain, each device a name + optional free-text, with opt-in key-value rows.
- **OQ-2 Build log (FR-6):** one page, two sections — editable sketch canvas + append-only timestamped move feed with quick-add.
- **OQ-3 Sync & pricing (FR-11):** sync in MVP, free, via BYOS (Dropbox API
  first, no backend); sync is explicitly **not** the paywall. Under BYOS the
  marginal cost per user is zero — Otocho hosts no bytes — so gating sync would
  charge for infrastructure it does not run and would gate the user from their
  own storage folder.

  **The paid boundary is capability, on one axis only, and it starts at v1.**
  The MVP surface (projects, the three page types, search, onboarding, BYOS
  sync) is free **for every user on every platform** — web, official desktop and
  mobile builds, and self-built binaries alike, with no distinction between
  personal, professional, and studio use. Nothing is sold before v1, including
  the app-store listings, which carry the MVP build free. The v1 payload (Sketch
  page, templates, reference page, to-do page, mobile quick-capture) is the
  purchased line, and one purchase covers every platform. Packaging is never a
  gate: native builds are distributed free from the project's own site as well
  as through the stores. Store channels are **Apple's App Store (iOS and macOS)
  and Google Play**; other marketplaces (Steam, Microsoft Store, Flathub) are
  not yet decided and nothing here depends on them — Windows and Linux users
  take the free direct download until that is settled. Alongside the v1
  purchase: content sold as content (page packs, templates, preset libraries),
  from v1 onward. Collaboration (v2) has genuine recurring cost and remains a
  defensible subscription lane later. A managed first-party storage option for
  users who want no Dropbox account would contradict the "no backend"
  constraint and is a deliberate later pivot, not an MVP direction.

  **Rejected: per-seat commercial-use licensing for studios** (Obsidian's
  model). It was the weakest of the candidate lanes, it needs honor-system
  enforcement, and — decisively — it puts a second qualifier on the free
  promise: "free forever" would have had to become "free forever for personal
  use," which is exactly the kind of asterisk this product's positioning is
  built to avoid. Dropping it keeps the promise unqualified on both the platform
  and the user axis, and it removes the need for a license that restricts
  commercial use (see OQ-8).

  **Rejected: selling the packaged MVP build as an app-store convenience
  purchase** (Krita's model — a paid store listing beside a free direct
  download). It is a real revenue source for Krita, but it is payment before v1,
  which contradicts the decision above. From v1 the store listing sells the v1
  unlock, which is capability rather than convenience, so this lane does not
  survive as a distinct one.

  **Rejected: gating the packaged native builds** (paying for the artifact
  rather than the feature set). It reads as reasonable — it is Ardour's model —
  but it prices a second axis, and the desktop+MVP cell is then governed by two
  rules that disagree, forcing a silent exemption from the free-forever promise
  for exactly the users most likely to hit it. For a tool that lives beside a
  DAW, desktop is the primary form factor rather than a convenience, and it is
  where local-first is strongest (real filesystem access via the Node adapter,
  versus IndexedDB on web) — so "free on web only" would be a much thinner
  promise than it sounds, thinning the free tier that is already this product's
  weak point. Ardour can carry that model because it has no free tier to
  protect; Otocho does. Also ruled out as exploitative regardless of tier:
  project-count caps, paywalled export, and locking existing data behind a
  lapsed payment.

  **Consequence for Feature 6:** the desktop/mobile clients are a packaging and
  distribution question, not a pricing one. The first paid moment is v1.

  **Not yet decided:** actual v1 prices; which non-Apple/non-Google marketplaces
  to add, if any; and how the v1 unlock is sold inside the mobile apps, given
  that Apple and Google require their own in-app-purchase rails (and take a
  commission) for a digital unlock, so selling it on the web and honoring it in
  the apps may be preferable. Separately, whether the MVP surface is too thin is
  an open product question, but not a pricing one — `docs/concept.md`'s Next
  Steps already call for a willingness-to-capture test with target producers,
  and that test, not an intuition about scope, is what should settle it. None of
  these open items block Features 4 or 6, whose scope is unchanged either way.
- **OQ-4 Mobile depth (FR-13):** reduced — full read/search + light capture; preset-chain authoring stays on desktop.
- **OQ-5 Onboarding (FR-18):** first launch opens a prefilled, searchable example project dramatizing the durable-memory hook, plus a "create your first project" action.
- **OQ-6 Data/conflict model (FR-12):** file-per-page + append-union move feed; same-page concurrent edits use last-write-wins with in-app conflict surfacing (no silent loss); CRDT deferred.
- **OQ-7 Dropbox UX (FR-19/20):** local-first, connect-later; migrate local data on connect; disconnect/auth-fail/out-of-space keep working locally with a "not backed up" warning and no data loss.
- **OQ-8 Licensing (cross-cutting):** **source-available with delayed OSS
  conversion**, on the Functional Source License's shape — the repository is
  public and readable, the license restricts redistribution and *competing* use
  while permitting all other use including commercial and studio use, and each
  release converts automatically to a permissive OSS license (Apache-2.0 or MIT)
  two years after publication. The "Otocho" name is reserved as a trademark.
  Contributor terms (a CLA or equivalent grant) are required from the first
  external contribution.

  **FSL rather than BUSL, because OQ-3 dropped per-seat commercial licensing.**
  BUSL would be the choice if commercial use had to be restricted and sold
  separately, since its Additional Use Grant is the licensor's to define. With
  the free promise now unqualified on the user axis, nothing needs a
  commercial-use restriction, and FSL's shorter window and narrower carve-out
  are closer to this project's original open-source intention. Note the
  consequence: the v1 payload is protected only for its two-year window, after
  which that release is freely redistributable — that is the deal delayed
  conversion makes, not an oversight.

  **This supersedes an earlier GPL-3.0 decision, and the reason it changed is
  worth recording.** GPL was chosen while the paid boundary was the packaged
  native build — Ardour's model, where public source does not undercut selling
  the artifact. OQ-3's rewrite moved the paid boundary to *capability*, so what
  is now sold is v1's **code**, and copyleft guarantees every recipient the
  right to compile and redistribute that code for free. GPL is therefore worst
  at protecting the revenue lane OQ-3 leans on hardest. The licensing entry was
  not revisited when the pricing axis moved; this entry is that correction.

  **Second reason: GPL-3.0 conflicts with Apple App Store distribution**, which
  OQ-3 now commits to. GPL forbids imposing the additional restrictions Apple's
  terms carry; VLC's 2011 removal from the App Store is the standing example.
  Sole copyright holdership is an escape hatch — a copyright holder is not bound
  by the license they offer others — but a fragile one that breaks on the first
  outside contribution merged under plain GPL. Source-available removes the
  clash outright rather than routing around it.

  **What this preserves.** Public source keeps the local-first BYOS claim
  ("your data stays in your Dropbox; we run no servers and never see it")
  auditable rather than merely asserted — that argument never depended on the
  OSI label. Keeping source private would buy little anyway: there is no
  backend, so the whole product is client code, and the react-dom web bundle is
  already readable by anyone who opens the app. The delayed conversion honors
  the project's original open-source intention on a timer instead of abandoning
  it.

  **What this gives up, plainly:** this is *not* open source and must not be
  described as such during the protection window; forkability and the goodwill
  that comes with it; Linux distro and Flathub packaging that assumes a FOSS
  license; and some contributor interest.

  **Not yet actioned:** the exact license text and the conversion window and
  target license; the trademark filing; and the contributor-terms wording. All
  three want legal review, and they are one conversation with one lawyer rather
  than three. No `LICENSE` file has been added to the repo yet.

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
