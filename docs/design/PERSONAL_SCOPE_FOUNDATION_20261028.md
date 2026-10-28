# Captured personal-send authority foundation — 28 October 2026

Status: the canonical contract is implemented and tested locally. Client producer adoption is still required. The full goal remains active; personal push stays hard-disabled. No production/schema/API publication, real messages or moderator actions, master push, cloud build, new APK or phone operation ran.

## Canonical contract

Direct and Messenger-proxy text/media sends accept an optional `commandContext` with expected actor and an opaque authority digest. This is a consistency constraint, never authorization: current active account, thread membership, workspace access and existing contact/request/family/moderation policies still govern each operation. Captured identity and authority are checked before command lookup, acknowledgement, unread fanout, media/catalogue effects and message insertion.

Thread detail projects the context over the authenticated actor's durable account revision, thread identity/type/encryption/company, membership row and join epoch, membership role and a new optional `sendRevision`. Workspace threads also bind the company/owner lifecycle revision and company-membership row/role/revision. There is no timestamp dependency. Invalid or exhausted revisions have no projected context and fail bound sends.

The only audited in-place role-editing path is `messaging/groups.updateMember`: promotions, demotions and both sides of ownership transfer advance `sendRevision`. A no-op role assignment does not. Revocations remain possible even with a corrupt/exhausted counter; that grant becomes ineligible for a bound send. This revision is separate from receipt/private-unread epochs and does not erase those records. Creation paths establish fresh rows; existing rejoin paths use `restartReceiptEpoch`, and replacement row IDs distinguish new grants. The audit covered messaging threads/groups/requests and workspace salon/channel/focus-room membership producers. Canonical account/company lifecycle revisions reuse the existing sourcing-authority writers.

The send context is excluded from payload idempotency hashes. An old context cannot acknowledge a committed send after revocation/regrant. A newly authorized context can acknowledge the same immutable committed payload without creating a second message. This server behavior does not authorize a client to silently replace a saved context. Existing unbound callers and the transaction-local Story reply writer remain compatible and are **not** qualified against stale captured intent. No new personal-send capability is advertised yet.

The contract binds account/membership/workspace authority. It does not establish durable invalidation for every reversible contact/family/request/thread-policy transition. Current policies are rechecked at execution; that wider transition inventory, plus other mutation families, remains required.

## Local evidence

The first valid RED run had 13 failures because thread detail provided no captured write context. The initial fixture omitted a required timestamp and the initial runner used an incompatible Node runtime; both setup errors were corrected before recording that RED run. The final dedicated suite has 17 cases. It checks four text/media direct/proxy entrypoints, another active member's account, same-clock role loss/regrant including committed retries, removal/rejoin, replacement membership rows, ownership transfer, workspace role/replacement grants, canonical operator suspension/unsuspension, malformed/exhausted revisions, receipt preservation, no-op roles, legacy compatibility, and the one-introduction acknowledgement policy.

The broader selected backend run passed 353 cases across 30 files; its exact selection and terminal result are saved with the verification receipt. This is a new scoped run, not a claim that every test from an earlier 34-file receipt was rerun. Backend type checking, formatting and changed-source whitespace checks are recorded separately in `personal-scope-foundation-verification.json`. No client runtime changed in this slice, so earlier Consumer/Business/native builds remain historical receipts rather than new builds. Optional schema publication and the existing full API-generation/native-runtime gates are still outstanding.

## Next implementation and remaining acceptance

1. Add the canonical shared personal-write scope and localized stale-intent recovery contract; retain captured metadata in DM's encrypted outbox without rebinding restored or legacy entries.
2. Adopt it in both actual Consumer and standalone composers, with capability gating, account/thread/grant changes, upload cancellation, late completion protection and explicit draft recovery. Preserve search/scroll and compose namespace; do not remount the conversation list just to retire a composer.
3. Qualify direct/private-group/workspace/support producers and the separate Story reply transaction, plus frozen/read-only/request/contact/family reversals and queued non-send mutations. Keep unchanged existing policies and immutable retry identity.
4. Run current affected UI/domain/types/build/export and rendered checks after adoption, then authorized actual two-client and physical recovery acceptance. A synthetic server transaction is not evidence of process-kill recovery, actual cross-client convergence, production activation or a phone release.

All remaining original feature/screen/flow, moderation, privacy, media, social, calling/security, API-generation and release requirements stay open in `remaining-goal.md`. No optional provider or push decision changed.
