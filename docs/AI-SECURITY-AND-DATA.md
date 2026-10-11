# Personal provider keys and online AI

AI is optional. Key storage is available before online consent; authentication tests, text/image requests, voice and Meshy generation require version 1 acceptance, stored locally with its timestamp. Existing keys do not imply acceptance. Revoking acceptance prevents new requests and stops native voice. Manual editing and native Windows dictation remain available.

## Storage and trust boundary

The dedicated password field is in an isolated native key-entry window. It masks input and clears after save/error. The value briefly exists in that window and native-process memory; clipboard copies remain under Windows/user control. The key is encrypted with Electron safeStorage before atomic local storage in the user profile private/ai-settings.json. On Windows this uses account-bound DPAPI. It is encryption, not hashing or base64-only protection. The app refuses unavailable encryption and Linux basic_text fallback. The key is decrypted in the native process for authenticated provider HTTPS calls, never returned through normal editor APIs or included in campaign/library exports.

This does not protect against malware or applications acting as the same Windows user, privileged attackers, a compromised running process, clipboard capture or a compromised operating system. Removing the local saved key does not revoke it at the provider. Use dedicated restricted keys, provider expiry where supported, otherwise regular rotation/revocation, usage monitoring and provider spending controls.

## Data sent and destination

Provider keys and AI content go directly to fixed provider HTTPS endpoints, without an MGN key relay. Text/voice context can include recent conversation, campaign summaries, DM notes, character records, terrain layout and asset metadata, shared style and bounded excerpts of active workspace Markdown documents. Image generation sends prompts and selected reference/concept images; Meshy receives approved concepts and model settings. Live voice transmits microphone audio to OpenAI. The client does not scan arbitrary PC files for AI; imported/linked content becomes workspace context. Local editing itself does not call AI. Public pack discovery fetches public catalogue metadata without transmitting private campaign content to that catalogue endpoint.

OpenAI text Responses use store:false; this is not a promise that providers retain no data. Provider abuse-monitoring, retention, privacy and billing terms apply. Do not send information you cannot share. AI output and print geometry require review.

## Tests, failures and accounting

Each provider has an explicit repeatable test with last-tested timestamp. OpenAI/Claude text tests send only a tiny connection request, not campaign content, and can be billed. Meshy checks authentication/balance without creating a model. Saving a key is not a successful test; a successful text test does not establish image/voice permissions or future account credit.

Known structured provider error codes distinguish insufficient credits/quota, spending limits, rate limits, invalid keys, model permissions, timeouts and outages. Raw provider prose is not shown or logged as diagnostics because it can echo prompts or credentials. Paid generation is never automatically retried. Saved model task IDs allow explicit resume; completion credit accounting is deduplicated by task.

Text/image token totals use reported usage. Realtime response tokens are recorded once; GPT-Live cumulative reported seconds are counted as deltas and separately from delegated text tokens. Meshy counts only explicitly reported credit values. Missing usage is unknown, never zero-cost evidence. Reset session clears only in-memory session counters; all-time totals and bounded recent request records remain. This PC's client ledger cannot measure other applications, verify the provider invoice, or infer unreported charges. Consult provider dashboards for the bill and balance.

## Primary documentation checked 2026-10-11

- https://www.electronjs.org/docs/latest/api/safe-storage
- https://developers.openai.com/api/docs/guides/your-data
- https://developers.openai.com/api/docs/guides/error-codes
- https://developers.openai.com/api/docs/guides/live-conversations
- https://docs.meshy.ai/en/api/authentication
- https://docs.meshy.ai/en/api/errors
- https://platform.claude.com/docs/en/api/errors
