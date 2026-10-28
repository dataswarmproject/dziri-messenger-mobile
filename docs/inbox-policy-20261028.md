# Support bridge permission and schema foundation — 2026-10-28

The required support bridge is now being implemented in the owned integration checkout. Six canonical metadata tables and strict current tenant/customer/staff/consent guards are present as source. Company membership checks are shared with existing messaging and shop permissions; linked shops follow the actual business-store link, not coincidental shared ownership. No second identity or message authority is introduced.

Current customer history is separate from permission to share with staff. Withdrawal, account or company closure, missing grants, invalid shop delegation, left membership and duplicate/malformed records close staff/transport access. Old captured connection/tenant generations cannot authorize after reconfiguration. New consent must bind the tenant authority revision; legacy rows without that binding retain customer history only and require explicit new consent before transport. Ownership transfer does not silently transfer customer sharing. Order context reloads actual tenant scope.

Local evidence: 62 focused cases; 1,735 selected backend tests across 105 files, including canonical Business shop/workspace regressions; 242 Consumer messaging UI cases across 33 files; 147 DM UI cases across 27 files; official backend codegen/module analysis and full types; eight deployment-hold checks. Behavioral failures for stale order context and tenant/consent binding were reproduced and fixed. Earlier module/config/schema setup failures are retained separately. The official codegen command only generated/analyzed types; it did not finish a push or change running backend code/schema.

All eight build-impact results are unaffected for this backend-only source delta. No frontend/native application runtime changed, and no web/native build or APK was repeated. The original 316-path snapshot and empty index, primary uncommitted bridge/schema work, and previously qualified native source hashes remain preserved. Consumer/DM UI tests are regression evidence; the support journey itself is not wired or accepted yet.

The four missing inbox/service endpoints remain required, together with canonical trusted-actor writers, explicit support customer/staff access, authenticated actor/target/generation consent, outbox/webhook hooks, current remote acknowledgements, exact receipt privacy/private-note exclusion, in-app-only notifications, privacy cleanup/export/retention and both client flows. See [support-bridge-integration-20261028.md](support-bridge-integration-20261028.md). This foundation is not a permanent-unavailable stub or a claim that support works.

The production dependency audit reports 105 findings (2 critical, 23 high, 62 moderate, 18 low). Lockfile/dependencies are unchanged; reachability and compatible remediation remain unresolved release work. No clean security or production acceptance is claimed. W04 / SC44 / F12 and the full original 92-feature, 45-screen and 14-flow backlog remain open under the governing remaining goal.

Source backup to GitHub master is authorized. All deployment, backend/schema publication, provider activation and live account actions stay held until separately lifted. Personal push and dependent background calling remain disabled. No new APK.

Receipt SHA-256: `a67ded3187f4e8745283d6951a55664751a3928e1ca63348773730f9a2e59b6d`.
