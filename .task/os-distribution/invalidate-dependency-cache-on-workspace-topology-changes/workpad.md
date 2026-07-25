# invalidate dependency cache on workspace topology changes

branch: `task/os-distribution/invalidate-dependency-cache-on-workspace-topology-changes`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1661/invalidate-dependency-cache-on-workspace-topology-changes
github pr: https://github.com/consuelohq/opensaas/pull/1661
started: 2026-07-25

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-25 17:33:03 `review.run`: passed — OK
- 2026-07-25 17:33:12 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## goal

Prevent the shared Yarn install action from restoring a stale node_modules tree when workspace package paths or manifests change without a yarn.lock change.

## acceptance criteria

- [x] Add a failing workflow contract proving dependency cache identity includes workspace topology.
- [x] Preserve Node-version and yarn.lock cache segmentation.
- [x] Include root/package manifests and project metadata that change workspace layout.
- [x] Keep exact-SHA cache reuse and safe prefix fallback behavior.
- [x] Run focused workflow tests, strict review, and publish-valid verification.

## observed failure

PR #1651 moved the ESLint package from packages/twenty-eslint-rules to packages/eslint-rules without a yarn.lock delta. GitHub restored a node_modules cache keyed only by Node version and yarn.lock, skipped yarn install, and the workspace registry gate stalled while the same four suites passed locally under Bun 1.3.14.

## test-first contract

The cache key prefix in .github/actions/yarn-install/action.yaml must hash yarn.lock plus workspace-defining files (root package.json, package manifests, and project metadata). A package path move must therefore force dependency installation instead of reusing an old node_modules topology.

## validation evidence

- RED: `bunx vitest run packages/workspace/tests/github-workflow-policy.test.js` failed 1/5 because the cache key used only `hashFiles('yarn.lock')`.

## files changed

- `.github/actions/yarn-install/action.yaml`
- `packages/workspace/tests/github-workflow-policy.test.js`

- GREEN: GitHub workflow policy passed 5/5.
- GREEN: the composite action parses as YAML and exposes the topology-hash builder.
- GREEN: the repository topology fingerprint is deterministic (`928ecb3a3dc9ae4bce55105a8f966cb1796dcbfb`).
- GREEN: strict review found zero owned, pre-existing, or blocking issues (`trc_7a248e135ac0`).
- GREEN: full verification is publish-valid (`trc_4a981e6f9dc9`).

## remaining risk

- GitHub must prove the new cache prefix causes a miss and dependency installation on the Linux runner. The action retains exact-SHA cache reuse after that first healthy installation.
