# Terrain Foundry 1.2.0 — print cost estimates

- Adds **Estimate print costs** beside **Prepare print pack** in the desktop editor.
- Uses the website's current pricing calculation for PLA/PETG, A1/H2S, colour, UK delivery and optional parts discounts. Website rate/calculation changes take effect without a client rebuild while the estimate API remains compatible.
- Measures the scene's export locally, including connectors and fit-test quantities. Only part measurements, identifiers and quantities are sent; STL geometry, scene layouts and personal details are not uploaded for estimates.
- Shows the website breakdown and a clearly dated cached estimate when offline, only for an identical pack and print options. A new scene or option needs an online calculation first.
- Saves a ready-to-upload ZIP and opens the print website when requested. The user chooses whether to upload it there.
- Print requests remain test-only. No payment, printing or shipping is enabled. Estimated weight/time are not Bambu Studio slice results.

Existing OpenLOCK scenery, non-commercial licensing, sculpted detail and saved scene layouts are unchanged. Physical connector fit still requires the supplied test print. The signed launcher offers the new client as an interactive update.
