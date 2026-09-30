# Optional print and ship service

This is separate from the offline desktop editor. Source is MIT, consistent with the repository. Customers submit a ZIP of an exported print-pack folder, choose one PLA colour, provide an email and delivery address, receive a server-calculated quote, and choose whether to pay through PayPal. The paid workshop email contains the requested colour, item quantities, shipping address and a 24-hour private download link. Printing is performed by an operator in Bambu Studio; this service never controls a printer.

## Current delivery status

Implemented and locally tested. The API is deployed at `https://terrainfoundry-print.azurewebsites.net` in `rg-terrainfoundry`, with private storage `tfprint5xc3ig54fujlw`; **live checkout remains disabled**. `rates.example.json` contains illustrative numbers, not an approved commercial offer. The business contact is `nigel.webster@mgnconsultancy.co.uk`. This address is not assumed to be an authenticated sender or a PayPal merchant identity.

Before accepting live orders, supply the actual volume/piece/setup/minimum tariff, shipping areas and charges, VAT treatment, printer dimensions, available filament colours, delivery times, trading address and cancellation/returns terms. Approve the final customer terms. Configure a PayPal Business REST app and webhook, a verified Azure Communication Services email sender, and Cloudflare Turnstile. Use the Azure app settings / Key Vault for credentials; never commit them or paste them into chat.

## Pricing and file interpretation

- The server reads binary or ASCII STL geometry and the exact exported `quantities.csv` contract. CSV dimensions and client-supplied prices are never trusted. Quantity counts include clips and fit-test parts.
- The tariff is based on **enclosed model volume**, per-piece handling, setup/minimum price, shipping and VAT, calculated in integer pence. This is not sliced filament usage or predicted printer hours. It needs commercial calibration with representative Bambu Studio slices before approval. Example rates are 8p/cm³ + 25p/copy + £3 setup, £10 minimum print price, £4.95 GB shipping and 0% VAT; these are deliberately unapproved.
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


## Invited quote testing

See [PRICING.md](PRICING.md) for the A1/H2S PLA/PETG draft model, calibration, private test access and discount configuration. The dedicated email resources are defined in `infra/print-email.bicep`. Preview mode supports real quote emails and test requests, but cannot create PayPal orders, take money or queue production. Keep all commercial enablement flags false. Test records remain non-payable even after future live activation.


## Single-file workshop import

New quote packs include `OPEN-IN-BAMBU.3mf`, generated only from validated STL
geometry and server-checked quantities. Open this file once in Bambu Studio;
all copies, including listed OpenLOCK clips and fit tests, are present. The
STLs and quantities.csv remain as fallback originals. Do not import both.
This is unsliced millimetre geometry, with objects separated in a staging grid.
Select printer/nozzle/material, Arrange All across plates, and inspect slicing
before printing. It intentionally contains no machine profile or G-code.
Older saved packs are unchanged; their workshop email retains STL instructions.
Only verified paid orders receive a workshop download link; preview requests
remain non-paying and cannot queue production.

The operator reported obtaining separate OpenLOCK commercial permission on
2026-09-30, including supplying clips. This does not relicense the public assets
or grant commercial permission to other users. Keep the agreement privately
with business records and follow its terms. Payment/rate/terms approvals and
provider configuration remain separate from commercial-rights approval.


## Private real 10p PayPal transaction test

This is separate from print discounts and from non-paying preview requests.
The quote owner must supply its private link and a private test code; the quote
email must match PRINT_OPERATOR_EMAIL. Only one test invoice per quote is made.
GBP 0.10 is fixed server-side, with no shipping. A successful capture is stored
under payment-tests/, never quotes/, and cannot queue workshop files or settle
the original quote. No automatic refund is issued. PayPal's own receipt applies;
this path does not send a print-order confirmation email.

Configure PAYPAL_ENV=live, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
PAYPAL_MERCHANT_ID and PAYPAL_TEST_WEBHOOK_ID securely in Azure. Register a
separate live webhook at /api/print/test-webhook for CHECKOUT.ORDER.APPROVED,
CHECKOUT.ORDER.COMPLETED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.REFUNDED,
PAYMENT.CAPTURE.REVERSED and PAYMENT.CAPTURE.DENIED. Keep the ordinary production
webhook separate. Set PRINT_PAYMENT_TEST_ENABLED=true, a private random
PRINT_PAYMENT_TEST_CODE of at least 16 characters, and a UTC
PRINT_PAYMENT_TEST_EXPIRES timestamp. The quote page offers a test-payment dialog
only while these prerequisites are configured. Keep preview mode enabled and
normal paid-print ordering disabled during testing. Configure the credentials
through Azure settings or a private local settings file, never commit secrets.
Test payment state can be reconciled after the code expires; new captures cannot.


## Payment confirmation and workshop progress

PayPal return parameters are accepted in the query string or appended after the
private URL fragment. They never substitute for server-side payment verification.
A captured 10p test queues explicitly labelled customer/operator receipts and
shows a persistent test confirmation; it never marks the scenery quote paid.
Paid live print-order emails include a separate purpose-bound workshop link.
That operator link supports paid -> in-progress -> shipped, with optional carrier
and tracking text. Customer emails link back to the read-only order status.
Customer quote tokens cannot operate workshop endpoints. Preview, sandbox,
unpaid and payment-review orders cannot enter fulfilment. Keep workshop links
private; their authority is tied to PRINT_TOKEN_SECRET, independently derived
from customer quote capabilities. No customer account is needed.


## General STL printing and filament-only promotions

The upload selector accepts Terrain Foundry ZIP manifests, Meshy STL exports,
and other standalone STL models or STL-only ZIPs. General uploads create their
own quantity manifest from the chosen copies-per-model value. They follow the
same closed-geometry, finite-coordinate, build-volume, triangle, byte and copy
limits. General ZIPs reject unrelated files and nested archives. No G-code,
script, executable, external resource or renderer is executed. Uploaded texture
files and third-party project formats are not supported: export STL in mm.
Before reading multipart uploads, apply global and per-peer hourly budgets;
after authorization, existing email budgets and geometric checks still apply.
Public ordering remains gated on server-side Turnstile and business readiness.

A versioned discount with mode `filament-only` waives the minimum print charge,
machine time, handling, markup and postage. It charges the estimated raw
filament cost (and configured VAT, currently zero), rounded up to a penny.
It is a server-side discount, never a client-supplied price override. Existing
quotes retain their frozen totals. Codes have UTC validity windows and can be
disabled in PRINT_DISCOUNTS_JSON. The operator knowingly absorbs postage.
