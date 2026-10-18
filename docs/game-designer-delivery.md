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

## Remaining work

Linked-account settings, funding routes, protected persistence, project usage, generation capability gates and reviewed rulebook chapter actions are integrated. Rules-neutral planning hints now cover all 717 included catalogue entries without treating connector-carrier height as measured model height. New scenery keeps the existing required editable metadata contract. Custom/Warhammer character imports preserve described capabilities rather than adding default DND statistics.

The agent's latest official Electron smoke passes: readable page preview, accessible account settings, missing image-key guidance before submission, separate API token counts, reviewed chapter Apply, saved chapters after restart, Markdown retrieval, PDF/HTML export and player privacy. Provider-payload tests exercise two consecutive requests from a large campaign, verify the size ceiling and excluded early history, and preserve the full local project.

The combined client release test selection passed 236 tests with one skipped after metadata, custom-import, sign-in retry, automatic funding-route and creative image-accounting fixes. The skipped file-symlink test needs Windows developer mode; no security settings were changed. Public-source, release-inventory and packaging-boundary checks pass. The full geometry suite cannot run here without the declared release/asset-packs input; the client-only workflow reuses already published scenery and has its own required test selection. Do not regenerate or scan working collections to fill that gap.

The owner's first real authorization returned to the loopback callback but the connection reported HTTP 500. The retry now retains the issued registration before exchange, preserves any existing active connection, exposes only a safe failing stage/protocol code, and refreshes the settings state automatically. A regression proves retry after restart and excludes raw error bodies/credentials. The fresh real sign-in succeeded. A separate Electron process using the same owner test profile read the protected connection and discovered seven models, including gpt-6-luna. No OpenAI API key was added. The agent's bounded, linked-only semantic acceptance run is in progress.

Creative concept images now resolve their owning campaign from the existing native discussion binding (or their own design conversation), enter the project ledger before paid submission, and refresh the header afterward. Image tokens remain separate from text token totals and limits. A regression exercises this with the real accounting service and a mocked image provider.

Remaining: real owner sign-in/model availability and conversation acceptance, final combined release checks, review, scoped commit and push, signed client-only publication, then release and installed-client evidence. The isolated owner-verification client is open and the sign-in request is pending. Do not report Live deployment or goal completion before the relevant evidence exists.
