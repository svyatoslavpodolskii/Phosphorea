# Phosphora 0.8.7

Default master volume is 1. Explicit saved volume and mute choices are preserved; sound is still off by default. Cue levels are balanced internally against full master volume.

Wheel ticks retain their source sample, with about 2 dB less direct gain and a reduced room send. Hold waves use a zero-slope half-second attack, a quieter direct path and a larger relative diffuse send. Their visual cycles are 3 seconds with 1.5-second staggering; the opening ring lasts 2 seconds. Sound pulses remain tied to the visual animation events.

Zoom has more presence in a lower, narrower band, reducing upper-mid hiss. Pan uses irregular fine grains and a mostly dry mix to suggest contact with paper rather than wind in a resonant space. Lasso retains its distinct material. Existing gesture routing and two-finger isolation remain unchanged.

Validation: 265 unit tests; Svelte/TypeScript without errors or warnings; production build; Chromium and Firefox gesture/audio checks, full-volume bounds and default-volume persistence. Tests guard the soft wave onset, 3-second rings and stagger, and retained wheel source. Physical-device listening remains necessary for subjective timbre and balance.
