# Shared Consumer and standalone Messenger design

Consumer's existing Messages routes and this Expo app use the same Dziri backend
and canonical conversations. The Consumer UI now follows this app's monochrome
design, compact type, avatars, bubbles, input and Settings controls.

The design authority is `packages/shared/src/messenger-design.json` in the Dziri
monorepo. Run its `scripts/sync-messenger-design.mjs --mobile-root <this-checkout>`
after changing colors or core metrics. This updates `config/messenger-design.json`
and `docs/messenger-design-contract.json`. Do not edit the snapshot by hand.
`pnpm check:design` and `pnpm bundle:inbox` verify the snapshot hash.

Consumer development/build checks generated CSS against the same source. Release
the two snapshots together; a standalone checkout cannot observe unpublished
changes in another repository automatically. Shared design values do not merge
the platform-specific UI code or auth storage. Native remains SecureStore; this
app's web version keeps its per-tab session, while Consumer retains its existing
shared web authentication adapter. No tokens are passed in URLs or copied between
apps.

Data updates use existing reactive subscriptions. UI updates require building
the affected targets. Android/iOS exports are compilation evidence, not an
installed app, app-store release, push-notification or physical-device acceptance.
