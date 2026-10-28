# Independent Marketplace reaction activity — 28 October 2026

Status: implemented locally in Consumer, Business and standalone DM. The complete remaining goal stays active. Push remains hard-disabled; no production publication, real-user mutation, deployment, master push or APK distribution ran.

## Problem and behavior

Exact message observations deliberately send only incoming, actually visible message IDs. The older reaction-notification cleanup was coupled to that message-read mutation, so an outgoing-only conversation could never clear its own private reaction activity and batches above 100 were not drained.

The new private conversation-view query and acknowledgement are independent from message delivery/read receipts. An authenticated, focused, online, ready conversation waits 500 ms, then clears only the current actor's notifications for that conversation in batches of at most 100. A one-row indexed head query detects further/new activity. Single-flight continuations yield between batches and retry transient failures after one second while the same view remains active. Leaving the view, backgrounding, loss of connection/support, account or authority changes and unmount cancel pending work and invalidate late responses. No dummy message ID, public read evidence or message timestamp is created.

Every transaction reconciles current authenticated identity and canonical conversation/store/company authority. Captured actor, full durable authority digest and preference generation are consistency constraints, never grants. Denied/stale query context returns null; denied mutation context fails before writes. Company/store constraints remain explicit for Business. Current read-sharing being disabled does not prohibit private cleanup, but an old sharing generation cannot be replayed. Existing notification schema/indexes and legacy mutation behavior are preserved.

The canonical shared receipt factory exposes a frozen Marketplace source snapshot, separate from personal thread identity. Consumer and Business share the same web hook; DM uses the same pure lifecycle and the list's actual focus/app/connection state. The server must advertise `features.reactionInbox === 1` before any client queries the new endpoint. An older backend quietly retains existing behavior, with no new unknown-function request or fabricated legacy-read fallback. Native Chatwoot isolation and expression/push configuration are unchanged.

## Verification

- Backend RED reproduced the missing independent endpoint; lifecycle RED and the actual native list RED reproduced absent cleanup. GREEN includes an outgoing-only conversation with 250 reactions, other actor/conversation isolation, idempotence, invalid/stale context, disabled read sharing, suspended account and Business role loss. Existing durable-authority regression coverage also passed.
- Current scoped checks: 388 backend cases / 33 files; backend TypeScript passed. Consumer: 200 UI cases / 32 files. Business: 712 UI cases / 79 files. DM: 100 UI cases / 21 files, 58 domain cases, TypeScript, changed-source lint and consistency passed. Actual Consumer and Business page tests exercise no-incoming-message cleanup and readiness/account boundaries; actual native list tests exercise focus/background and capability boundaries.
- Android, iOS and web exports passed. This is bundle proof, not an installed APK or a physical-device test.
- Normal Consumer (270 static pages) and Business (18 static pages plus dynamic routes) builds passed, including type checks. All four matching Consumer source-map entries agree with the current shared lifecycle, web hook/observer and Marketplace page. Business source maps are unavailable; its build and actual component tests are recorded separately. Both apps' compiler files were restored byte-for-byte by the guarded local wrapper. No build environment file was written or credential printed.
- The actual Business page ran in a desktop browser with synthetic data/grants at component widths 375 (EN), 320 (AR/dark) and 430 (FR/light). Nine observed cases cover initial 100/100/50 draining, offline, reconnect, older server, transient failure/retry, account mismatch, fresh authority, revocation and restoration. The final console error list is empty; measured narrow components have no horizontal overflow. These are component-width and synthetic-lifecycle results, not physical mobile viewport, live backend or two-account acceptance. Temporary browser tab/server were closed.

The final machine-readable checkpoint is `reaction-inbox-verification.json`; independent logs/artifacts are under `D:/codex-artifacts/dziri-reaction-inbox-20261028`. Earlier verification receipts are historical and are not overwritten.

## Open acceptance and next slice

The full goal remains in `remaining-goal.md`. Next: queued asynchronous writes must retain the initiating account/grant across disconnect/retry and account/role changes; inspect and prove this against both actual producers and canonical server writers. Native persisted outbox recovery, other lanes, discovery/privacy and actual authorized two-client/device cases remain required.

The legacy global `getUnreadReactionCount` still performs an unbounded scan. Its exact numeric contract and Business sidebar caller need a bounded canonical replacement or reviewed retirement; this slice does not silently cap that count or claim global badge scalability. Legacy message reads retain their compatibility cleanup; new clients no longer need to manufacture incoming reads to clear private activity.

API generation/runtime qualification remains an open release gate (existing global Sharp/analysis blocker). Local capability/API code is not deployed. Shared runtime impact conservatively marks all seven web apps affected; only the newly recorded Consumer and Business builds qualify here, with five other app builds and comparison to actual last-successful deployed revisions outstanding. Live moderation, production, physical phone, background calling and the previous full release/security/feature acceptance matrix remain unqualified. Push stays disabled and the previous signed APK does not contain these changes.
