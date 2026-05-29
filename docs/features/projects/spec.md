# Feature Spec: Projects

**Parent spec:** `docs/spec.md` (Otocho MVP) — satisfies US-1, FR-1
**Status:** Draft

## Overview

Projects are the organizing spine of Otocho: a producer creates a project to have one durable home for everything about a track, before adding any pages to it. This feature covers the full lifecycle of the project entity — creating, naming, listing, opening, renaming, and deleting — so a producer always has a clear place to put context and a reliable way to return to it. It does not cover the pages inside a project or how projects sync; it owns the container, not its contents.

## Goals

- A producer can create a project and immediately have a working home for a track.
- A producer can see all their projects and reopen any one quickly.
- A producer can rename a project as its identity becomes clear.
- A producer can delete a project they no longer want, without risk of accidental permanent loss.
- An empty project (no pages yet) is a valid, useful first step.

## Non-goals

- Page types, page CRUD, or page contents (covered by US-2 / FR-2–FR-10).
- Sync, conflict resolution, and cloud-storage connection (US-6/7 / FR-11–FR-12, FR-19–FR-20).
- Global search across projects (US-8 / FR-15–FR-16).
- Project sharing, export, templates, or folders/nesting of projects.

## User stories

- As a producer, I want to create a project so I have one home for everything about a track.
- As a producer, I want to see and reopen my projects so I can return to past work.
- As a producer, I want to rename a project so its name reflects the track.
- As a producer, I want to delete a project so my notebook stays uncluttered, without fear of losing it by mistake.

## Functional requirements

1. The system MUST let a user create a project; a name is REQUIRED at creation. [FR-1]
2. Duplicate project names MUST be permitted; the system MUST distinguish projects by a stable internal identifier, not by name.
3. Creating a project MUST take no more than two interactions and MUST open the new project on success. [FR-10]
4. The system MUST present a list of all projects, each openable, ordered by most recently opened by default.
5. A newly created project with no pages MUST be valid and persist as-is.
6. The system MUST let a user rename an existing project; the new name takes effect immediately and the project's identifier MUST NOT change.
7. Deleting a project MUST require explicit confirmation and MUST be a soft-delete: the project moves to a recoverable state (trash/undo) before any permanent removal.
8. Deleted projects MUST be excluded from the default project list and MUST be restorable until permanent removal.
9. Projects MUST persist locally across app restarts, independently of any DAW file. [FR-14, FR-19]
10. Each project MUST record creation and last-modified timestamps.

## Open questions

None identified.

## Out of scope (deferred)

- Project archiving (distinct from delete) and bulk operations.
- Folders, tags, or grouping of projects.
- Project-level metadata beyond name and timestamps (cover art, color, BPM, key).
- Pinning/favoriting projects in the list.
- Duplicating or templating a project.
