# Native Story composer and logo rendering

The Android screenshot showed a solid rectangle in place of the header mark.
Native image tinting applies to the SVG wrapper instead of its embedded image
alpha. Native UI surfaces now load `assets/dziri-ring-transparent.png`, extracted
byte for byte from the approved SVG's embedded PNG. Its SHA-256 is
`9c9e93e0f3cd8b0667e92b6311870a2fefbcbfd70697060c9387fa2f16405fd1`.
The 180 × 180 image has alpha ranging from 0 to 255. The approved SVG and
1024px launcher PNG remain unchanged; the consistency check enforces exact
embedded-image equality. Theme tint preserves contrast without changing geometry
or mirroring the mark. Git attributes preserve hashed export and license bytes
across Windows checkouts.

Story creation uses a centered text/photo/video preview, compact media controls,
an explicit audience selection and a bottom publication button. Text uses the
same default background and 280-character limit as Consumer; media captions are
limited to 200 characters. A selected image fills the preview area without
opening another image viewer. Existing upload cancellation, current-attempt
fencing and publication error recovery remain in place.

Composer and viewer modals each own their safe-area provider. Insets apply on
Android and iOS, including the status bar and bottom navigation area; keyboard
handling remains on the content within the safe area. Camera and gallery still
open only after the user selects their controls. This does not activate push,
publish a Story, change audience defaults or alter permissions.

Local checks and actual rendered/device evidence are recorded separately.
Consumer presentation alignment and final physical-device qualification remain
pending until their respective checks have run.
