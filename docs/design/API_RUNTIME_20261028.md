# Backend API generation and dependency resolution — 28 October 2026

Status: the official local API-generation prerequisite is now qualified against the current backend source. The full original Messenger goal remains active. Push stays hard-disabled.

## Change and evidence

The canonical backend had a nested `convex/node_modules` junction to the separate installation at `D:/codex-artifacts/messenger-backend-runtime-20261025/node_modules`. The declared root installation and that installation have the same tested package versions, but resolve to different paths. Official generation reproduced invalid cross-drive component imports. The Convex external-package resolver also compares installation paths; listing Sharp as external does not make a shadow installation equivalent to the root installation.

A separate same-drive project copy included all 1,494 backend files, excluded the nested dependency link, and used the canonical root dependencies and package source. No environment files were copied. `convex codegen --dry-run --typecheck enable` passed, including server analysis of the expression image module. No module, validator or image inspection was omitted. The copied backend source and manifests matched the authoritative workspace before repair.

After preserving the generated files and recording the exact junction target, only the verified junction was unlinked. Its target installation and contents remain intact. Normal official `convex codegen --typecheck enable` then passed in the owned workspace. Both commands used the existing **development** deployment `honorable-moose-964` for analysis. Codegen does not publish running functions; no deploy command or deployment completion step ran.

The generated API declaration gained 40 existing source-module references (80 lines), including requests, reports, moderation, receipts and send authority. `api.js` is byte-identical. The other generated server/model files had line-ending-only changes; after equality checks their original formatting was restored. These are generated source types, not proof that the main production backend has these features. The existing expression module references do not re-enable GIF or sticker UI.

`node scripts/check-convex-runtime.mjs` now checks that Convex, component/auth and configured external packages resolve to the root installation without importing package code, making network calls or writing files. Six filesystem regressions cover equal-version shadow installations, auth export conditions, undeclared dependencies and missing entries. The real separate runtime was also rejected in the isolated fixture, then its fixture link was removed. Build-impact tests preserve direct-import rebuilds and fail open for opaque runtime imports; an unused inspection tool alone requires no app deployment.

## Verification and limits

- Official isolated dry run and canonical API generation: passed, full TypeScript checks enabled.
- Canonical chat/Marketplace/safety/deletion/export regression set: 506 passed across 36 files.
- Runtime/build-impact/lockfile/deployment-baseline tooling: 87 passed.
- Standalone native typecheck and Consumer/staff consistency check: passed. Native app implementation and existing export bytes were not changed by this slice.
- The read-only main-backend connection check passed seven anonymous contracts at `dashing-orca-24`. This proves reachability and anonymous boundaries, not authenticated staged-feature availability.
- The Consumer production build passed all 270 pages, including its normal type checks. Its first attempt stopped with `ENOSPC`. Three superseded completed Consumer webpack caches were removed only after path/type checks; their build IDs and manifests stayed unchanged. Source, output chunks, source maps, APKs and historical receipts were retained. Compiler files are restored and checked by the build runner.

The source-bound receipt is `api-runtime-verification.json`; retained artifacts are under `D:/codex-artifacts/dziri-api-runtime-20261028` and `E:/CodexArtifacts/dziri-api-qualification-20261028`. Earlier failure logs remain historical evidence. No decoder request using real user media or physical native image-runtime test ran.

## Next acceptance

This closes the previously failing **official API generation/server module-analysis** gate for the recorded source. It does not close the remaining original API/privacy contracts, policy/mutation producers, recovery, family enrollment authority, actual Consumer/DM two-account/device/moderation flows, other affected app builds, release review, deployed-revision comparison, production publication, signed updated APK/private download or physical acceptance. The existing Story-flow APK still predates the current source.

For subsequent source changes, first run `node scripts/check-convex-runtime.mjs`, then the official codegen command with the existing reviewed development selection and TypeScript enabled. Preserve generated-file changes for review. Never substitute `convex dev`, a deployment, omitted functions or weakened validation for this read-only qualification. All original provider, push, live-data and release holds remain unchanged.

| Register area | Evidence added | Required remainder |
| --- | --- | --- |
| Core / requests / reports / moderation API | Official generated references and complete server analysis | Authenticated production contract and actual two-client lifecycle |
| Build and release | Repaired dependency paths, regression guard, source-bound logs | Remaining affected builds, reviewed release and signed package/device gates |
| Consumer / standalone consistency | Canonical tests, native types and isolation check | Authorized real-account, recovery and physical acceptance |
