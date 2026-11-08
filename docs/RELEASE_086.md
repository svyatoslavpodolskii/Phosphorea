# Phosphora 0.8.6

Two-finger input no longer enters the one-finger pan audio path. Previously, alternating touch coordinates could produce a maximum-speed pan sample while the camera was also producing zoom audio.

Pan, zoom and lasso now have separate stereo source buffers. Pan uses brighter air with slower entry/release and more presence. Zoom uses a quieter, smooth colored-noise swell in a lower band; lasso has a narrower, lightly textured middle band. Sources are cached; audio automation runs on the audio thread. A gesture uses one looping source, with a short fade if its material changes.

Ordinary taps have lower gain and a softer, lower-frequency transient. The accepted wheel detent sample and its original room response are preserved. Hold waves have no periodic oscillator or sustained fundamental; a filtered pressure pulse feeds a longer diffuse stereo tail.

Validation: 263 unit tests, TypeScript/Svelte checks, production build, Chromium two-finger injection confirming only the zoom source is used, Chromium/Firefox gesture and sound settings checks, offline rendering with peak and sub-bass bounds. A hash regression protects the accepted wheel sample; signal tests distinguish the three source spectra and reject the previous 140 Hz hold hum. Actual timbre and balance on a physical phone remain subjective listening checks.
