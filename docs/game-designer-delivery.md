# Universal Game Designer delivery

Nigel clarified on 18 October 2026 that this work belongs in Terrain Foundry. Desertofthereal is reference only. The original goal text mentioning that project is superseded by this clarification.

## Target and preserved baseline

Official publication repository: `MGN-Consultancy/TerrainFoundry`. Current integration checkout: `G:\Github\TerrainFoundry`, on the existing `main`, fast-forwarded to fetched `5f43f36` before edits. No new branch or worktree was created. Its modern Campaign Studio already supplies shared conversation, assistant actions/review/undo, agent mode, workspace files/memory, voice, creative generation, Meshy and a priced API usage ledger. Preserve those services.

Initial prototypes and isolated tests were made in the older `G:\Github\dnd-terrain-builder` checkout, retained as commits `e98ec07` and `b0baa46`. They establish reusable implementation/test work, not acceptance of the official client. Do not replace the newer official files with that older editor or publish the older checkout.

## Full requested outcome

- A universal Game Designer with explicit DND, Warhammer and custom-game setup. Custom projects use their own rules and vocabulary. Ask only missing supplementary questions after reading supplied context.
- Native UTF-8 Markdown context uploads, retained with the project and kept out of player exports.
- Full projects stay local. Retrieve relevant excerpts for each turn; do not send every record, character, source file, scenery item or previous message. Bound all dynamic provider context, including designer, workspace and saved-world sources.
- Persistent linked ChatGPT account settings. Linked conversation and API image generation are separate capabilities. Linked AI plus Meshy must work from manually uploaded concept art without an OpenAI API key. Clearly explain what needs each connection.
- Rules-neutral metadata for free included scenery and all newly created scenery, available to encounter/world planning.
- One companion across characters, scenery, worlds/encounters and a rulebook. Use the existing reviewed action pipeline; do not introduce a second apply/undo system.
- Paginated rulebook editing with cover art, contents, chapter order, PDF and HTML export.
- Clear top-right linked-account/API usage and honest credit/token reporting, with no unannounced paid fallback or invented remaining subscription balance.
- Human-style agent testing, repair/retest, required release checks and verified publication to the official clients.

## Current official integration

Game type, private Markdown context and rulebook chapters now round-trip through the current campaign schema/storage. Native context import uses the existing renderer identity guard. Context and Rulebook sections use the existing shared conversation and navigation validation. Rulebook PDF/HTML export is additive to existing exports. Custom/Warhammer character editing uses descriptive capabilities rather than imposing the preset character sheet. Designer discussion sessions do not assume DND rules for other design purposes.

`gameDesignContext` applies local retrieval to core records and additional editor/designer/workspace data, with a 24 KiB dynamic-context ceiling, up to six recent messages and eight Markdown excerpts. Unrelated scene/designer/world metadata is omitted. Full source files and history remain local. The existing full scene catalogue still validates action IDs while request metadata is bounded.

Focused official campaign/context/action/workspace/native/creative-generation checks: 79 passed. Official build passed before the latest character-UI refinement. Agent desktop testing against this integration is in progress. Earlier working-checkout UI tests and a mocked loopback sign-in are not official installed acceptance.

## Required context and token discipline

- Never send the whole campaign, uploaded Markdown collection, full conversation, scenery catalogue, or generated files on every turn. Keep those on the client.
- Retrieve only the current task's relevant source excerpts and selected records locally. Bound dynamic project context to 24 KiB, recent dialogue to six messages, and uploaded-source excerpts to eight per request.
- Preserve game type and the active editor context when switching between rules, characters, scenery and worlds. Ask for missing details instead of attaching unrelated material.
- Verify the actual provider payload against a large project fixture, including unrelated-content exclusion and the size ceiling. Preserve the complete local project while limiting what leaves the client.
- Show recorded linked-account and API usage separately; report unknown usage honestly. Context limits do not represent a guaranteed bill or remaining account allowance.
- Keep development inspection scoped to tracked source and named inputs; reuse completed results rather than repeatedly scanning working collections or sending unchanged tool output.

## Verification and release status — 18 October 2026

Official source is on existing main in MGN-Consultancy/TerrainFoundry. No new release has yet been published for this work.

The client release selection passes 248 tests with one Windows file-symlink permission skip. The build, public-source audit, release packaging regression and public-source/release-inventory checks pass. Official Electron smoke covers Markdown retrieval, shared conversation, readable rulebook pages/reorder, private PDF/HTML/player exports, reviewed chapter Apply, saved chapters after restart, accessible account settings, image-key guidance before submission and separate project usage. These UI responses are mocked and do not prove real inference.

Real owner sign-in succeeded and protected connection persistence was verified in a separate Electron process using the same profile. Seven models are available. No OpenAI API key was added. The real linked response asked relevant missing questions for the custom Beacon Keepers game without importing preset rules.

Real inference exposed a streaming decoder bug: completed responses may provide text only in deltas. The decoder now retains bounded deltas, requires a completed terminal event and preserves reported usage on incomplete responses. Invalid or incomplete output is retained locally in a bounded, redacted support file; this does not create a user-facing recovery feature. Partial/invalid drafts are never applied automatically. Focused writing instructions omit unrelated creative/world protocols; local project retrieval remains bounded. Funding confirmation now names linked ChatGPT versus API correctly, with unknown remaining allowance/charges stated and no silent fallback.

The real acceptance project has an unchanged 30,000 text-token limit. The final two separated submissions used the ordinary 2,000 output-token setting without retries or image/Meshy calls. Cumulative usage is 16,818 linked tokens, zero API tokens and six requests. The chapter passed official review/apply and retained the supplied custom rules. The character reply exposed an advertised but unsupported navigation action; its retained draft now passes local revalidation and official review/apply, and the saved character reopens at revision 5 without another paid request. Navigation is strictly allowlisted and switches sections immediately without writing content; reviewed native navigation remains non-mutating. Character action normalization is idempotent and preserves existing model data. Its private visibility differs from the requested player visibility and is recorded as a safe default requiring conscious review.

The full geometry suite requires the declared release/asset-packs input unavailable in this checkout. Do not regenerate or scan working collections to fill this gap. Client-only publication reuses already-published signed scenery and runs its required client checks.

Remaining: commit the final fixes, create and verify a signed client-only release candidate, publish the authorized release and verify the downloaded runtime. Source push and CI success alone do not establish Live or installed behavior. Preserve existing unrelated print-geometry and installer licence changes.
