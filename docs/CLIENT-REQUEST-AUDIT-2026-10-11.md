# Client request audit — 11 October 2026

This checklist reconciles Nigel's requests in this conversation with the published 1.18.1 source, `4295dd5b842dacee5188a1d03ceb5e52b057ac2a`. It is an audit, not a claim that every requested feature is complete. The audit working branch differs from that merge only by merge ancestry. Public release and website status were fetched during this audit.

**Status meanings:** Implemented = source path exists and relevant local/package evidence is available; Partial = a material requested behavior remains unfinished; Open = no completed implementation/delivery was established; Deferred = Nigel explicitly postponed it. No paid provider calls, activation slots, model regeneration or installations were performed for this audit.

## Highest-priority omissions

1. **Automatic premium updates on launch: partial.** Free content has a per-file signed manifest and changed/missing-file updates. Premium activation can skip unchanged encrypted sections, but there is no automatic startup refresh of existing premium entitlements/catalogues or equivalent per-piece premium update flow. This must not be described as completed by the component updater.
2. **Willowbrook corrected printable delivery: open.** The live packs page still pauses checkout/downloads, explicitly noting stale model mappings and pending base-height, wall-thickness and slicing checks. Client 1.18.1 deliberately changed no scenery. A corrected tavern with one centred door, coherent timber/plaster/stone construction, and corrected market canopy/walls has not been established as publicly delivered by this audit.
3. **Scenery search hangs: partial.** Visible results are limited and thumbnails cached, but `src/main.js` still invokes synchronous `makeThumbnails` during search/category changes. No heavy-premium-library responsiveness proof was found. Pagination is not a complete fix for UI-thread stalls.
4. **Generated models with usable OpenLOCK bases and guaranteed printable thickness: partial.** Meshy output is scaled and inspected, but socket assembly is explicitly `adapter-required`; minimum wall thickness, physical fit and print readiness remain unverified. Descriptive metadata does not close these engineering requirements.
5. **World realism: partial.** Actual footprints, bounds, levels, spacing and owned IDs are checked. Continuous roads/rivers, door access, stairs/landings, structural support and connector/seam matching are not fully enforced geometrically. Central recommendations for unowned packs are not implemented.

## Campaign, voice and workspace

| Request | Status | Evidence and limits |
|---|---|---|
| One orchestrator conversation across campaign, character and scenery design | Implemented | `src/campaign-studio.js` passes the same companion element into the designer; `creative-actions.mjs` and `creative-orchestrator.cjs` dispatch designer actions. Packaged smoke checks one assistant/chat. |
| Four character stages: description, appearance, model, sheet | Implemented | `src/creative-studio.js`: Brief, Appearance, 3D model, Character sheet. Non-D&D purposes use Asset details. |
| Scenery has its own guided process and named packs | Implemented | Scenery stages end in Pack; stable asset/pack IDs and named folders in `creative-library.cjs`. |
| Voice keeps orchestrating image/model creation rather than sending users to another chat | Implemented, provider acceptance pending | Creative tool dispatch exists in the shared voice workflow. Package/provider-fixture tests passed; this audit did not make a real paid multi-provider voice-to-model call. |
| Text, Dictation, Live voice switches below the input; device modal | Implemented | `campaign-studio.js`, `campaign-voice.js`; native dictation appends to the draft, not automatic Send. Live voice is gated on provider readiness. |
| No repeated AI setup buttons; settings cog; aligned controls | Implemented with visual acceptance pending | Shared settings and compact control styles exist. Nigel's assessment at his display scaling is still an acceptance step. |
| Single evolving overview, then agreed overview | Implemented | `assistant.draftBrief` and review/agree flow replace stacked overview proposals. Other item proposals still have separate review actions. |
| Agent switches to the relevant work area | Implemented | Designer view/action routing and campaign section routing exist; not an unrestricted general-purpose agent. |
| Optional autonomous workspace changes without confirming every edit | Implemented within supported actions | Agent-mode setting and validated action service. Writes are constrained to campaign content/playbook/notes and supported operations, not arbitrary control of the application install directory. |
| Durable campaign/workspace folders, Markdown memory, shared game style | Implemented | `campaign-workspace.cjs`, `campaign-memory.cjs`, `campaign-style.cjs`; approved facts and conversation archives persisted. |
| Shared references across campaigns rather than duplicate assets | Implemented with snapshots | Source references and a shared revision cache support missing-source/relink/review. Saved campaign revisions do not silently change when the source changes. |
| Context compaction and retained conversations | Partial | Approved memory is persisted and explicit summarisation exists. Text requests use recent chat plus approved/workspace context and reject oversized context; comprehensive automatic long-session compaction/retention is not proven. |
| Guided beginner choices, length/tone/party/rules, runbook | Implemented, rules accuracy bounded | Guided choices and campaign sections/playbook exist. Complete authoritative rules coverage and automatic correctness for every edition are not established. |
| Character sheets and compact printable cards | Implemented with limits | `character-sheet.mjs`, sheet schema and native PDF output. This is an original layout; full official-sheet equivalence and every rules-derived calculation are not claimed. |
| People/place/mission thumbnail cards and modal editors | Partial | Grid and modal exist. Current item cards use a category initial, not each item's approved generated artwork as requested. Character portraits are supported. |
| All sections compact and usable without excessive scrolling | Partial | Navigation and some grids/modal editors improved. Timeline, relationships, maps, GM tools and other sections retain generic forms. This is not a completed redesign of every screen. |
| Campaign illustrations, cover and printable playbook | Implemented with acceptance pending | Image action, stored artwork, campaign PDF/export paths exist. Full professionally illustrated campaign output requires a real approved campaign and visual review. |
| Animated AI working indicator | Implemented | `src/campaign-activity.js` reflects actual thinking, voice, concept and model events. |
| Luna default, Astra Pro option, live/image model choices | Implemented configuration | Defaults and model selectors exist. Provider access is checked; selectable names are not a guarantee that every account can use them. |
| Remove ten-generations-per-ten-minutes restriction | Implemented change | `campaign-ai.cjs` now uses 120 requests per ten minutes. Provider limits and an in-flight request guard still apply. |
| Offline editing without keys; AI requires working keys | Implemented | Manual creation/import/edit remain local. OpenAI/Meshy readiness gates report why generation is unavailable. Keys remain outside exported campaign/library content. |

## Library, concepts and generated assets

| Request | Status | Evidence and limits |
|---|---|---|
| Named workspace created immediately and resumed later | Implemented | `creative-library.cjs` creates named, stable-ID asset folders at creation; design conversations are linked/persisted. |
| D&D, railway, racing and other characters/scenery | Implemented | Purpose/style/scale fields and non-D&D final step. Detailed specialist workflows beyond these fields remain to be demonstrated. |
| Retain/discard concepts, main thumbnail, amend prior concepts | Implemented | Concept references, selected/main concept, retained/approved state and image-edit context. Discard means excluded from use; it does not necessarily purge historical image bytes immediately. |
| Up to four uploaded reference images; selected approved images to Meshy | Implemented | Native reference import and one-to-four approved concepts for single/multi-image model generation. No generation starts merely by saving a key. |
| Prompt/template download for external tools | Implemented | `creativePromptBundle` export includes identity, brief, continuity and engineering instructions. |
| Modify owned scenery or extend an existing pack | Partial | References and derivative instructions exist. Automatic mesh editing of an existing scenery model is not established; rights and exact geometry still need review. |
| Correct character/model sizing and print-safe output | Partial | STL scaling, up-axis choice and geometry checks exist. Pose/orientation, thin features, watertightness and physical fit can still need repair/review. |
| Actual 3D thumbnail and reference in library | Implemented | Model preview/thumbnail and stable IDs; preview coverage depends on successful format decoding. |
| Import individual models and complete third-party packs | Implemented with format limits | STL, OBJ, GLB, 3MF and ZIP paths exist. Arbitrary vendor-specific manifests, external OBJ materials/textures, huge archives and every provider's pack format are not guaranteed. |
| Separate central content library for sounds, characters, free/premium/generated scenery | Partial | Character/scenery libraries, terrain browser and campaign soundboard exist, but not one fully unified browser across all requested asset types. |
| External library export/import including conversations | Implemented for personal assets | Backup can include personal model files; ZIP limits are 512 MB/4,000 entries. This is not an unlimited whole-computer backup. |
| Include purchased pack copies or ownership references in backup | Partial | Ownership/free-content references are exported; premium credentials and encrypted installed pack payloads are not portable in this backup. Destination activation/redownload is required. Automatic restoration of every owned pack from the reference list is not established. |
| Disk usage for editor, assets, cache, logs and indexes | Implemented | `storage-audit.cjs` and storage dialog; bounded scans report partial results and omit linked folders rather than following arbitrary paths. |
| Crash recovery and economical backups | Partial | Atomic writes and terrain recovery; project backup retention capped at 100 files/200 MB. Campaign Markdown/document history and conversation archives lack equivalent comprehensive retention controls. |
| Required useful scenery metadata | Implemented for new assets | 1.18.1 enforces the shared contract on personal scenery, imports and new official IDs; premium build gates cover every piece. Unknowns block automatic placement. Existing official IDs are grandfathered, not falsely marked curated. |
| Every asset's metadata sufficient for realistic automatic assembly | Partial | Purpose/style/material/scale/dimensions/spacing/entry/traversal/elevation/connectors are represented. Several spatial relationships remain descriptive text, requiring agent/user judgment and further geometric validation. Legacy library enrichment is unfinished. |

## Worlds, encounters and updates

| Request | Status | Evidence and limits |
|---|---|---|
| Campaigns, Worlds, Encounters, Characters and Scenery entry routes with new/open/recent | Implemented | `campaign-studio.js`, native project discovery and creative libraries; illustrated cards. |
| Correct default folders instead of Downloads | Implemented | World/encounter pickers use Documents/Terrain Foundry/Projects/Worlds or Encounters. Campaign workspace actions stay under campaign tools. |
| Save encounters with full previews and drag into worlds or reload a scene | Implemented | `scene-preview.js`, `scene-library-ui.js`, world placement/grouping and stored scene data. |
| World table presets/custom sizes, layers, reusable encounters | Implemented with limits | World schema/UI support table dimensions, levels and instances; explicit maximum sizes/counts apply. |
| AI helper beside world/encounter with retained context | Implemented | Project-specific companion identity, saved conversations and editor inventory/context. |
| Live provisional layout, Keep/discard/manual editing and undo | Implemented | Terrain planner/renderer; signed packaged smoke exercised discard, Keep and undo. |
| Fresh coherent villages/caves, roads/rivers, lift-on/interior choice | Partial | Instructions guide small batches and ask these choices. There is no complete procedural settlement generator or guaranteed connectivity/structural solver. |
| Recommend suitable unowned packs from central metadata | Open | Instructions prohibit inventing packs, but an actual central recommendation catalogue is not wired in. |
| Separate launcher/client/content releases; changed files only | Implemented for public components | Separate GitHub workflows and signed per-file channels. Verified 1.18.1 changed only client files; launcher/free content unchanged. |
| Already-activated premium packs automatically update changed/missing assets at startup | Partial — priority omission | Premium store matches existing encrypted sections during activation/download. Automatic startup entitlement refresh and per-piece delta sync are missing. |
| Compact responsive launcher, clear phase/overall progress and close on editor launch | Implemented source/tests; user acceptance pending | Launcher 1.16.1 compact layout/background, async verification and lifecycle checks. 1.18.1 does not replace this launcher. |
| Premium licence acceptance and useful overall progress | Implemented infrastructure | Explicit acceptance receipt and overall bytes/section progress. This does not make Willowbrook sale-ready. |

## Earlier product and website requests that remain tracked separately

| Request | Status |
|---|---|
| Willowbrook correct bases, printable canopy/plaster, consistent plain/coloured variants, single centred tavern door and coherent materials | **Open delivery.** Exact corrected uploaded files, sliced checks and printed fit acceptance must be established separately. Public pack page remains paused. |
| Full original cave/grotto 50-piece pack, free client starter delivery, expansions and consistent seams/heights | **Not closed by this audit.** No full 50-piece exact-delivered-file and physical-print acceptance reconciliation was performed here. Do not infer completion from the legacy catalogue. |
| Paid Willowbrook £9.99, PayPal, activation plus STL files and agreed licence | **Paused/not sale-ready.** Delivery/licence infrastructure exists; live packs page pauses checkout. Approved pricing is not proof of an active purchase/download path. |
| Digital pack protection | **Partial by design.** Entitlements/encryption help control access. Exportable STL files cannot be made impossible to copy or redistribute; no such guarantee should be offered. |
| Better website imagery, free/premium comparison, railway/racing concepts, offline/optional-AI explanation | **Present on live website; visual acceptance pending.** Homepage HTTP 200, concept labels and galleries present. Concepts must not be represented as delivered geometry. |
| Website plain/colour, base show/hide and zoom without distributing premium mesh | **Present in website source/live controls.** Static prepared views and zoom; full gallery visual fidelity and completeness were not reapproved in this audit. |
| Direct Windows file download | **Implemented with API dependency.** `site/release.js` resolves the newest published launcher MSI; test passes. HTML fallback still points to releases if JavaScript/API resolution fails. |
| Publisher information | **Implemented accurately.** About page says MGN CONSULTANCY LIMITED digitally signs the software; no unverified Microsoft endorsement logo is claimed. |
| Prepaid hosted AI credits and online accounts | **Deferred explicitly by Nigel.** Current scope uses personal provider keys. |
| Kickstarter and future railway/racing packs | **Future product work**, not silently counted as shipped client functionality. |

## Evidence and next action

- Public release checked: `v1.18.1-client-10-1`.
- Prior signed-release receipt: `test-results/1.18.1-publication.json`; signed packaged smoke passed with zero real provider calls.
- Fresh audit regression run: **65 passed, zero failed**, in `test-results/request-audit-tests.txt`. Covered metadata, creative library/orchestration, terrain planner, campaign workspace/voice, worlds, scene library and direct-download selection.
- Live homepage, packs and about endpoints returned HTTP 200. Packs page explicitly pauses Willowbrook checkout/downloads.
- This audit makes no claim of paid live provider acceptance, completed Willowbrook repairs, physical printability, or every-screen visual acceptance.

Recommended completion order: (1) exact Willowbrook print-file repair/delivery; (2) automatic premium update path; (3) terrain search responsiveness; (4) generated-model engineering/OpenLOCK assembly; (5) world connectivity and legacy metadata; (6) remaining unified-library/card imagery/UI and history-retention work. Keep every partial/open row visible until there is specific implementation and acceptance evidence.


## Follow-up implementation: 1.18.2 candidate

- Existing premium entitlement refresh and per-entry delta downloads implemented. Mock-provider integration proves one changed catalogue entry downloads and unchanged models are reused; interruption preserves the installed version. Update service deployed and invalid-key endpoints reject unauthorised requests. No real activation code or slot used.
- Terrain search displays filtered results before deferred thumbnail jobs; obsolete jobs cancel. Content library routes, campaign artwork cards and compact forms pass browser smoke tests.
- Central public pack discovery is wired to text and voice, fails closed for unavailable packs and excludes verified installed parent ownership.
- Optional structured road/river/landing points and entrance polygons are checked geometrically for new placements. Missing data, physical support and legacy metadata remain explicit limits.
- Campaign archive retention bounds recognised history and pins approved content and active undo snapshots. It does not claim unlimited automatic conversation compaction.
- Final integrated regression run: 206 passed, zero failed, one Windows symlink capability skip. Publication and packaged evidence will be recorded separately.
- Willowbrook: wb040/wb042 central canvas measured 0.06�0.4 mm despite closed topology; structural repair candidates are being checked. The wb005 8 mm carrier candidate previously failed Float32 topology. Market wall source/slice reconciliation remains open. No such candidate is silently included in this client-only release.
