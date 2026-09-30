# Test pricing and calibration

This is an invited test service, not a commercial checkout. No payment, printing or shipping is authorised by a test request. Existing OpenLOCK commercial-rights gates remain closed. Test records cannot later be converted to payable orders.

## Confirmed inputs

- Printers: Bambu A1 and H2S.
- Basic PLA: GBP 12/kg; PETG: GBP 16/kg.
- UK delivery only; no VAT added because the operator is not VAT registered.

## Proposed settings, awaiting print calibration

The versioned test tariff is `rates.preview.json`. It estimates material from STL enclosed volume and surface area, using a 1 mm shell, 15% infill, PLA density 1.24 g/cm3 or PETG 1.27 g/cm3, and a 15% material allowance. These assumptions do not replace a slicer and do not accurately predict every support, internal overlap, thin wall, purge or failed print.

Provisional throughput is 12 g/hour for A1 and 20 g/hour for H2S. These are assumptions, not measured printer specifications or speed guarantees. Estimated grams divided by throughput gives machine hours; multiply by GBP 1.50/hour for A1 or GBP 2/hour for H2S. The hourly charge is intended to cover power, wear and machine use; do not add those costs again without revising the tariff.

Parts charge = (filament cost + machine-time cost) x 1.5, rounded up in integer pence, plus 25p handling per printed copy. Add GBP 3 setup, apply a GBP 10 minimum printing charge, then GBP 4.95 provisional UK postage. A 50% markup is not a 50% gross margin. Postage, packaging, time rates, colour availability and profitability remain unconfirmed. Every copy in quantities.csv counts, including clips and fit-test parts. Split unusually large orders for manual review.

## Calibrate before offering firm prices

1. Slice a small floor/wall pack, the supplied sample scene and a detailed/overhanging scene in Bambu Studio for each printer/material you intend to offer.
2. Record total sliced grams and total machine hours for **all plates and all copies**, including supports, purge and clips. Keep the exact nozzle, layer height, walls, infill and support settings.
3. Compare with the website estimate and adjust shell/infill/allowance/throughput conservatively. Record actual material use, hands-on time, failed prints and packaging after test prints.
4. Confirm the UK shipping service and parcel limits. Publish trading/delivery/returns terms and obtain the necessary commercial permissions before enabling payments.

For the supplied 56-copy sample, the initial estimate gives 387.91 g PLA: A1 32.33 hours / GBP 101.68 delivered; H2S 19.40 hours / GBP 87.14 delivered. PETG estimates are 397.29 g: A1 GBP 106.00; H2S GBP 91.09. These are illustrative test calculations, not sliced times or firm offers.

## Discount codes

Set `PRINT_DISCOUNTS_JSON` privately in Function App settings. Never expose the list in the site's configuration response. `discounts.example.json` shows the structure; 1000 basis points means 10%. One code per new quote. Codes are case-insensitive, have UTC start/end dates, an optional minimum eligible parts amount and an optional maximum reduction. Codes are reusable, not single-use or customer-specific.

The reduction applies to parts only, excluding setup and postage. The minimum print charge remains in force, so the actual reduction may be capped. VAT, if enabled in a future tariff, is calculated after discount. The exact price and applied code are frozen in the quote for its seven-day validity; changing a code does not alter an existing quote.

For a discount limited to particular models, optionally provide `sha256: ["64-character lowercase STL content hash"]`. The server hashes the uploaded bytes; renaming another STL does not qualify it. Modified or re-exported STL bytes need a separately approved hash. Do not scope discounts using customer-controlled filenames.

## Test access and email

`PRINT_PREVIEW_ENABLED=true` opens only the invited test path. `PRINT_PREVIEW_ACCESS_CODE` must be at least 16 characters; `PRINT_TOKEN_SECRET` at least 32. Store these only in private app settings. A private invitation code is required before files are analysed. Test request counts are limited and uploads are private. Test quotes and requests are deleted after 30 days.

Azure Communication Services sends real, clearly marked test emails. Replies go to `PRINT_OPERATOR_EMAIL`. Submitting a test request queues a customer receipt and an operator notification explicitly instructing **do not print or ship**; no production download link is sent. A provider `Succeeded` receipt proves provider acceptance, not inbox delivery. Check the recipient inbox/junk folder during acceptance.

Turning preview off does not authorise commercial operation. The original commercial-rights, rates, terms, PayPal and anti-spam requirements all remain necessary. Keep `PRINT_SERVICE_ENABLED=false` while testing.
