# GIS, weather and crop-care reference update

Date: 24 October 2026

References inspected:

- `C:\Users\ADT AI\Downloads\GIS (3)\GIS (2)\GIS\GIS`
- `C:\Users\ADT AI\Downloads\ADT_Weather-main (2)\ADT_Weather-main`

## Result

The V2 app now shares farm context between its dashboard, GIS, weather and photo diagnosis. Context preserves the farm ID, actual satellite dates/history, soil-record availability, crop-stage provenance, forecast freshness and practical inspection cues. Different farms cannot be combined. Weather suitability and photo classification remain separate evidence; neither confirms nutrient deficiency or a field diagnosis.

The dashboard now shows two large farm/weather cards, clear module actions and field checks tied to available information. Navigation has five consistent tabs and a farmer/language header. Unimplemented notification actions, Pro badges, artificial work schedules and hardcoded soil/irrigation details were removed. Farm details now distinguish missing records from confirmed information. English and Marathi text is provided for the new flows.

Weather has selectable forecast days. Selecting a day updates the displayed humidity/wind and dated crop-watch guidance. Its context and crop watch recheck freshness while open. Irrigation explains whether crop stage came from a record or was estimated from planting date. Rainfall remains a forecast and irrigation uses today's rainfall, not later rain credited to today.

GIS keeps the large real-boundary map and hides empty index selectors. It adds previous dated observations only when multiple measured records exist, plus a brief nutrient-confirmation note for greenness/chlorophyll proxies. The existing genuine historical raster remains separate from the more recent field-average date.

The legacy NDVI classification was also corrected: it describes greenness rather than assigning growth stage or prescribing nitrogen. Its retained numeric score is documented as an uncalibrated compatibility heuristic, not a crop-health probability, and is not shown on the new dashboard.

Photo scans now submit the selected farm ID and check ownership before inference. Responses attach the same farm's local GIS and cached weather context. Inference runs in a worker thread with serialized model access, so CPU work does not run on the async event loop. Missing GIS context does not discard a completed photo result. Weather outages do not discard dashboard soil/map information.

## Reference decisions

The new GIS reference includes nutrient, chlorophyll and biomass agents. Their useful safeguards were adopted: stage/age must have provenance, vegetation indices alone cannot establish a nutrient deficiency, and absolute biomass requires additional measured/calibrated inputs. V2 does not invent SAR, SPAD measurements, planting-to-date weather or intermediate observation history. It exposes analysis readiness instead of presenting unsupported tonnes or nutrient conclusions.

Recorded crop stage takes priority. When absent, a valid planting date can estimate stage using the reference windows: 0–45 days sprouting, 46–120 tillering, 121–270 grand growth, and later maturity. The source is explicitly `planting_date_estimate`; future/invalid dates do not create crop age.

The weather reference's eight scouting rules match the previously integrated versions. V2 now runs them independently for every forecast day. Unmeasured leaf wetness and rainfall rules without a verified accumulation period remain excluded.

The installed UNet and reference UNet are byte-identical. Both SHA-256 hashes:

`9E7328744107BB81A0AA6787C5E0D5F6054F02180472A36EA3104814B4BD3CAE`

No retraining or replacement was performed. Real model inference was executed; a plain generated test image is a smoke test, not an assessment of diagnostic accuracy on real crop photos.

## Farmer records checked

- Asawari Amol Kadam: 1.9 acres, real eight-vertex boundary, no recorded satellite crop observation or raster. Empty index values are preserved and explained; no values were fabricated.
- Dhondiba Dulbaji Dakhore: 1.4 acres, real boundary, NDVI 0.449 dated 12 October 2026, genuine pilot raster dated 12 October 2024. The dates remain distinct.
- Canonical registry remains 25 farmers, 25 farm boundaries, 25 soil records and 23 satellite observation records. No farmer records, schema or reference files were changed.

## Validation

- `npm run typecheck --prefix frontend`: passed.
- `npx expo export --platform web` in `frontend`: passed; exported to `frontend/dist`.
- `python -m pytest -q tests test_task7_science_gis.py test_task9_minimal_ui.py test_phase4_e2e.py` in `backend`: 31 passed, including a final run against the restarted server with cold model loading.
- Additional real farm-bound inference assertions in `test_phase4_e2e.py`: passed.
- `python test_scaffold.py`: all checks passed, including authentication, family selection, real weather, map data, UNet, dashboard and ownership enforcement.
- New tests cover stage/date provenance, invalid/future observations, cross-farm context rejection, stale/future weather, dashboard weather outage, scan authorization before inference, worker-thread execution, and preservation of scan results when GIS is unavailable.
- The live API tests verify both farmers' context, actual forecast coordinates, all seven dated crop-watch groups and authenticated raster access.

An initial live suite failed because no server was running. After starting V2, a cold UNet import/load exceeded the old 15-second test timeout; the image-analysis request now explicitly allows 60 seconds. The model completed, and subsequent inference and final checks passed. Existing pytest/Pydantic deprecation warnings remain.

V2 is running locally at `http://127.0.0.1:8000/` (final process 1972; the verified session-owned process 5656 was restarted to load the last backend correction). The new web bundle is served on that same port. No reference-project server was changed.

## Remaining limits

Browser security rejected acquisition of the existing preview tab. No alternate browser or automation workaround was used. Consequently rendered desktop/mobile layout, Marathi wrapping and physical-device camera behavior have not been visually verified in this update; no fresh screenshots are claimed.

No new Copernicus request was made. An earlier automatic approval review rejected sending a private farm boundary to Copernicus without explicit permission. Asawari's current satellite values remain missing until a permitted real observation is retrieved. The existing manual refresh control discloses that boundary transmission.

Absolute biomass, calibrated chlorophyll, confirmed nutrient deficiency and planting-to-date GDD remain unavailable where required measurements or calibration are missing. The app does not claim those outputs.
