# Contact reversals and queued sends — 28 October 2026

Status: implemented and qualified locally to the scope below. The preceding goal turn was progress: request-decision invalidation was recorded in receipt `d14db1e57f5a7b178da5710406d445947f48151ee8d9d870b1694acc050f09bf`. This checkpoint closes the tested personal contact block/unblock reversal gap. The complete original goal remains active. Push stays hard-disabled.

## Behavior

Both canonical block directions now advance one indexed contact-pair consistency record when effective DM access changes between open and closed. A block/unblock cycle in the same millisecond cannot revive a captured send, including a committed command whose acknowledgement was lost. Fresh current context still supports ordinary idempotent acknowledgement without duplication. Direct and Messenger-proxy text/media paths are tested for both authors, both block directions and unsent/committed intent.

The existing active `blockedUsers` table retains its semantics and physical unblock deletion. No tombstones were added to the widely consumed active-block rows. The new `messagingContactAuthorities` table contains only two normalized participant IDs and a bounded monotonic revision. There is one pair lookup and at most one counter write; no conversation/member fanout or scan is needed. Querying a conversation creates no pair/activity record.

Overlapping directional blocks change the counter only when combined access changes. Adding/removing a private second block while access remains closed, changing a reason or extended-block flag, and no-op unblocks do not publish another send-context change. Neither block direction, reasons nor timestamps are stored in this technical table. Existing current actor, membership, contact and parental authorization remains mandatory; the opaque hash is a consistency check and never grants access.

Personal DM contexts now bind the actual peer's account revision and membership identity/receipt epoch, plus the contact record identity/revision. Replacement membership or counter records cannot reuse an earlier context simply by preserving field values or time. Missing legacy records are read as zero; exhausted, invalid and duplicate records cannot become valid through a privacy unblock. Ambiguous technical state remains held without preventing the underlying block/unblock action.

Legacy DMs without a `dmPairKey` backfill are protected because enforcement follows current participants, rather than a single conversation lookup. Shared groups, unrelated DMs and their original send contexts remain unchanged by a pair block. Group/Marketplace/staff authorization policies were not widened. No message body, queue entry, membership or receipt/unread record is rewritten by block/unblock.

Existing Consumer and standalone DM use the same opaque context and already hold old commands for review without rebinding, retrying or clearing the current draft. Their app implementation sources and the prior native export bytes are unchanged. This backend change rotates prior DM contexts once when first applied; previously captured commands must remain held rather than being automatically transferred to the new context.

## Data lifecycle and privacy

The schema is widened with one technical table and three indexes. Existing rows require no backfill. No migration, deployment or schema publication was executed.

Both participant indexes are configured in canonical account cleanup. Cleanup refuses to erase an active account's consistency barrier; deletion-marked or missing accounts can be drained. A late block/unblock cannot recreate the record for a missing or deleting participant. Tests remove both indexed orientations while preserving another pair.

Shared consistency records include the other participant's private contact decisions and are intentionally omitted from participant export payloads. Canonical `_exportTable` returns no pair IDs, counter values, timestamps or private activity for this table. Existing user-facing block-list payloads retain their previous policy. This is a tested implementation boundary, not a broad data-retention or regulatory-acceptance claim.

## Local evidence

- The initial RED run had 42 failures and two passing existing guarantees across 44 cases. The later active-cleanup regression separately failed before its guard. Final focused scope: 48 cases. It covers reversal/idempotency, overlap privacy, no-op/metadata/receipt preferences, unaffected chats, legacy DMs, peer/counter replacement, poisoned/exhausted/duplicate bindings, pure reads, endpoint agreement, export privacy and account cleanup.
- Final messaging/Marketplace plus account-deletion-resume and export-artifact suite: 506 cases across 36 files. Full Convex type checking passes. Consumer messaging and four adjacent UI files: 256 cases across 36 files. Standalone full UI: 137 cases across 27 files. New/changed messaging helpers and the focused test pass formatting. The large schema/export/deletion files received bounded patches rather than unrelated whole-file formatting.
- Both detail endpoints agree on current contexts and send availability before, during and after a block. Existing client grant-change tests and retained runtime hashes remain separate from a real two-client subscription. Test data, block/deletion commands and storage were synthetic; no real messages, blocks, reports, moderation, exports, accounts or phone state were changed.
- The build policy helper classifies this backend/schema/test-only delta as requiring no Vercel app rebuild. Earlier unreleased shared-runtime changes still retain their five other app builds and actual deployed-revision comparison gates. Existing generated API files are unchanged against HEAD; the new data-model table is checked through schema-derived types. Code generation/publication/runtime qualification remains an original outstanding release requirement.
- Recorded client runtime hashes and native export bytes match the previous verified receipt. They are reused evidence, not new web/native builds or a new APK. No deployment, master push, cloud build, provider configuration or push activation ran. No matching Convex CLI watcher was observed during the final environment check.

Receipt: `contact-send-epoch-verification.json`. Artifacts: `D:/codex-artifacts/dziri-contact-send-epoch-20261028`.

## Remaining goal

This closes the tested captured-DM contact reversal gap under the canonical block/unblock paths. Legacy unbound sends, other producers (including Story replies and other mutation families), family/thread-policy reversals, broader media/recovery, actual authorized client/device/privacy/moderation proof and the complete original feature/screen/calling/security/release/APK matrix remain required. Current source has frozen/read-only gates but no normal canonical freeze/unfreeze control writer; that operational path and its durable lifecycle remain unqualified. Push and dependent background calling remain held.
