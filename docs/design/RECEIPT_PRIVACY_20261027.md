# Receipt privacy after restriction changes — local slice

Core acceptance review found personal public receipts are projected from private unread/delivery cursors. A read while a contact is blocked can therefore become public after unblocking. The preference cutoff also compares message creation time rather than the consented observation, so a newly read old message can never receive a receipt after sharing is enabled. Same-millisecond preference toggles have no distinct epoch.

Required behavior: private unread cleanup continues while contact/sharing is restricted; only a fresh authorized observation advances a separate public cursor. Merely toggling settings, unblocking, changing parent controls or repeating an already-processed cursor never publishes past private observations. A later fresh consented prefix-read may cover earlier history under the existing cursor model. Read sharing uses a monotonic preference generation independent of the wall clock. Delivery remains independent of the read-receipt preference, but follows contact restrictions. Marketplace uses the same generation without exposing private `readAt`.

Additive optional metadata only; no historical private cursor is backfilled as public evidence. Legacy personal receipt visibility is unknown until a fresh authorized cursor advance; private unread state is preserved. No client payload/DTO shape change is intended. Timestamp ties and full visible-message batch acknowledgement remain required acceptance under C04, not silently declared solved by this privacy slice.

Use synthetic transactions only. Backend/schema/frontend publication and real account actions remain held; push stays hard-disabled.

## Implemented locally

- Personal membership rows now keep `sharedReadAt` / `sharedReadGeneration` / `sharedDeliveredAt` separately from private unread/delivery cleanup. `markRead` and `markDelivered` publish only a fresh private-cursor advance under current contact permission. Replaying the same cursor after unblocking, relaxing family controls or enabling read sharing cannot publish a past private observation. The same guards serve Consumer and standalone; neither client invents public receipts from private state.
- `getThread` projects only those public observations and rejects inactive requesters. Request acceptance clears both private and public cursors. Existing blocked-contact history/report access remains available; no messages or unread history are deleted.
- Actual read-preference transitions increment `readReceiptsGeneration` in the same transaction. Same-clock off/on toggles cannot revive a receipt from the previous generation. New authorized reads of old unread history can share a receipt; the message's creation time no longer has to be newer than the preference change. Delivery remains independent of the read-sharing toggle.
- Marketplace records the generation only on the first private read of each received message. An already-private read is never upgraded by a replay. Public DTOs omit internal generations and the reader identity; private read bookkeeping stays available only to the receiving side. Legacy explicit Marketplace public receipts retain their prior cutoff only in generation zero.
- Workspace directory/profile/search had separate raw-presence reads that bypassed Messenger settings. They now use canonical visible presence and active-account checks. Hidden/blocked/protected/stale activity cannot appear as online; hidden last-seen is null. Directory and public-salon ordering no longer depends on another person's private read cursor. Public profile names never fall back to private email addresses. Member listing is bounded and requires current thread/business access; search remains bounded public name/handle matching with `usedAi: false` and no provider.

Schema additions are optional metadata on existing tables, with no backfill or data migration. A legacy personal private cursor cannot prove public consent and is therefore not displayed as a receipt. A fresh authorized cursor advance establishes a new public observation. This conservative transition must be included in release review; it deliberately does not guess historical consent. Existing public query shapes are retained; the directory uses the existing offline status convention rather than inventing online presence.

## Verification and register delta

Final synthetic backend run: **240 passing checks across 22 suites**, including **15 new privacy cases**. This includes existing requests/reporting, retry, family contact, groups, Marketplace, Studio, workspace access, Business customer flows and the security lockdown suite. Intermediate focused runs are not counted again.

RED evidence: `.codex/receipt-privacy-red.log` reproduced eight receipt/privacy failures before correction; `.codex/receipt-public-presence-red.log` reproduced three public-surface bypasses; `.codex/receipt-privacy-account-red.log` reproduced inactive canonical receipt access. GREEN evidence: `.codex/receipt-privacy-all-verified.log` covers the final 240-check run. Current source/test/log hashes and remaining gates are frozen in `receipt-privacy-verification.json`.

Full backend TypeScript, explicit-file formatting and scoped whitespace checks passed on the final runtime source. No compile/test configuration, build policy or budget was weakened.

The repository's actual impact function reports no web rebuild for all seven declared Dziri projects. This is backend-only source/schema work and a local-delta check, not a release-baseline comparison or deployment approval. No unnecessary frontend/native rebuild or replacement APK is needed. Existing Story-flow native source hashes and the local APK are rechecked in the receipt; cloud download metadata is not re-queried in this slice.

| Plan/audit item | Local progress | Still required |
| --- | --- | --- |
| C04 — receipts/privacy | Public observations separated from private cleanup; consent generations; no retroactive publication on replay | Timestamp ties, exact visible-message batch acknowledgements and live cross-client focus/reconnect/revocation acceptance |
| B04 — Marketplace receipts | First-read consent generation shared with personal preferences; no internal metadata in DTOs | Authorized buyer/seller/staff cross-client acceptance and reviewed release |
| S08 — family/privacy | Relaxing a contact restriction alone cannot publish a protected private read | Secure enrollment/age/guardian authority, remaining schedule/privacy policies and physical/two-account acceptance from the family checkpoint |
| SC12 / SC32 — public activity/privacy | Workspace public surfaces honor canonical presence settings; no private-read sorting or email fallback | Full deployed public-profile/directory and account-switch qualification |
| N01 — foreground updates | Both clients consume the same canonical receipt projection | Sustained actual reconnect/resume convergence; no native push qualification |

Timestamp-prefix reads are not exact per-message visibility proof. A later fresh consented prefix-read may cover older messages, and equal creation timestamps still require the C04 batch/identity design and its implementation. This checkpoint does not close that gap, family enrollment or the full acceptance matrix.

No UI layout/type/RTL/brand/staff runtime changed. Push remains hard-disabled. No schema/API publication, Git push, provider activation, real messages, family settings, reports or moderation actions occurred. Physical/live two-client qualification remains open and the overall goal stays active.
