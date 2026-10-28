# Story access and reply safety checkpoint — 2026-10-27

## Reconciliation and scope

The preceding checkpoint closed storage-waiting outbox lifecycle bugs locally and delivered its private APK. Physical process-kill, two-account/deployed acceptance and the wider goal remain open. This pass inspected auth/recovery and Stories, then selected two evidenced Story gaps rather than reimplementing completed core chat flows.

Story replies previously created their own DM and inserted messages directly, bypassing pending requests, frozen conversations and canonical text policy. Open standalone Stories retained a selected array snapshot, so an update/removal in the live feed did not remove the old content. The viewer also used its array index as identity and had no wall-clock expiry timer for stalled media.

## Implemented locally

- `convex/messaging/storyAccess.ts` centralizes current authenticated Story access. Expired, hidden, blocked/blurred, blocked-user and inactive-account paths deny reads and actions. Non-authors cannot read pending moderation media. Followers/custom readers use current server authority. No schema/backfill was added.
- Close-friends, geographic and restricted-tier Stories lack canonical roster/geographic/tier readers. They now remain private to their author rather than being exposed to every follower. This is a deliberate fail-closed prerequisite, not completed close-friends support. The existing Consumer audience choice still needs an honest availability/completion pass.
- `stories:listFollowing`, `recordView` and legacy `react` share that access decision. View receipts remain idempotent. The public Circle Story reader retains its stricter public-only policy.
- `threads.findOrCreateDm` and `messages.sendTextMessage` are plain transaction-local helpers reused by their existing registered endpoints and Story replies. Existing public validators remain intact. This removes the duplicate DM/send policy and preserves pending introductions, canonical pair reuse, blocking, membership, freeze, text moderation and sender parental keyword checks.
- `storyReply` accepts an optional stable `clientMessageId`: matching retries return one prior message without duplicating a reaction/counter; conflicting payloads fail. Retry acknowledgements recheck membership, contact, archive/freeze and declined/spam state. Client attempt coordination is not yet implemented in the Story controls; do not claim all existing UI retries are now durable/idempotent.
- Standalone `stories-strip.tsx` selects an author and derives the viewer's items from the current query result. Unknown/removed visibility exposes no stale Story content. `story-viewer.tsx` tracks stable Story IDs, closes when that selected item disappears or expires, rejects late media callbacks from an older Story and mirrors navigation chevrons in Arabic.
- Consumer already receives its selected author's current Story list. No Consumer UI source was changed; shared server policy applies to both clients once released. Consumer playback readiness, pause/resume and expiry timing still need completion.

## Verification

- Backend RED: initial 16 access/request/retry regressions failed in `.codex/stories-safety-red.log`. Block fixtures were corrected to include the required `extendedBlock` field; final cases verify actual behavior.
- GREEN: 82 messaging backend cases, 5 public Circle-source cases, 5 Consumer Story discovery cases; 58 standalone domain and 60 standalone UI cases. **210 distinct checks** pass, including 21 new backend cases and 5 new standalone Story cases. Focused reruns are not counted again.
- Full backend TypeScript check passed; a final incremental check after the retry guard also passed. Native typecheck and lint passed, with the initial missing-effect-dependency warning corrected. Web/Android/iOS Expo exports and Android release assembly passed.
- Three native regressions failed before their fix: live edit/removal, stalled-media expiry and current identity after reordering. Additional tests cover old media callbacks and selected-item removal.
- A real browser used the actual native Story rail/viewer with React Native Web and synthetic feed/mutation adapters. Live revocation removed the open content. Stalled media closed after wall-clock expiry without starting playback. Arabic next/back labels and chevrons were checked at 375 px. Browser error logs were empty. The fixture replaces locale/icons/media/composer/query adapters, and is not a full native visual or media-transport qualification. No real Story was opened, viewed, published or replied to.
- Saved captures and package receipts: `D:/codex-artifacts/dziri-stories-safety-20261027/`. Temporary fixture tab/server are closed after verification. The ordinary signed-in preview is preserved.

## Feature/screen/flow register delta

| Audit item                              | Local status                                                                                               | Still required                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 / SC35 / F10: Story rail and viewer | Shared server audience/action gate; live native content and expiry guards implemented and fixture-verified | Consumer playback/visibility/pause lifecycle; native hold-to-pause/readiness/error UX; actual expiry/revocation across authorized clients/devices                |
| T02 / SC36 / F10: compose and reply     | Canonical request/contact/moderation-safe reply transaction and optional idempotency implemented           | Native reply/reaction controls and immutable attempt IDs in both UIs; cancel-safe publishing; media/audience parity and qualified explicit publish/reply journey |
| Safety/request/report journeys          | Existing local implementation preserved; Story entry can no longer bypass request policy                   | Release and authorized two-account/moderator acceptance from requests-reporting checkpoint                                                                       |
| Push / background calling               | Owner hold preserved; `PERSONAL_PUSH_CONFIGURED=false`                                                     | Explicit owner authorization and provider qualification before activation                                                                                        |

Do not replace the historical 92-item audit statuses with a parity percentage. This checkpoint advances parts of T01/T02 only. Keep the goal active.

## Build, release and phone boundary

These are backend and standalone changes. No Consumer/Console runtime, branding, dependency, provider or schema change was made in this pass. API changes are additive and backward-compatible at the argument boundary. A local build-impact analysis is recorded separately; it is not a deployment-baseline comparison or release approval. No Vercel/Convex publication, Git push, operator/data mutation or live account action occurred.

The APK carries the native viewer guards and the previously verified runtime. The new server protections are **not deployed**, so installing the APK alone does not activate them. A local signed ARM64 package is prepared with the existing test-signing identity, not a Play Store release. Phone installation/behavior and deployed policy remain unqualified. Retain previous private APKs as rollback artifacts.

Final package, hashes and private-download metadata are recorded in `verification.json` in the artifact directory after successful upload/readback. Next local work: finish Consumer Story playback/expiry, cancel-safe composition and consistent canonical reply controls, then resume the remaining goal acceptance register. Keep push disabled.

## Final phone package receipt

Private APK: [DM Story safety build](https://drive.google.com/file/d/1-8QH1sI9U83L54rlZTnhB06dXTG3enUO/view?usp=drivesdk). Drive readback confirms 31,261,087 bytes, Android package MIME type, modification time `2026-10-27T20:24:05.117Z`, and owner-only permission. SHA-256: `3de33b332f7bd75e7adbd495784286f392a9650a9fdd8815886847ab06d28026`. Package `com.dziri.messenger`, label `DM`, version `0.1.0` / code `1`, ARM64. Signature matches the preceding DM builds (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`); signature verification and 16 KiB alignment passed. This remains an internally test-signed package. No phone installation or production server behavior was claimed.

The local Story-only impact check reports no Consumer/Console app runtime build required (`.codex/stories-build-impact-final.json`). Its initial attempt included tracked-but-deleted working-tree files; the corrected working-tree inventory excludes missing files. No app rebuild policy or budget was changed.
