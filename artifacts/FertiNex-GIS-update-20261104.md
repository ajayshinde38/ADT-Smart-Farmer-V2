# GIS display and FertiNex advisory update — 4 November 2026

Reference read only: `C:\Users\ADT AI\Downloads\FertiNex\Fertigation Model`.
Schedule constants extracted with Python AST literal parsing from `backend_django/app/services/fertigation_schedule.py`; no reference application code executed, credentials read, or reference files modified.

## Maps

Removed forced nearest-neighbour/pixelated browser display for all six index layers and the NDVI-derived VRA layer in web and Android WebView. Browser image interpolation now softens enlarged source-cell edges. Original PNGs, measurements, bounds, farm clipping, ownership checks, no-data alpha, class interpretation and VRA counts remain unchanged. This is display smoothing, not new observations or higher satellite resolution. VRA is still canopy-vigor screening; it supplies no fertilizer rates.

## Fertilizer logic

Raw STCR remains separate from the FertiNex bounded seasonal target. FertiNex uses 80% of raw STCR bounded to 80–120% of these per-acre reference benchmarks: Adsali N/P/K 160/68/68, pre-seasonal 136/68/68, Suru 100/46/46. Its target-yield scenarios are 250/220/200 t/ha. A recorded target overrides the yield scenario. Unknown season can be inferred from a valid planting month, with its provenance displayed.

The pH/DAP tables cover pH 6–8.2 and above 8.2–8.9; cutoffs are 450/420/360 DAP. Unknown/out-of-range pH or missing soil N/P/K/OC blocks a product schedule. Missing applied nutrients stay unknown, not zero. All three confirmed nutrient amounts use kg/acre N/P2O5/K2O. Preview can override season and planting date without updating farm data. Future dates are rejected. Past doses are never labelled completed, and an expired crop cycle gets no catch-up schedule.

Remaining nutrients equal max(0, bounded target minus confirmed applied nutrients). The planner uses reference nutrient-carrier groups and bounded nonnegative fitting (scale 0–8), reports delivered/unmet/excess nutrients, and labels unmatched scenarios for agronomist review. A zero remaining nutrient cannot be reintroduced by a mixed carrier. Product masses and nutrient totals scale with actual acreage. Unknown compositions, pesticide entries and liquid quantities without verified density are excluded from fertilizer balancing. No name-hash product assignment, default missing soil nutrients, assumed application history, or invented irrigation water volumes are used. These are reference scenarios, not validated autonomous prescriptions; nutrient basis, suitability and mixing compatibility require field review.

Composition calculator display corrected to read its actual N/P2O5/K2O response keys.

## Verification

- Backend suite: 72 passed, 1 explicitly gated real-model test skipped.
- Added fertilizer tests cover bounds for all seasons, missing history versus confirmed zero, area scaling, zero-nutrient constraints, honest balance residuals, old crop cycles, ownership, invalid inputs and current-cycle previews.
- TypeScript compilation passes.
- Native map harness passes all seven layers, original bounds, clipping, token destination restrictions, zoom preservation, stale responses and cleanup. Network and Leaflet are mocked in this harness.
- Web export succeeds; local API health and web root respond successfully, and the new protected plan route is loaded.
- Browser sessions show sign-in; authenticated real-farm visual checks were not completed. Emulator capture did not provide a usable app view. No authentication bypass or new farmer records were used for testing.

Local web: http://172.16.104.220:8002/ . Reload the Expo app for updated native JavaScript. No deployment or APK build was performed for this change.
