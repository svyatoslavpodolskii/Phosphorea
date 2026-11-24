# Retained GPU zoom renderer

Target report: Nothing Phone 1, Android Firefox Mobile; visible stutter with only 20 atoms.

## Change

Previously each atom combined geometry, decoration and zoom-dependent text into a Canvas bitmap. Font-size changes and raster density boundaries regenerated complete textures during a pinch. The input Canvas was also cleared on every GPU frame, and a stationary direct gesture kept the frame loop running.

Bodies now use retained Pixi Graphics contexts, with prepared flat and highlighted variants. Icons and radial gradients are shared with reference counts. Labels have independent fixed-resolution textures; zoom changes their transforms. Selection rings, pins, relationship curves, relationship text and collapsed-group dots stay in the GPU scene. The input Canvas draws only active hold/lasso feedback. Stationary direct gestures stop scheduling frames until another input arrives. Navigation controls no longer apply a permanent backdrop blur.

Canvas 2D remains the fallback for unavailable WebGL. Settings shows the actual renderer and existing build identifier. Storage schema, persistent data and Plugin API are unchanged.

## Reproducible work counts

Same 20 pinned atoms, 40 native two-finger updates, initial zoom 0.62, headless Chromium software WebGL fixture, CPU throttle 4, 1280 x 800, DPR 2:

| End zoom | Previous raster creations | Retained raster creations | Previous overlay clears | Retained overlay clears |
| --- | ---: | ---: | ---: | ---: |
| 0.7 | 160 | 0 | 399 | 0 |
| 1.6 | 220 | 0 | 403 | 0 |

The baseline is commit 030cebe with an optional CPU timing hook. Raw reports are in artifacts/zoom-work-{baseline,retained}-*.json. Work counts exclude the initial warm-up. The regression requires zero new raster textures, zero input-Canvas clears and zero idle draws during a stationary pinch. A separate linked-graph test crosses grouping thresholds and checks that the input Canvas remains empty, including relationship labels and group atmosphere.

CPU draw timings are not GPU completion timings. The old loop also sampled redundant idle draws, whereas the new loop draws only changed frames. These timings cannot establish a percentage FPS improvement. Driver step timings include automation and are not frame rates.

## Validation and limits

Run npm run check, npm test, npm run build, then Playwright zoom-work and render-stability tests. npm run test:firefox runs narrow-viewport zoom tests for default WebGL and forced Canvas plus navigation/reduced-motion regressions. Install Playwright Chromium and Firefox first. PHOSPHORA_TEST_URL can target an existing preview. Optional ?profile=1 exposes CPU draw time on canvas.map without normal-mode timing instrumentation.

Desktop Firefox 142 with a narrow viewport verifies Gecko rendering and fallback behavior. It is not Android Firefox or a physical Nothing Phone 1 benchmark. Device frame pacing remains to be confirmed. Screen-constant link/ring geometry still updates on zoom; this change eliminates whole-node raster regeneration rather than promising transform-only work for every graph feature.

Invisible node and relationship-label caches are evicted against estimated texture memory and count limits. Visible content may exceed the soft texture budget; native geometry memory is additional. Destroy paths release contexts and reference-counted textures.


## 0.10.6: dense mobile WebGL work counts

The earlier raster-creation benchmark missed GPU draw-call overhead. The new
`tests/performance/gpu-zoom.spec.ts` fixture uses Firefox hardware WebGL,
390 x 844 CSS pixels, DPR 2, twenty pinned atoms in Now, sixty links, and 120
pinch frames. It counts actual GL draw calls and vertex/index buffer uploads.

| Work during the same pinch | 0.10.5 | 0.10.6 |
| --- | ---: | ---: |
| GL draw calls | 12,120 | 480 |
| Buffer uploads, bytes | 55,550,400 | 38,668,800 |
| New text/icon rasters | 0 | 0 |
| JS preparation, median ms | 4.84 | 3.02 |
| JS preparation, p95 ms | 8.30 | 4.78 |

Node bodies, icons, pins and labels now occupy shared layers; their graphics
contexts opt into batching. Rings use one analytic quad mesh, with CSS stroke
width adjusted by a zoom uniform. Explicit GLSL 300 headers and a shader-draw
assertion prevent a silent shader compilation failure from masquerading as a
performance gain. Screenshots were compared to preserve the Now dashes.

These are desktop-browser work counts and timing samples, not measured phone
FPS. Overall RAF cadence stayed approximately the same on this desktop.
Buffer upload cost remains; splitting render groups did not improve this fixture
and was not retained. Canvas fallback and persistent storage are unchanged.
