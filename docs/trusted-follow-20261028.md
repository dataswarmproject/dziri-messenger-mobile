# Trusted-contact captured-send checkpoint — 2026-10-28

The full original Messenger goal remains active. This closes the locally tested
canonical follow/unfollow reversal gap for captured personal messages, with the
existing Consumer and standalone held-intent contract.

## Current behavior

Canonical follow/unfollow observes effective two-way family contact access before
and after changing the authenticated person's follow edge. A genuine access
transition advances the existing indexed pair authority, so removing and restoring
trust cannot revive a saved command, even in one transaction with the same clock.
Both participants' direct/proxy text and media commands reject the old context
before acknowledgement or effects. Fresh, authorized retries preserve immutable
message identity and cannot duplicate an already committed message.

Unrestricted/adult follows, no-ops, redundant same-family follows, inbound follows
by strangers, and changes hidden behind an existing private block do not advance
the pair. With two protected participants, the pair changes only at the effective
open/closed transition. One definite family restriction dominates ambiguous peer
controls; unrelated private edits do not churn an already closed binding.

Family contact reads now model unavailable authority explicitly, using bounded
indexed lookups. Missing, mismatched or duplicate controls and ambiguous membership
stay closed. A real privacy unfollow remains possible under that unavailable
family state and invalidates prior intent for later reviewed repair. Duplicate
follow rows require review: follow/unfollow returns an error and leaves the rows
unchanged instead of silently opening contact. This is no automatic data repair.

The revision remains opaque in existing detail responses. No new public grant,
permission, sensitive-data category, participant table, schema field or provider
was added. Existing pair deletion/export protections and receipt/unread epochs
are preserved. Client runtime source is unchanged; both actual detail endpoints
project the same replacement context to their existing adapters.

## Verification and baseline diagnosis

- Initial focused regression: **19 failures / 5 passes** across 24 cases. A
  separate red case proved definite restrictions must dominate ambiguous peer
  controls. Final focused scope: **35 passing cases**.
- The expanded existing follow/activity matrix initially failed eight cases.
  An isolated Vite loader substituted exact `edf38eac2` source for both changed
  pre-existing modules, without changing working source. Its load trace confirms
  both overrides. All eight failures reproduced against that baseline.
- Three existing fixtures were corrected: playback begins after actual server
  receipt issuance; experiment timing follows recorded server events/expiry; and
  a private-Story reaction explicitly rejects with zero reaction/notification
  effects. Expansion limits, exact 72-hour snooze, post-expiry denial, paid and
  audience restrictions remain asserted. No production recommendation,
  experiment, notification or Story rules were changed to make tests pass.
- The final selected backend matrix passes **1,298 cases across 87 files**, four
  workers and normal logging, with no scheduled transaction/teardown errors.
  Consumer existing scope/recovery: **27 cases / 3 files**; standalone: **14 cases
  / 3 files**. These are synthetic checks, not actual cross-device observation.
- Runtime resolution and normal official generation/type checking pass against
  the existing development analysis selection. No running functions were
  published. Generated references include the new internal helper module.
- Every new lookup is indexed and bounded; there is no participant fanout or
  pair write for ordinary adult follows. This is source-level cost review, not a
  production latency benchmark. The build-impact helper finds no affected web
  app for this new backend/test delta relative to the preceding source commit;
  deployed-revision comparison and the full release matrix remain distinct.

Receipt: `trusted-follow-verification.json`. Local evidence:
`D:/codex-artifacts/dziri-trusted-follow-20261028`.

## Remaining scope and holds

Family enrollment invitation/verified-age/guardian authority remains a release
blocker. Schedule/time-window and age transitions, frozen/read-only operational
controls, Story/other producers, captured account/grant transport for other
mutations, actual authorized client/device/privacy/recovery/moderation acceptance,
and the complete original feature/security/release/APK plan remain required.

Local and GitHub source backup remain authorized. All eight Vercel project
configurations still disable automatic deployment pending billing resolution and
separate release approval. No schema/runtime publication, real follows/messages,
family/account edits, moderator actions, provider activation, native export or new
APK occurred. Personal push and dependent background calling stay held.

The full [remaining goal](https://github.com/dataswarmproject/dziri-platform/blob/master/tasks/messenger-meta-parity/remaining-goal.md)
remains authoritative; no full family, device or production acceptance is claimed.

Receipt SHA-256: `627d9182eed0b4410f1f97af6c4635b7193538c73dc33c459ae6edc6150881e7`.
