# Oversized-message receipt visibility — local checkpoint

2026-10-28. Overall goal remains active. This checkpoint extends the personal receipt UI checkpoint; it does not qualify every messaging lane or authorize a release.

## Change and behavior

Consumer and standalone DM share one visibility policy: a short message must be wholly visible; an oversized message qualifies when it covers at least 80% of the conversation viewport. Active read dwell remains 500 ms. Measuring 80% of the whole message made very tall messages impossible to read, even while the user viewed them.

Consumer now derives IntersectionObserver thresholds from the pane and measured message heights. ResizeObserver rebuilds those thresholds when the pane or content changes. Obsolete observers and queued resize callbacks cannot publish after a rebuild, account change or cleanup. Horizontal clipping also prevents a read. Existing actor, membership epoch, manual-unread revision, sharing-generation, focus, connectivity and retry guards remain in force.

Standalone uses FlashList's view-area threshold with the same constants and retains its whole-short-message special case. The existing observer controls read dwell. Its list remains mounted so receipt preparation does not reset search jumps or scrolling. The generated native policy copy and source manifest match the canonical shared source.

## Verification

- Consumer scoped UI: 172 tests across 28 files. Focused policy/controller/adapter suite: 20 tests, including oversized messages, resize, incomplete short messages, stale observer and account-change callbacks.
- Standalone UI: 94 tests across 20 files, including the actual installed FlashList ViewabilityHelper with the actual MessageList configuration; native domain: 58 tests. Types, changed-source lint and isolation/consistency checks passed.
- Consumer normal production build: 270 pages. Five relevant compiled source-map entries match current source. The build's temporary TypeScript configuration edits were checked and restored byte-for-byte.
- Standalone Android, iOS and web exports passed. This is an export, not an installed APK or physical-device acceptance.
- Browser checks used actual Consumer receipt/bubble components with synthetic data at component widths 320/375/430, light/dark and EN/FR/AR. Tall messages qualified; offscreen messages were not read. Manual-unread/sharing changes did not silently re-read already-visible content; fresh entry produced the new bound observation. French final console error list was empty. These were component widths in a desktop browser, not mobile viewport or physical-device evidence.
- Backend source was not changed by this slice. The verification manifest compares recorded backend hashes against the earlier 355-case checkpoint; those historical checks were not rerun here. It does not certify unlisted backend files.

Evidence: [viewport-receipts-verification.json](viewport-receipts-verification.json). Screenshots and copied logs: `D:/codex-artifacts/dziri-viewport-receipts-20261028/`.

## Next core slice and remaining acceptance

Marketplace is still inconsistent. Consumer's marketplace conversation page marks loaded incoming messages read when the document is visible, without a viewport/dwell observation. Native commerce uses MessageList's legacy delivery/read path. Canonical marketplace mutations validate conversation/store access and explicit IDs, but do not bind the observed actor and sharing generation like the new personal contract. The next slice must address both clients and canonical buyer/seller/store authority together, including role loss, delayed commands, privacy, retries and batches over 100; do not reuse personal receipt-state endpoints with marketplace IDs.

Other lane/support/community private-read cleanup, discovery/reader/family privacy, physical orientation and recycling, text scaling, actual authorized two-client/recovery and all original media/Stories/calling/security acceptance remain open. API reference generation remains blocked by existing Sharp Linux ARM64 analysis. The previous affected-build assessment requires the other six web projects and actual last-successful deployed revision comparisons before release qualification.

Push remains hard-disabled. No real communication, account/moderator action, migration, production/schema/API publication, master push, deployment or new APK/private-download distribution occurred. All original goal scope and authorization gates remain intact.
