# Campaign portal

Open-source, passwordless player accounts, email-bound invitations, private player snapshots, membership removal and attributed shared notes. DM story/chat/provider keys remain in the desktop client. Publish only the explicit player handout JSON exported from Campaign Studio; publishing a newer snapshot reveals newly visible content. This is an explicit upload workflow, not automatic cloud sync or live multiplayer terrain editing.

## Local review

Run from the repository root:

```powershell
$env:PORTAL_LOCAL_DEV='1'
node portal-service/server.mjs
```

Open http://127.0.0.1:5190/campaign-portal.html. Development email is written to ignored work/portal-dev/mail.jsonl, never served over HTTP. It is intentionally a developer-only substitute for email delivery. Use test addresses, inspect that private file for one-time links, and do not expose development mode to a network. The listener binds loopback only and rejects a non-loopback development origin. Production mode refuses to start without HTTPS, private storage and email configuration.

Test without paid calls:

```powershell
node --test portal-service/test/*.test.mjs
```

## Hosting setup required before real invitations

1. Host the Node 22+ service on an HTTPS origin such as https://campaigns.terrainfoundry.co.uk. It serves its own portal frontend and API on the same origin; this keeps authenticated cookies first-party. The current static website alone cannot run the invitation service. Configure DNS/TLS for the chosen origin.
2. Install the existing print-service dependencies (pnpm --dir print-service install --frozen-lockfile); the service reuses those Azure SDK packages. Startup command: node portal-service/server.mjs.
3. Configure PORTAL_ORIGIN, PORTAL_STORAGE_CONNECTION_STRING, PORTAL_EMAIL_CONNECTION_STRING and PORTAL_EMAIL_SENDER in server application settings or Key Vault references, not source control or client settings. Storage must forbid anonymous access. A separate private campaign-portal container is created; it is separate from premium/print-order archives.
4. Configure and verify an Azure Communication Email sender/domain. Sign-in and invitation links are sent only by this server; the sender must be operational before enabling real accounts. SMTP/API request success is not a guarantee of inbox delivery. No live email or infrastructure has been provisioned by the local implementation.
5. Keep PORTAL_LOCAL_DEV unset in production. Secure HttpOnly SameSite=Strict cookies, same-origin writes and CSRF checks are enforced. Do not expose the Node listener except through the HTTPS host. Preserve the configured origin through your reverse proxy.
6. Update the client's trusted portal URL configuration and the website link to the hosted origin. The site/campaign-portal.html file on a static-only host deliberately shows a service-not-configured message if its API is unavailable.
7. Verify with two actual email accounts: owner login, publish visible snapshot, player invitation, wrong-email denial, player-only reading, notes, membership removal and newly published visibility. Verify spam filtering, email throttling, persistence, TLS and restart before public activation.

## Storage and operating limits

Local JSON storage serialises one process and is for review only. Production BlobStore uses a renewed exclusive Azure blob lease for transactional changes, including one-use login/invitation consumption and revision checks. This initial small-deployment design uses one private state blob (250 MB ceiling), 10,000 users, 30 campaigns per DM, 100 members per campaign, 15 MB player snapshots and 1,000 shared notes per campaign. Back up the container and restrict operator access; session/login/invitation tokens are hashed at rest, not plaintext. Long-term campaign retention and account deletion procedures must be set before launch. Email request limits are per account/peer; a reverse proxy may group peers, which deliberately throttles conservatively. Dedicated edge rate limiting should be configured for a public launch.

Shared notes retain up to 50 revisions server-side. Authors and the DM can edit them; stale revisions conflict. Portal members see shared notes, while the local campaign's DM-only notes never enter the published snapshot. No public bearer campaign links, private premium geometry, native API keys or campaign conversation are uploaded. An authorised player can copy content they can view; membership removal prevents future reads rather than retracting prior screenshots/downloads.

Online sound distribution is not bundled with this portal. The fullscreen desktop DM playbook uses local sound cues; uploaded player snapshots contain story visibility and maps, not private audio or premium pack content.
