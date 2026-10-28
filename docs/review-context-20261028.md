# Captured moderation review authority — 28 October 2026

Status: implemented and verified locally to the scope below. This follows the private Console review lifecycle and trusted-follow checkpoints. The full original Messenger goal remains active. Deployment stays held for billing and separate owner approval; personal push stays hard-disabled.

## Behavior

The real Console message-report page now captures the authenticated reviewer and current grant context for queue reads, evidence reads and decisions. The backend checks current permissions first, then the captured context, before returning private evidence or signed attachment links, looking up a previous command receipt, or applying a decision. A different authorized account cannot inherit an earlier account's command.

A durable optional user revision records effective operator grant changes, including status, roles, effective permissions, company scope and expiry. Canonical operator creation, edits, removal, legacy administrator role transitions and account merging use the same revision helpers. Same-transaction loss and restoration cannot revive an old review, including previously committed retries. Ordinary activity, notes, wallet-only limits, redundant permissions and metadata ordering preserve the review. Rollback also rolls back the revision. Invalid or exhausted revisions keep captured review unavailable while access can still be revoked.

The Console requires the new backend capability and a valid canonical reviewer context; it has no unbound fallback. It retires private review state when authority changes or the grant deadline elapses, rechecks on focus/visibility and before a decision, and does not revive the same expired page if the clock moves backward. Source and report-state labels are localized in English, French and Arabic.

The context is a consistency constraint, never a credential or substitute for current permission, scope or independent-review rules. Older API callers retain their existing current authorization checks through optional backend arguments. Existing immutable decision payloads and idempotency receipts are preserved. Consumer and standalone DM keep the same canonical reporting backend; their runtime sources are unchanged in this slice.

## Local verification

- **1,444 backend cases across 93 files pass**, including 45 new captured-review cases, the existing report flows, operator governance, account-state and access-expiry tests. Normal logging and four workers were retained.
- **952 Console interface cases across 82 files pass**, including 29 actual report-page cases. These cover capability/context admission, captured transport, account and grant replacement, elapsed and paused-timer expiry, focus, clock rollback, unchanged activity/order, retries and EN/FR/AR behavior.
- Official Convex generation and backend type checking pass. Code generation uses the CLI's read-only analysis path; running functions and schema were not published.
- One expanded expiry test failed by one millisecond on both the new source and exact previous committed operator source. The fixture now anchors its exact scheduler assertion to the actual mutation timestamp. Production scheduling and assertions remain unchanged.
- Normal Console production build and the unchanged bundle-budget gate pass for all **26 measured routes**. The report-route source map matches the final source exactly. The first build passed compilation/types but could not resolve a dependency from the cross-drive output directory; the normal build was repeated with the canonical workspace dependency path. No build or type-check gate was disabled. Compiler files retain their exact pre-build bytes.
- Browser verification used the actual report component, compiled Console CSS and synthetic adapters with no backend connection and disabled decision transport. Activity preserved the draft and acknowledgement; an account switch removed the review; French source labels were localized. At a **375 × 812 browser viewport**, Arabic showed `dir=rtl`, no horizontal overflow, and the elapsed 30-second grant removed evidence, draft and decision controls. No browser warnings or errors were observed. This is not physical-device or authenticated production acceptance.
- The preserved original 316-path source snapshot and empty index were checked, allowing only accumulated goal bookkeeping. All 41 recorded standalone runtime hashes remain unchanged. No native export or new APK is implied.

Evidence, exact source hashes and screenshots are retained under `D:/codex-artifacts/dziri-review-context-20261028`; the source-bound receipt is `review-context-verification.json`. Standalone retains a matching documentation copy. All eight deployment-hold tests pass, and automatic Vercel deployment remains disabled.

## Remaining acceptance

Live account/grant revocation, independent decisions and appeals require authorized accounts and actual cross-client evidence. Existing optional legacy API paths still use current authorization rather than the new captured contract. Other mutation/policy families, family enrollment authority, all remaining core/media/social/calling/security flows, physical lifecycle/recovery, affected release builds, last-successful deployment comparisons and a new signed private-download APK remain required by `remaining-goal.md`.

No deployment, schema publication, real report or decision, account/operator grant change, provider activation, push enablement or store release was performed. The isolated browser tab was closed, its viewport override reset and its local server stopped; user tabs and sessions were retained.

| Register area                     | Evidence added                                                                                            | Required remainder                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Reports / independent moderation  | Captured reviewer transport, durable grant reversals, elapsed expiry, local regression and browser checks | Authorized live decisions, revocation, retries and appeals |
| Consumer / standalone consistency | Shared reporting backend retained; unchanged runtime hashes verified                                      | Actual cross-client and device acceptance                  |
| Release                           | Verified source checkpoint for local and GitHub backup; deployment held                                   | All remaining build, deployment, security and APK gates    |

Receipt SHA-256: `56b78da5a450b8c1904b885749215edf2617900fdb88f3124dc6ba93ad105af8`.
