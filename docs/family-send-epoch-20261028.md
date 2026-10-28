# Family-policy captured-send checkpoint — 2026-10-28

The full original Messenger goal remains active. This closes the locally tested
captured-send reversal gap for canonical parent-control updates and child
enrollment/removal. It does not qualify family enrollment, production or devices.

## Behavior and ownership

The existing parent-controls writer now advances an optional durable account
revision when a setting used by personal-message gates changes, or when it repairs
the policy's parent binding. Enrollment and removal advance the same revision.
It survives deletion of the policy and membership history, so a policy that is
tightened and restored cannot revive a saved command. Counters do not depend on
timestamps. Invalid or exhausted state stays held without preventing restrictions
from tightening. Legacy absent/zero state preserves the previous digest shape.

Canonical personal write context includes the actor's revision and, for a DM,
the peer's revision. Both existing Consumer and standalone adapters receive the
same opaque context and use their existing held-intent review, without rebinding
or sending the saved message automatically. Both authenticated direct/proxy text
and media sends reject old context before message lookup, acknowledgements or
effects. A freshly authorized retry can acknowledge the existing immutable
message without duplication. Legacy unbound producers retain their existing
policy checks and remain a separate unfinished adoption task.

No-op settings, equivalent keyword order/case/duplicates, call-only and unrelated
profile/story settings preserve current context. An unrelated group participant
keeps their grant. Receipt epochs, private unread state and membership records
are unchanged. Public profiles expose no revision; thread details expose only
the existing opaque context, with no parent filter text.

Repeating removal of an already removed family membership now returns without
deleting a replacement policy. A separate failing regression proved that the
previous path erased that newer row. Authorization still runs before this no-op.

## Local verification

- Initial focused regression: **21 failures / 3 passes** across 24 cases.
- Final focused suite: **37 passing cases**, including same-transaction policy
  changes with identical timestamps, four send entrypoints, both participants,
  committed and unsent intent, enrollment/removal, no-ops, rollback, poisoned and
  saturated counters, endpoint agreement and public-profile privacy.
- Broader selected backend matrix: **1,183 cases across 75 files**, four workers
  and normal logging. Product source remained byte-identical after that run; the
  final focused run follows test formatting and ordering of one assertion.
- Consumer existing recovery/scope contracts: **27 cases / 3 files**. Standalone
  existing captured-send/review contracts: **14 cases / 3 files**. Client runtime
  source is unchanged; this is synthetic adapter proof, not live subscriptions.
- Runtime resolution check and normal official backend generation/type checking
  pass. Generation used the existing development analysis selection and did not
  publish running functions. Generated API references include the new helper.
- The build-impact helper classifies this backend/schema/test delta as affecting
  no Vercel app build. This comparison is against the preceding source checkpoint,
  not against a successful deployed baseline. No new web build, native export,
  signed APK or physical-device check is claimed.

Receipt: `family-send-epoch-verification.json`. Local evidence directory:
`D:/codex-artifacts/dziri-family-send-epoch-20261028`.

## Required remaining work and release hold

This introduces one optional technical field on existing accounts, with no
backfill, new participant table or new authorization role. No schema or runtime
publication occurred. Local/GitHub source backup remains authorized; all eight
Vercel project configurations still disable automatic deployment while billing
and separate release authorization remain outstanding. Personal push remains
hard-disabled. No real parent controls, family memberships or messages changed.

The existing `families.addChild` invitation/age/guardian authority defect remains
a family-policy release blocker. This consistency change does not legitimize
that enrollment mechanism or introduce a KYC provider. Trusted-contact
follow/unfollow reversals, time-window/age transitions, freeze/unfreeze and
read-only controls, Story/other mutation producers, broader recovery, and actual
authorized client/device/moderation acceptance remain required alongside the full
original [remaining goal](https://github.com/dataswarmproject/dziri-platform/blob/master/tasks/messenger-meta-parity/remaining-goal.md).

Receipt SHA-256: `a02ae7add763400daa4af97d3eebd61c21f845865c21cb68f5f5d00525420869`.
