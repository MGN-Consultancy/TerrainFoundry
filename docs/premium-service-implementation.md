# Premium delivery service

Azure subscription: existing Terrain Foundry sponsorship subscription. Resource group: rg-terrainfoundry. Private UK South storage: tfpremium5xc3ig54fujlw; containers premium-packs and premium-state. Public blob access is disabled at account and container level; HTTPS and TLS 1.2 are enforced. Dedicated service: https://terrainfoundry-premium.azurewebsites.net/api/premium/config . Managed identity has Storage Blob Data Reader and Storage Blob Delegator on this storage account only. The existing print service was not replaced.

Nigel confirmed Willowbrook at GBP 9.99, two simultaneously activated computers and free support-assisted replacement transfers. Commercial checkout remains disabled until an approved sale-ready pack exists. A synthetic tf-delivery-qa fixture is private, hidden from the public catalogue, and never available for purchase.

## Customer flow

Verify email with a ten-minute six-digit number, approve PayPal purchase, server confirms exact settled pack/currency/amount/merchant, durable outbox emails one activation code. Redeem in Packs, verify the purchase email, prove possession of the protected device key, then download. Retries and repairs on the same device reuse its slot. Support can release an old slot after verifying the purchase.

Requests use POST /api/premium/{action} with JSON and Authorization: Bearer <verified device-bound session> where required. Actions: login-start, login-verify, checkout, confirm, webhook, challenge, activate, download-challenge, download, resend, support-reset. Public GET config exposes only the issuer public key and public product terms. Client/browser tokens must not enter campaign/project exports or logs.

## Encrypted format

An immutable .tfc blob concatenates independently AES-256-GCM encrypted files. The Ed25519 signed envelope payload contains schemaVersion 1, issuer TerrainFoundry, packId, version, complete ciphertext size/SHA256 and file records with path, offset, length, plainSize, plaintext SHA256, IV and tag. Each file uses authenticated data packId + newline + version + newline + path. The encrypted catalogue.json describes editor meshes, physical bounds, OpenLOCK ports and binary STL files. The native client verifies the fixed issuer, device-bound entitlement, full ciphertext inventory and every file; stores keys under Windows protection and decrypts geometry in memory.

Pack source and final plaintext masters stay under ignored premium-assets. build-private-pack.mjs checks human approval, sale readiness and rights flags, and matches source hashes against a delivery spec. Its private-delivery-record.json contains a content key and belongs only in private premium-state storage, never public site/source/releases. Pack versions and blob hashes are immutable. Do not regenerate or replace the issuer key: existing installed content relies on it.

## Deployment and operational setup

scripts/deploy-premium-service.ps1 deploys only the dedicated premium Function App. It uses the existing print-service dependencies with src/premium-functions.mjs as its entrypoint; no print endpoints are deployed by that package. Secrets are restricted Function App settings, excluded from source. For stronger operator separation, move app secrets to Key Vault references before delegating administration. The private signing key used by the authoring operator is outside source; never distribute it with a client.

PayPal credentials and the verified Azure Communication Email sender were inherited from the existing Terrain Foundry setup. No customer was charged or emailed by the integration tests. The dedicated live /api/premium/webhook is registered with PayPal for completed captures, refunds, denials and reversals; PREMIUM_PAYPAL_WEBHOOK_ID is configured. No live purchase was made. Checkout flags must stay off until that registration and real sandbox settlement/email/client tests succeed. Sales require PREMIUM_SERVICE_ENABLED=true and the specific product readyForSale=true, plus an approved private delivery record. Activating the flags is a separate final launch step after approved deliverables exist.

Refund/reversal notifications block future grants; already installed offline content remains usable. A buyer can copy exported printable files. This implementation deters cache copying between machines and does not claim to make authorised print exports uncopyable.

Runtime token, code-hash, outbox encryption and issuer signing secrets must be backed up securely before rotation. Never rotate a code-hash/outbox key without migrating existing orders/codes. Support uses a separate protected operator token, not a customer code; keep reset records. Keep transactional order records for the published commercial retention period and the daily cleanup removes expired login/session/download records and old hourly rate limits. Set an Azure spending alert for storage, Functions and email usage.

## Bounded evidence

Backend tests cover verified settlement, idempotent code issuance, durable email retries, two-device enforcement, stolen-code denial, proof replay/expiry, support reset, OTP/session binding, ciphertext tampering and fail-closed pack readiness. Live synthetic Azure test verifies anonymous blob denial, managed-identity user-delegation SAS, read-only HTTPS download, wrong-device and replay denial, and correct decryption. Native tests and installer publication are separate gates. Local receipts are in work/premium-setup/azure-delivery-receipt.json; they contain no signed URLs, keys or activation codes.
