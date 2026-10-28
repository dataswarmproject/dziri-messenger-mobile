# Marketplace observation foundation and viewer privacy

2026-10-28. Overall goal remains active. This is a backend prerequisite and a canonical privacy fix; Marketplace viewport/lifecycle parity is still required before activation.

## Implemented locally

Recent and paged Marketplace history now retain the buyer/seller side returned by the canonical conversation/store access check. The message projection previously performed a second check without the explicit store context. An employee who was also the buyer could therefore receive their private buyer-side read timestamp while viewing the same conversation as staff. Both history APIs now pass the reconciled side to the projection. The buyer still receives private unread bookkeeping, and the seller receives only consented public read evidence. This canonical fix serves Consumer, Business and standalone without duplicating their permissions.

Existing read/delivery mutations accept an optional observation containing `expectedActorId` and `readGeneration`. These are consistency constraints, never authority. The authenticated actor, active account and canonical conversation/store permissions remain mandatory. An observation from another account or an obsolete sharing generation fails before acknowledgement or reaction-notification writes. Invalid generations are rejected. Bound read calls require explicit IDs and retain the 100-ID transaction bound and whole-batch foreign-message validation. Legacy callers retain their existing behavior during preparation; they are not silently upgraded to the new contract.

The authorized conversation detail includes its own `receiptContext` with the authenticated actor and current sharing generation. This is preparation for the adapters, not a receipt capability announcement. No new client path or capability was activated in this slice, and no schema or existing data changed.

## Verification and limits

The first regression reproduced missing observation validation. A second regression reproduced the private timestamp leak in both recent and paged history. Both now pass. The new suite has 22 cases, including authorized account changes, same-clock off/on sharing, denied membership, suspension, wrong store, foreign/mass batches, private cleanup and retained consented evidence. The broader scoped regression passed 345 tests across 30 files, including personal receipts/requests/reporting, business-store access, workspace checks and erasure/export/retention. The verification manifest records final typecheck and source hashes.

This backend-only slice does not change either frontend bundle, native source, branding or push. No app rebuild, new APK, production publication, real messages, reports, moderator actions, account changes or master push occurred. Tests use synthetic records. Historical app/device/release evidence is not upgraded by these results.

## Required next slice

Complete a durable authority/revocation binding before enabling the new adapters. Current access denial is tested; a delayed observation surviving loss and re-grant is not yet invalidated by this actor/sharing-only context. Audit canonical actor/company/member revision triggers and immutable store/link identity, including all reversible authority writers, deletion/re-invitation, same-clock cycles and exhausted/invalid counters. Do not substitute wall-clock timestamps or a constant epoch for that requirement.

The completed observation must also bind the buyer/seller side and store/company context that produced it. A client transport ref must not combine an old observation with a newly selected seller scope. The server must reconcile the complete observation against current authority in the same acknowledgement transaction; an opaque key supplied by the client can constrain a verified grant, never create one. Existing sourcing-authority triggers may supply reusable persistent revisions, but their writer coverage must be established rather than inferred from the presence of fields.

Then wire both actual Marketplace producers to the same checked visible-ID/dwell/retry lifecycle. Consumer currently acknowledges loaded messages while the document is visible; standalone still uses the legacy MessageList acknowledgement path. Preserve buyer/seller/store context, private unread cleanup, cancellation on focus/connectivity/account/access change, batches over 100 and failed-command retry. Marketplace must keep its own message/state endpoints rather than passing its IDs to personal thread APIs. Verify real components and required authorized two-client/native flows before release.

All other original goal requirements, API-generation/native-runtime issues, remaining affected-build qualification, production/device acceptance and release authorization gates remain open. Push and dependent background incoming calls remain held.
