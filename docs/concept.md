## Concept: Otocho

*(Otocho — 音帳, "sound-notebook" — a DAW-agnostic notebook and idea sketchpad for audio projects)*

### Problem & Value

People who work in DAWs carry a lot of project context in their heads or scattered across sticky notes, phone memos, and stray text files: the arrangement to try next session, the plugin settings that made a vocal sit right, the sequence of moves that made a track finally work, the fixes left before a mix is done. The DAW is a poor home for this — heavy to open just to jot a thought, its notes buried and project-locked, nothing carrying across DAWs, projects, or machines. And it's fragile: when a project file is lost, corrupted, or stranded on another computer, the knowledge of how it was built goes with it. Starting fresh has its own friction, too — ideating inside the DAW often means wrestling the tool instead of the raw idea. Otocho gives this context a structured home *outside* the DAW, so a creator can think, plan, and remember without booting a session, sketch a musical idea without wrestling the full tool, and keep a record of a project that survives even when the project file doesn't.

### Target Audience

Anyone whose primary creative tool is a DAW and who accumulates more project context than the DAW comfortably holds.

- **Primary (MVP): producers / musicians** — tracks, arrangement ideas, mix to-dos, references, reusable presets. The MVP is built and polished around this workflow.
- **Secondary: podcasters** — episode/season planning, guest notes, recording-chain settings, publishing checklists.
- **Secondary: sound designers** — patch/preset libraries, sound-palette references, per-project briefs.

The data model stays general enough to serve all three, but the first release is tuned to producers so it feels compelling rather than generically adequate.

### Core Concept

Otocho is a notebook organized around **projects**, where each project holds **pages** — and every page has a specific purpose rather than being a blank canvas. A preset page is scoped to a single track and captures named plugin/parameter settings; a Build log records how a track came together, holding both the arrangement/idea sketch and the sequence of moves that made it work; a to-do page tracks mix/edit tasks; and a Sketch page is a piano-roll for entering a musical idea and hearing it played back. The structure is the product: purpose-built page types make it fast to capture the right thing in the right shape and easy to find later, which a generic note app never does — and the Sketch page extends that from writing an idea *down* to sketching it *out* in sound.

Because it lives outside the DAW and syncs across machines, the notebook doubles as **durable project memory** — a human-readable record of what a project contained and how it was built that persists even if the DAW file is lost, corrupted, or on another computer. DAW-native notes structurally can't do this; they die with the file.

For the MVP it is deliberately **DAW-agnostic and manual-entry** — it doesn't read or parse DAW project files. This keeps it usable with any DAW (Ableton, Logic, Pro Tools, Reaper, FL, Reason, Audacity…) and avoids brittle per-format integration early, at the cost of some convenience the page templates are meant to offset. Lower-friction ways to pull project data in are a post-MVP exploration, not a launch commitment (see Open Questions). It is **cross-platform with sync** (desktop alongside the DAW, web, mobile for capture) and **shareable**: primarily a personal notebook, but individual pages or projects can be shared or exported.

### Key Capabilities

- Users can fill a project with purpose-built pages instead of blank documents.
- Users can log how a track came together — ideas plus the moves that made it work — to remember and repeat their best material.
- Users can capture track-scoped preset/parameter settings and reuse them across projects.
- Users can rely on the notebook as durable memory that survives a lost or off-machine DAW file.
- Users can sketch melodic/harmonic ideas in a piano-roll timeline and hear them through a built-in instrument, without opening a DAW.
- Users can quick-capture an idea from any device, away from the studio.
- Users can keep mix/edit/publish to-dos and references attached to a project.
- Users can search across all projects and pages to retrieve a past setting or idea.
- Users can share or export a page or whole project, working across desktop, web, and mobile with everything synced.

### Feature Milestones

**MVP** — smallest version delivering the core "home for project context," tuned to producers.
- Music projects containing pages — the organizing spine.
- Three page types: free-form Notes, a Build log (arrangement/idea sketch + sequence of moves), and track-scoped Presets — the pages producers reach for most, and the proof of the purpose-built-page thesis.
- Cross-device sync for a single user — the cross-platform promise is hollow without it.
- Global search — retrieval is the payoff for writing things down.

**v1** — first genuinely day-to-day-useful release.
- Sketch page — a piano-roll for MIDI ideas played through a built-in instrument (plus audio-file playback). Lands here, not MVP, because the editor + cross-platform playback engine is a substantial build; its weight may justify its own focused effort within v1.
- Mix/edit to-do page — the producer's "what's left before this is done" loop.
- Mobile quick-capture into an inbox — captures ideas the moment they occur.
- Reference page (links, images, file paths, reference tracks) — supports the workflow once core capture exists.
- Templates per page type — turns structure into speed, once page types are stable.

**v2** — power-user and collaboration expansion.
- Page/project sharing and export — collaboration follows the personal-notebook core.
- Cross-project preset library — payoff once enough presets exist to be worth a library.
- Audience-tailored page packs (podcast planner, sound-design brief) — sharpens fit for secondary segments once the core is proven.
- Rich linking between pages/projects — depth for heavy long-term users.

*Post-MVP exploration:* lower-friction ways to get project data in beyond manual entry — open-format export ingestion (MIDI/audio/track-list exports), screenshot-to-preset vision extraction, clipboard/drag capture, native project-file parsing, or a companion plugin/bridge. Each trades DAW-agnosticism and maintenance cost for fidelity; all are opt-in and none are an MVP commitment.

### What This Is Not

- Not a DAW, multitrack arranger, or full sequencer. The Sketch page is a minimal piano-roll for sketching a single idea — no multitrack arrangement, recording, mixing, audio editing, plugin hosting, or song construction. It's for sketching an idea, not producing a track.
- Not a DAW integration at launch — the MVP does not read, parse, or sync project files; richer ingestion is explored only post-MVP.
- Not a general-purpose note app or wiki — pages are purpose-built, not blank.
- Not a real-time collaborative editor — sharing is share/export, not live multiplayer.
- Not a sample/loop marketplace.

### Competitive Landscape

**Notion / Obsidian** — flexible note tools many creators bend into project trackers. Overlaps on storing notes/structure; differs by shipping audio-specific page types out of the box. Learn from: fast capture and powerful search.

**DAW built-in notes & markers** (Ableton Info text, Logic notes) — the status quo. Overlaps on project-attached notes; differs by living outside the DAW, spanning projects/DAWs, reachable from any device. Learn from: proximity to the work — Otocho must feel nearly as close-at-hand.

**Preset/sample managers** (Splice, ADSR, Sononym) — organize assets and some presets. Overlaps on preset organization; differs by storing human-readable settings and intent, not binary assets. Learn from: strong tagging/library UX. *(Feature sets vary — treat as approximate.)*

**Songwriting / idea-capture apps** (Hum, voice memos) — quick musical capture. Overlaps on on-the-go ideation; differs by being text/structure-first and tying ideas into a full project home. Learn from: friction-free capture.

**Clearest differentiator:** purpose-built audio-domain pages in one DAW-agnostic, cross-device home that acts as durable project memory. What makes it indispensable is *retrieval that pays off capture* — instantly recalling the chain and the exact moves from a track made eight months ago, in another DAW, on another computer, even after the original file is gone.

### Caveats & Pitfalls

- **Focus / adoption risk:** producers are the largest *and* most crowded segment, and the incumbents (DAW notes, Notion) are free and already open. Switching cost is low, but so is the trigger to switch — value must be obvious in the first session. Keep the data model general so a podcaster/sound-designer pivot stays cheap if producer adoption stalls.
- **Execution risk (capture friction):** manual entry is a friction tax, worst where value is highest — the Build log must be filled *mid-flow*, when a producer least wants to stop and type. If capture is tedious, those pages die. It must be near-frictionless (quick append, minimal fields, voice-to-text later) and faster than a plain text file.
- **Behavioral assumption:** this assumes people *want* to write things down outside the DAW; many never do, trusting memory or the session file. Early validation should test willingness to capture, not just feature interest.
- **Scope-creep risk (Sketch page):** a piano-roll with playback sits right on the DAW slope — "just one more" requests (a second track, quantize, recording, effects, longer arrangements) each sound small and collectively rebuild a DAW badly. The "sketch one idea, not arrange a track" boundary must be defended, or the page competes head-on with the DAWs it's meant to complement.

### Technical Considerations

- **Sync-first data model:** cross-platform with offline mobile capture implies designing for sync/merge from day one (local-first / CRDT-style), not bolting it on later.
- **Extensible page-type schema:** since page types are the product and arrive each milestone, a flexible block/field schema (vs. hardcoded layouts) determines how cheaply new ones ship.
- **The Sketch page is the heaviest bet:** MIDI is core, so it needs a piano-roll editor plus a cross-platform engine rendering MIDI through a bundled instrument (soundfont/sampled) consistently on desktop, web, and mobile. This is materially harder than the rest of the app combined and argues for a mature audio/MIDI library over a from-scratch build — the rest of Otocho is essentially a synced structured-notes app.

### Open Questions

- What minimal structure makes a preset page faster to fill than a text file?
- How does the Build log hold both the arrangement sketch and the running move-list — one page or two linked sections — and stay flexible without becoming rigid? What's the lowest-friction mid-session capture path?
- Where is the Sketch page's feature line — how many tracks, region length, note-editing depth (quantize, velocity, tempo), built-in instruments — so it stays a sketch tool, not a mini-DAW?
- Which audio/MIDI engine underpins cross-platform playback, and does it realistically cover desktop, web, *and* mobile, or does one platform get a reduced experience first?
- What does sharing mean concretely (read-only link, export, account-to-account), and does it pull collaboration forward?
- Free vs. paid, and is sync the paywall? This shapes whether sync must be in MVP.
- Post-MVP, which data-ingestion option(s) to pursue — ranked on the fidelity vs. DAW-agnosticism vs. maintenance-cost tradeoff — and which DAWs to support first if native parsing or a companion plugin is chosen?

### Next Steps

The lead audience is set (producers/musicians), so the concept is close to spec-ready. Validate two things first, in order: (1) the Sketch page is now the project's center of gravity and its riskiest part — pick the cross-platform audio/MIDI engine and build a throwaway prototype proving a piano-roll plays back through a built-in instrument on desktop, web, and mobile, since this finding is most likely to reshape the roadmap; and (2) test willingness-to-capture with a few target producers before committing to manual entry as the core interaction. Once both are confirmed, this is ready for a speccing session.
