# Optional print and ship service

This is separate from the offline desktop editor. Source is MIT, consistent with the repository. Customers submit a ZIP of an exported print-pack folder, choose one PLA colour, provide an email and delivery address, receive a server-calculated quote, and choose whether to pay through PayPal. The paid workshop email contains the requested colour, item quantities, shipping address and a 24-hour private download link. Printing is performed by an operator in Bambu Studio; this service never controls a printer.

## Current delivery status

Implemented and locally tested. The API is deployed at `https://terrainfoundry-print.azurewebsites.net` in `rg-terrainfoundry`, with private storage `tfprint5xc3ig54fujlw`; **live checkout remains disabled**. `rates.example.json` contains illustrative numbers, not an approved commercial offer. The business contact is `nigel.webster@mgnconsultancy.co.uk`. This address is not assumed to be an authenticated sender or a PayPal merchant identity.

Before accepting live orders, supply the actual volume/piece/setup/minimum tariff, shipping areas and charges, VAT treatment, printer dimensions, available filament colours, delivery times, trading address and cancellation/returns terms. Approve the final customer terms. Configure a PayPal Business REST app and webhook, a verified Azure Communication Services email sender, and Cloudflare Turnstile. Use the Azure app settings / Key Vault for credentials; never commit them or paste them into chat.

## Pricing and file interpretation

- The server reads binary or ASCII STL geometry and the exact exported `quantities.csv` contract. CSV dimensions and client-supplied prices are never trusted. Quantity counts include clips and fit-test parts.
- The tariff is based on **enclosed model volume**, per-piece handling, setup/minimum price, shipping and VAT, calculated in integer pence. This is not sliced filament usage or predicted printer hours. It needs commercial calibration with representative Bambu Studio slices before approval. Example rates are 8p/cmÂ³ + 25p/copy + Â£3 setup, Â£10 minimum print price, Â£4.95 GB shipping and 0% VAT; these are deliberately unapproved.
- Validate finite geometry, build-volume limits, nondegenerate triangles and closed consistently oriented edges. This does not detect every self-intersection, internal overlap, support requirement or fit issue. Operators must inspect the Bambu Studio slice before printing and contact/refund customers if a model cannot be manufactured.
- Limits: 40 MB compressed, 160 MB expanded, 180 archive entries, 600,000 distinct-model triangles and 500 total copies. Larger scenes must be split. An invalid pack is rejected before checkout. No archive entries are extracted to the filesystem or executed.
- Only validated STLs and `quantities.csv` are retained in a rebuilt manufacturing ZIP. `.terrain`, README files and other documents are not instructions and are discarded.

## Local checks and demo

From the repository root:

```powershell
pnpm --dir print-service install --ignore-workspace --frozen-lockfile
node --test print-service/test/*.test.mjs
node print-service/dev.mjs
```

Open `http://127.0.0.1:4175/#print-service`. This loopback-only demonstration uses in-memory records and example rates. It never sends email, uploads to Azure, takes payment or commands a printer. Restarting it deletes demo quotes. `test/helpers.mjs` is deliberately excluded from production deployment.

## Azure deployment

The existing website remains on Static Web Apps Free. The optional API is a separate Node 22 Azure Functions consumption app with private Blob Storage. Consumption/storage/email can incur usage charges. `infra/print-service.bicep` provisions only this service and starts it disabled; it does not touch other projects or reuse their mail credentials. Compile/validate the Bicep before deployment. After authenticating Azure CLI, deploy code with `./scripts/deploy-print-service.ps1` from the repository root (use `-AzureCli` when the CLI is not on PATH). The script builds a portable dependency archive and preserves existing app settings. Azure Functions Core Tools is an alternative. The deployment currently exposes only availability: requesting a paid service remains disabled, with no payment/email credentials configured.

Set the fields in `local.settings.example.json` as Function App settings (not in public files). Use a new random `PRINT_TOKEN_SECRET` of at least 32 characters. Set `PRINT_RATES_JSON` to the complete approved tariff. Keep `PAYPAL_ENV=sandbox` until end-to-end sandbox acceptance. Add a PayPal webhook at `https://<function-app>/api/print/webhook` for `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED`. Set the real webhook ID and merchant ID. Complete payment-provider dispute monitoring separately; PayPal remains the authority for financial records.

Verify the sender domain for `nigel.webster@mgnconsultancy.co.uk` in an appropriate Azure Email Communication Service. Do not claim this address as the sender until verification succeeds. The required email service and its settings are intentionally not taken from another project. Configure Turnstile for the canonical site hostname and action `print-quote`. API CORS and origin checking must allow the chosen site origin. The deployed CORS and `PRINT_ALLOWED_ORIGINS` allow both root and `www` hosts; quote links use the canonical root host.

The public API origin is configured in `site/print-config.js` and the website CSP `connect-src`. Change both together if the API moves. Allow `https://challenges.cloudflare.com` in CSP `script-src`, `frame-src` and `connect-src` for Turnstile. Set no-cache for private quote pages/API responses. Then set the three approval flags only after rates, terms and provider configuration are complete. A one-minute timer sends/retries queued emails. Configure Azure Monitor alerts for failed function invocations, payment review events and undelivered outbox entries; periodically inspect pending email records in private storage. Email retries resume stored provider operations where available, but a crash between provider acceptance and saving the operation can cause a duplicate email. They cannot cause a duplicate print order or charge.

## Payment and privacy controls

The server owns the price and shipping snapshot. Checkout uses one stored PayPal order per quote, a deterministic PayPal request ID and a renewable Blob lease. Customer returns alone never mark an order as paid. The server re-fetches the provider order and checks completed status, order/quote association, merchant, GBP amount and final capture before setting `paid` and queuing workshop notifications. Signed PayPal webhooks recover a payment when the browser closes. Refund/reversal/denial events move the record to payment review. Operators must check current payment status before printing/shipping, because notifications already delivered cannot be recalled.

Quote links carry a random identifier plus HMAC capability in the URL fragment; customer personal information is never returned by the public quote endpoint. Links are deliberately account-free: anyone with a complete private quote link can view the quote and initiate its checkout. Keep those links private. PayPal receives the delivery address associated with the quote. Browser rendering uses text nodes, not uploaded HTML.

The dedicated storage container denies public access. Download URLs are issued only in workshop email after verified payment and expire in 24 hours. The daily cleanup removes unpaid quote records/files after 30 days, and paid/review records/files after 180 days; PayPal/accounting retention is separate. Limits use HMAC email keys, with short retention. API errors/logs do not echo uploaded data or addresses. Never commit sample customer uploads, local settings, payment credentials or generated order data.

## Required acceptance before live payments

1. Confirm the actual tariff against representative Bambu Studio slices and shipping costs. Approve VAT and customer terms.
2. Use a PayPal sandbox buyer to pay a real sandbox order; exercise cancellation, a closed browser, webhook replay, provider pending status, refund and amount mismatch handling.
3. Verify real quote, paid customer and workshop email delivery, including a downloadable manufacturing ZIP, delivery address and copy counts.
4. Confirm Azure Blob leases/concurrent requests and email outbox retries on the deployed environment. Test upload limits and Turnstile denial.
5. Review the configured retention and monitor failed notifications. Only then enable live PayPal and publish the active service.

## OpenLOCK edition licensing gate

As of 1.1.0 the scenery uses attributed CC BY-NC OpenLOCK profiles and clips. Paid ordering additionally requires `PRINT_COMMERCIAL_RIGHTS_APPROVED=true`, which must remain unset/false until written permissions covering every relevant model and connector contribution have been verified. A Printable Scenery permission alone must not be assumed to cover a separate community profile contribution. The public site reports paid printing paused. Local test fixtures exercise payment logic on original test geometry; they do not establish commercial rights.
