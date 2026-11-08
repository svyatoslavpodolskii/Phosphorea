# Phosphora 0.7.0 — interaction review

## Map

- Blank long press creates at its world point. Selection and folder context no
  longer silently create a parent relationship. “Связанный атом” remains explicit.
- Daily commands receive a camera position and folder membership separately from
  a semantic parent. They find nearby free space, keep state `normal`, and preserve
  the current zoom. Optional calendar relationships still work.
- A dwell drop on an existing connection removes that connection using the same
  revision checks and undo UI as the relationship editor. New connections still
  require a deliberate dwell.
- Folder drops show plus/cross feedback, toggle membership, and scroll the folder
  strip near either edge while the canvas owns pointer capture. Folder colors and
  territory opacity are more visible; territory paths keep rounded ambient edges.
- The state tray uses readable Russian labels and vector icons. Its delete target
  uses Core's atomic deletion, local backup and undo, including multiple raw IDs.
- Starting lasso clears prior single selection. Overview slider positioning is
  continuous instead of jumping at the previous snapping threshold.
- Dragged bodies follow the hand independently. Cached link tension moves neighbours
  only when stretched, allowing rotation around them. Motion continues at frame
  cadence while held, is bounded to a neighbourhood, and rolls back on cancelled
  or failed drops. Pending simulation results cannot apply after physics is disabled.

## Editor and plugins

- Two modes: editable normal view and Markdown. Untouched source, unsupported
  blocks, wiki references, CRLF and task history retain their existing safeguards.
- Type, state and importance share a compact row. Appearance and aliases have quick
  controls. Connections and deletion live in the header's overflow panel, directly
  below that header when opened. Nested panels dismiss before the editor.
- Share/copy supports original Markdown or sanitized plain text. Sharing does not
  save or rewrite the note. The system share sheet is used when available;
  clipboard is the fallback.
- Physics and theme controls live in plugins. Existing preferences remain compatible;
  scoped settings apply one changed field at a time. New workspaces enable all
  available plugins; updates preserve deliberate disabled choices.
- Plugins have monochrome icons and separated configuration controls. Instructions
  are collapsed by default. Storage persistence is described as anti-eviction,
  without implying encryption.
- Existing themes retain IDs and gain Russian names. Paper has a lighter background
  and less grain. Four stronger variants include paper and daisies: muted text has
  at least 7:1 contrast on theme surfaces, graph outlines are thicker, and the strong
  rendering flag survives theme export/import.

## Review and data

Review caught and corrected an unintended model reset when changing liveliness,
stale settings application, needless startup writes, undersized dropdown space,
and recovered drafts without appearance.
No SQLite schema, database path, workspace identity or backup format changes.
Updates never clear diary storage. This release does not introduce encryption or P2P.

Validation uses type checking, all unit/integration tests, production build and
targeted Chromium/Firefox browser scenarios. It covers independent creation,
connection removal, folder edge scrolling, delete/undo, source preservation,
Android-style beforeinput, plugin persistence, theme contrast/offline restart,
camera framing and structure stability. Desktop Firefox at a phone viewport cannot
establish Nothing Phone 1 frame rate, physical haptics or the OS share sheet.

Release checks: 247 unit/integration tests passed; type checking has no errors or
warnings; production build passed. Across targeted browser runs, 36 distinct
Chromium scenarios and 12 Firefox scenarios passed. Source and interaction changes
were reviewed before publication; generated screenshots/metrics are not release
source files.
