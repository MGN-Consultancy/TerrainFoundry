# Private premium downloads

Keep the open-source client and free scenery on the public TerrainFoundry GitHub repository and releases. Do not upload paid pack archives, original private artwork, authoring masters, codes or signing keys there. An obscure public URL is still a public download.

Use Azure Blob Storage for premium archives, with a private container and storage-account anonymous access disabled. The existing infra/print-service.bicep already requests allowBlobPublicAccess=false for print-order storage; that does not establish a configured premium archive service. Keep premium archives and print-order records in separate containers with separate access policies.

## What Nigel needs to configure

1. Create or designate a private premium storage account/container in Azure, using HTTPS, private container access and anonymous blob access disabled. Choose a region and budget; no infrastructure has been provisioned by this work.
2. Upload only final licensed, validated pack deliverables under immutable pack/version/hash paths. Keep concept review ZIPs private and outside sale deliverables. Record SHA-256 and signed inventory. Do not change a published archive in place.
3. Give the download Function App a managed identity, blob read permission, and permission to obtain a user delegation key at the appropriate storage scope. Keep signing/private pack encryption secrets server-side, preferably in Key Vault. Never embed an Azure account key in the client or website.
4. Configure verified payment settlement and buyer verification, activation allowance and support transfer rules. The repository has a premium licensing module and device identity foundation, but their existence does not prove a live end-to-end purchase/download service. Its current Willowbrook constants must be reconciled with the agreed price/licence terms before commercial use.
5. Implement an entitlement-checked download endpoint: verify buyer/device proof and pack/version scope, then mint a read-only, HTTPS, single-blob user-delegation SAS with a short expiry, for example 5–10 minutes. Return it to that client request; do not publish a permanent link in catalogue JSON or source. Rate-limit issuance, avoid logging tokens, and allow an entitled device to obtain a new link for failed downloads.
6. Client verifies publisher signature and complete byte hashes, installs atomically, and preserves its previous working pack on failures. Keep purchased offline use available. Finish the protected pack reader integration rather than treating an activation code alone as download protection.
7. Test unauthenticated denial, wrong pack/device denial, expired-link denial, verified-buyer activation, same-device retry, device-limit enforcement, reset/resend support and offline use on two machines before enabling sales.

## What a secure link provides

A SAS URL is a temporary bearer capability: someone who copies it can use it until it expires. Scope it to one blob with read permission, limit its duration, and issue it only after server-side entitlement checks. A signed file manifest proves publisher/content integrity; it does not make its download URL private. Once an authorised customer exports printable files, those files can be copied. Licence terms and provenance are needed; no offline printing client can guarantee prevention of sharing.

Use the current docs/premium-pack-delivery.txt as the product-flow reference, but verify implementation and live configuration independently. Its earlier inventory/status notes may be historical. Existing print-service storage download links are scoped to print orders and use a 24-hour expiry; do not reuse that method unchanged for premium assets.

Official Azure references checked 6 October 2026:

- https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-configure
- https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview

## Campaign content and sound rights

Campaign source code remains open source; premium scenery assets remain excluded. User campaign exports contain the user's story/content, not provider keys or private pack masters. Import user-owned or properly licensed audio; a publicly playable soundboard does not by itself grant redistribution rights. Track the source/licence of any bundled audio or rules text. D&D campaign tools should use original guidance or appropriately licensed SRD content with its required attribution, not copied commercial rulebooks.
