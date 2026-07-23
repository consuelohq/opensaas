# automatic versioning release channels

branch: `task/os-distribution/automatic-versioning-release-channels`
stream: `stream/os-distribution`
task session: `tsk_e72fe1489158`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1579/automatic-versioning-release-channels
github pr: https://github.com/consuelohq/opensaas/pull/1579
started: 2026-07-23

## acceptance criteria

- [x] Assign one automatic SemVer to a changed runtime closure, with explicit first-release seed validation and deterministic no-op behavior when the release fingerprint is unchanged.
- [x] Keep runtime `version`, `releaseFingerprint`, bundle identity, immutable artifact identity, Git tag, GitHub Release, GitHub Deployment, and channel manifest in consensus while allowing `schemaVersion` to evolve independently.
- [x] Publish immutable runtime bundles and detached signatures once, with retry-safe/idempotent state transitions and digest parity between GitHub and Cloudflare surfaces.
- [x] Support protected `dev -> canary -> beta -> stable` promotion, explicit rollback by existing bundle ID, platform completeness, optimistic concurrency, source-in-main validation, and a manual stable approval boundary.
- [x] Expose fail-closed JSON/dry-run CLI commands: `publish`, `promote`, `inspect`, and `rollback-channel`.
- [x] Add dedicated GitHub Actions workflows for automatic dev publication and manual promotion/rollback without allowing PR jobs to mutate protected channel pointers.
- [x] Document release-channel operations and update package scripts without introducing a second runtime-bundle implementation.
- [x] Validate through focused TDD, the complete distribution suite, syntax/static checks, workspace review, and workspace verify.
- [ ] Push the independently reviewable task PR, request CodeRabbit, complete CI and Grok 4.5 review, post findings/dispositions, and merge only into `stream/os-distribution`.

## implementation summary

- Added a provider-neutral release state machine using Worker 02's canonical version-neutral `releaseFingerprint` as the no-op and allocation input.
- Added first-release seed validation, patch/minor/major intent, allocation reuse, immutable `consuelo-os-vX.Y.Z` tags, and one release-set ID for the complete platform inventory.
- Added strict consensus checks across runtime manifests, platform bundle IDs, archive digests, detached Ed25519 signatures, GitHub assets/Releases/Deployments, Cloudflare R2 objects, protected channel refs, and signed channel manifests.
- Added signed `dev`, `canary`, `beta`, and `stable` pointers with legal forward transitions, stable approval evidence, optimistic revision checks, channel history, verified rollback, and independent manifest `schemaVersion` migration controls.
- Added provider retry safety: authoritative remote-state preflight, exact-retry no-op, immutable digest comparison, nullable GitHub digest download-and-hash fallback, source-commit integration validation, idempotent provider ensures, redacted errors, and release-state commit last.
- Added JSON CLI commands (`publish`, `promote`, `inspect`, `rollback-channel`) that default mutating operations to dry-run and require explicit `--apply`.
- Added a publication preparer that verifies the three deterministic Worker 02 archives, signs each immutable archive identity, and emits one publication input.
- Added dedicated main-only publication, manual promotion, and manual rollback workflows using protected GitHub environments. Unchanged closures stop before version allocation/build/provider mutation. Workflow-run creation time is reused across retries so signed state remains deterministic.
- Added strict release-channel JSON schema, operator runbook, package scripts, workflow write-permission allowlisting, parity classification, and source-only runtime-bundle exclusions.

## test-first contract

- **Behavior under test:** Release assignment and channel pointer mutations are deterministic, immutable, retry-safe, signed, platform-complete, transition-gated, concurrency-safe, and consistent across GitHub/Cloudflare metadata.
- **Existing local pattern:** `packages/os/tests/distribution/runtime-bundle.test.ts` uses Vitest fixtures and direct Bun CLI subprocess assertions; Worker 02 provides the canonical bundle builder/verifier.
- **Red command:** `bun run --cwd packages/os test -- tests/distribution/release-channels.test.ts tests/distribution/release-channel-workflows.test.ts`
- **Observed red:** missing release-channel domain module, CLI, schemas, workflows, and integration artifacts.
- **Green expansion:** domain, CLI, workflow, provider retry/failure injection, schema, real three-platform publication preparer, and runtime source-boundary regressions.
- **No-test waiver:** none.

## files changed

- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-os-runtime-rollback.yaml`
- `.task/os-distribution/automatic-versioning-release-channels/*`
- `.task/tasks/os-distribution/automatic-versioning-release-channels.json`
- `packages/os/docs/distribution/release-channels.md`
- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/distribution/release-channel-provider.ts`
- `packages/os/scripts/lib/distribution/release-channel.schema.json`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/prepare-release-publication.ts`
- `packages/os/scripts/release-channels.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- `packages/os/tests/distribution/release-channel-schema.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/distribution/release-channels-cli.test.ts`
- `packages/os/tests/distribution/release-channels.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`

## key decisions

- `releaseFingerprint`, not Git history, decides whether a customer-visible runtime closure changed.
- Version allocation happens before build; the same source commit and fingerprint reuse the same version after retry.
- Channel manifests are mutable signed pointers to immutable multi-platform release records. Promotion and rollback never rebuild or relabel bytes.
- `schemaVersion` describes pointer format and is independent from runtime SemVer; format changes require explicit migration evidence.
- Release-domain behavior is provider-neutral and injectable. GitHub/Cloudflare command execution is an adapter with credentials kept in environment variables only.
- Provider state is committed last. A remote state with the target revision and identical canonical content is an exact retry no-op; stale or conflicting state fails before mutation.
- GitHub asset digest metadata is used when present. If absent, the exact release asset is downloaded and SHA-256 hashed before reuse.
- Protected channel refs may move only to source commits already integrated into `main`.
- Release orchestration and publication preparation are source/operator-only and excluded from customer runtime bundles.

## validation evidence

- Focused red phase confirmed missing release module/workflows before implementation.
- Domain and signing suite: 18 passing tests, including seed/no-op/allocation, consensus, platform completeness, detached signatures, legal transitions, stable gate, concurrency, rollback, tamper rejection, and secret redaction.
- CLI/provider planning suite: 5 passing tests for no-credential no-op planning, fail-closed mutation credentials, secret-safe errors/argv, and pointer-only promotion plans.
- Provider retry suite: 6 passing failure-injection tests for exact object reuse, conflicting GitHub asset digest, stale remote state, exact committed retry, source-in-main requirement, and nullable GitHub digest download/hash fallback.
- Publication preparer: real deterministic archives for `darwin-arm64`, `linux-x64`, and `windows-x64`; one release-set ID; three verified Ed25519 signatures.
- Workflow/schema contracts: protected triggers/environments/permissions, fail-closed state restore and tag discovery, deterministic workflow-run timestamp, no rebuild during promotion/rollback, strict schema version/fields.
- Complete distribution suite: 68 passed, 10 pre-existing Worker 04 lifecycle TODOs skipped (`trc_a672c521b144`).
- Post-review affected suite: 12 passed (`trc_5637c219a2f4`).
- Package syntax gate: passed (`trc_e87e78897e1e`).
- Script parity audit: passed (`trc_f85f84a40ed2`).
- YAML parse for all three workflows: passed (`trc_98c3771c4d2f`).
- Bun builds for `release-channels.ts` and `prepare-release-publication.ts`: passed (`trc_601ae7ed996b`).
- `git diff --check`: passed (`trc_bae5132708d1`).
- Native review initially found 19 mechanical error-handling findings; all fixed with behavior preserved. Final `review.run` reports zero issues (`trc_456c66879089`).
- Full workspace `verify` against `origin/stream/os-distribution`: publish-valid; review/static/spec checks passed, selected `@consuelo/os` package suite passed, DB guard passed, verify stamp written (`trc_56f78e2704c4`).

## issues and recovery

- Required `os.get_steering` was rate-limited; subsequent authenticated OS calls returned upstream HTTP 502. After repeated typed retries and bounded backoff, Ko explicitly authorized the authenticated workspace fallback. No native Git, unscoped repository shell, another computer, provider substitution, or legacy fallback was used silently.
- First `stream.context` raced concurrent remote-ref updates (`trc_532409d93e8a`). A narrow retry succeeded; `stream.sync` then updated the assigned stream (`trc_74aa7d6f21ed`).
- Several oversized edit payloads were rejected before execution (`trc_690c2947fd5d`, `trc_ab58ee29b17c`, `trc_d8d7e73ceb08`). Recovery split edits into smaller task-scoped typed operations; no partial file writes occurred.
- The new documentation directory did not exist (`trc_9a0d110a2c9a`); the first write failed without `mkdirs` (`trc_a23a6a8121b4`), then succeeded with explicit directory creation (`trc_2882c9bd66a9`).
- Early CLI tests exposed a Node/Vitest harness using unavailable global `Bun` and a synthetic provider inventory omission; the test harness moved to Node `spawnSync` and the fixture was corrected.
- Provider retry tests exposed platform-bundle-to-release-tag mapping and signature-asset fixture defects; both were corrected and all retry contracts pass.
- The real publication preparer test exposed PEM newline trimming (`trc_f605cf5521c9`); credentials now preserve bytes while rejecting blank values.
- Script parity audit found new source classifications and stale generated plist entries (`trc_dd09aa3803c6`); classifications were corrected and the audit passes.
- An attempted generic package `check` script did not exist (`trc_d2a82f1e1df0`); validation was realigned to the repository's documented syntax, review, verify, distribution, parity, YAML, and Bun-build gates.
- Workflow contract testing found permissive R2 state restore (`trc_fb380959342d`); restore now permits only a verified first-release not-found response and fails authentication/provider errors closed.
- Two calls used the wrong lifecycle tool name (`review`), producing a timeout and `WorkspaceReviewResponseError`; a later attempt to inspect `activity` also used an unavailable alias (`trc_033cc567f873`). The task skill was reread, the correct `review.run` route with stream base was used, and review completed.
- Correct `review.run` found 19 blocking mechanical findings: 16 async error-boundary rules and 3 catch typing rules (`trc_a47f83ae938d`). One broad fix script aborted before writing because a method signature differed (`trc_167239cb9e6d`). Smaller typed edits fixed every finding; final review is clean.

## notes for ko

- No install, update, reset, restart, or uninstall action was run on the Mac Mini or MacBook Air.
- Human read-only checkpoint after a canary release:

```bash
curl -fsSL "https://<release-host>/channels/canary.json" | jq '{channel: .payload.channel, version: .payload.version, bundleId: .payload.bundleId, platforms: [.payload.platforms[] | (.platform + "-" + .architecture)]}'
```

Expected result: valid signed canary JSON with the approved version/bundle ID and exactly `darwin-arm64`, `linux-x64`, and `windows-x64`. Updater signature verification must pass before any installation command is approved.

## improvements noticed

- Semantic exploration was stale for new distribution code; structured task-scoped reads/scans were more reliable.
- The workflow permission guard determines changed workflows from committed Git history, so it must be rerun after the first task commit to include newly added workflow files.
- `review.run` should be the only documented lifecycle spelling; the generic `review` alias fails opaquely.

## remaining publish sequence

1. Create and push the first task commit through `task.push`.
2. Rerun the workflow permission guard now that new workflows are tracked.
3. Update the task PR, request CodeRabbit, and wait for CI/review evidence.
4. Render and run the required Grok 4.5 review, post structured findings/summary and dispositions, fix valid findings, and rerun validation.
5. Remove `packages/os/.tmp-reviews/automatic-versioning-release-channels/` after posting.
6. Merge PR #1579 only into `stream/os-distribution`; do not promote the stream to `main`.

- 2026-07-23 02:29:58 write: `.task/os-distribution/automatic-versioning-release-channels/workpad.md`

## workspace-owned: files changed

- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-os-runtime-rollback.yaml`
- `.task/os-distribution/automatic-versioning-release-channels/*`
- `.task/tasks/os-distribution/automatic-versioning-release-channels.json`
- `packages/os/docs/distribution/release-channels.md`
- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/distribution/release-channel-provider.ts`
- `packages/os/scripts/lib/distribution/release-channel.schema.json`
- `packages/os/scripts/lib/distribution/release-channels.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/prepare-release-publication.ts`
- `packages/os/scripts/release-channels.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- `packages/os/tests/distribution/release-channel-schema.test.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/distribution/release-channels-cli.test.ts`
- `packages/os/tests/distribution/release-channels.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`

## workspace-owned: activity log

- 2026-07-23 02:29:58 fs.write: `.task/os-distribution/automatic-versioning-release-channels/workpad.md`

## workspace-owned: files read

- `packages/os/skills/task/SKILL.md`
