# Messenger test-runtime checkpoint — 2026-10-28

The full original Messenger goal remains active. This checkpoint supersedes the preceding scheduler diagnosis only; it does not complete the integration, broader backend matrix or release.

## Proven cause and local correction

The installed `convex-test` 0.0.49 bytes match the official registry archive and the checked-in lock integrity. Two minimal tests reproduce the real-timer failure: a scheduled mutation or action inherits the completed parent's transaction lock, commits its writes and then is marked failed with `Transaction already committed or rolled back`. Three fake-timer/instance-isolation cases also establish the surrounding behavior. The regression functions are virtual test modules, outside the deployable Convex source.

The official current package observed from the registry is 0.0.66. Its scheduler explicitly exits the nested transaction context, and its peer requirement `convex ^1.43.0` includes the installed 1.46.0. The registry archive integrity was verified before use. All five scheduler regressions pass with this version. The root development dependency and lock entry are pinned to 0.0.66; only six declaration/lock lines change. No product dependency version changes.

The candidate's old `node_modules/convex-test` junction was retained as `node_modules/.convex-test-original-link-20261028`; the replacement is a physical copy of the verified official package inside the candidate. The original worktree/runtime was not changed. Do not install or patch through the saved link. The original installed `dist/index.js` remains SHA-256 `2296b32fceb5cbae27765182f1210c96d507b2ba51f4a03ad07fd13b8857b77d`.

## Verification and remaining failures

- Default intercepted logging and four workers now pass **530 cases across 39 core Messenger/Marketplace, privacy/deletion, TV and runtime files**, with zero scheduled-job, transaction or worker-teardown errors. No logging suppression flag was used.
- The complete selected matrix initially reported 174 failing / 972 passing cases across 74 files. It no longer logged the previous scheduled-job/transaction/teardown failures. The new library pins monotonic server transaction time, exposing clock-sensitive DDIE cases. Do not presume every remaining failure is only a fixture problem; trace each actual contract.
- Three test files were migrated without altering product behavior or dropping assertions: capture future-key and rolling-window boundaries now use the server clock; consent revocation and explicit creator preference retain exact timestamp checks against server transaction time. All **71 cases across these three files** pass.
- The final complete matrix reports **170 failing / 976 passing cases, 10 failing / 64 passing files**, with no scheduled-job, transaction or worker-teardown errors. The full matrix and merge remain unqualified. The source-bound triage receipt lists every remaining failing file.
- The staged secret scanner and the production Convex/component/image-runtime checker passed. `npm ls convex-test --depth=0` confirms the declared candidate version. Formatting and staged whitespace checks pass.

Remaining files are audience measurement collection, feed delivery links, feed purpose epochs, recommendation-linked negatives, and signed-share issuance/view/order-scope/order-evidence/conversion-pair/conversion-ledger cases. Investigate server-versus-caller clocks, frozen-clock assumptions, and action/transaction boundaries while retaining consent, expiry, provenance, idempotency, money and privacy assertions. Shared signed-share fixtures account for many downstream failures. Do not relax production authority/expiry checks or return to a falsely green runtime to make the suite pass.

## State and holds

Continue in `E:/CodexWorktrees/messenger-master-integration-20261028/tawasool-mmogram`. HEAD remains `f0af35e64eb81aa9c6a8aec578f7fdbd56767b23`, with master `005b769bc9014748259e6227a71a6c1caf547ec6` staged in a pending merge and no unresolved conflicts. The merge is not committed or pushed. The earlier original Messenger checkout and native sources remain preserved. Historical checkpoint receipts must not be rewritten.

Earlier Consumer/UI/code-generation and seven-app build evidence retains its recorded scope. No new frontend/native build or API publication ran in this slice. Requalify affected outputs and complete the reviewed local merge after the remaining tests are understood and corrected. All original feature/security/privacy/policy/recovery, authorized real-account/device/moderation, hosting/release and signed-APK acceptance remains required. Push stays HARD-DISABLED; no provider configuration, real messages/reports/moderation, schema publication, master push or APK release ran.

Evidence: `D:/codex-artifacts/dziri-test-runtime-20261028`. The sibling verification receipt binds source/package hashes, all retained red/green/failing logs, current triage and preservation checks.
