# Reference-based farmer app improvements

Updated 22 October 2026. App: http://127.0.0.1:8000/.

## What was borrowed from the references

Read the GIS MapViewer and satellite agent in `C:/Users/ADT AI/Desktop/GIS (2)/GIS`. Kept its useful map-first approach, polygon clipping and index comparison. Did not copy its synthetic-raster generator or mock-index fallback.

Read the integrated weather and pest/disease code under `C:/Users/ADT AI/Downloads/ADT_Weather-main (2)/ADT_Weather-main`. Reused its eight reference-approved crop-watch rules, rule registry and weather-suitability engine inside the existing V2 backend. Borrowed its confidence-filtered image segmentation approach. No reference files were modified and no additional backend service was created.

## GIS and Asawari

- Tighter framing makes the actual field larger on the map; pan, zoom, centering, real imagery and required attribution remain.
- Added comparison between the plain satellite image and measured crop colours.
- Defaults to the newest available observation rather than showing an older raster as current. Genuine pixel overlays remain available separately with their own date.
- Corrected observation selection: sort by valid acquisition date, reject future/invalid dates, preserve missing measurements as null. Removed the backend's fabricated 0.50 NDVI and hardcoded date fallbacks.
- Private raster responses now use private rather than public cache headers.
- Added an authenticated, ownership-checked satellite-refresh action with provider failure handling and a per-farm local derived-data cache. It does not import or overwrite farmer/soil/history records.
- Refresh uses a real cloud-masked Copernicus statistics request over the saved boundary; it never synthesizes a spatial pattern. The updated `/statistics/v1` route follows the [official Copernicus API documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/ApiReference.html). Missing/no-data/future/nonfinite observations are rejected.

Asawari Amol Kadam has the correct 1.9-acre boundary but no saved historical satellite observation. The blank readings are a real data gap, not a map rendering failure. She still has genuine weather and soil/advisory data. The Copernicus account authorization check succeeded, but the actual farm-boundary request was blocked by automatic approval review. No live observation was fetched, fabricated or added. Her values therefore remain unavailable pending explicit permission to send her private farm boundary to Copernicus, and a usable scene being returned.

The UI's “Check satellite observation” action explains that this sends the boundary to Copernicus. It was not clicked during verification.

## Weather and Crop Care together

- Added a compact high/low temperature and rainfall trend visual alongside the seven-day outlook.
- Weather and Crop Care share the same farm-specific crop-watch data. A direct action links weather guidance to photo checking, with navigation back to full weather.
- Crop watch uses the eight rules from the reference project, with short English/Marathi inspection cues. It presents weather suitability as scouting guidance, not disease probability or confirmed infestation.
- Crop stage remains explicitly unknown when not recorded. Leaf wetness is never invented. Rainfall thresholds with unclear accumulation periods are excluded instead of comparing them to an incompatible daily total.
- Daily forecast humidity and wind now come from complete, same-day hourly forecast values rather than copying current weather across seven days. Missing daily observations stay missing.
- Cache keys include the farm and irrigation inputs, preventing nearby/shared-coordinate farms with different areas or stages from receiving the wrong irrigation result.
- Incomplete provider values fail clearly instead of using sample temperatures, winds or hourly measurements. Weather-provider errors return a simple 503 message.
- Today's irrigation adjustment now uses today's rain forecast; rain later in the week is not deducted from today's water need. The earlier weekly physics contract remains available for existing callers and its regression tests.

## Scan correctness and UI

- Replaced the simulated viewfinder, fake controls, technical model badges and generated sample leaves with actual photo capture/gallery selection, a clear preview and readable results.
- Photo checking is the first main action on Crop Care; weather scouting follows it.
- Retained the trained model and its existing preprocessing. Applied the reference's 75% pixel-confidence filter and 2% minimum detected image area. Confidence is calculated from the detected class pixels rather than the entire image.
- Added genuine segmentation highlights from the inference mask when a supported disease is detected. No overlay is fabricated for a missing/failed result.
- Model absence/inference failure now returns an error rather than a fake Brown Rust diagnosis. Missing model weights no longer run an untrained model.
- A no-supported-disease result has no Brown Rust details or treatment. The UI explicitly does not equate a negative scan with a healthy crop.
- Scan requests require authentication and validate actual image format, upload size (8 MB) and decoded dimensions (20 megapixels).
- Removed stale results when selecting a different image and cleaned up browser image URLs. Existing treatment material remains behind an optional reference section.

## Files changed or added

Backend: GIS service/schema/router and new satellite_refresh.py; weather service/schema/router/physics; pest_disease router/service/schema/unet_classifier plus reference prisk_engine.py, rule_registry.py, crop_watch.py and data/disease_and_pest_rules.json; tests/test_reference_improvements.py; authenticated scan calls in test_scaffold.py and test_phase4_e2e.py. Added backend cache exclusion to .gitignore.

Frontend: GISScreen.tsx, InteractiveGISMap.web.tsx and native map props; WeatherScreen.tsx, PestDetectionScreen.tsx, RootNavigator.tsx, apiClient.ts and types/index.ts; new CropWatchCard.tsx and ForecastChart.tsx. Regenerated production web export. No database schema, farmer identity, KML, soil record, historical observation or reference-project file was changed.

## Verification

- TypeScript validation passed.
- Expo production web export passed.
- `python -m pytest -q tests test_task7_science_gis.py test_task9_minimal_ui.py test_phase4_e2e.py`: 23 passed.
- `python test_scaffold.py`: existing core suite passed, including real commercial weather/caching, trained-model inference, family authentication, ownership and advisory behavior.
- The original scan tests were updated to send their existing authenticated farmer token, matching the now-protected scan endpoint. New tests separately verify unauthenticated rejection, invalid uploads, failure responses, missing-data integrity, crop-watch missing inputs, daily weather aggregation, irrigation timing and cache isolation.
- Explicit cross-farmer satellite-refresh attempt returned 403 before any provider call.
- Read-only real-farmer checks preserved 25 farmers, 25 boundaries, 25 soil records and 23 historical observations. All six existing pilot PNGs passed protected-access checks.
- Restarted only the verified V2 process on its existing port 8000. Other reference projects were not started, stopped or changed.

One initial core-suite attempt overlapped with the web export clearing/replacing its output and failed the root HTML assertion. It passed after the completed export. A legacy unauthenticated scan test initially returned the new correct 401; its call was updated to use the authenticated test farmer, and the full suite then passed.

## Remaining limits and required approval

The live Copernicus statistics call for Asawari was rejected by automatic approval review because it transmits her private farm boundary to an external service without sufficiently specific authorization. The account check alone does not establish availability of a usable satellite scene. This is the only pending external data step; it must not be worked around or represented as a successful retrieval.

Reference crop-watch thresholds were preserved from the supplied project, not independently revalidated as clinical outbreak probabilities. No physical Android device or new model-accuracy benchmark was run. Native mapping retains the pre-existing boundary-preview limitation; satellite visualization is verified in web layouts. Upload/error and negative-model-result paths have regression coverage; a genuine diseased-photo accuracy validation remains outside the performed checks.

## Visual inspection and artifacts

Visually inspected the updated pilot farm map at browser width, including the larger real boundary and the plain-satellite comparison control. Checked Weather → Crop Care navigation. At a 390-pixel phone width, inspected Asawari's own farm, Marathi labels, the photo-first Crop Care layout, the shared crop-watch cues and seven-day graph/table. No satellite-refresh button was pressed. Browser screenshots in this folder document the inspected layouts.

The phone check used a temporary same-origin iframe; its outer page can scroll when the browser viewport is shorter than the 844-pixel phone frame. This test aid was removed from the production output after inspection. It does not establish physical Android behavior.

Checked that neither the Open-Meteo API key nor the Copernicus client secret appears in the exported web JavaScript. The frontend only calls the existing authenticated V2 API.
