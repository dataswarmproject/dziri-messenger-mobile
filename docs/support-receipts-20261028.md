# Support exact receipts and private unread — 2026-10-28

Consumer and standalone DM now adopt support-specific exact observation and receipt rendering through the same checked contract. Authority is captured for both acknowledgement and state queries; tenant, connection, actor/member, contact and mapped-staff changes retire old callbacks. Existing personal/group/Marketplace contracts keep their previous key shape when no support authority is present.

Private unread counts only the opposite party. One currently authorized staff reader can supply business read proof for a customer message; staff reading coworkers' public replies cannot represent the customer. Current customer history remains privately readable after withdrawal, without publishing new delivery/read proof. Restricted or unlinked content cannot gain public proof. Privacy replays, revoked mappings, renewed consent and stale state queries are covered.

Only current exact public proof queues message.receipt through the existing signed leased worker. Read-before-remote-ID binding is reconciled in bounded batches after the exact message acknowledgement. A stronger remote read acknowledgement may satisfy a delivery operation without creating canonical public read proof. Actual Rails status-only webhook echoes are excluded from canonical content handling, preventing erroneous content-actor retries. The actual staff REST viewport still needs a canonical per-message producer.

Final local checks: 1,872 backend cases/113 files; 261 Consumer UI/34 files; 164 native UI/28 files; 58 native domain/recovery checks; fresh official generation/full backend types; native types/lint/consistency/receipt contract; eight deployment holds. Seven normal web builds pass, including 26 unchanged Console route budgets. Android/iOS exports pass. A real browser fixture using the actual shared observer and Arabic synthetic rows recorded two new-authority reads and zero stale reads. This is not live Rails, actual two-account, full-app design or physical-device proof.

The first Consumer build failed to resolve already declared installed sharp from isolated output. Its output/logs remain; a separately named normal retry passed after restoring dependency lookup through a junction. No package/lock/import/type-check bypass changed. All previous build targets, original 316-path source/index and concurrent primary bridge/schema remain preserved. Source and final evidence hashes are sealed in the receipt.

W04/SC44/F12 remain open: actual tenant/staff setup, acknowledged sync and native handoff, staff viewport receipts, media/reply metadata, legacy reconciliation, Marketplace, remote privacy/lifecycle and authorized interoperability are required. Dependency findings remain release work (root 105, including 2 critical; native production 8, including 4 high). All original feature/security/family/client/device/recovery/release/signed-APK gates remain active.

Local and GitHub master source backup is authorized. Deployment/schema/provider/real-account operations remain held; bridge transport stays default-off, personal push hard-disabled and dependent background calls held. No new APK or deployment baseline refresh occurred.

Receipt SHA-256: `d8ead1d8231c59e3f20c7b3fc1787fe5085354125c73988141bee56a822e4d04`.
