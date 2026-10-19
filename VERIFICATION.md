# Entry screen redesign

The customer/team entry now has a responsive two-column desktop layout,
single-column mobile layout, compact language controls, visible keyboard focus,
and the approved ring composited into the dark background without a visible tile.
Original logo files/hashes and account routing are preserved. Arabic uses a
system sans fallback, mirrored layout/arrows and an unchanged logo orientation.

Typecheck, lint, 18 existing tests, brand/runtime consistency and web/Android/iOS
bundle export passed. The design heuristic scan found no warnings/errors;
this does not claim exact Geist fidelity. Browser checks cover the desktop and
390px layouts, Arabic, keyboard focus/activation and both account destinations.
Native device rendering of blend mode remains unverified. See
`docs/design/entry-screen.md` for the scoped design contract.

The shared Inbox source changed during this task after the owner asked that chat
to restore original Chatwoot styling. The mobile snapshot now follows that
current blue/charcoal palette; the entry redesign uses its tokens directly.

## Customer, staff and agent access checkpoint

The owner's clarification expands the app to customers as well as staff/agents.
The root chooser mounts separate existing-auth runtimes, with no client-selected
role grants. Team access requires an active administrator/agent membership.
Customers keep their canonical Dziri identity and messages and gain support
availability, explicit sharing consent, connection readiness and withdrawal UI.

An anonymous read-only request to `honorable-moose-964` on 19 October 2026 again
returned the disabled-free-plan error. The customer view must show a truthful
unavailable state until restoration. No actual customer login, customer-to-Inbox
live exchange, billing change or bridge activation is claimed in this checkpoint.

The actual existing backend's 25 isolated tests passed (19 Inbox bridge and
6 message/header checks), including consent, private-note exclusion and tenancy.
These are fixture tests, not live production connectivity. Role and support-link
tests reject inactive/customer roles and links that try to supply access/consent.

Current verification: 18 mobile/domain tests, 25 backend fixture tests,
typecheck, lint, frozen install, ring/layout/theme/runtime isolation guard and
web/Android/iOS exports passed. Browser checks verified the English/Arabic
chooser, locale retention when switching views, the real disabled-backend
customer notice, separate staff sign-in and active administrator workspace.
Staff queues recovered after an independent local service restart.

The native support form/withdrawal code is implemented against the existing
backend functions. Live customer form submission cannot be qualified while the
customer backend is disabled. Native device and OS universal-link association
verification remain pending. No production role changes were made.

## Earlier team companion checkpoint

19 October 2026. The owner's correction identifies **dziri-inbox** as the existing
web app. The current mobile entry now uses its Rails staff sessions and APIs,
replacing the previous consumer-only default. Inbox baseline: `47b8909`.

Real local server checks pass for staff login, profile, queue access, persisted
messages/private notes, status, assignment, cross-account rejection and logout.
Only synthetic local demo data was changed; scripted status/assignment changes
were restored. No production backend, bridge, external channel, app-store or
paid cloud build was activated.

Current checks: 16 mobile/domain tests, consumer-plus-Inbox typecheck, lint,
ring/layout/theme consistency and frozen dependency install passed. Final web,
Android and iOS bundle export passed. The existing web editor's 286 selected
tests and rebuilt dashboard/SDK also passed.

Actual two-client browser proof: a reply sent in the companion appeared in the
existing web dashboard without reload; a reply typed and sent in the repaired
web editor appeared in the companion without reload. Resolving on mobile changed
the web workflow to Reopen. These checks used account 43 / conversation 1 in the
standalone synthetic local demo. Screenshots are recorded under
`D:/codex-artifacts/dziri-inbox-mobile-wiring-20261019`.

Browser testing caught and fixed a fetch receiver error and changing FlatList
viewability callback. The fetch regression is included in unit checks. It also
exposed duplicate ProseMirror model constructors in the web editor; a separate
Inbox worktree unifies the dependency and Vite resolution, with an identity guard.

The shared black-theme snapshot matches Inbox. Development watches its source;
bundle export refreshes the snapshot. Server/API updates serve both clients;
screen changes still require separate platform builds.

Android/iOS exports are JavaScript/Hermes evidence only. The Android SDK is absent
on this host and iOS requires macOS/Xcode or separately authorized build access.
Native storage, lifecycle and push still need device checks. Staff attachments,
calls, full settings, localization and durable offline sends remain unfinished.

## Historical consumer checkpoint (superseded default)

19 October 2026, Africa/Algiers. Scope: local source, isolated tests and JavaScript
bundles. This is an initial implementation, not a production release or native
device acceptance. No customer conversations, accounts or backend data were
created or modified; no backend deployment or paid native build was performed.

## Consistency reconciled

The referenced chat `Integrate Chatwoot with Dziri` was read before implementation.
Its latest instruction is Dziri colors with the original Chatwoot layout retained.
The earlier request for exact blue styling is superseded by that theme-only pass.

- Mobile upstream is pinned at `e3c8fc5f3d0ece96ea6843e38759bc9b44e13112`.
- Ongoing Inbox source was rechecked at
  `f934cf2e2ffb44297e200a07b8f74c7dc099b38a`.
- Mobile `config/dziri-theme.json` exactly matches the Inbox theme at verification.
- Production ringed SVG and PNG hashes match `docs/branding.md` in the Dziri
  monorepo. Its logo guard passed for 33 assets; the mobile guard also passed.
- Existing native `src/components-next`, `src/screens`, `src/navigation` and
  `src/assets/fonts` have no changes against the pinned mobile upstream.
- Consumer screens adapt the original row/bubble/button geometry to Dziri IDs
  and roles. This is an adaptation, not a claim of identical agent controls.
- No original staff store, staff sign-in, private-note API, Firebase listener,
  Sentry initializer or upstream EAS owner is mounted by the consumer entry.

## Implemented in source

Existing-account password login through Convex Auth; native secure token storage
and environment namespaces; backend-client recreation after logout; inbox/search;
paginated conversation history; canonical text sends with an in-memory retry ID;
visible-message read cursors; accurate stored/seen labels; safe deleted/unsupported
message rendering; localized AR/FR/EN and light/dark colors.

Encrypted-thread sending is unavailable until a protocol implementation exists.
Plaintext is not sent into encryption-marked threads by this client. No working
E2EE claim is shown. There is no direct consumer-to-Chatwoot write path.

## Checks executed and passed

| Check | Actual result |
| --- | --- |
| Frozen offline pnpm installation | Passed from the checked lockfile after dependency updates |
| `pnpm test` | 10/10 domain tests passed |
| `pnpm run typecheck:consumer` | Passed for all active consumer modules and imported theme modules |
| `pnpm run lint` | Passed, zero reported lint errors/warnings |
| Mobile consistency guard with `--inbox-root` | Passed ring hashes, unchanged inherited layouts/fonts, consumer identifiers and matching theme |
| Existing backend messaging regression suite | 6/6 passed using the actual current Dziri schema/functions and isolated `convex-test` identities |
| `expo export --platform all --output-dir dist` | Web, Android Hermes and iOS Hermes bundles passed on final source/dependency state |
| Browser at localhost:3903 | Correct unavailable state with no configured backend; English, French and Arabic language switching verified |

The backend check uses `scripts/verify-dziri-backend.mjs <source-root>`. It runs
the existing `tests/activation/thread-header.test.ts` suite without modifying or
deploying the source checkout. The main checkout has a missing local auth package,
so this isolated runner resolves the already declared mobile auth dependency for
that test process only. Results are API fixture evidence, not a web/native/live
conversation test. The inactive upstream staff test suite is not an active
consumer build target.

Final exported bundle files:

- Web: `AppEntry-0ba05dfe063e97a8e3f768e12795df38.js` (2.2 MB).
- Android: `AppEntry-d54a4d3cf5276904d68a82994287b062.hbc` (3.7 MB).
- iOS: `AppEntry-9d2c5f0d3e24d8560803d8dce01a2f6b.hbc` (3.7 MB).

Generated bundles and local test artifacts are ignored, not committed.

## Dependency audit and limitations

The production-dependency audit moved from 1 critical / 46 high / 17 moderate /
3 low to **0 critical / 4 high / 3 moderate / 0 low**. Compatible scoped overrides
cover the patched dependency lines; no forced major replacement was used to hide
an incompatible consumer dependency.

Remaining findings:

| Package/path | Scope and remaining work |
| --- | --- |
| `node-forge` via Expo CLI | High; audit reports no patched version for GHSA-86w9-cpqp-85rv |
| `braces` via Metro file map/micromatch | High; audit reports no patched version for GHSA-vfj7-8cjw-p6xm |
| `image-size` 1.2.1 via Metro | Two high findings; patched 2.x requires a separately verified Metro/API migration |
| `uuid` 7 via Xcode config plugin | Moderate; patched 11.x requires compatibility review |
| `decode-uri-component` via React Navigation/query-string | Moderate; patched 0.5.x requires compatibility review |
| `postcss-selector-parser` 6 via Tailwind | Moderate; current finding requires the patched 7.x API line |

Audit classifications and dependency paths are scoped evidence. They do not
prove runtime reachability or a clean security posture. Details remain in
ignored `.codex/audit-prod-final.json`.

Expo reports newer patch versions within SDK 57; that coordinated upgrade and
native module qualification remain release work. The inherited ESLint TypeScript
parser declares a pre-5.9 support range while the pinned compiler is 5.9.3;
typecheck/lint passed, but tooling alignment remains recorded. Deprecated native
navigation dependencies require a planned upgrade with layout regression checks.

## Still required

- Android SDK/platform tools and a device/emulator are absent from the configured
  local SDK path; no Android native boot/build acceptance was claimed.
- iOS physical-device acceptance requires macOS/Xcode or separately authorized
  signing/build access. A Hermes export does not satisfy that gate.
- No backend URL is checked in or configured by default. Tool policy rejected a
  preview command that supplied an overridden backend address, with no additional
  reason provided. Browser checks therefore cover the unavailable state only.
- Real existing-account login/refresh/revocation and a two-account web/mobile
  exchange remain unverified. No test credentials were entered or sent.
- Inbox results are bounded by the existing backend; local search covers only
  that returned set. Inbox pagination still needs a backend contract extension.
- Drafts/retry IDs are currently in memory, not durable across navigation/restart.
  Outbox persistence, media/voice, new DM/discovery, group management, push, calls,
  stories and actual support/merchant bridge are later slices.
- Complete privacy/signing/native permission review, measured performance/cost,
  remaining security findings, rollback and store acceptance before release.

Consumer source is intended for the fork's `master` checkpoint only. This task
does not trigger a Vercel/Convex production release or publish to app stores.
