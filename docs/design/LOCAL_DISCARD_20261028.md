# Confirmed removal of a local queued copy — 28 October 2026

Status: implemented locally; final commands and source hashes are recorded in `local-discard-verification.json`. The full original goal remains active. Push remains hard-disabled. No backend/schema/API publication, real communication or moderation, account/grant changes, master push, phone operations, cloud build or new APK distribution ran.

## Behavior and boundaries

Consumer personal chat and standalone DM personal/Marketplace reviews now offer **Remove local copy** with a second explicit confirmation. The confirmation displays the original body/attachment reference and explains that the current draft stays and that an already submitted message is neither deleted nor cancelled. Cancelling keeps the review. Failure leaves it reviewable and reports that removal could not be confirmed, rather than claiming that the copy was removed or certainly retained on disk. Error wording follows a language change in EN/FR/AR.

Native removal passes the exact reviewed immutable command through the existing account-owned queue into its encrypted journal. Active transport cannot be discarded; queue retirement and duplicate removals are guarded. Only after the journal write is read back successfully does the visible queue release the entry. A concurrently added command and the latest draft body are preserved. An ID-only removal record prevents a later stale save from restoring the discarded command after reopening. Fingerprints include reply, attachment, expression and normalized captured send authority, excluding transient delivery status.

The existing version-1 journal remains readable; empty removal arrays are omitted. Removal records are limited to 400 per conversation, 20 journals and the existing 300,000-character plaintext bound. Records expire with the original command's 24-hour lifetime. A protected journal cannot be silently evicted to make room for another conversation; capacity failure stays explicit through the existing save-failure path. This is serialized, single-session journal evidence, not a cross-process transaction or physical-device recovery qualification. Device files, uploaded storage objects and canonical server messages are not deleted.

Consumer removes only the currently reviewed optimistic object in its current account/thread, refusing canonical confirmation, a replaced command or a retained callback from another owner. Synchronous owned row updates preserve another command queued in the same event. Its optimistic queue remains in memory; this does not add web process-kill persistence. The draft remains in its existing session store. The existing independent Blob presentation releases its URL on unmount.

Readable native conversations that have become read-only can still open local review and remove their own held command. The composer remains unavailable for sending and the read-only notice stays visible. Loss of full read/account access continues to show the existing unavailable screen.

## Local verification

Regression tests cover storage readback failure, stale-save resurrection, journal capacity, changed command identity, normalized authority ordering, in-flight/retired queues, draft edits and another newly queued command. The actual native queue hook/provider/vault is exercised across remounts without transport. Actual Consumer page tests cover selected removal, preservation of another command and stale account/thread/replacement callbacks. Both actual composers preserve the draft and make no send during confirmation. Native Marketplace is wired through the same queue command. Failure, cancellation, delayed selection and language changes have component regressions.

Final standalone qualification includes 136 UI cases across 27 files, 58 domain cases, types, lint, canonical consistency and Android/iOS/web exports. Consumer messaging plus the four existing adjacent UI files pass 255 cases across 36 files; the full Business UI suite passes 715 across 79. Normal Consumer and Business builds and exact compiler-file restoration and source-map comparison belong to the receipt. A preliminary build/export before the error-language fix is excluded from final runtime proof. No backend source was changed in this slice; only the previously recorded backend hashes are rechecked, rather than claiming a fresh backend suite.

Eight browser cases use the actual Consumer composer/pending/review/draft components in a synthetic disposable fixture: confirmation, cancel, uncertain removal, AR/320/dark, another account, FR/430/light, successful removal with saved-draft readback, and unavailable sending. Both narrow captures preserve 44px controls without horizontal overflow. The final fixture makes zero send calls, commits or server deletion calls and records no browser errors. The fixture's fake removal callback demonstrates UI behavior; the actual page and actual native storage/queue adapters have separate tests. Synthetic output instrumentation is not a private production account. Temporary browser tab/server are closed.

Artifacts: `D:/codex-artifacts/dziri-local-discard-20261028`. This establishes local source/build/component evidence, not authenticated two-client, actual moderation, physical attachment access, process-kill device or production proof.

## Remaining goal

Explicit local removal supersedes the discard gap recorded in `queue-review-20261028.md` for the tested views above. Broader resumable media recovery, web optimistic process-kill persistence, separate Story/forward/edit/delete/reaction/typing producers, durable policy reversals, actual authorized two-client/device/privacy/moderation acceptance, API/runtime qualification and every original media/social/calling/security/release gate remain required in `remaining-goal.md`.

The shared runtime still conservatively affects all seven web apps. Consumer and Business are the two locally qualified web targets in this checkpoint; the other five affected builds and actual last-successful deployed-revision comparison remain release gates. Existing APKs do not contain this work. Push and dependent background calls remain held.
