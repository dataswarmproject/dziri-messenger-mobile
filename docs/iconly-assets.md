# Messenger icons and animated title

The approved icon source is [Iconly V3 Free, by Iconly/Piqo](https://www.figma.com/design/h74FycxHMr7U98GL6dD2YJ/). The user exported the complete pack from the signed-in Figma session on 2026-11-01. The original ZIP is retained privately at `D:/codex-artifacts/dziri-iconly-20261101` with SHA-256 `8d7b71e1ddd0dc5f10ebeaf6129b2eee336c117286a61526adcbd5b6c9978460`.

The archive contains 924 files: 517 SVGs and 407 PNGs. The selected runtime catalogue has 57 original assets. Regular Light is the default, with Regular Outline arrows where the Light export supplies only PNGs. Selected navigation states use the corresponding original Bold assets; their 48px PNG exports display at 24 logical pixels. Asset bytes are unmodified. The catalogue records each original export path and SHA-256.

Consumer uses `apps/dziri/public/icons/iconly/catalog.json` and local CSS alpha masks. Standalone DM copies that catalogue through `scripts/sync-iconly.mjs --source <platform-checkout>` into its static Expo registry and `docs/iconly-contract.json`. Verification mode checks the copied hashes without needing Figma. Assets follow the current neutral theme; only directional arrows mirror in RTL. Brand artwork never mirrors.

The pack does not provide every chat action. Existing standard glyphs remain for semantic gaps such as read ticks, pause, thumbs-up, reply, copy, link and emoji. Button handlers, accessible labels and touch targets remain owned by the existing controls. The Iconly images are decorative.

The complete export is a local source archive, not a redistributable icon library. Use is subject to the original [Iconly licensing guide](https://iconly.pro/pages/licensing-guide) and [terms](https://iconly.pro/pages/terms); this repository does not relicense Iconly artwork under MIT. No paid Iconly Pro assets have been purchased or activated.

The Friends heading types the localized full brand, pauses, then contracts to `DM` once per mount. Its accessible name remains the full localized name. Reduced-motion users receive static `DM`; unmounting or changing the source cancels pending timers. The shared React timer adaptation credits [Magic UI Typing Animation](https://magicui.design/docs/components/typing-animation), with its MIT notice at `packages/ui/licenses/magic-ui.txt`. It adds no animation dependency. Standalone synchronizes the same hook and license through `scripts/sync-messenger-title.mjs`.

This is a presentation change. It does not qualify deployed identity flows, native physical-device rendering, calling providers, push, or the remaining feature catalogue.
