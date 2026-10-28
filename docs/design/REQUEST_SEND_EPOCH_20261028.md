# Request decisions and captured sends — 28 October 2026

Status: implemented and verified locally. The previous goal turn was progress: it completed confirmed local-copy removal with the source-bound receipt `25353034df058dcc366e2d4f6e59acbba1630f24a743f86d224c6c23ef7f379c`. This checkpoint advances the remaining request-policy reversal gap. The entire original goal remains active and push stays hard-disabled.

## Corrected behavior

A captured introduction could previously survive a same-clock decline/spam → restore roundtrip. An unsent command could then become sendable again, and an old committed introduction could be acknowledged using the pre-decision context. Acceptance also left the sender's old context valid. The new regression file reproduced these cases before the change.

Canonical `messaging/requests:decide` now advances the existing membership `sendRevision` for both participants when request send access changes between pending, closed and accepted. It uses the existing saturating revision helper, so a corrupt/exhausted counter cannot become a valid grant again. The revision updates and the request decision share one Convex transaction. No new schema, API field, capability or migration was added.

Declined and Spam remain separate private recipient folders but have the same closed send access. Moving between those folders does not advance the sender's authority or publish a decision label. Repeating an unchanged decision is a no-op. All existing server-derived actor, membership, recipient, contact and acceptance checks remain in force. An access-changing decision on a malformed request with more than two membership rows fails atomically rather than partially invalidating grants. The invalidation reads at most three rows and writes at most two.

Direct and Messenger-proxy text/media sends already verify captured context before acknowledgement or effects. They now reject the invalidated context after restoration or acceptance. A newly obtained context still permits the ordinary current-policy operation, including idempotent acknowledgement of the original introduction without a duplicate. Legacy unbound calls retain their existing current-state authorization and remain outside captured-context qualification.

Decline/restore changes only send authority. Tests preserve both participants' private read/delivery markers, receipt epochs/revisions and exact-unread state. Acceptance keeps its existing recipient receipt reset/retirement behavior. Failed acceptance due to freezing or blocking rolls back the counter changes too.

## Consumer and standalone DM

Both existing detail endpoints expose the same updated command context. No app implementation changed in this slice. Tests of the actual Consumer page and standalone conversation inject the resulting sequence of access contexts: the old command remains held through denial/restoration, its original text/scope is retained, and it is neither retried nor rebound. The native current transport refuses the old context; read-only review remains available. A restore closes the obsolete selected review while preserving the source for another explicit review. Unchanged closed access does not unnecessarily retire that review.

This is local endpoint/component/queue-contract proof. The client tests use synthetic query responses; they are not a live two-client subscription or physical-device demonstration. No real message, request decision, report, moderation action, account/grant change or phone operation ran.

## Verification and impact

- Focused regression: 22 cases, covering same-clock unsent/committed introduction recovery, direct/proxy paths, both authors' text/media context after acceptance, private folder equivalence, unchanged decisions, receipt preservation, poisoned counters, malformed membership, transaction rollback and detail-endpoint agreement. The corrected RED fixture has 15 expected failures and five passing existing guarantees; an initial nested-fixture timeout is archived and excluded from the regression proof.
- Scoped messaging/Marketplace backend suite: 446 cases across 33 files. Full Convex type checking passes. Consumer messaging plus the four adjacent UI files: 256 cases across 36 files. Standalone full UI suite: 137 cases across 27 files. Formatting passes.
- App/shared/native runtime sources recorded by the preceding receipt, the schema and the prior verified native export bytes remain unchanged; generated API sources are unchanged against HEAD. Unlisted sources are not independently certified by that hash comparison. The receipt verifies hashes rather than treating earlier build output as a new build. The policy helper classifies this backend/test-only delta as requiring no Vercel app rebuild. No frontend builds, native exports, cloud jobs, APK rebuild, deployment, API publication or master push were run for this delta.
- This delta does not remove the five other app builds and deployed-revision comparisons still required by the earlier unreleased shared-runtime batch. The existing APK distribution and physical/live/API/security acceptance gates also remain open.

Receipt: `request-send-epoch-verification.json`. Artifact directory: `D:/codex-artifacts/dziri-request-send-epoch-20261028`.

## Remaining goal

The canonical request-decision → captured-send invalidation gap is closed to the tested scope above. Other durable contact/family/thread-policy reversals, Story replies, forwarding and other mutation families, broader native/web/media recovery, actual authorized two-client/device/moderation/privacy proof, all remaining feature/screen/calling/security work and the original complete release/APK matrix remain required in `remaining-goal.md`. Push and dependent background notifications/calls remain held.
