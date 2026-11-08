# Phosphora 0.8.4

Gesture audio keeps its noise texture, with a brighter spectrum, slower gain/filter transitions and a short diffuse stereo room. One seamless loop follows velocity; pointer movement does not produce repeated contact sounds.

Fixed Firefox's AudioParam fallback: capture the current value before cancelling scheduled changes. Cancelling first could discard the initial zero-gain event and expose the default full-volume value. A regression test simulates this reset.

Contact feedback uses stable harmonic notes and soft envelopes inspired by vmeste's sound garden. Hold waves have quieter repeating cues triggered by their actual animation cycles. The two visible waves now alternate at 600 ms instead of starting together. Reduced motion suppresses both animated waves and their repeating cues.

The Sound plugin adds an alternative recorded Kenney palette and explicit previews for contact, hold and movement. Included samples are CC0, bundled locally and precached for offline use. Existing volume, mute and other user data are preserved.

Validation: 257 unit tests; Svelte/TypeScript without errors or warnings; production build; Chromium and Firefox gesture, palette persistence and offline audio-render checks. Checked mobile layout screenshots. Physical Android speaker/headphone quality still requires listening on the user's device; automated tests verify timing and behavior, not subjective timbre.
