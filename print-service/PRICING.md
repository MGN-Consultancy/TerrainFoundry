# Draft print pricing — test only

Paid printing remains disabled pending OpenLOCK commercial permission and final rate approval.

PLA costs GBP 12/kg and PETG GBP 16/kg. New quotes charge material at cost plus 30 percent, rounded up to whole pence. Machine time is charged separately at GBP 1.50/hour for A1 or GBP 2/hour for H2S, with no additional markup. Handling combines GBP 3 setup and GBP 0.25 per copy. The minimum print charge is GBP 10, provisional UK postage GBP 4.95, and no VAT is added (not VAT registered).

Customer responses expose filament, machine time, combined handling, minimum adjustment, discounts, postage and total only. Underlying costs and markup assumptions remain in the private quote record. Existing quotes preserve frozen prices and show a saved printing total when their tariff predates this breakdown. Saving a quotation keeps its private capability link and original seven-day expiry; it does not reserve production or extend validity.

Geometry estimates use a 1 mm shell, 15 percent infill, 15 percent material allowance and PLA/PETG densities of 1.24/1.27 g/cm3. Draft throughput is 12 g/hour on A1 and 20 g/hour on H2S. These are not Bambu Studio sliced results. Calibrate before offering firm prices.

## Calibrate before offering firm prices

1. Slice a small floor/wall pack, the supplied sample scene and a detailed/overhanging scene in Bambu Studio for each printer/material you intend to offer.
2. Record total sliced grams and total machine hours for **all plates and all copies**, including supports, purge and clips. Keep the exact nozzle, layer height, walls, infill and support settings.
3. Compare with the website estimate and adjust shell/infill/allowance/throughput conservatively. Record actual material use, hands-on time, failed prints and packaging after test prints.
4. Confirm the UK shipping service and parcel limits. Publish trading/delivery/returns terms and obtain the necessary commercial permissions before enabling payments.

## Discount codes

Set `PRINT_DISCOUNTS_JSON` privately in Function App settings. Never expose the list in the site's configuration response. `discounts.example.json` shows the structure; 1000 basis points means 10%. One code per new quote. Codes are case-insensitive, have UTC start/end dates, an optional minimum eligible parts amount and an optional maximum reduction. Codes are reusable, not single-use or customer-specific.

The reduction applies to parts only, excluding setup and postage. The minimum print charge remains in force, so the actual reduction may be capped. VAT, if enabled in a future tariff, is calculated after discount. The exact price and applied code are frozen in the quote for its seven-day validity; changing a code does not alter an existing quote.

For a discount limited to particular models, optionally provide `sha256: ["64-character lowercase STL content hash"]`. The server hashes the uploaded bytes; renaming another STL does not qualify it. Modified or re-exported STL bytes need a separately approved hash. Do not scope discounts using customer-controlled filenames.

## Test access and email

`PRINT_PREVIEW_ENABLED=true` opens only the invited test path. `PRINT_PREVIEW_ACCESS_CODE` must be at least 16 characters; `PRINT_TOKEN_SECRET` at least 32. Store these only in private app settings. A private invitation code is required before files are analysed. Test request counts are limited and uploads are private. Test quotes and requests are deleted after 30 days.

Azure Communication Services sends real, clearly marked test emails. Replies go to `PRINT_OPERATOR_EMAIL`. Submitting a test request queues a customer receipt and an operator notification explicitly instructing **do not print or ship**; no production download link is sent. A provider `Succeeded` receipt proves provider acceptance, not inbox delivery. Check the recipient inbox/junk folder during acceptance.

Turning preview off does not authorise commercial operation. The original commercial-rights, rates, terms, PayPal and anti-spam requirements all remain necessary. Keep `PRINT_SERVICE_ENABLED=false` while testing.
