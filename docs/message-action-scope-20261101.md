# Message action dialog ownership

Standalone DM uses the generated canonical `messageActionScopeKey` contract to
reset action state when actor, message, conversation/store scope or write
availability changes. Existing conversation adapters supply their local scope.
Commit-time lifetime guards withhold late success/error/copy/forward callbacks
from replacement UI. Receipt updates preserve an in-progress draft.

Final local proof: 21 action checks; complete 252-check / 37-file UI suite; 22
domain/contract checks; types, changed-file lint, upstream/brand/runtime
consistency; actual RN Web synthetic target-switch check with zero commands; and
Android/iOS/web normal Expo exports. The final export uses 947 verified runtime
inputs in `D:/codex-artifacts/dziri-message-action-scope-20261101/native-build-source`
and the unchanged pinned Expo entry, producing `native-export5`.

This is UI ownership, not mutation authorization, cancellation, remote version
checking, actual account/device acceptance or an APK. Consumer uses the same
canonical identity contract. The complete checkpoint and remaining M03/M04/F04
gates are in `tasks/messenger-meta-parity/message-action-scope-20261101.md` in
the Dziri monorepo. Push, deployment, provider and APK holds remain unchanged.
