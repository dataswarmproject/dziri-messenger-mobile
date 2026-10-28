# Private moderator review lifecycle — 28 October 2026

Status: implemented and qualified locally to the scope below. The preceding API/runtime checkpoint was progress; its receipt is `43664795fd9801c708893bfb012fa87e8805751b652efd52c4068f2092071aee`. The full original Messenger goal remains active. Push stays hard-disabled.

## Behavior

Console's real message-report screen previously retained selected private evidence, the typed decision reason and changed-source acknowledgement when a different authorized operator replaced the current operator. Replacing the operator grant, changing effective permissions or changing grant-expiry metadata also retained the review. An earlier query error could leave the private queue's error boundary stuck for a newly authorized operator. Five reproductions failed before the fix; the browser fixture also showed operator B inheriting operator A's draft and acknowledgement.

The private queue/error boundary is now keyed to the canonical operator snapshot: user, grant, status, roles, effective permissions, company scope and expiry metadata. Changing that snapshot retires the entire local review, including selection, draft, acknowledgement, busy state and retry command identity. Ordinary activity heartbeats and locale changes preserve the current review. Reopening a report after an authority change starts with a blank reason and unchecked acknowledgement. A late failure from an old component cannot overwrite the next operator's review.

Canonical report evidence, moderation permissions, independent-review rules, fingerprints, idempotency and decision transport are unchanged. This is local private-view/decision-state isolation. Already-dispatched commands retain their existing server authorization; strict captured-actor transport binding, elapsed-time grant expiry, live revocation and actual multi-account moderation acceptance remain open. The screen's existing raw source-lane label also remains a localization follow-up.

## Verification

- Complete Console UI suite: **939 passed across 82 files**, including 16 new report-review cases. These cover private-query admission, account/replacement-grant/permission/expiry-metadata changes, activity preservation, stale private errors, late command failure, changed-evidence acknowledgement, stable retry IDs, safe attachment links, bounded pagination and EN/FR/AR direction.
- Normal Console production build and the unchanged post-build bundle-budget script passed after the fix. All **26 measured routes** satisfy their existing budgets. The actual report-route source map matches the final owned source, and compiler files were restored to their exact pre-build bytes. Source-map upload was disabled for these local builds.
- A pre-fix normal build and its original report source/chunks are preserved separately. The reviewed source delta adds only the authority key and its field list; it changes no layout or report payload.
- Browser verification used the actual report component and compiled Console CSS with synthetic read adapters and disabled mutation transport. It reproduced the old leak and observed the fixed account switch, activity preservation, French copy, Arabic grant reset and a fresh Arabic review. The final DOM has `dir=rtl`, empty reason, unchecked acknowledgement and disabled decision buttons; no horizontal overflow or browser warnings/errors were observed in this desktop fixture. This is not a physical/mobile viewport or authenticated production proof.
- Backend, shared Consumer runtime and standalone app sources remain unchanged from the preceding source-bound checkpoint. Their prior evidence remains limited to its recorded scope; no native export/APK rebuild is implied by this Console-only fix.

Artifacts, source snapshots, logs and screenshots: `D:/codex-artifacts/dziri-console-qualification-20261028`. The matching receipt is `console-review-verification.json`; a copy is retained in standalone's design notes.

## Remaining acceptance

This qualifies Console's local build and the tested private review lifecycle. Four other web builds required by the earlier shared-runtime batch remain: Shop, Circles, ID and Flexy. Actual last-successful deployment comparisons, Consumer/DM two-account and device/recovery flows, real independently authorized moderation/appeal journeys, remaining policy/mutation families, family authority, other approved features/security and the reviewed release/signed updated APK/private download all remain required under `remaining-goal.md`.

No production publication, master push, new APK, user-data migration, real report/decision, operator grant change, provider activation or push enablement ran. The temporary browser fixture was closed and its server stopped; user tabs and account sessions were untouched.

| Register area | Evidence added | Required remainder |
| --- | --- | --- |
| Reports / independent moderation | Private review remounts with account/grant context; actual-page regression and browser evidence | Captured-actor transport, elapsed expiry, live decision/revocation/appeal acceptance |
| Console release | Normal build, exact source-map match, existing budgets, full UI suite | Four other affected builds, actual deployment comparisons and reviewed release |
| Consumer / standalone consistency | Shared report backend and client sources preserved | Authorized actual cross-client and physical lifecycle evidence |
