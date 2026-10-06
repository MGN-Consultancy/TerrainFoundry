# Terrain Foundry campaign studio

User request recorded 6 October 2026. This document defines the requested scope; it is not a statement that all features are shipped.

## Entry and saved projects

After introductory tips, ask “What would you like to do?” with Campaigns, Worlds, Encounters / Scenes and Setup. Each project route offers named creation and opening an existing project. Existing world and encounter libraries remain usable. The campaign is the root for story, worlds and scenes, with durable references and visible missing-link handling.

A saved campaign retains its initial brief, current story, characters, missions, linked project IDs, notes, conversation history, unresolved questions and session progress. Reopening it restores that context. Persist a factual campaign summary and recent conversation for provider context; do not silently treat a short recent chat window as the entire campaign. Tell the user when long context is truncated or summarised. Edits and saves should not require internet or a configured key.

## Story builder and provider setup

Setup chooses OpenAI or Claude, configurable supported model, output budget and the user's API key. Keys are encrypted with native OS-protected storage, sent only to fixed official provider endpoints from the desktop process, never saved in campaign files/exports or renderer storage. The UI shows configured/not-configured without returning the key. Remove/replace key controls are required. Saving a key must not silently submit a billable request.

New campaign questions cover name, world genre and era, tone, party size/level, mission themes, intended length, rules system and boundaries/preferences. Questions and answers remain editable. Explicit generation actions produce introductions, hooks, NPCs, missions and session plans. Generated material is a proposal; no automatic world edit, asset purchase, external tool execution or filesystem action follows provider text.

AI context should include current campaign information and only the linked world/encounter details needed for the request. Local-only editing remains usable. No live provider request or expense is needed to test application behaviour: use deterministic request/response fixtures.

## Inventory-aware encounters

Build a compact catalogue of assets actually installed and available: stable ID, name, type, footprint, height, connector compatibility and pack/source. Provide measurements rather than image-only guesses. Filter unavailable/locked pieces. Ask what scenario and board size the user wants, then produce a structured proposal. Validate every asset ID, finite position, quantity, orientation, board bounds and footprint collision before offering Apply. Preserve the existing scene until the user explicitly accepts; apply as one undoable operation. Reject malformed provider output rather than guessing an ID.

## Campaign organiser and table tools

| Area | Requested behaviour |
| --- | --- |
| Items and categories | User-defined categories for characters, villains, locations, events and other campaign records; searchable content. |
| Connections | Named relationships with details, visible as a network view; secret relationships excluded from player output. |
| Timelines | Dated or ordered item events with per-entry visibility. |
| Notes | Campaign-linked notes, revision history and item mentions/links. |
| Maps | Imported images with named pins and tooltips; hidden pins stay private. |
| Characters | Editable sheets, portraits, stats, spells and dice actions. |
| GM screen | User-configurable notes/reference widgets, names/bounties and initiative. |
| Dice | Common polyhedral dice, modifiers, advantage/disadvantage and logged results; original or licensed rule guidance. |
| Initiative | Add players/monsters, manual or rolled scores, stable turn ordering and round tracking. |
| Player output | Explicit visibility with DM-only default; omit hidden details and hidden relationship endpoints from player exports. |
| Player collaboration | Safe handouts can be local exports. Authenticated live invitations, roles and multiuser revision attribution require an actual sharing backend and must not be claimed from a local file export. |

## Soundboard

Campaign-specific sound pads with user-imported licensed audio, labels, play/stop, loop, volume and stop-all. Provide useful original/licensed starter sounds and preserve attribution. Keyboard shortcuts can be configured as Stream Deck hotkey actions; document when the client must be focused. A native Stream Deck plugin or background/global control must not be implied by focus-only shortcuts. Keep soundboard audio reusable across sessions, with missing-file handling.

The linked DnD Soundboard is a feature reference, not permission to redistribute its audio. Do not copy its catalogue wholesale into a paid or open-source distribution without an applicable licence.

## Print and illustrations

Generate printable NPC/mission/item cards and a complete campaign book with a cover, sections and imagery. Offer DM and player versions. Provide duplex-ready layout/margins and printer guidance; printer hardware/driver settings determine whether physical duplex is supported. Print/PDF output must omit keys, hidden player content and private scenery masters.

Users can import their own artwork. Image generation uses a supported image-capable provider API on explicit request, with a clear cost/data notice and cancellation/error handling. A text-only Claude integration should not claim native raster image generation. Persist artwork in the campaign so it survives reopening and printing.

## Delivery and ownership

Client implementation owner: Build a DND terrain editor (01a0bb6e-13a1-7e80-ae6e-0a2673012e11), desktop/src/tests and narrow entry integration. Website and premium-download documentation owner: this chat (01a102ae-e4d3-70b1-aab6-a869806b2ab2). Preserve village owner files and unrelated work.

Keep campaign source open source and premium pack assets private. Website copy must separate local development from the public released client. No deployment or premium sale activation is part of the local implementation checks. Premium storage instructions are in premium-download-setup.md.
