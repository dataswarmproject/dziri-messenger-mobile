# Dziri Messenger implementation rules

- The product serves customers, staff and agents, per the owner's clarification.
  `src/messenger.tsx` selects the customer (`src/dziri/`) or team (`src/inbox/`)
  runtime. A view selection never grants roles. Staff/agent access comes only
  from current active server-returned workspace membership.
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
- Theme colors come from `config/dziri-theme.json`, shared with Dziri Inbox.
  Theme changes must not change native spacing, geometry or typography.
- Only use the ringed logo in `assets/dziri-ring.*`; do not mirror it for RTL.
- Keep tokens in SecureStore on native. Do not persist message bodies in ordinary
  AsyncStorage. Do not claim working E2EE based on a thread flag.
- Run domain tests, changed-file lint, typecheck and bundling after changes.
  Record real-device and backend checks separately; fixtures are not live proof.
- Keep this checkout and pnpm lockfile isolated from the npm Dziri monorepo.
- Do not deploy, publish stores, enable a support bridge or spend on cloud builds
  without the corresponding release checks and user scope.
