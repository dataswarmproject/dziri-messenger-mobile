# Messenger entry design

Scope: the customer/team chooser only. User-authorized redesign on 19 October
2026. Existing sign-in, permissions, routing, provider isolation and service
availability behavior remain unchanged.

This is a Dziri adaptation, not an exact Geist reproduction. Retain the existing
Inter assets, approved ring mark and current Inbox theme tokens. The referenced
Inbox chat restored the original Chatwoot palette during this task; the shared
snapshot therefore carries blue accents and standard charcoal surfaces. The layout uses a
two-column desktop composition and a single scrollable column below 900px.
French/Arabic labels remain localized; Arabic reverses layout and directional
arrows but never mirrors the logo. System font fallback covers Arabic glyphs.

The logo PNG has opaque black pixels. `mixBlendMode: screen` composites that
black against the page rather than altering the canonical artwork. No asset is
traced, redrawn or replaced; this is rendering transparency, not a new PNG with
an alpha channel. Original SVG/PNG hashes remain authoritative. Native blend
rendering still needs device verification.

Compact language buttons announce selection. Entry cards keep their original
one-press destinations, show pointer/pressed feedback and a theme-accent keyboard-focus
border. The screen uses real product choices, without invented activity,
connectivity claims, metrics or inactive links. No motion is introduced.

Project-adapted dimensions: 1080px content maximum, 900px responsive breakpoint,
24px narrow-screen gutters, 16px entry-card corners. These are local design
choices, not claimed measurements from an external reference.
