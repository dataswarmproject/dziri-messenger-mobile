# Business Marketplace receipt adoption and scope isolation

2026-10-28. Overall goal remains active. This extends `marketplace-wiring-20261028.md`; it is local implementation and verification, not production or physical-device acceptance.

## Implemented

Business Marketplace now uses the same explicit-ID, measured visibility, focus/connectivity, active dwell, retry and cancellation logic as Consumer. The DOM hook moved into the dependency-declared `@dziri/ui/messenger-receipts` entry; its runtime body is unchanged, verified against the preceding Consumer build. Consumer retains its personal preparation/summary adapter and reuses the shared hook. Business imports the package, not another app's components.

The canonical Marketplace transport now carries explicit company as well as store context. Its local identity binds those fields, so a queued observation cannot be dispatched through a newly selected company's transport even before a fresh detail response. Read/delivery requests retain the opaque server authority digest and captured actor/sharing generation. Missing, revoked or stale context enables no legacy loaded-history fallback. All store-team messages remain excluded from incoming observations.

Business chat remounts its local draft/reply/edit state on account, workspace, store or conversation change. If the current account no longer matches the boundary's verified viewer, the old conversation and composer stay hidden until authority refreshes. Queued old DOM observations cannot read the replacement scope. The stale `setShowEmoji` call that prevented sending was removed; failed-send draft preservation, duplicate-send prevention and older-history loading still pass.

The store's side now controls outgoing bubble/receipt presentation for messages written by any employee. Actual sender ownership separately controls edit/delete actions; another employee's messages do not acquire author controls. Existing trusted parts events retain their immutable action restrictions. Native Chatwoot layout, authentication, credentials and customer/staff separation were not changed.

## Verification

- Full Business UI suite: 711 tests across 79 files. The focused actual chat/inbox file has 11 cases, including delayed visible reads, company payloads, empty/unknown context, queued callbacks, scope/draft reset, pending viewer refresh, author rights, failed sends and duplicate prevention.
- Consumer scoped UI: 182 tests across 29 files. The shared hook/controller/transport tests retain the existing observation, resize, sharing and recovery behavior.
- Standalone: 99 UI tests, 58 domain tests, typecheck and isolation/consistency passed after syncing the checked shared contract. Android/iOS/web export passed; no APK was built or installed.
- Normal Consumer and Business builds passed, including their type checks (270 and 18 static pages respectively, plus compiled dynamic routes). Temporary build configuration edits were checked and restored byte-for-byte. Consumer compiled source maps match the current shared hook, transport and wrapper. Business source maps are not enabled by its local build configuration; its normal build and actual page fixture provide the stated evidence, without claiming byte-matched Business source maps.
- Browser checks used the actual Business chat page and components, actual translations/CSS, the shared hook and synthetic authority/message adapters. At component widths 320/375/430, with EN/FR/AR and light/dark, only visible incoming messages were read. Switching account hid old chat/draft; refreshing authority restored an empty draft. Revocation removed the chat, and restored access allowed current/older visible history. Other employees' store messages rendered outgoing without edit/delete controls. The clean final run had no console errors. These are desktop component fixtures, not real accounts, a phone viewport or physical/native proof.
- The Business test configuration's stale UI subpath aliases were repaired so the full suite resolves the actual brand/expression/receipt modules. No tests were removed or weakened to obtain the full result.
- No backend implementation changed in this slice. The new manifest checks the preceding recorded backend source hashes; the earlier 380-case backend results are historical, not rerun or a certification of unlisted files.

Evidence: `business-receipts-verification.json` and `D:/codex-artifacts/dziri-business-receipts-20261028/`.

## Remaining core work and release limits

Private Marketplace reaction-notification cleanup must become independent of incoming-message reads: a conversation containing only outgoing messages produces no incoming read command. Qualify that cleanup with zero incoming messages, more than 100 notifications, failure/retry and account/grant/focus changes; do not manufacture public message reads to clear a private badge. Review bounded notification windows and the remaining support/community/channel private-read paths. Complete queued write-command actor/grant isolation and the original identity/session/recovery acceptance across the actual clients; local draft isolation is not proof of every asynchronous write path.

Legacy API call retirement still needs the reviewed upgrade/rollout contract. Discovery/family/privacy, media/Story/calling/security, actual two-account/moderator/device and signed APK/release requirements remain outstanding under the original goal. API generation retains its recorded Sharp Linux ARM64 blocker. Build-impact analysis conservatively requires all seven web projects because shared UI runtime metadata changed: Consumer and Business have new local build proof; the other five and actual last-successful deployed SHA comparisons remain release gates.

Push stays hard-disabled. No live communications, reports, account/moderator changes, database initialization/migration, deployment, schema/API publication, master push or APK/private-download distribution occurred. All existing authorization gates and the full remaining goal remain intact.
