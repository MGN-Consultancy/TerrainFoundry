# Campaign Studio — local implementation

This source candidate is not in the public 1.9.0 installer. It does not enable live paid API tests or publish the website.

Startup opens Campaigns / Worlds / Encounters after the introductory guide. Campaign files are stored under Documents/Terrain Foundry/Campaigns. Native OS encryption stores provider keys under the existing application profile, separate from campaign files. Keys are entered in a separate sandboxed window; the editor receives configured status only. AI requests require explicit native confirmation, use fixed provider endpoints, have no automatic retry and show reported token usage. No prices are invented. The OpenAI image path requires a configured gpt-image model; Claude is text only. Original generated output remains a draft; encounter layouts need explicit application and can be undone.

Campaigns retain brief, editable factual summary, session progress, all chat, notes/revisions, records/categories, relationships, timeline, maps/pins, character sheet sections/portraits, copied linked projects, GM references, dice logs, initiative and original/imported audio. Only the most recent 30 chat messages enter a request; the full local history remains saved and the summary carries earlier facts.

Player PDF/JSON exports include approved visible content and omit hidden parents and their relationships, chat, private summary/history, sounds, keys and terrain geometry. JSON includes sourceCampaignId/sourceRevision for the separate online portal. The portal button opens a fixed website URL; users upload their player snapshot themselves. This is a handoff, not native account synchronization. Portal service availability and authentication are owned by the website implementation.

The live local playbook offers fullscreen, entry/linked-project navigation and persistent inline sound cues. Stream Deck can send Ctrl+Alt+Shift+F1–F12 while the client has focus; no native plugin or global shortcuts are included. Starter audio is original synthesized CC0 material, not photographic/natural field recordings. User-imported audio needs an entered source/licence.

Book/card PDF export uses the native PDF renderer. Duplex cards pad incomplete sheets and mirror the backs by column. Print A4 at 100%, long-edge duplex; check a two-page sample with your printer. Books have alternating inner/outer margins. Cards intentionally clip long text; books preserve full descriptions.

Validation: tests/campaign.test.mjs covers visibility, stale saves, traversal, duplex slots, provider mocks, redaction, no automatic calls/retries, cancellation/busy, proposed bounds/overlaps and dice limits. tests/campaign-smoke.cjs uses an isolated profile and fake key, mocks network responses, creates/saves/reopens/restarts a campaign, exports native PDFs, adds starter sounds/cues and checks fullscreen navigation. It never uses a real provider account. Screenshots/PDFs are under test-results.
