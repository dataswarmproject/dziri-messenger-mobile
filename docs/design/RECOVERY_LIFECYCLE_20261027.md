# Core recovery lifecycle checkpoint — 2026-10-27

## Current-state reconciliation

The preceding goal turn made progress by creating the active goal and consolidating the backlog. Existing encrypted draft/outbox persistence, stable retries, local account namespaces, actions, history search, requests/reporting, and media flows are already implemented locally. Phone process-kill recovery, sustained two-account/device behavior, deployed role revocation and release remain unqualified. Do not redo those completed implementations or mark their external acceptance complete.

Current source inspection found a concrete reliability gap in the standalone outbox: persistence could finish after its owning conversation was unmounted and still invoke transport. Sign-out waited for cache cleanup without first suspending existing queues, so delayed persistence could start a send during logout. Two focused hook regressions reproduced both failures before the fix; Consumer already cancels late upload completion and scopes its draft acknowledgements.

## Implementation

- `src/dziri/outbox.ts`: activation epochs invalidate storage-waiting dispatches and late transport results. Deactivation accepts no new commands and does not publish late completion. Interrupted commands retain their immutable IDs/payloads for explicit retry. React development remounts can reactivate safely without reviving an old asynchronous attempt.
- `src/dziri/use-outbox.ts`: each queue registers its cancellation for logout, deactivates on scope change/unmount, and binds visible queue/readiness/error state to the current instance. An older queue cannot overwrite a newer conversation or account’s UI.
- `src/dziri/local-messages.tsx`: sign-out suspends queues synchronously before awaiting storage cleanup. The provider also keys its child subtree by account/deployment, protecting callers that omit a parent key.
- Consumer code is unchanged: its existing draft/account isolation and upload-unmount cancellation implement the same no-late-dispatch behavior. Eight matching Consumer regression cases passed.

A request already handed to the network cannot be unsent by this fix. Server-side identity, permissions and message idempotency remain authoritative; this change prevents a storage-waiting operation from starting transport after its owner is gone.

## Evidence

- RED: two new hook failures in `.codex/recovery-lifecycle-red.log`.
- GREEN: 58 standalone domain tests and 55 standalone UI tests pass, including explicit recovered retry, delayed storage, leaving, synchronous logout cancellation, actor changes without a parent key, scope changes, late failure isolation and StrictMode.
- Standalone typecheck/lint and web/Android/iOS exports passed. No new dependency or backend function was introduced. Consumer and Console require no new build for this standalone-only source change.
- A real browser loaded the actual hook/provider/queue code through an isolated synthetic in-memory adapter. Alice queued while storage was held; switching to Bob hid Alice’s queue; releasing storage invoked zero transports. Switching back restored the original failed command without sending. One explicit retry invoked the fake transport exactly once. No real messages, auth changes or external moderation actions occurred; browser error logs were empty.
- This browser fixture uses synthetic accounts and memory-only persistence. It does not prove physical native storage, process-kill recovery, real delivery or two-device authorization.

## Goal state and holds

This advances core-reliability slice 3a/3b. Required physical/deployed acceptance stays open, and the full goal remains active. Keep personal push hard-disabled, preserve emoji-only UI and existing branding, retain release/provider/live-action authorization gates, and keep Chatwoot staff unchanged.

## Phone package

APK assembly, integrity and private delivery receipts are recorded after completion in the checkpoint artifact directory `D:/codex-artifacts/dziri-messenger-recovery-20261027/`.

Final native assembly passed using compact ARM64 packaging; package/signing identity match the previous DM build, with signature and 16 KiB alignment verified. Local APK: `D:/codex-artifacts/dziri-messenger-recovery-20261027/DM-0.1.0-recovery-arm64-compact.apk`, 31,260,323 bytes, SHA-256 `3608dcf547ac09b5d9e9938d032ad1e04bdf9e9376136fb6eae7bb5f94d9b7fc`. Private package uploaded successfully; final readback is recorded in the artifact receipt.

Private APK: https://drive.google.com/file/d/1lU1EAFvfC9baAJB9Y-S89hxZIQLdqhPR/view?usp=drivesdk

Drive metadata confirms the correct filename, Android package MIME type, 31,260,323 bytes, modification time 2026-10-27T20:02:54.722Z and owner-only permission. No public sharing was enabled. Temporary browser fixture/server were closed; the ordinary Messenger preview was left untouched.
