# Story playback, replies and cancellation checkpoint — 2026-10-27

This advances the active remaining-work goal after `stories-safety-20261027.md`. It does not close the full Story, Messenger, device or release acceptance gates. Source is in the existing owned Consumer/backend worktree and standalone Messenger checkout; previous dirty work and rollback packages are preserved.

## Implemented locally

- Consumer and DM share Story copy in English, French and Arabic, six compact emoji reactions, display/view-dwell durations, frozen reply-command identity and the recipient Story-context contract. Standalone has a checked generated copy and hash receipt; bundling checks it without adding dependencies.
- Both viewers wait for media readiness, expose loading/error/retry, pause on hold/reply/background, preserve elapsed photo/text progress, and follow actual video/voice progress and completion. Wall-clock expiry still removes stalled or paused content. Native retains live-feed identity/revocation and guards callbacks by Story and playback attempt.
- Voice/video playback claims ownership across Story and chat players. Other media pauses when a player starts. Registration and autoplay survive React StrictMode cleanup/replay. A temporary suspension only resumes playback that it interrupted.
- Both reply surfaces query the canonical current actor and the additive `storyReplies:1` capability. Older/unknown backends show an honest unavailable state. Self-replies are absent. Reply/reaction mutations use immutable intent IDs across uncertain results, a synchronous duplicate-dispatch lock and generic localized retry states. Late results cannot update an unmounted or different-account surface. These are in-memory attempts, not persistent Story outbox recovery.
- Open conversation uses canonical DM creation and navigation. It never submits the Story draft or a placeholder message. The user must explicitly send through the reply controls.
- Composition cancellation invalidates late upload/camera results before a create mutation is dispatched. Native disables payload changes during upload and preserves picked video type/duration. Both expose only currently supported Public and Followers choices; unsupported Close friends was removed from Consumer. This does not implement custom/close-friends/geographic/tier audience readers.
- Native receives and renders the canonical Story reply snapshot with compact recipient context. Both clients use media-type-appropriate passive previews. Both message APIs redact frozen Story context for deleted/blocked messages; clients also suppress blurred/ciphertext previews.
- Native Story layout now uses the same compact monochrome header/canvas/reply arrangement, explicit RTL rows without double mirroring, safe-area handling and keyboard avoidance. Text remains Inter/thmanyah Sans. Audio seeking remains LTR; numbers use Latin digits. Push remains `PERSONAL_PUSH_CONFIGURED=false`.

Cancellation cannot recall a create/send mutation already handed to the server. Canonical transaction policy still decides access, pending requests, moderation, membership and retry acknowledgment. No schema/backfill or provider was added in this slice.

## Verification

**352 distinct checks passed**, without counting focused reruns twice:

| Suite | Count | Final local log |
| --- | ---: | --- |
| Backend messaging and public Circle source | 89 | E `.codex/story-flows-backend.log` |
| Consumer messaging UI | 110 | E `.codex/story-flows-consumer-ui-verified.log` |
| Consumer Story composer | 9 | E `.codex/story-flows-composer-verified.log` |
| Consumer Story discovery | 5 | E `.codex/story-flows-discovery-verified.log` |
| Native domain | 58 | D `.codex/story-flows-domain-verified.log` |
| Native UI | 81 | D `.codex/story-flows-ui-verified.log` |

E means `E:/CodexWorktrees/messenger-tabs/tawasool-mmogram`; D means `D:/projects/dziri-messenger-mobile`.

RED evidence captured readiness/progress/expiry/identity and open-chat auto-send failures, a blocked snapshot leak, native composition cancellation/editability/type failures, and media ownership/StrictMode failures. Corresponding GREEN cases verify behavior, not source text alone. Initial fixture/configuration failures and the initial native lint warning were corrected before final verification.

Full backend TypeScript and native TypeScript/lint passed. Final Consumer production build is `.codex/story-flows-consumer-build-verified.log`. Console production build and unchanged bundle budgets passed in `.codex/story-flows-console-build.log`. Shared package metadata changes cause both builds in the local impact analysis `.codex/story-flows-impact-final.json`; this is not a last-deployed-baseline comparison or deployment approval. Final Expo web/Android/iOS export and ARM64 assembly passed in D `.codex/story-flows-export-verified.log` and `.codex/story-flows-apk-verified.log`. Earlier candidate builds are superseded. Build-generated Consumer/Console configuration was guardedly restored to its exact pre-build bytes.

Final runtime source hashes are recorded with the verification receipt, including the playback coordinator. No source changed after the verified builds. Branding was not changed.

## Rendered verification and its limits

A local real-browser fixture imports the actual Consumer and React Native Web Story viewer/reply components with synthetic query, mutation and navigation adapters. It verified failed reply/retry intent reuse, draft preservation, open-chat without sending, actual HTML audio completion, old-backend fallback, and compact English/French/Arabic rendering at 320/375/430 widths and desktop. Native capture/media/safe-area adapters are synthetic; this does not qualify Android/iOS playback, IME, permissions or accessibility services. A two-second silent local audio file exercised Consumer HTML audio completion. The final healthy fixture tab had no browser errors. No real Story was opened/viewed/published/replied to, and no account or moderation state was changed.

Final captures in `D:/codex-artifacts/dziri-story-flows-20261027/` include `consumer-reply-retry-375.jpg`, `consumer-story-arabic-320.jpg`, `native-story-arabic-320.jpg`, `native-story-375.jpg`, `native-story-french-430.jpg`, `consumer-french-older-backend-430.jpg` and `consumer-audio-completed.jpg`. Files containing `before` and the earlier desktop candidate are not final visual proof. The temporary fixture and viewport override were closed/reset; the ordinary signed-in preview was preserved.

## Feature/screen/flow register delta

| Audit item | Local status | Required acceptance still open |
| --- | --- | --- |
| T01 / SC35 / F10 — Story viewer | Readiness, progress, pause, retry, expiry and playback ownership implemented in both clients; synthetic behavior/rendering verified | Physical media/IME/accessibility and actual two-client visibility/revocation, interruption and expiry |
| T02 / SC36 / F10 — compose/reply | Cancel-safe upload, supported audiences, immutable reply/reaction attempts, honest capability gate and recipient context implemented | Authorized publication/reply/retry across clients, native camera/gallery/background interruption, full audience/media/Circles parity |
| Safety/request/moderation | Previous canonical transaction protections preserved; blocked snapshot exposure fixed | Reviewed backend release plus independent authorized two-account/moderator acceptance |
| Push/background incoming calls | Explicit owner hold preserved | Separate authorization and provider/device qualification |

Required remaining Story work includes canonical custom/close-friends roster/geographic/tier/parental readers where approved, full creation/media/background/Circles journeys, captions/reporting and the original plan's acceptance matrix. Voice Story creation was not added; the viewer handles existing voice Stories. No full parity percentage is inferred, and historical audit statuses are unchanged.

## Release and package boundary

All server/frontend source remains local. New reply controls require the prepared backend capability and safe reply transaction; installing the APK alone does not enable those unpublished server changes. No Convex/Vercel release, master push, live action, provider setup or phone installation occurred. Physical tests remain outstanding because the phone is remote.

The artifact `DM-0.1.0-story-flows-arm64-compact.apk` uses the existing internal test-signing identity, package `com.dziri.messenger`, launcher label `DM`, version `0.1.0` / code `1`, ARM64. Signature verification and 16 KiB alignment passed. It is not a Play Store production-signed release. Final bytes/hash and owner-only Drive readback are in `story-flows-verification.json` and the artifact directory's `verification.json`. Preserve previous packages for rollback. The goal remains active.

Private APK: [DM Story flows build](https://drive.google.com/file/d/1lR7TKBcblZvKODEqMwbPl_d2Ja9ZXgJI/view?usp=drivesdk). Drive readback confirms 31,278,267 bytes, Android package MIME type, owner-only permission and modification time `2026-10-27T21:31:25.023Z`. SHA-256: `42da0c9cf908b7c84a78aee959cd29ccc2fc987e1318e866fb1f6caf0f5a26b8`.
