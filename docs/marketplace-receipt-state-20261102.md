# Marketplace aggregate receipt rendering

Local source checkpoint, November 2, 2026. DM consumes `marketplaceMessages:receiptState` only when conversation detail advertises `receiptEvidence: 1`. Older backends retain inline projection. Supported mode requires a current canonical Marketplace observation and an outgoing stored, non-deleted, unrestricted message that is visible while the app is focused, foregrounded and online. Marketplace and personal receipt queries are mutually skipped; opaque Marketplace thread IDs never reach personal APIs.

`null`, loading and suspended evidence omit status instead of reviving inline proof or guessing Sent. Pending local drafts retain their own status. The existing observer/contact identity and incoming-only acknowledgement path remain intact. Store-side display does not grant actual-author edit/delete permissions.

This matches the Consumer/Business source change in the owned `messenger-security-20261101` checkout and the local stored-evidence backend commits `e5d1c2c57` / `aa072c747`. No schema/function publication or live backend acceptance is implied.

Qualification: focused reproduction 32 passing / 10 failing before wiring, then 42 passing. Final full native UI suite 330 passing / 45 files; 78 domain/runtime regression cases; native TypeScript, changed-runtime-file ESLint and consistency checks all exit 0. Android, iOS and web exports succeeded with the existing `D:/DM-build-20261101` builder, dependencies, SDK/Metro homes and `dist-inbox` output. Exactly five runtime inputs were updated against the prior 1,016-input manifest; before/after source and builder hashes matched. The exported backend is explicitly synthetic. No APK was generated or installed.

Evidence: `E:/CodexArtifacts/dziri-journal-recovery-20261101/receipt-state-native-red-20261102.json`, `receipt-state-native-ui-20261102.json`, `receipt-state-native-types-20261102.json`, `receipt-state-native-checks-20261102.json`, `receipt-state-native-regression-20261102.json`, `native-receipt-state-source-inputs-20261102.json`, `native-receipt-state-export-result-20261102.json`.

Rendered physical/two-account/revocation/RTL/accessibility acceptance and coordinated release remain open. Marketplace Block UI remains disabled until its remaining enforcement/client gates pass. The full plan is unchanged. Personal push remains HARD_DISABLED; provider/background activation, deployment/schema publication, master push, spending and live-account actions remain held. The previously delivered private APK has not changed.
