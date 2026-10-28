# Family schedule and retained sends — 28 October 2026

Status: implemented and verified locally. The previous goal turn made progress by committing and backing up captured moderation review authority. This turn addresses the remaining time-window send gap in the same canonical backend. The entire original Messenger goal remains active; deployment and personal push remain disabled.

## Behavior

Bedtime and the existing school-hours rule now use the same explicit Algeria clock as the repository's other regional calendar helpers, independently of the server/device timezone. The configured school rule remains September–June, Sunday–Thursday, 08:00–17:00; this change does not claim that fixed rule is an official school calendar or add holidays. Overnight and daytime bedtime intervals include their start and exclude their end. Empty, incomplete and equal-time legacy bedtime settings retain their previous inactive-window meaning. Malformed nonempty clock strings are rejected atomically by the authorized setter; corrupt legacy policy remains unavailable until repaired.

Captured personal text/media intent includes the actor's most recent scheduled lock period. A queued or previously committed command cannot revive after a lock starts and later ends, even when the boundary job was delayed. Both direct and proxy sends validate this before acknowledgement lookup or effects. A fresh permitted context can acknowledge the original immutable committed message without duplicating it. The ordinary peer's send context is preserved; incoming contact policy is not broadened or replaced.

The real Consumer and DM detail endpoints agree: during the actor's lock they return `canSend: false` with no writable context; after reopening they return a new context. Existing Consumer draft/retry handling and native local-review/recovery behavior keep the old command held. No application runtime or visual layout changes are needed in either client.

One optional private `parentalControls.scheduleNextAt` marker records the next boundary. Canonical control updates and new child-policy creation arm one successor job. A boundary changes that marker, invalidating subscribed detail queries that read the policy; it preserves parent configuration timestamps and account-wide family revisions. Duplicate, obsolete, early, removed-policy and rolled-back work cannot create a new grant or restart an old chain. Each callback rechecks current family/policy authority, reads bounded indexed rows and writes at most the one private policy marker. There is no participant fanout or public schedule metadata.

## Verification

- Initial new regression: **35 failed / 1 passed**. A separate loader substituted the exact previous committed `parentalControls.ts` under a UTC host clock; the legacy text send at 22:00 Algeria time incorrectly succeeded there. The fixed gate rejects it.
- Final selected backend matrix: **1,509 passing cases across 95 files**, four workers and normal logging, including **65 new time/calendar cases**. These cover direct/proxy text/media, unsent and committed retries, exact boundaries, overnight/daytime windows, the existing weekday/year/summer rule, overlap, missing/duplicate/mismatched/malformed authority, actual scheduled execution, delayed/duplicate/early jobs, metadata preservation, rollback, removed/disabled policies and bounded rollout continuation.
- Alternate host timezone: **21 focused cases pass** under `America/New_York`; the main selected matrix runs under UTC. The configured Algeria rule is independent of either host timezone.
- Actual Consumer composer/scope contracts: **23 cases / 2 files**. Actual DM conversation/recovery contracts: **15 cases / 3 files**. A new native test verifies that the composer is hidden while locked, local review remains available, and reopening does not rebind the old queue entry. The first version of that new test incorrectly expected a visible disabled composer; its corrected assertion checks the existing intended UI and required no application change.
- Official Convex code generation/type checking and a separate final-source backend type check pass. Existing eight deployment-hold checks pass. Generated API bindings include the new internal modules.
- The preserved original 316-path snapshot and empty index were checked, allowing only accumulated goal bookkeeping. All 40 other inputs from the recorded 41-path standalone contract snapshot are preserved; the one changed input is its owned conversation test. All standalone application source remains unchanged. No native export or APK rebuild is implied.
- The unchanged build-impact helper finds no affected frontend for this new backend/test delta relative to the preceding source checkpoint. Unaffected web/native builds were not repeated. This is not a comparison against actual last-successful deployments; that release reconciliation remains outstanding.

These are synthetic backend/component checks. They do not prove physical-device, live two-account, production subscription timing, real family authority, or actual cross-client recovery acceptance. Source-bound evidence, baseline loader trace and logs are retained in `D:/codex-artifacts/dziri-family-time-20261028` and `family-time-verification.json`.

## Release and remaining work

Publication is held. Before any later activation, independently approve and resolve the existing guardian/enrollment/age authority blocker, review the optional schema/function rollout, and explicitly arm pre-existing policies using the internal `messaging/familySchedule:armExisting` continuation with pages of at most 50. This rollout is prepared, never automatically run by deployment, and was not executed against real data. Confirm actual active-policy timers and subscribed Consumer/DM transitions using authorized accounts. Existing rows without a timer still have server-side current-time denial and captured-period checks, but their timed UI refresh remains unqualified until the reviewed initialization and live acceptance run.

The new internal job uses the documented durable [Convex scheduler](https://docs.convex.dev/scheduling/scheduled-functions); the [runtime's deterministic transaction clock](https://docs.convex.dev/functions/runtimes#using-randomness-and-time-in-queries-and-mutations) remains authoritative. No polling, notification provider, real message, family/account edit, backend/schema publication, Vercel deployment, spending or push activation ran.

Age/guardian authority, daily screen/prayer policy decisions, remaining thread-policy reversals and Story/other producers, all original core/media/social/calling/security/device/recovery flows and reviewed release/signed APK acceptance remain required by `remaining-goal.md`.

| Register area             | Evidence added                                                                           | Required remainder                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Core queued sends         | Shared time-period binding, exact current-time gates and immutable retry acknowledgement | Other producers/policies and actual recovery acceptance                              |
| Family controls           | Algeria calendar, bounded next-boundary invalidation and reviewed rollout function       | Guardian/age authority, live timers/client transitions and remaining policy controls |
| Consumer / DM consistency | Matching canonical detail shape and both existing held-command interfaces                | Authorized live clients and physical lifecycle proof                                 |
| Release                   | Verified source checkpoint for local/GitHub backup                                       | Billing hold, separate release approval, full acceptance and new APK                 |

Receipt SHA-256: `843c20fe55af4241af1e4d0c2bc0bae5882845e5ebaac757376ad17c92093ae1`.
