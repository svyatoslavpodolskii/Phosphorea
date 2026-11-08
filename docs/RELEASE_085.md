# Phosphora 0.8.5

Sound is muted by default for new users; explicit existing choices are preserved. Plugins remain enabled by default. The global contact listener now survives opening the editor or settings. The sound plugin offers previews and the same mute control as the map.

Contact and zoom detents use short broadband mechanical transients instead of pitched notes. Hold feedback is lower, softer and more spacious. Pan, zoom and lasso have separate gain, frequency, spatial and release profiles; movement is substantially quieter. Rejected Kenney palette is no longer offered. Hold rings expand farther with a static glow and slower, alternating waves; repeating audio remains synchronized to animation cycles. Reduced motion suppresses the moving rings and repeating sounds.

Appearance and aliases are header icons in the editor. Importance is a three-way control inside Appearance. Type and state use themed, keyboard-accessible popovers instead of native mobile selectors. The note menu has compact link controls and a dedicated delete action.

Types are managed in the Types plugin: create, rename, select an icon, edit a text template, delete. Deleting a type atomically converts its notes to the base note type while retaining content, links, aliases and appearance. Existing legacy hub notes remain readable as “Тема”; this type is not offered to new users. Disabling the plugin preserves its catalog.

The full storage backup already includes all database settings and plugin data. JSON map export now also carries the validated type catalog and templates. Import merges definitions without replacing existing definitions; old map files remain supported.

Validation: 260 unit tests, svelte-check without errors or warnings, production build, Chromium and Firefox mobile-viewport checks for type creation/application/export/deletion and sound preferences/settings feedback. Chromium additionally checks hold pulses, pan intent, zoom anchoring and lasso feedback. Mobile screenshots reviewed for editor, appearance, menu and type settings. Physical Android audio quality still requires listening on the device.
