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


## 0.10.7: retained camera frames

0.10.6 still prepared the entire scene on every camera frame. The renderer now
has a camera-only path. Immutable scene identity, presentation revision, selection,
lens, palette, viewport, semantic LOD bands and a world-space coverage guard decide
when a full refresh is necessary. The guard accounts for atom bodies and labels,
so panning cannot reveal an empty strip of unprepared content. A settled camera
always gets a fresh full frame and is then persisted normally.

Curves share one retained mesh. Centerlines and normals are uploaded when the
scene changes; a zoom uniform keeps stroke width constant. Render groups isolate
body/icon/pin geometry from live text scaling. The old render-group experiment did
not help while full scene preparation still ran; separating camera frames is what
makes those groups useful. Label positions/sizes and icon/pin visibility continue
to update during gestures. Semantic crossfades, edits and dragging use full frames.

Same dense mobile WebGL fixture as above, 120 frames:

| Work | 0.10.6 | 0.10.7 |
| --- | ---: | ---: |
| Buffer uploads, bytes | 38,668,800 | 1,186,560 |
| Full scene preparations | 120 | 3 |
| Retained camera frames | 0 | 117 |
| GL draw calls | 480 | 840 |
| JS preparation, median ms | 3.02 | 0.88 |
| JS preparation, p95 ms | 4.78 | 1.60 |

The extra render groups deliberately trade three draw calls per frame for much
less CPU preparation and buffer traffic. The 1000-note zoom/pan fixture measured
1.46 ms median / 2.58 ms p95 preparation in the final run (0.10.6: 6.32 / 24.40).
Desktop RAF cadence remains near the desktop display limit; these numbers are
not evidence of actual Nothing Phone 1 FPS.

Diagnostic export now includes a bounded local ring of the latest 120 camera
frames: preparation time, RAF interval and retained/full counts. This captures the
phone's own timing without note contents or automatic network reporting. Frame
interval includes browser/GPU/compositing delays; preparation measures JS only.


## 0.10.8: quality, stable surfaces and corrected timing

The supplied NP1 report still shows serious user-visible stutter. Desktop
improvements in 0.10.7 did not establish that the phone problem was solved.
The previous RAF interval could also include an intentional pause in pointer
delivery when the rig stopped requesting frames. Reset it when the queue empties
and report actual RAF queue wait separately. The local bounded Long Animation
Frame observer adds browser-side attribution without note data or full URLs.

Bodies now use shared Canvas2D-rasterized, linearly filtered mipmapped textures
rather than unsmoothed vector outlines. Cache ownership follows existing node
eviction and byte accounting (including mipmaps). Zoom does not rebuild them.
Curves retain their geometry and use fragment coverage for edge antialiasing.
Background rebases retain canvas dimensions and patterns instead of discarding
three backing stores. Rotary motion uses CSS transform; preview and control
layout are isolated.

Dense Firefox WebGL fixture: 117/120 retained frames, zero new textures during
zoom, 909,600 buffer bytes versus 1,186,560 in 0.10.7; preparation median 0.72 ms,
p95 1.30 ms in the first run. A repeat was 0.84/1.60 ms: do not treat small
timing differences as a demonstrated phone FPS gain. 1000-note prep was
1.46/2.22 ms. Both near and distant views were inspected.

The Chromium CPU-throttled broad-zoom compositor fixture uses Canvas fallback
on this machine. Removing background/UI improves median but long periodic gaps
remain even without them. It is an investigation tool, not a phone benchmark or
proof that GPU/compositor delay has been identified. Real NP1 verification is
still needed; no claim of fixed 60 FPS is justified.
