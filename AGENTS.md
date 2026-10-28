# Dziri Messenger implementation rules

- One messenger has Friends and Marketplace (all active signed-in users),
  and Staff & agents (active Dziri Business ownership or an invited
  non-viewer membership). These tabs use live authenticated server eligibility;
  unknown state grants no tabs. Marketplace combines buying/selling conversations
  with canonical store permissions and explicit seller context; product publication
  is not required to retain existing conversations. Revocation resets the selected tab and
  its open business conversation. No account-type chooser or client role grants.
- `src/messenger.tsx` injects the isolated Inbox runtime into the signed-in shell.
  It is reachable only from the eligible Staff & agents tab. Rails still checks
  its own active staff membership; a Dziri tab never issues Rails credentials.
- Team mode uses the existing Rails sessions, account APIs and Action Cable.
  Customer mode uses canonical Dziri identity/messages and the existing consent
  bridge to support. Keep credentials and caches isolated between runtimes;
  never expose staff account APIs/private notes through the customer client.
- Public support links select only the support company; they never grant staff
  access, convey credentials, activate the bridge or imply customer consent.
- Web/mobile runtime changes share the server immediately. Platform UI code
  still requires its own build. Theme source is `dziri-inbox/config/dziri-theme.json`;
  use `sync:inbox` before development/build rather than editing the generated copy.

- Preserve upstream history, MIT notices and the upstream native component layouts.
- Consumer runtime is `src/dziri/`; it must not import Chatwoot staff auth,
  account APIs, Redux store, private notes, Firebase subscriptions or Sentry setup.
- Dziri owns identity, thread/message IDs, access policies and receipts. Use the
  existing authenticated functions; never add a client-supplied authorization userId.
- The consumer runtime follows the inspected Messenger Figma reference recorded in
  `docs/design/FIGMA_MESSENGER_IMPLEMENTATION.md`, with Consumer fonts and Dziri
  domain navigation. Its appearance tokens live in `src/dziri/colors.ts`;
  source icon geometry lives in `src/dziri/figma.tsx`.
  The inherited staff runtime retains `config/dziri-theme.json`, shared with Inbox,
  and its original native spacing, geometry and typography.
- Only use the ringed logo in `assets/dziri-ring.*`; do not mirror it for RTL.
- Sign out is a row on the main Settings screen; Language remains in Profile settings.
  the main Settings header contains only Back (the public header keeps its globe).
  Avoid repeated headings and
  language footers. Keep conversation sender names in the header, with avatars
  beside bubbles. Use centered time markers at day/five-minute boundaries;
  tapping reveals the compact individual time with receipt ticks and reply/react.
  Never place an inline three-dot button beneath a message. Emoji-only text with
  1–3 complete emoji clusters is bare and larger; voice messages use one pill.
- Consumer colors override the reference's Facebook blue: use monochrome controls
  and Consumer ink bubbles. Only read-receipt ticks retain their rose accent.
  Hide scroll indicators without disabling scrolling. Keep the input pill
  free of focus rings. Arabic drafts follow their first strong letter even in
  EN/FR, while locale controls the interface's mirrored layout.
- Custom messenger text uses Consumer's Inter/thmanyah Sans pairing through
  `src/dziri/typography.tsx`. Preserve the publisher OTF bytes/names/license.
  Reverse layout explicitly in Arabic; keep the layout root LTR to avoid double
  mirroring, and use the locale-aware Text/TextInput wrappers for text direction.
- Keep tokens in SecureStore on native and namespaced sessionStorage on web so
  browser refreshes retain sign-in for the current tab. Never store passwords.
  Do not persist message bodies in ordinary
  AsyncStorage. Do not claim working E2EE based on a thread flag.
- Run domain tests, changed-file lint, typecheck and bundling after changes.
  Record real-device and backend checks separately; fixtures are not live proof.
- Keep this checkout and pnpm lockfile isolated from the npm Dziri monorepo.
- Do not deploy, publish stores, enable a support bridge or spend on cloud builds
  without the corresponding release checks and user scope.
