# Dziri Messenger

An isolated consumer fork of Chatwoot Mobile. Upstream is pinned at
`e3c8fc5f3d0ece96ea6843e38759bc9b44e13112` (mobile 4.9.11).
MIT notices and upstream history are retained. See `LICENSE` and upstream README.

The consumer entry is `App.tsx` -> `src/dziri/app.tsx`; the original staff
application remains in source but is not mounted, authenticated or initialized.
Its screens, components, navigation and font files are unchanged. Consumer
screens adapt the native inbox and message geometry to Dziri's domain and IDs;
this is not a claim that consumer and agent screens have identical controls.

The active manifest contains consumer dependencies only. Inactive staff-only
Firebase, Sentry, recorder and FFmpeg modules are excluded; their source and
original dependencies remain in upstream Git history. The inherited staff
application/test suite is not an active build target of this first slice.

## Consistency contract

- Preserve Chatwoot layout/spacing/typography; Dziri colors are token-only.
- `config/dziri-theme.json` is a snapshot of the ongoing Dziri Inbox theme.
  Resynchronize deliberately and run the consistency check when that file changes.
- Use only production ring assets, without mirroring for Arabic.
- Dziri owns users, threads, messages, memberships and read cursors.
- The future support bridge owns synchronization; the consumer never writes to
  Chatwoot agent APIs. No staff credentials or private notes enter this app.
- Encryption-marked conversations cannot send plaintext in this build.
  No E2EE label is displayed. Unsupported messages get an explicit placeholder.

## First implementation slice

Existing-account password sign-in, secure native token persistence, bounded
inbox/search, paginated history, text sends with an in-memory retry identifier,
visible-message receipts, AR/FR/EN labels and light/dark tokens.

The current backend `listMyThreads` is bounded, not paginated. Inbox search
filters that returned set. This is a known first-slice limit, not a complete
large-inbox implementation. Native outgoing drafts/retry keys are not yet
durable across restart/navigation. Media, discovery/new DM, push, calls, groups
management, stories and the production support bridge remain later slices.

## Local commands

Requires the pinned pnpm and Node 22.18+ for built-in TypeScript domain tests.

```powershell
pnpm install --frozen-lockfile
pnpm run test:domain
pnpm run typecheck:consumer
pnpm exec eslint App.tsx app.config.ts src/dziri src/theme/tailwind.config.ts
node scripts/check-dziri-consistency.mjs --inbox-root D:/projects/dziri-inbox
pnpm exec expo export --platform android
pnpm exec expo export --platform ios
```

Create ignored `.env.local` from `.env.example`, using the selected development
deployment origin. Do not copy a main `.env` wholesale. Then `pnpm start`.
Without a valid origin the app shows a localized unavailable state and makes
no backend connection. Web preview sessions are memory-only; native tokens use
SecureStore with collision-free key encoding.

Actual Android compilation requires Android SDK/platform tools and a device or
emulator. iOS requires macOS/Xcode or separately authorized build/signing access.
A Metro bundle or browser check is not a native-device acceptance pass.

Consumer scripts and CircleCI checks now use the consumer entry and tests.
Before publishing, review CI under Dziri
ownership, configure signing, qualify dependencies/native modules, run actual
two-account backend/device checks, and finish the release plan. No inherited
Chatwoot Firebase/Sentry/EAS owner or app identifier is configured in consumer
app config. Native manifests/permissions must be inspected in the device phase.
